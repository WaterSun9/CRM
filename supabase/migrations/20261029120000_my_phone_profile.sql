-- Profile phone for every login (NOT YET RUN). Asked for by the owner on 29 Oct 2026:
-- office, sales, technicians, partners and dealers each add or change their own phone
-- number (profiles.phone). The quotation maker fills the salesperson phone from it.
-- Run AFTER 20261027120000_partner_profile_phone.sql (needs profiles.phone and
-- clean_contact_phone). A dealer's own number is the same profiles.phone.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

alter table public.profiles add column if not exists phone text;

-- Saves the calling login's own phone number; blank removes it.
create or replace function public.set_my_phone(p_phone text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    clean text := public.clean_contact_phone(p_phone);
begin
    if auth.uid() is null then
        raise exception 'Sign in first.';
    end if;
    update public.profiles p set phone = clean where p.id = auth.uid();
    return clean;
end;
$$;

-- The calling login's own phone number.
create or replace function public.my_phone()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select p.phone from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.set_my_phone(text) from public, anon;
revoke all on function public.my_phone() from public, anon;
grant execute on function public.set_my_phone(text) to authenticated;
grant execute on function public.my_phone() to authenticated;

commit;

-- Check (expect functions_2):
select count(*) as functions_2 from pg_proc where pronamespace = 'public'::regnamespace
    and proname in ('set_my_phone', 'my_phone');
