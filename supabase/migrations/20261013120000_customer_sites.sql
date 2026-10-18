-- Saved customer location ("pin") and road-distance lookups for the km of a visit
-- (NOT YET RUN - needs the owner's go-ahead). Run AFTER 20261013110000_service_trips.sql.
-- Only needed for the "pro" km mode (TRIP_DISTANCE_MODE in src/constants.js, 'simple' by
-- default) and the office "Set location" button. Steps: docs/GOOGLE_ROUTES_SETUP.md.
--
--   * customer_sites: one exact point per customer. A separate table on purpose: the
--     admin table is saved whole-row by several screens and has history / updated_at
--     triggers, so a pin there could be wiped by an older copy of the card.
--       - The first time a technician taps "Reached site" with a good phone fix
--         (accuracy 100 m or better) on a job for that customer, the point is saved
--         (source 'technician_reached'). It is never overwritten by a technician.
--         Not saved when "Reached site" is within 500 m of the trip's phone-location start
--         (tapped by mistake right after "Start trip": that is not the customer's place).
--       - Office (admin / sales) can set it from a Google Maps link or clear it, only
--         through set_customer_site / clear_customer_site (source 'office').
--       - Read by anyone who can read the customer card (the admin table's own rules
--         decide), and by a technician while that customer's complaint is assigned to them.
--   * service_mark_reached is replaced: same answers and checks as in
--     20261013110000_service_trips.sql, plus the first-pin save above.
--     IF 20261013110000 IS EVER RUN AGAIN, RUN THIS FILE AGAIN AFTER IT.
--   * service_visits gains km_source ('estimate' | 'google' | 'manual') and route_km
--     (one-way road km from Google, 1 decimal). Both stay empty for "simple" visits.
--   * trip_distance_lookups: one row per call of the trip-distance edge function, for its
--     daily limits (200 per person, 1000 in total). Written only by the function (service
--     role); admin can read it.
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Saved customer location ------------------------------------------------------

create table if not exists public.customer_sites (
    customer_id uuid primary key references public.admin(id) on delete cascade,
    lat double precision not null,
    lng double precision not null,
    source text not null,
    set_at timestamptz not null default now(),
    -- Set null when a login or trip is deleted, so the pin stays.
    set_by uuid references auth.users(id) on delete set null,
    trip_id uuid references public.service_trips(id) on delete set null
);

-- Dropped and added again so a re-run picks up any change to the rules.
alter table public.customer_sites drop constraint if exists customer_sites_source_check;
alter table public.customer_sites add constraint customer_sites_source_check
    check (source in ('technician_reached', 'office'));
-- India's rough box, same as the trip points (NaN and infinity fail "between").
alter table public.customer_sites drop constraint if exists customer_sites_point_check;
alter table public.customer_sites add constraint customer_sites_point_check
    check (lat between 6 and 37 and lng between 68 and 98);

alter table public.customer_sites enable row level security;
-- Read only for app logins; writes go through the functions below.
revoke all on public.customer_sites from public, anon, authenticated;
grant select on public.customer_sites to authenticated;
grant all on public.customer_sites to service_role;

drop policy if exists customer_sites_read on public.customer_sites;
create policy customer_sites_read on public.customer_sites
for select to authenticated
using (
    -- Runs as the caller, so the admin table's own rules decide who sees the card.
    exists (select 1 from public.admin a where a.id = customer_sites.customer_id)
    -- A technician cannot read customer cards, only the complaints assigned to them.
    or ((select public.get_my_user_type()) = 'technician'
        and exists (select 1 from public.service_issues issue
                    where issue.customer_id = customer_sites.customer_id
                      and issue.assigned_to = (select auth.uid())
                      and issue.status in ('assigned', 'completion_pending')))
);

-- 2. Road-distance lookups (trip-distance edge function) ---------------------------

create table if not exists public.trip_distance_lookups (
    id uuid primary key default gen_random_uuid(),
    requested_by uuid references auth.users(id) on delete set null,
    travel_mode text not null,
    ok boolean not null,
    error_code text,
    created_at timestamptz not null default now()
);

alter table public.trip_distance_lookups drop constraint if exists trip_distance_lookups_travel_mode_check;
alter table public.trip_distance_lookups add constraint trip_distance_lookups_travel_mode_check
    check (travel_mode in ('TWO_WHEELER', 'DRIVE'));
alter table public.trip_distance_lookups drop constraint if exists trip_distance_lookups_error_code_check;
alter table public.trip_distance_lookups add constraint trip_distance_lookups_error_code_check
    check (error_code ~ '^[a-z_]{1,40}$');

create index if not exists trip_distance_lookups_user_idx on public.trip_distance_lookups (requested_by, created_at);
create index if not exists trip_distance_lookups_created_idx on public.trip_distance_lookups (created_at);

alter table public.trip_distance_lookups enable row level security;
revoke all on public.trip_distance_lookups from public, anon, authenticated;
grant select on public.trip_distance_lookups to authenticated;
grant all on public.trip_distance_lookups to service_role;

drop policy if exists trip_distance_lookups_admin_read on public.trip_distance_lookups;
create policy trip_distance_lookups_admin_read on public.trip_distance_lookups
for select to authenticated
using ((select public.get_my_user_type()) = 'admin');

-- 3. Visits remember where the km came from ----------------------------------------

alter table public.service_visits add column if not exists km_source text;
alter table public.service_visits add column if not exists route_km numeric;

alter table public.service_visits drop constraint if exists service_visits_km_source_check;
alter table public.service_visits add constraint service_visits_km_source_check
    check (km_source in ('estimate', 'google', 'manual'));
alter table public.service_visits drop constraint if exists service_visits_route_km_check;
alter table public.service_visits add constraint service_visits_route_km_check
    check (route_km between 0 and 10000);

-- 4. Office sets or clears a customer's location -----------------------------------

create or replace function public.set_customer_site(p_customer_id uuid, p_lat double precision, p_lng double precision)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me uuid := auth.uid();
begin
    if me is null or not exists (select 1 from public.profiles p where p.id = me and p.user_type in ('admin', 'sales')
                                 and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Only the office can save a customer location.';
    end if;
    if p_lat is null or p_lng is null or not (p_lat between 6 and 37) or not (p_lng between 68 and 98) then
        raise exception 'This location is not in India. Check the link or the numbers.';
    end if;
    if p_customer_id is null or not exists (select 1 from public.admin a where a.id = p_customer_id) then
        raise exception 'Customer not found. Refresh the page.';
    end if;
    insert into public.customer_sites as site (customer_id, lat, lng, source, set_at, set_by, trip_id)
    values (p_customer_id, p_lat, p_lng, 'office', now(), me, null)
    on conflict (customer_id) do update
        set lat = excluded.lat, lng = excluded.lng, source = 'office', set_at = now(), set_by = me, trip_id = null;
    return true;
end;
$$;

-- True when a saved location was removed, false when there was none.
create or replace function public.clear_customer_site(p_customer_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me uuid := auth.uid();
    removed uuid;
begin
    if me is null or not exists (select 1 from public.profiles p where p.id = me and p.user_type in ('admin', 'sales')
                                 and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Only the office can remove a customer location.';
    end if;
    delete from public.customer_sites site where site.customer_id = p_customer_id
    returning site.customer_id into removed;
    return removed is not null;
end;
$$;

-- 5. "Reached site" also saves the customer's first pin ------------------------------
-- Same signature, checks and answers as in 20261013110000_service_trips.sql.

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
    job_customer uuid;
begin
    if me is null or not exists (select 1 from public.profiles p where p.id = me and p.user_type = 'technician'
                                 and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Technician account required';
    end if;
    if p_lat is null or p_lng is null or not (p_lat between 6 and 37) or not (p_lng between 68 and 98)
       or (p_accuracy is not null and not (p_accuracy >= 0)) then
        raise exception 'The phone location looks wrong. Reached site was not saved.';
    end if;
    select t.id, t.issue_id, t.started_at, t.reached_at, t.start_lat, t.start_lng into trip
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
    select issue.customer_id into job_customer
    from public.service_issues issue
    where issue.id = trip.issue_id and issue.assigned_to = me
      and issue.status in ('assigned', 'completion_pending');
    if not found then
        raise exception 'This job is not assigned to you any more. Refresh the list.';
    end if;
    update public.service_trips t
    set reached_at = now(), reached_lat = p_lat, reached_lng = p_lng,
        reached_accuracy_m = case when p_accuracy is not null then least(round(p_accuracy, 1), 1000000) end
    where t.id = trip.id and t.reached_at is null
    returning t.id into changed_id;

    -- First good fix at this customer becomes their saved location. Never overwrites a
    -- pin (the office's or an earlier technician's); a poor or unknown accuracy saves nothing,
    -- and neither does a "Reached site" within 500 m of a phone-location start.
    if changed_id is not null and job_customer is not null and p_accuracy is not null and p_accuracy <= 100
       and (trip.start_lat is null or trip.start_lng is null
            or sqrt(power((p_lat - trip.start_lat) * 111.32, 2)
                    + power((p_lng - trip.start_lng) * 111.32 * cos(radians(p_lat)), 2)) >= 0.5) then
        begin
            insert into public.customer_sites (customer_id, lat, lng, source, set_at, set_by, trip_id)
            values (job_customer, p_lat, p_lng, 'technician_reached', now(), me, changed_id)
            on conflict (customer_id) do nothing;
        exception when others then
            -- The pin is a convenience; "Reached site" itself must still be saved.
            raise warning 'service_mark_reached: customer location not saved: %', sqlerrm;
        end;
    end if;
    return changed_id is not null;
end;
$$;

revoke all on function public.set_customer_site(uuid, double precision, double precision) from public, anon;
revoke all on function public.clear_customer_site(uuid) from public, anon;
revoke all on function public.service_mark_reached(uuid, double precision, double precision, numeric) from public, anon;
grant execute on function public.set_customer_site(uuid, double precision, double precision) to authenticated;
grant execute on function public.clear_customer_site(uuid) to authenticated;
grant execute on function public.service_mark_reached(uuid, double precision, double precision, numeric) to authenticated;

commit;

-- Check (expect both tables with RLS on, 3 functions with a pinned search_path, the 2 new
-- visit columns, and how many customers have a saved location by source):
-- select relname, relrowsecurity from pg_class where oid in ('public.customer_sites'::regclass, 'public.trip_distance_lookups'::regclass);
-- select proname, prosecdef, proconfig from pg_proc where proname in ('set_customer_site', 'clear_customer_site', 'service_mark_reached');
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'service_visits' and column_name in ('km_source', 'route_km');
-- select source, count(*) from public.customer_sites group by 1;
-- select travel_mode, ok, error_code, count(*) from public.trip_distance_lookups group by 1, 2, 3 order by 1, 2, 3;