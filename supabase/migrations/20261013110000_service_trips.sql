-- Technician trips: start point (phone location or typed pincode) and an
-- optional "Reached site" point, so the office can pre-fill the km of a visit
-- (NOT YET RUN - needs the owner's go-ahead). Run AFTER 20261012190000_service_jobs_v2.sql.
--
--   * A technician taps "Start trip" on their own job (assigned or waiting for
--     the code). The start is the phone location, or a typed pincode when
--     location fails. "Reached site" saves one more location (optional).
--   * Km = straight line start -> customer x 1.3 road x 2 (round trip) + 5 km
--     grace, worked out in the app (src/utils/tripKm.js). The database keeps the
--     points; the office saves the km on the visit and must give a note when it
--     types a different km than the estimate.
--   * Trips are written only through service_start_trip / service_mark_reached.
--     At most 6 trips per job per day (India time). "Reached site" only on your
--     own trip, once, within 12 hours of starting.
--   * A browser cannot prove a location is real (fake-GPS apps exist), so this is
--     an estimate the office checks, not proof of the route driven.
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Trips -----------------------------------------------------------------------

create table if not exists public.service_trips (
    id uuid primary key default gen_random_uuid(),
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    technician_id uuid not null references auth.users(id),
    started_at timestamptz not null default now(),
    start_lat double precision,
    start_lng double precision,
    start_accuracy_m numeric,
    start_pincode text,
    start_source text not null,
    reached_at timestamptz,
    reached_lat double precision,
    reached_lng double precision,
    reached_accuracy_m numeric,
    created_at timestamptz not null default now()
);

-- Dropped and added again so a re-run picks up any change to the rules.
alter table public.service_trips drop constraint if exists service_trips_start_source_check;
alter table public.service_trips add constraint service_trips_start_source_check
    check (start_source in ('gps', 'manual'));
alter table public.service_trips drop constraint if exists service_trips_start_pincode_check;
alter table public.service_trips add constraint service_trips_start_pincode_check
    check (start_pincode ~ '^[1-9][0-9]{5}$');
-- gps: a point inside India's rough box (NaN and infinity fail "between";
-- "is not null" because a check that comes out null counts as passed).
-- manual: only the typed pincode, no point.
alter table public.service_trips drop constraint if exists service_trips_start_point_check;
alter table public.service_trips add constraint service_trips_start_point_check check (
    (start_source = 'gps' and start_lat is not null and start_lng is not null
        and start_lat between 6 and 37 and start_lng between 68 and 98)
    or (start_source = 'manual' and start_pincode is not null and start_lat is null and start_lng is null
        and start_accuracy_m is null)
);
alter table public.service_trips drop constraint if exists service_trips_reached_point_check;
alter table public.service_trips add constraint service_trips_reached_point_check check (
    (reached_at is null and reached_lat is null and reached_lng is null and reached_accuracy_m is null)
    or (reached_at is not null and reached_lat is not null and reached_lng is not null
        and reached_lat between 6 and 37 and reached_lng between 68 and 98)
);
alter table public.service_trips drop constraint if exists service_trips_accuracy_check;
alter table public.service_trips add constraint service_trips_accuracy_check check (
    (start_accuracy_m is null or start_accuracy_m between 0 and 1000000)
    and (reached_accuracy_m is null or reached_accuracy_m between 0 and 1000000)
);

create index if not exists service_trips_issue_idx on public.service_trips (issue_id, started_at desc);
create index if not exists service_trips_technician_idx on public.service_trips (technician_id, started_at desc);

alter table public.service_trips enable row level security;
-- Read only for app logins; writes go through the two functions below.
revoke all on public.service_trips from public, anon, authenticated;
grant select on public.service_trips to authenticated;
grant all on public.service_trips to service_role;

drop policy if exists service_trips_read on public.service_trips;
create policy service_trips_read on public.service_trips
for select to authenticated
using (
    public.get_my_user_type() in ('admin', 'sales')
    or (public.get_my_user_type() = 'technician' and technician_id = (select auth.uid()))
);

-- 2. Visits remember the trip and the estimate ------------------------------------

alter table public.service_visits add column if not exists trip_id uuid;
alter table public.service_visits add column if not exists km_estimate numeric;
alter table public.service_visits add column if not exists km_note text;

do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_trip_id_fkey' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_trip_id_fkey foreign key (trip_id) references public.service_trips(id) on delete set null;
end if; end $$;
alter table public.service_visits drop constraint if exists service_visits_km_note_check;
alter table public.service_visits add constraint service_visits_km_note_check check (length(km_note) <= 300);
alter table public.service_visits drop constraint if exists service_visits_km_estimate_check;
alter table public.service_visits add constraint service_visits_km_estimate_check check (km_estimate between 0 and 10000);
-- Office may change the estimated km, but must say why.
alter table public.service_visits drop constraint if exists service_visits_km_changed_note_check;
alter table public.service_visits add constraint service_visits_km_changed_note_check check (
    km_estimate is null or kilometers = km_estimate or coalesce(km_note, '') ~ '[^[:space:]]'
);
-- One visit (payment) per trip.
create unique index if not exists service_visits_one_per_trip on public.service_visits (trip_id) where trip_id is not null;

-- The trip must be this job's and this technician's.
create or replace function public.check_service_visit_trip()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.trip_id is not null and not exists (
        select 1 from public.service_trips t
        where t.id = new.trip_id and t.issue_id = new.issue_id and t.technician_id = new.technician_id
    ) then
        raise exception 'This trip belongs to another job or technician.';
    end if;
    new.km_note := nullif(btrim(new.km_note), '');
    return new;
