-- Sandeep's requests, 11 Nov 2026. Safe to run more than once.
-- RUN THIS BEFORE the app update that goes with it: the new lead form sends the
-- Category, and saving a lead fails while the column does not exist.
--
-- 1. Category (SC / ST / General) on the customer.
-- 2. Channel partners and dealers may CHANGE the address on the warranty card of
--    their own customers, not only fill a missing one. The pincode is still
--    add-only for them, and every other field stays with the office.
--
-- To undo 2: run supabase/migrations/20261028130000_partner_customer_location.sql again.
-- To undo 1 (only if no lead has a category yet): alter table public.admin drop column social_category;
set lock_timeout = '8s';
begin;

alter table public.admin add column if not exists social_category text;
alter table public.admin drop constraint if exists admin_social_category_check;
alter table public.admin add constraint admin_social_category_check
    check (social_category is null or social_category in ('General', 'SC', 'ST'));

create or replace function public.set_customer_location(p_customer_id uuid, p_address text, p_pincode text)
returns table(full_address text, pincode text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    my_type text := coalesce(public.get_my_user_type(), '');
    my_branch text := lower(btrim(coalesce(public.get_my_channel_partner(), '')));
    my_name text := lower(btrim(coalesce(public.get_my_name(), '')));
    v_address text := nullif(left(btrim(coalesce(p_address, '')), 500), '');
    v_pin text := nullif(regexp_replace(coalesce(p_pincode, ''), '\D', '', 'g'), '');
    card record;
begin
    if v_pin is not null and v_pin !~ '^[1-9][0-9]{5}$' then
        raise exception 'Enter the 6-digit pincode.';
    end if;
    select a.id, a.full_address, a.pincode, a.channel_partner, a.sub_channel_partner, a.deleted_at
    into card from public.admin a where a.id = p_customer_id;
    if not found or card.deleted_at is not null then
        raise exception 'Customer not found.';
    end if;
    if not (my_type in ('admin', 'sales')
        or (my_type in ('channel_partner_office', 'channel_partner_office_manager', 'office2')
            and my_branch <> '' and lower(btrim(coalesce(card.channel_partner, ''))) = my_branch)
        or (my_type = 'agent' and my_name <> '' and lower(btrim(coalesce(card.channel_partner, ''))) = my_name)
        or (my_type = 'agent2' and my_name <> '' and lower(btrim(coalesce(card.sub_channel_partner, ''))) = my_name
            and lower(btrim(coalesce(card.channel_partner, ''))) = my_branch)) then
        raise exception 'You can only change the address of your own customers.';
    end if;
    -- Partners may change the address (11 Nov 2026); the pincode they only fill when empty.
    if my_type not in ('admin', 'sales') then
        if v_pin is not null and nullif(btrim(coalesce(card.pincode, '')), '') is not null then
            raise exception 'The pincode is already on the customer card. Ask the office to change it.';
        end if;
    end if;
    update public.admin a
    set full_address = coalesce(v_address, a.full_address),
        pincode = coalesce(v_pin, a.pincode),
        updated_at = now()
    where a.id = p_customer_id;
    return query select a.full_address::text, a.pincode::text from public.admin a where a.id = p_customer_id;
end;
$$;
revoke all on function public.set_customer_location(uuid, text, text) from public, anon;
grant execute on function public.set_customer_location(uuid, text, text) to authenticated;

commit;

-- Check (expect column_1 and true):
select count(*) as column_1 from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'social_category';
select prosrc not like '%The address is already on the customer card%' as partners_can_edit_address
from pg_proc where proname = 'set_customer_location';
