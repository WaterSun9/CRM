-- Technician visits, 5 Nov 2026. Run after 20261029130000_technician_km_rate.sql.
--   1. Technicians see open complaints in full (customer card, history) before claiming.
--   2. Past complaints of the same customer, for office and technician.
--   3. The technician on the job can add the inverter serial number when the card has none.
--   4. Each trip is a numbered visit (#1001-1, #1001-2, ...). After Reached site the
--      technician fills the site readings (AC / DC voltages, floating voltage), then marks
--      the visit Fixed or Revisit needed. Every step goes into the complaint's history.
--   5. "My trip": the technician picks the houses for a day and their order.
--   6. Photos: Before is optional (only After is needed for the code); up to 10 named
--      site photos (panels, inverter, ...).
--
-- Safe to run more than once. After running, redeploy service-otp (only After photos needed).
set lock_timeout = '8s';
begin;

-- 1. Technicians read open complaints ------------------------------------------------------
drop policy if exists service_issues_read on public.service_issues;
create policy service_issues_read on public.service_issues
for select to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales')
    or created_by = (select auth.uid())
    or ((select public.get_my_user_type()) = 'technician'
        and (assigned_to = (select auth.uid()) or status = 'open'))
    or ((select public.get_my_user_type()) in ('channel_partner_office', 'channel_partner_office_manager',
                                               'office2', 'agent', 'agent2')
        and customer_id is not null
        and exists (select 1 from public.admin a where a.id = service_issues.customer_id))
);

