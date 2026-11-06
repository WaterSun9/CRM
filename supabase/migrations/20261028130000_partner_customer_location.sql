-- Channel partners and dealers may add a MISSING address or pincode for their own completed
-- customers - nothing else (NOT YET RUN). Asked for by the owner on 28 Oct 2026. Changing an
-- address or pincode that is already there, and every other detail, stays with admin / office.
-- Run after 20261028120000_complaints_in_warranty_only.sql.
--
--   * set_customer_location(customer, address, pincode) changes only admin.full_address and
--     admin.pincode. Every other field of the card stays office-only.
--   * Who may: admin and sales (any customer), and partners for their own customers, matched
--     the same way the customer list is (admin_select): partner office / manager / office2 by
--     their branch, a Channel Partner (agent) by its own name, a dealer (agent2) by its own
--     name within its branch.
--   * Partners can see every other detail but not change it. The app logs the change in the
--     Activity log like any other edit.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

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
    -- Partners only fill what is empty.
    if my_type not in ('admin', 'sales') then
        if v_address is not null and nullif(btrim(coalesce(card.full_address, '')), '') is not null then
            raise exception 'The address is already on the customer card. Ask the office to change it.';
        end if;
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

-- Check (expect function_1):
select count(*) as function_1 from pg_proc where proname = 'set_customer_location' and pronamespace = 'public'::regnamespace;
