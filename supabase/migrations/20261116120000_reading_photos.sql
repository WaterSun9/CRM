-- 16 Nov 2026 (client meeting 14 Nov): one photo for each site reading.
-- Each of the 6 voltages (AC Pos-Neg / Pos-Earth / Neg-Earth, DC Plus-Minus / Plus-Earth /
-- Minus-Earth) needs a photo of the meter showing it before the readings can be saved.
-- Photos are kind 'reading', label = the reading key (ac_pn ...), linked to the visit (trip_id).
-- The app shrinks them to about 800 px (tens of KB) before upload.
-- One transaction; safe to run twice.

begin;
set lock_timeout = '8s';

alter table public.service_issue_files
    add column if not exists trip_id uuid references public.service_trips(id) on delete cascade;
create index if not exists service_issue_files_trip_idx on public.service_issue_files (trip_id) where trip_id is not null;

alter table public.service_issue_files drop constraint if exists service_issue_files_kind_check;
alter table public.service_issue_files add constraint service_issue_files_kind_check
    check (kind in ('problem', 'before', 'after', 'site', 'reading'));

-- One photo per reading per visit.
create unique index if not exists service_issue_files_one_reading_photo
    on public.service_issue_files (trip_id, label) where kind = 'reading';

create or replace function public.limit_service_issue_files()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    trip record;
begin
    perform pg_advisory_xact_lock(hashtextextended(new.issue_id::text, 0));
    if auth.uid() is not null then
        if new.kind not in ('before', 'after', 'site', 'reading') then
            raise exception 'Only Before, After, site and reading photos can be added to a complaint.';
        end if;
        if new.mime_type is null or new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
            raise exception 'Only photos (JPG, PNG or WebP) can be added to a complaint.';
        end if;
        if new.kind = 'reading' then
            if new.label is null or new.label not in ('ac_pn', 'ac_pe', 'ac_ne', 'dc_pm', 'dc_pe', 'dc_me') then
                raise exception 'Unknown reading for this photo.';
            end if;
            select t.issue_id, t.technician_id, t.outcome into trip from public.service_trips t where t.id = new.trip_id;
            if not found or trip.issue_id <> new.issue_id or trip.technician_id <> auth.uid() then
                raise exception 'Visit not found. Refresh the page.';
            end if;
            if trip.outcome is not null then
                raise exception 'This visit is already closed. Photos cannot be changed.';
            end if;
        else
            new.trip_id := null;
            if (select count(*) from public.service_issue_files f
                where f.issue_id = new.issue_id and f.kind = new.kind) >= 10 then
                raise exception 'A complaint can have at most 10 % photos. Delete one first.', new.kind;
            end if;
        end if;
        new.created_at := now();
        new.file_name := left(coalesce(nullif(btrim(new.file_name), ''), new.kind || '.jpg'), 200);
        new.label := nullif(left(btrim(coalesce(new.label, '')), 60), '');
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
    and kind in ('before', 'after', 'site', 'reading')
    and storage_path like issue_id::text || '/' || (select auth.uid())::text || '/%'
    and exists (select 1 from public.service_issues issue
                where issue.id = service_issue_files.issue_id
                  and issue.assigned_to = (select auth.uid())
                  and issue.status in ('assigned', 'completion_pending'))
);

-- Readings now also need their 6 photos.
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
    photos integer;
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
    if trip.reached_at is null then
        raise exception 'Tap Reached site first.';
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
    select count(distinct f.label) into photos from public.service_issue_files f
    where f.trip_id = trip.id and f.kind = 'reading';
    if photos < 6 then
        raise exception 'Add a photo for every reading (% of 6 added).', photos;
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

commit;

-- Check: expect trip_column = 1, reading_kind = true.
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'service_issue_files' and column_name = 'trip_id') as trip_column,
  (select pg_get_constraintdef(oid) like '%reading%' from pg_constraint where conname = 'service_issue_files_kind_check') as reading_kind;