-- The technician may read a job's card when it is open or theirs.
create or replace function public.service_job_visible(p_issue_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (select 1 from public.service_issues issue where issue.id = p_issue_id
                   and (coalesce(public.get_my_user_type(), '') in ('admin', 'sales')
                        or (public.is_active_technician()
                            and (issue.assigned_to = auth.uid() or issue.status = 'open'))))
$$;

create or replace function public.service_job_customer(p_issue_id uuid)
returns table(customer_name text, phone_number text, full_address text, pincode text, villages text,
              district text, channel_partner text, sub_channel_partner text, partner_phone text,
              panel_serial_no text, inverter_serial_no text, inverter_make text, module_brand text,
              module_wp numeric, no_of_modules numeric, system_capacity_kwp numeric)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.service_job_visible(p_issue_id) then
        return;
    end if;
    return query
    select a.customer_name::text, a.phone_number::text, a.full_address::text, a.pincode::text, a.villages::text,
           a.district::text, a.channel_partner::text, a.sub_channel_partner::text,
           (select m.phone from public.metadata m where m.category = 'channel_partner'
              and lower(btrim(m.label)) = lower(btrim(a.channel_partner)) and m.phone is not null limit 1),
           a.panel_serial_no::text, a.inverter_serial_no::text, a.inverter_make::text, a.module_brand::text,
           a.module_wp::numeric, a.no_of_modules::numeric, a.system_capacity_kwp::numeric
    from public.service_issues issue
    join public.admin a on a.id = issue.customer_id
    where issue.id = p_issue_id;
end;
$$;

-- 2. Past complaints of the same customer ---------------------------------------------------
create or replace function public.service_customer_past(p_issue_id uuid)
returns table(id uuid, ticket_no bigint, created_at timestamptz, problem_type text, status text,
              completed_at timestamptz, completion_method text, visits integer)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.service_job_visible(p_issue_id) then
        return;
    end if;
    return query
    select other.id, other.ticket_no, other.created_at, other.problem_type::text, other.status::text,
           other.completed_at, other.completion_method::text,
           (select count(distinct t.visit_no)::integer from public.service_trips t where t.issue_id = other.id)
    from public.service_issues issue
    join public.service_issues other on other.customer_id = issue.customer_id and other.id <> issue.id
    where issue.id = p_issue_id and issue.customer_id is not null
    order by other.created_at desc
    limit 30;
end;
$$;

-- 3. History steps for the new actions -------------------------------------------------------
alter table public.service_issue_events drop constraint if exists service_issue_events_event_check;
alter table public.service_issue_events add constraint service_issue_events_event_check check (event in (
    'raised', 'assigned', 'claimed', 'visited', 'second_visit', 'code_sent', 'completed', 'cancelled',
    'reopened', 'gave_up', 'returned',
    'trip_started', 'reached', 'readings', 'fixed', 'revisit', 'inverter_added'));

create or replace function public.add_service_event(p_issue_id uuid, p_event text, p_note text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    insert into public.service_issue_events (issue_id, event, note, actor_id, actor_name)
    values (p_issue_id, p_event, left(p_note, 600), auth.uid(),
            (select p.name from public.profiles p where p.id = auth.uid()));
end;
$$;

-- The job is the signed-in technician's and still open, else an error.
create or replace function public.require_my_open_job(p_issue_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if not public.is_active_technician() then
        raise exception 'Technician account required';
    end if;
    if not exists (select 1 from public.service_issues issue
                   where issue.id = p_issue_id and issue.assigned_to = auth.uid()
                     and issue.status in ('assigned', 'completion_pending')) then
        raise exception 'This job is not assigned to you any more. Refresh the list.';
    end if;
end;
$$;

-- 4. Inverter serial number from the site -------------------------------------------------
-- Only fills an empty card: a number already there is changed by the office.
create or replace function public.service_add_inverter(p_issue_id uuid, p_serial text, p_make text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    serial text := nullif(btrim(coalesce(p_serial, '')), '');
    make text := nullif(btrim(coalesce(p_make, '')), '');
    card uuid;
begin
    perform public.require_my_open_job(p_issue_id);
    if serial is null or length(serial) > 60 then
        raise exception 'Type the inverter serial number (up to 60 characters).';
    end if;
    if make is not null and length(make) > 60 then
        raise exception 'The inverter make can be at most 60 characters.';
    end if;
    select issue.customer_id into card from public.service_issues issue where issue.id = p_issue_id;
    if card is null then
        raise exception 'This complaint has no customer card. Tell the office the inverter number.';
    end if;
    update public.admin a
    set inverter_serial_no = serial,
        inverter_make = coalesce(nullif(btrim(coalesce(a.inverter_make::text, '')), ''), make)
    where a.id = card and nullif(btrim(coalesce(a.inverter_serial_no::text, '')), '') is null;
    if not found then
        return false;
    end if;
    perform public.add_service_event(p_issue_id, 'inverter_added', concat_ws(' · ', make, serial));
    return true;
end;
$$;

-- 5. Numbered visits, readings and outcome -------------------------------------------------
alter table public.service_trips add column if not exists visit_no integer;
alter table public.service_trips add column if not exists readings jsonb;
alter table public.service_trips add column if not exists readings_at timestamptz;
alter table public.service_trips add column if not exists outcome text;
alter table public.service_trips add column if not exists outcome_note text;
alter table public.service_trips add column if not exists outcome_at timestamptz;
alter table public.service_trips drop constraint if exists service_trips_outcome_check;
alter table public.service_trips add constraint service_trips_outcome_check
    check (outcome is null or outcome in ('fixed', 'revisit'));

-- Old trips: each trip of a complaint is one visit, oldest first.
update public.service_trips t set visit_no = numbered.n
from (select id, row_number() over (partition by issue_id order by started_at, id) as n from public.service_trips) numbered
where numbered.id = t.id and t.visit_no is null;

-- A new trip keeps the visit number until that visit has an outcome (a restarted
-- trip is the same visit); after Fixed / Revisit needed the next trip is the next visit.
create or replace function public.number_service_trip()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    last_no integer;
    last_done boolean;
begin
    select t.visit_no, t.outcome is not null into last_no, last_done
    from public.service_trips t where t.issue_id = new.issue_id
    order by t.visit_no desc nulls last, t.started_at desc limit 1;
    new.visit_no := case when last_no is null then 1 when last_done then last_no + 1 else last_no end;
    new.readings := null; new.readings_at := null;
    new.outcome := null; new.outcome_note := null; new.outcome_at := null;
    return new;
end;
$$;
create or replace trigger service_trip_number before insert on public.service_trips
for each row execute function public.number_service_trip();

-- History: trip started and reached site.
create or replace function public.log_service_trip()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if tg_op = 'INSERT' then
        perform public.add_service_event(new.issue_id, 'trip_started',
            'Visit ' || new.visit_no || coalesce(' · from ' || new.start_pincode, ''));
    elsif new.reached_at is not null and old.reached_at is null then
        perform public.add_service_event(new.issue_id, 'reached', 'Visit ' || new.visit_no);
    end if;
    return null;
end;
$$;
create or replace trigger service_trip_history after insert or update of reached_at on public.service_trips
for each row execute function public.log_service_trip();

-- Site readings: AC P-N, P-E, N-E; DC +/-, +/earth, -/earth (volts); floating voltage yes/no.
create or replace function public.service_save_readings(p_trip_id uuid, p_readings jsonb)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    trip record;
    key text;
    clean jsonb := '{}'::jsonb;
    value numeric;
begin
    select t.id, t.issue_id, t.visit_no, t.reached_at, t.outcome into trip
    from public.service_trips t where t.id = p_trip_id and t.technician_id = auth.uid() for update;
    if not found then
        raise exception 'Trip not found. Refresh the list.';
    end if;
    perform public.require_my_open_job(trip.issue_id);
    if trip.outcome is not null then
        raise exception 'This visit is already marked %. Readings cannot be changed.', case trip.outcome when 'fixed' then 'Fixed' else 'Revisit needed' end;
    end if;
    foreach key in array array['ac_pn', 'ac_pe', 'ac_ne', 'dc_pm', 'dc_pe', 'dc_me'] loop
        if p_readings ? key and nullif(btrim(p_readings ->> key), '') is not null then
            begin
                value := (p_readings ->> key)::numeric;
            exception when others then
                raise exception 'Readings must be numbers.';
            end;
            if value < 0 or value > 2000 then
                raise exception 'A voltage must be between 0 and 2000.';
            end if;
            clean := clean || jsonb_build_object(key, round(value, 1));
        else
            raise exception 'Fill every voltage reading.';
        end if;
    end loop;
    if jsonb_typeof(p_readings -> 'floating') is distinct from 'boolean' then
        raise exception 'Choose Yes or No for floating voltage.';
    end if;
    clean := clean || jsonb_build_object('floating', (p_readings ->> 'floating')::boolean);
    update public.service_trips set readings = clean, readings_at = now() where id = trip.id;
    perform public.add_service_event(trip.issue_id, 'readings',
        format('Visit %s · AC %s/%s/%s V · DC %s/%s/%s V · floating %s', trip.visit_no,
               clean ->> 'ac_pn', clean ->> 'ac_pe', clean ->> 'ac_ne',
               clean ->> 'dc_pm', clean ->> 'dc_pe', clean ->> 'dc_me',
               case when (clean ->> 'floating')::boolean then 'yes' else 'no' end));
    return true;
end;
$$;

-- Fixed / Revisit needed for one visit. Needs the readings (not Reached site: the phone's
-- location can fail, and that must not stop the job).
create or replace function public.service_visit_outcome(p_trip_id uuid, p_outcome text, p_note text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    trip record;
    note text := nullif(left(btrim(coalesce(p_note, '')), 500), '');
begin
    if p_outcome not in ('fixed', 'revisit') then
        raise exception 'Choose Fixed or Revisit needed.';
    end if;
    if p_outcome = 'revisit' and note is null then
        raise exception 'Write why another visit is needed.';
    end if;
    select t.id, t.issue_id, t.visit_no, t.reached_at, t.readings, t.outcome into trip
    from public.service_trips t where t.id = p_trip_id and t.technician_id = auth.uid() for update;
    if not found then
        raise exception 'Trip not found. Refresh the list.';
    end if;
    perform public.require_my_open_job(trip.issue_id);
    if trip.outcome is not null then
        raise exception 'This visit is already marked.';
    end if;
    if trip.readings is null then
        raise exception 'Fill the site readings first.';
    end if;
    update public.service_trips set outcome = p_outcome, outcome_note = note, outcome_at = now() where id = trip.id;
    -- The complaint's stage: Visited after Fixed, Second visit needed after Revisit.
    update public.service_issues issue
    set visit_stage = case when p_outcome = 'fixed' then 'visited' else 'second_visit' end,
        visit_stage_note = case when p_outcome = 'fixed' then null else note end
    where issue.id = trip.issue_id;
    perform public.add_service_event(trip.issue_id, case when p_outcome = 'fixed' then 'fixed' else 'revisit' end,
        concat_ws(' · ', 'Visit ' || trip.visit_no, note));
    return true;
end;
$$;

-- 6. My trip: the houses of one day, in order --------------------------------------------
create table if not exists public.service_plan_stops (
    technician_id uuid not null references auth.users(id) on delete cascade,
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    plan_date date not null,
    position integer not null,
    created_at timestamptz not null default now(),
    primary key (technician_id, issue_id)
);
create index if not exists service_plan_stops_day_idx on public.service_plan_stops (technician_id, plan_date, position);
alter table public.service_plan_stops enable row level security;
revoke all on public.service_plan_stops from public, anon, authenticated;
grant select on public.service_plan_stops to authenticated;
grant all on public.service_plan_stops to service_role;
drop policy if exists service_plan_stops_read on public.service_plan_stops;
create policy service_plan_stops_read on public.service_plan_stops
for select to authenticated
using ((select public.get_my_user_type()) in ('admin', 'sales') or technician_id = (select auth.uid()));

-- Saves the day's houses in this order. Open jobs in the list are claimed first; a job
-- someone else took in the meantime is left out. Returns the jobs that are in the plan.
create or replace function public.service_save_plan(p_date date, p_issue_ids uuid[])
returns setof uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me uuid := auth.uid();
    job uuid;
    pos integer := 0;
begin
    if not public.is_active_technician() then
        raise exception 'Technician account required';
    end if;
    if p_date is null or p_date < (now() at time zone 'Asia/Kolkata')::date - 1 then
        raise exception 'Choose today or a later day.';
    end if;
    if coalesce(array_length(p_issue_ids, 1), 0) > 30 then
        raise exception 'At most 30 houses in one day.';
    end if;
    delete from public.service_plan_stops s where s.technician_id = me and s.plan_date = p_date;
    foreach job in array coalesce(p_issue_ids, array[]::uuid[]) loop
        update public.service_issues issue
        set status = 'assigned', assigned_to = me, assigned_at = now(), give_up_reason = null
        where issue.id = job and issue.status = 'open';
        if exists (select 1 from public.service_issues issue where issue.id = job and issue.assigned_to = me
                   and issue.status in ('assigned', 'completion_pending')) then
            pos := pos + 1;
            insert into public.service_plan_stops (technician_id, issue_id, plan_date, position)
            values (me, job, p_date, pos)
            on conflict (technician_id, issue_id) do update set plan_date = excluded.plan_date, position = excluded.position;
            return next job;
        end if;
    end loop;
end;
$$;

-- 7. Photos: Before optional, named site photos ------------------------------------------
alter table public.service_issue_files add column if not exists label text;
alter table public.service_issue_files drop constraint if exists service_issue_files_kind_check;
alter table public.service_issue_files add constraint service_issue_files_kind_check
    check (kind in ('problem', 'before', 'after', 'site'));
alter table public.service_issue_files drop constraint if exists service_issue_files_label_check;
alter table public.service_issue_files add constraint service_issue_files_label_check
    check (label is null or length(label) <= 60);

create or replace function public.limit_service_issue_files()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended(new.issue_id::text, 0));
    if auth.uid() is not null then
        if new.kind not in ('before', 'after', 'site') then
            raise exception 'Only Before, After and site photos can be added to a complaint.';
        end if;
        if new.mime_type is null or new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
            raise exception 'Only photos (JPG, PNG or WebP) can be added to a complaint.';
        end if;
        if (select count(*) from public.service_issue_files f
            where f.issue_id = new.issue_id and f.kind = new.kind) >= 10 then
            raise exception 'A complaint can have at most 10 % photos. Delete one first.', new.kind;
        end if;
        new.created_at := now();
        new.file_name := left(coalesce(nullif(btrim(new.file_name), ''), new.kind || '.jpg'), 200);
        new.label := nullif(left(btrim(coalesce(new.label, '')), 60), '');
    end if;
    return new;
end;
$$;

-- Closing by code needs one After photo (Before is optional from now on).
create or replace function public.check_service_code_photos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.status = 'completed' and new.completion_method = 'otp'
       and (old.status is distinct from 'completed' or old.completion_method is distinct from 'otp') then
        perform 1 from public.service_issue_files f where f.issue_id = new.id and f.kind = 'after' limit 1 for share;
        if not found then
            raise exception 'Add at least one After photo first.';
        end if;
    end if;
    return new;
end;
$$;

drop policy if exists service_issue_files_create on public.service_issue_files;
create policy service_issue_files_create on public.service_issue_files
for insert to authenticated
with check (
    (select public.is_active_technician())
    and uploaded_by = (select auth.uid())
    and kind in ('before', 'after', 'site')
    and storage_path like issue_id::text || '/' || (select auth.uid())::text || '/%'
    and exists (select 1 from public.service_issues issue
                where issue.id = service_issue_files.issue_id
                  and issue.assigned_to = (select auth.uid())
                  and issue.status in ('assigned', 'completion_pending'))
);

-- 7b. Road km asked of Google once per trip -----------------------------------------------
-- The trip-distance function remembers each answer under a SHA-256 of the two points and
-- the mode (no points stored). Only the function (service role) reads and writes it.
create table if not exists public.trip_distance_cache (
    key text primary key check (key ~ '^[0-9a-f]{64}$'),
    distance_km numeric not null check (distance_km >= 0 and distance_km <= 4000),
    duration_minutes integer,
    travel_mode_used text,
    created_at timestamptz not null default now()
);
alter table public.trip_distance_cache enable row level security;
revoke all on public.trip_distance_cache from public, anon, authenticated;
grant all on public.trip_distance_cache to service_role;

-- 8. Rights ---------------------------------------------------------------------------------
revoke all on function public.service_job_visible(uuid) from public, anon;
revoke all on function public.service_customer_past(uuid) from public, anon;
revoke all on function public.add_service_event(uuid, text, text) from public, anon, authenticated;
revoke all on function public.require_my_open_job(uuid) from public, anon, authenticated;
revoke all on function public.service_add_inverter(uuid, text, text) from public, anon;
revoke all on function public.number_service_trip() from public, anon;
revoke all on function public.log_service_trip() from public, anon;
revoke all on function public.service_save_readings(uuid, jsonb) from public, anon;
revoke all on function public.service_visit_outcome(uuid, text, text) from public, anon;
revoke all on function public.service_save_plan(date, uuid[]) from public, anon;
grant execute on function public.service_job_visible(uuid) to authenticated;
grant execute on function public.service_customer_past(uuid) to authenticated;
grant execute on function public.service_add_inverter(uuid, text, text) to authenticated;
grant execute on function public.number_service_trip() to authenticated, service_role;
grant execute on function public.log_service_trip() to authenticated, service_role;
grant execute on function public.service_save_readings(uuid, jsonb) to authenticated;
grant execute on function public.service_visit_outcome(uuid, text, text) to authenticated;
grant execute on function public.service_save_plan(date, uuid[]) to authenticated;

commit;

-- Check (expect 7 new columns on service_trips/files, plan table 1, 6 functions):
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and ((table_name = 'service_trips' and column_name in ('visit_no', 'readings', 'readings_at', 'outcome', 'outcome_note', 'outcome_at'))
       or (table_name = 'service_issue_files' and column_name = 'label'))) as new_columns_7,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'service_plan_stops') as plan_table_1,
  (select count(*) from pg_proc where proname in ('service_customer_past', 'service_add_inverter', 'service_save_readings',
     'service_visit_outcome', 'service_save_plan', 'service_job_visible')) as functions_6;
