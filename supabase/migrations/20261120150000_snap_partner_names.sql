-- Snap CP / Dealer names to the login's spelling (D-047, 2026-11-20).
--
-- A partner sees a customer only when the card's CP / Dealer box matches their login name
-- (RLS on public.admin: lower(btrim(...)) on both sides, so capitals and outer spaces are
-- ignored but a double space inside the name is not). A card typed "RAMESHBHAI SOLANKI" is
-- hidden from the dealer login "RAMESHBHAI  SOLANKI".
--
-- This trigger fixes that at the source: when a card is added, or its CP box or Dealer box is
-- changed (app, import, Excel upload, SQL), that box is rewritten to the login's exact spelling
-- if it differs from the login only in capitals or in how many spaces sit between the words.
-- A missing space ("RAMESHBHAISOLANKI") is NOT treated as the same name, so a card can never
-- move to a different partner. Logins are never renamed and the access rules are not touched.
-- If two active spellings could match (a CP, a CPO branch or a dealer's own branch spelling), or
-- none, the name is left exactly as typed. Existing cards are not changed until someone edits
-- that box. Independent review 2026-11-20; its fixes are in.
--
-- The app's save check must accept the rewritten name (src/utils/saveCheck.js, same release):
-- release that app change before or together with this file.
--
-- One transaction; safe to run twice.

begin;
set lock_timeout = '8s';

-- Same name ignoring capitals, outer spaces, and the number of spaces between words.
create or replace function public.partner_name_key(p_name text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
    select nullif(lower(regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g')), '');
$$;

create or replace function public.snap_partner_names()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    cp_key text;
    dealer_key text;
    spellings text[];
begin
    cp_key := public.partner_name_key(new.channel_partner);

    -- CP box (only when added or changed): an independent CP's name, a CPO branch name, or the
    -- branch as a dealer login spells it (so a dealer's own leads keep the dealer's spelling
    -- when it differs: two spellings = left alone).
    if cp_key is not null and (tg_op = 'INSERT' or new.channel_partner is distinct from old.channel_partner) then
        select array_agg(distinct t.s) into spellings from (
            select btrim(p.name) as s from public.profiles p
             where p.user_type = 'agent'
               and coalesce(p.status, '') <> 'inactive'
               and public.partner_name_key(p.name) = cp_key
            union
            select btrim(coalesce(p.channel_partner, p.name)) from public.profiles p
             where p.user_type in ('channel_partner_office', 'office2', 'channel_partner_office_manager', 'agent2', 'dealer')
               and coalesce(p.status, '') <> 'inactive'
               and public.partner_name_key(coalesce(p.channel_partner, p.name)) = cp_key
        ) t
        where t.s <> '';
        if coalesce(array_length(spellings, 1), 0) = 1 and new.channel_partner is distinct from spellings[1] then
            new.channel_partner := spellings[1];
        end if;
    end if;

    -- Dealer box (only when added or changed): a dealer login under that same CPO branch.
    dealer_key := public.partner_name_key(new.sub_channel_partner);
    if dealer_key is not null and cp_key is not null
       and (tg_op = 'INSERT' or new.sub_channel_partner is distinct from old.sub_channel_partner) then
        select array_agg(distinct btrim(p.name)) into spellings
          from public.profiles p
         where p.user_type in ('agent2', 'dealer')
           and coalesce(p.status, '') <> 'inactive'
           and public.partner_name_key(p.name) = dealer_key
           and public.partner_name_key(coalesce(p.channel_partner, p.name)) = cp_key
           and btrim(p.name) <> '';
        if coalesce(array_length(spellings, 1), 0) = 1 and new.sub_channel_partner is distinct from spellings[1] then
            new.sub_channel_partner := spellings[1];
        end if;
    end if;

    return new;
end;
$$;
revoke all on function public.snap_partner_names() from public, anon, authenticated;

drop trigger if exists trg_snap_partner_names on public.admin;
create trigger trg_snap_partner_names
before insert or update of channel_partner, sub_channel_partner on public.admin
for each row execute function public.snap_partner_names();

commit;

-- Check: expect trigger = 1, double_space = true, missing_space = false.
select
  (select count(*) from pg_trigger where tgname = 'trg_snap_partner_names' and not tgisinternal) as trigger,
  public.partner_name_key('RAMESHBHAI  SOLANKI ') = public.partner_name_key('rameshbhai solanki') as double_space,
  public.partner_name_key('RAMESHBHAISOLANKI') = public.partner_name_key('rameshbhai solanki') as missing_space;
