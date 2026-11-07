-- Inverter serial number rules, 7 Nov 2026. Run after 20261107120000_after_photo_comments.sql.
--   1. One rule for "no inverter serial": empty, only dashes / dots / spaces, zeros, NA, N/A,
--      nil, none or null (inverter_serial_missing). The app and service-otp use the same rule.
--   2. service_add_inverter fills a card whose serial is missing by that rule (before, a card
--      with "NA" or "-" could not be filled). A make typed by the technician is kept only when
--      the card has none.
--   3. service_replace_inverter: the technician on an open job records a replaced inverter
--      (new serial, optional make). The card gets the new number; the old one stays in the
--      complaint history (event 'inverter_replaced', "Old … → New …").
--   4. A job cannot close by customer OTP while its customer card has no inverter serial
--      (trigger service_issue_inverter_check). The office's "Completed without code" is not
--      checked: it stays the way out for a complaint with no card or a site with no inverter.
--
-- Safe to run more than once. Deploy service-otp (inverter check) together with this, and
-- the site soon after: until then the old screen shows a server error instead of the reason
-- when a technician tries to close a job with no inverter serial.
set lock_timeout = '8s';
begin;

-- 1. The rule -----------------------------------------------------------------------------
create or replace function public.inverter_serial_missing(p_serial text)
returns boolean
language sql
immutable
set search_path = public, pg_temp
as $$
    select lower(regexp_replace(coalesce(p_serial, ''), '[^a-zA-Z0-9]', '', 'g')) ~ '^(na|nil|none|null|0*)$'
$$;

-- 2. History step for a replaced inverter (list copied from 20261105120000, one added) -------
alter table public.service_issue_events drop constraint if exists service_issue_events_event_check;
alter table public.service_issue_events add constraint service_issue_events_event_check check (event in (
    'raised', 'assigned', 'claimed', 'visited', 'second_visit', 'code_sent', 'completed', 'cancelled',
    'reopened', 'gave_up', 'returned',
    'trip_started', 'reached', 'readings', 'fixed', 'revisit', 'inverter_added', 'inverter_replaced'));

-- 3. Add a missing serial -----------------------------------------------------------------
create or replace function public.service_add_inverter(p_issue_id uuid, p_serial text, p_make text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    serial text := upper(nullif(btrim(coalesce(p_serial, '')), ''));
    make text := nullif(btrim(coalesce(p_make, '')), '');
    card uuid;
begin
    perform public.require_my_open_job(p_issue_id);
    if serial is null or length(serial) > 60 or public.inverter_serial_missing(serial) then
        raise exception 'Type the inverter serial number (up to 60 characters).';
    end if;
    if make is not null and length(make) > 60 then
        raise exception 'The inverter make can be at most 60 characters.';
    end if;
    select issue.customer_id into card from public.service_issues issue where issue.id = p_issue_id;
    if card is null then
        raise exception 'This complaint has no customer card. Ask the office to add the inverter number.';
    end if;
    update public.admin a
    set inverter_serial_no = serial,
        inverter_make = coalesce(nullif(btrim(coalesce(a.inverter_make::text, '')), ''), make)
    where a.id = card and public.inverter_serial_missing(a.inverter_serial_no::text);
    if not found then
        return false;
    end if;
    perform public.add_service_event(p_issue_id, 'inverter_added', concat_ws(' · ', make, serial));
    return true;
end;
$$;

-- 4. Record a replaced inverter -----------------------------------------------------------
-- Works on a card with or without a serial; the old serial (and make) go into the history.
create or replace function public.service_replace_inverter(p_issue_id uuid, p_serial text, p_make text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    serial text := upper(nullif(btrim(coalesce(p_serial, '')), ''));
    make text := nullif(btrim(coalesce(p_make, '')), '');
    card uuid;
    old_serial text;
    old_make text;
begin
    perform public.require_my_open_job(p_issue_id);
    if serial is null or length(serial) > 60 or public.inverter_serial_missing(serial) then
        raise exception 'Type the new inverter serial number (up to 60 characters).';
    end if;
    if make is not null and length(make) > 60 then
        raise exception 'The inverter make can be at most 60 characters.';
    end if;
    select issue.customer_id into card from public.service_issues issue where issue.id = p_issue_id;
    if card is null then
        raise exception 'This complaint has no customer card. Ask the office to add the inverter number.';
    end if;
    select nullif(btrim(coalesce(a.inverter_serial_no::text, '')), ''), nullif(btrim(coalesce(a.inverter_make::text, '')), '')
    into old_serial, old_make
    from public.admin a where a.id = card for update;
    if not found then
        raise exception 'The customer card was not found. Tell the office.';
    end if;
    if upper(coalesce(old_serial, '')) = serial then
        raise exception 'That is the same serial number as on the card.';
    end if;
    update public.admin a
    set inverter_serial_no = serial,
        inverter_make = coalesce(make, old_make)
    where a.id = card;
    perform public.add_service_event(p_issue_id, 'inverter_replaced', concat(
        'Old: ', coalesce(concat_ws(' · ', old_make, old_serial), 'none'),
        ' → New: ', concat_ws(' · ', coalesce(make, old_make), serial)));
    return true;
end;
$$;

-- 5. No close by OTP without an inverter serial ---------------------------------------------
-- service-otp checks first and gives the technician the plain message; this is the last word.
create or replace function public.check_service_code_inverter()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.status = 'completed' and new.completion_method = 'otp'
       and (old.status is distinct from 'completed' or old.completion_method is distinct from 'otp') then
        if new.customer_id is null or not exists (
            select 1 from public.admin a
            where a.id = new.customer_id and not public.inverter_serial_missing(a.inverter_serial_no::text)) then
            raise exception 'Add the inverter serial number first.';
        end if;
    end if;
    return new;
end;
$$;
-- Runs after service_issue_guard (triggers run in name order).
create or replace trigger service_issue_inverter_check before update on public.service_issues
for each row execute function public.check_service_code_inverter();

-- 6. Rights ---------------------------------------------------------------------------------
revoke all on function public.inverter_serial_missing(text) from public, anon;
revoke all on function public.service_add_inverter(uuid, text, text) from public, anon;
revoke all on function public.service_replace_inverter(uuid, text, text) from public, anon;
revoke all on function public.check_service_code_inverter() from public, anon;
grant execute on function public.inverter_serial_missing(text) to authenticated, service_role;
grant execute on function public.service_add_inverter(uuid, text, text) to authenticated;
grant execute on function public.service_replace_inverter(uuid, text, text) to authenticated;
grant execute on function public.check_service_code_inverter() to authenticated, service_role;

commit;

-- Check (expect functions_3, trigger_1, event_allowed_1, rule_ok true):
select
  (select count(*) from pg_proc where proname in ('inverter_serial_missing', 'service_replace_inverter', 'check_service_code_inverter')) as functions_3,
  (select count(*) from pg_trigger where tgrelid = 'public.service_issues'::regclass
     and tgname = 'service_issue_inverter_check' and tgenabled <> 'D') as trigger_1,
  (select count(*) from pg_constraint where conname = 'service_issue_events_event_check'
     and pg_get_constraintdef(oid) like '%inverter_replaced%') as event_allowed_1,
  (public.inverter_serial_missing(null) and public.inverter_serial_missing(' N/A ') and public.inverter_serial_missing('--')
   and public.inverter_serial_missing('000') and not public.inverter_serial_missing('GRW55K7781')) as rule_ok;
