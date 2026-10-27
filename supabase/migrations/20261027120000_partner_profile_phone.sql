-- Channel partner and dealer Profile: each adds or changes their own phone number,
-- and complaints / warranty cards show both numbers (NOT YET RUN). Asked for by the
-- owner on 27 Oct 2026. Run AFTER 20261026120000_complaint_stages_history.sql
-- (needs metadata.phone).
--
--   * Partner phone = the partner's directory entry (metadata, category 'channel_partner'),
--     the same one the office sets in Operations. Partner office, office manager and office2
--     logins change their own channel partner's number; an agent login (a channel partner by
--     name) changes its own.
--   * Dealer phone = the dealer's own login (profiles.phone, user_type 'agent2'). A dealer
--     changes only their own number.
--   * contact_phones(partner, dealer) gives both numbers to anyone who works on complaints
--     (office, technicians, partners, dealers). No SMS check: they are business contacts,
--     and a wrong number is simply corrected.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

alter table public.profiles add column if not exists phone text;
alter table public.profiles drop constraint if exists profiles_phone_check;
alter table public.profiles add constraint profiles_phone_check check (phone is null or phone ~ '^[6-9][0-9]{9}$');

-- "+91 98765-43210" -> 9876543210; null for blank; an error for anything else.
create or replace function public.clean_contact_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
    clean text := nullif(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), '');
begin
    if clean is not null and length(clean) = 12 and left(clean, 2) = '91' then clean := substr(clean, 3); end if;
    if clean is not null and length(clean) = 11 and left(clean, 1) = '0' then clean := substr(clean, 2); end if;
    if clean is not null and clean !~ '^[6-9][0-9]{9}$' then
        raise exception 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.';
    end if;
    return clean;
end;
$$;

-- The calling partner's directory name, or null for anyone else (a dealer gets its partner).
create or replace function public.my_partner_label()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select case
        when public.get_my_user_type() in ('channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent2')
            then nullif(btrim(public.get_my_channel_partner()), '')
        when public.get_my_user_type() = 'agent' then nullif(btrim(public.get_my_name()), '')
    end;
$$;

-- Return type changed while this file was still unrun: drop and create.
drop function if exists public.my_partner_profile();
-- -> partner_name, phone (the number this login changes), is_dealer, partner_phone
create function public.my_partner_profile()
returns table(partner_name text, phone text, is_dealer boolean, partner_phone text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
    v_label text := public.my_partner_label();
    v_dealer boolean := public.get_my_user_type() = 'agent2';
    v_partner_phone text;
begin
    if v_label is null and not v_dealer then
        raise exception 'Only channel partner and dealer logins have a partner profile.';
    end if;
    select m.phone into v_partner_phone from public.metadata m
    where m.category = 'channel_partner' and lower(btrim(m.label)) = lower(v_label) and m.phone is not null limit 1;
    return query
    select v_label,
           case when v_dealer then (select p.phone from public.profiles p where p.id = auth.uid()) else v_partner_phone end,
           v_dealer,
           v_partner_phone;
end;
$$;

-- Saves the number this login owns: a dealer its own, a partner its directory entry.
create or replace function public.set_my_partner_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_label text := public.my_partner_label();
    clean text := public.clean_contact_phone(p_phone);
    changed int;
begin
    if public.get_my_user_type() = 'agent2' then
        update public.profiles p set phone = clean where p.id = auth.uid();
        return clean;
    end if;
    if v_label is null then
        raise exception 'Only channel partners and dealers can set a phone number here.';
    end if;
    update public.metadata m set phone = clean
    where m.category = 'channel_partner' and lower(btrim(m.label)) = lower(v_label);
    get diagnostics changed = row_count;
    if changed = 0 and public.get_my_user_type() = 'agent' then
        -- A Channel Partner login works under its own name and may have no directory
        -- entry yet: add it, the same way a new CPO branch is added.
        insert into public.metadata (category, label, phone) values ('channel_partner', v_label, clean);
        changed := 1;
    end if;
    if changed = 0 then
        raise exception 'Your partner name "%" is not in the partner directory. Ask the office to add it.', v_label;
    end if;
    return clean;
end;
$$;

-- Partner and dealer numbers for a customer card (its channel_partner / sub_channel_partner).
create or replace function public.contact_phones(p_partner text, p_dealer text)
returns table(partner_phone text, dealer_phone text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(public.get_my_user_type(), '') not in ('admin', 'sales', 'technician', 'channel_partner_office',
        'channel_partner_office_manager', 'office2', 'agent', 'agent2') then
        return;
    end if;
    return query select
        (select m.phone from public.metadata m where m.category = 'channel_partner'
           and lower(btrim(m.label)) = lower(btrim(p_partner)) and m.phone is not null limit 1),
        (select p.phone from public.profiles p where p.user_type = 'agent2' and p.phone is not null
           and lower(btrim(p.name)) = lower(btrim(p_dealer))
           and (nullif(btrim(p_partner), '') is null or lower(btrim(coalesce(p.channel_partner, ''))) = lower(btrim(p_partner)))
           order by coalesce(p.status, 'active') = 'inactive', p.created_at desc limit 1);
end;
$$;

revoke all on function public.clean_contact_phone(text) from public, anon;
revoke all on function public.my_partner_label() from public, anon;
revoke all on function public.my_partner_profile() from public, anon;
revoke all on function public.set_my_partner_phone(text) from public, anon;
revoke all on function public.contact_phones(text, text) from public, anon;
grant execute on function public.clean_contact_phone(text) to authenticated;
grant execute on function public.my_partner_label() to authenticated;
grant execute on function public.my_partner_profile() to authenticated;
grant execute on function public.set_my_partner_phone(text) to authenticated;
grant execute on function public.contact_phones(text, text) to authenticated;

commit;

-- Check (expect functions_5 and dealer_phone_column_1):
select
  (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname in
    ('clean_contact_phone', 'my_partner_label', 'my_partner_profile', 'set_my_partner_phone', 'contact_phones')) as functions_5,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'profiles'
    and column_name = 'phone') as dealer_phone_column_1;