end;
$$;
create or replace trigger service_visit_trip_check before insert or update on public.service_visits
for each row execute function public.check_service_visit_trip();

-- 3. App functions -----------------------------------------------------------------

-- Start a trip on your own job. Returns the new trip id.
create or replace function public.service_start_trip(p_issue_id uuid, p_lat double precision, p_lng double precision,
    p_accuracy numeric, p_pincode text, p_source text)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me uuid := auth.uid();
    pin text := nullif(btrim(coalesce(p_pincode, '')), '');
    trips_today integer;
    new_id uuid;
begin
    -- Switched-off technicians keep their login until it expires, so check here too.
    if me is null or not exists (select 1 from public.profiles p where p.id = me and p.user_type = 'technician'
                                 and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Technician account required';
    end if;
    if pin is not null and pin !~ '^[1-9][0-9]{5}$' then
        raise exception 'The pincode must be 6 digits.';
    end if;
    if p_source = 'gps' then
        if p_lat is null or p_lng is null or not (p_lat between 6 and 37) or not (p_lng between 68 and 98) then
            raise exception 'The phone location looks wrong. Type the pincode you are starting from instead.';
        end if;
        if p_accuracy is not null and not (p_accuracy >= 0) then
            raise exception 'The phone location looks wrong. Type the pincode you are starting from instead.';
        end if;
    elsif p_source = 'manual' then
        if pin is null then
            raise exception 'Type the 6-digit pincode you are starting from.';
        end if;
    else
        raise exception 'Choose phone location or pincode for the start of the trip.';
    end if;
    -- Two taps at the same moment wait in turn, so the daily limit holds.
    perform pg_advisory_xact_lock(hashtextextended('service_trip:' || p_issue_id::text, 0));
    if not exists (select 1 from public.service_issues issue
                   where issue.id = p_issue_id and issue.assigned_to = me
                     and issue.status in ('assigned', 'completion_pending')) then
        raise exception 'This job is not assigned to you any more. Refresh the list.';
    end if;
    select count(*) into trips_today from public.service_trips t
    where t.issue_id = p_issue_id
      and (t.started_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;
    if trips_today >= 6 then
        raise exception 'Only 6 trips can be started for one job in a day. Call the office.';
    end if;
    insert into public.service_trips (issue_id, technician_id, start_lat, start_lng, start_accuracy_m, start_pincode, start_source)
    values (p_issue_id, me,
            case when p_source = 'gps' then p_lat end,
            case when p_source = 'gps' then p_lng end,
            -- Browsers on a laptop can report accuracy of hundreds of km; keep it, capped.
            case when p_source = 'gps' and p_accuracy is not null then least(round(p_accuracy, 1), 1000000) end,
            pin, p_source)
    returning id into new_id;
    return new_id;
end;
$$;

-- "Reached site" on your own trip: once, within 12 hours of starting.
create or replace function public.service_mark_reached(p_trip_id uuid, p_lat double precision, p_lng double precision,
    p_accuracy numeric)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me uuid := auth.uid();
    trip record;
    changed_id uuid;
begin
    if me is null or not exists (select 1 from public.profiles p where p.id = me and p.user_type = 'technician'
                                 and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Technician account required';
    end if;
    if p_lat is null or p_lng is null or not (p_lat between 6 and 37) or not (p_lng between 68 and 98)
       or (p_accuracy is not null and not (p_accuracy >= 0)) then
        raise exception 'The phone location looks wrong. Reached site was not saved.';
    end if;
    select t.id, t.issue_id, t.started_at, t.reached_at into trip
    from public.service_trips t
    where t.id = p_trip_id and t.technician_id = me
    for update;
    if not found then
        raise exception 'Trip not found. Refresh the list.';
    end if;
    if trip.reached_at is not null then
        raise exception 'Reached site is already saved for this trip.';
    end if;
    if now() - trip.started_at > interval '12 hours' then
        raise exception 'This trip was started more than 12 hours ago. Start a new trip.';
    end if;
    if not exists (select 1 from public.service_issues issue
                   where issue.id = trip.issue_id and issue.assigned_to = me
                     and issue.status in ('assigned', 'completion_pending')) then
        raise exception 'This job is not assigned to you any more. Refresh the list.';
    end if;
    update public.service_trips t
    set reached_at = now(), reached_lat = p_lat, reached_lng = p_lng,
        reached_accuracy_m = case when p_accuracy is not null then least(round(p_accuracy, 1), 1000000) end
    where t.id = trip.id and t.reached_at is null
    returning t.id into changed_id;
    return changed_id is not null;
end;
$$;

revoke all on function public.check_service_visit_trip() from public, anon;
revoke all on function public.service_start_trip(uuid, double precision, double precision, numeric, text, text) from public, anon;
revoke all on function public.service_mark_reached(uuid, double precision, double precision, numeric) from public, anon;
-- The visit trigger runs as the caller (office login or service role).
grant execute on function public.check_service_visit_trip() to authenticated, service_role;
grant execute on function public.service_start_trip(uuid, double precision, double precision, numeric, text, text) to authenticated;
grant execute on function public.service_mark_reached(uuid, double precision, double precision, numeric) to authenticated;

commit;

-- Check (expect the table with RLS on, 2 functions, the new visit columns and the trigger):
-- select relrowsecurity from pg_class where oid = 'public.service_trips'::regclass;
-- select proname, prosecdef, proconfig from pg_proc where proname in ('service_start_trip', 'service_mark_reached');
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'service_visits' and column_name in ('trip_id', 'km_estimate', 'km_note');
-- select tgname from pg_trigger where tgrelid = 'public.service_visits'::regclass and not tgisinternal;
-- select start_source, count(*), count(reached_at) as reached from public.service_trips group by 1;
