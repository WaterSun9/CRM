-- Complaint stages, a dated history of every step, combined visits and partner phone
-- numbers (NOT YET RUN). Asked for by the owner on 26 Oct 2026.
-- On live: run AFTER 20261023120000_complaint_photos_comments.sql, then the app.
--
--   * Complaint tabs: Raised (open), In process (assigned), Visited, Second visit needed,
--     Closed. "Visited" and "Second visit needed" are a visit stage on a job that is still
--     assigned (service_issues.visit_stage). The assigned technician and the office set it;
--     "Reached site" on a trip sets Visited by itself. Going back to the open queue, or
--     reopening a closed complaint, clears it. Its date is always the server's.
--   * History: every step of a complaint (raised, assigned / claimed, visited, second visit
--     needed, code sent, completed, cancelled, reopened, given up) is written to
--     service_issue_events with the date and who did it. Written only by the database;
--     anyone who can see the complaint can read its history. Old complaints get their
--     raised / assigned / completed dates back-filled.
--   * Combined visits: one trip to several houses is saved as one visit per complaint with
--     the same service_visits.trip_group. The first row carries the km and amount of the
--     whole trip, the others 0, so totals stay right.
--   * Channel partner phone (metadata.phone, category 'channel_partner'), set in Operations,
--     shown on the complaint so office and technician can call the partner.
--   * service_job_customer(): the customer card details of a complaint (address, pincode,
--     phone, partner and partner phone, panel and inverter serial numbers) for the office
--     and for the technician the job is assigned to (technicians cannot read customer cards).
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Visit stage on a complaint ---------------------------------------------------------

alter table public.service_issues add column if not exists visit_stage text;
alter table public.service_issues add column if not exists visit_stage_note text;
alter table public.service_issues add column if not exists visit_stage_at timestamptz;
alter table public.service_issues drop constraint if exists service_issues_visit_stage_check;
alter table public.service_issues add constraint service_issues_visit_stage_check
    check (visit_stage is null or visit_stage in ('visited', 'second_visit'));
alter table public.service_issues drop constraint if exists service_issues_visit_stage_note_check;
alter table public.service_issues add constraint service_issues_visit_stage_note_check
    check (length(visit_stage_note) <= 500);

-- 2. Update guard: same rules as 20261012190000_service_jobs_v2.sql, plus the visit stage ---


create or replace function public.guard_service_issue_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    my_type text;
    tech_fields constant text[] := array['status', 'assigned_to', 'assigned_at', 'give_up_reason', 'updated_at',
                                           'visit_stage', 'visit_stage_note', 'visit_stage_at'];
    customer record;
    open_ticket bigint;
begin
    -- No signed-in user = service role (service-otp edge function) or the SQL editor: not limited.
    if auth.uid() is not null then
        my_type := public.get_my_user_type();
        if my_type = 'technician' then
            if (to_jsonb(new) - tech_fields) is distinct from (to_jsonb(old) - tech_fields) then
                raise exception 'Technicians cannot edit complaint details.';
            end if;
            if old.status = 'open' and new.status = 'assigned' and new.assigned_to = auth.uid()
               and new.assigned_at is not null and new.give_up_reason is null then
                null;
            elsif old.status in ('assigned', 'completion_pending') and old.assigned_to = auth.uid()
               and new.status = 'open' and new.assigned_to is null and new.assigned_at is null
               and coalesce(new.give_up_reason, '') ~ '[^[:space:]]' then
                new.completion_requested_at := null;
            elsif new.status = old.status and old.status in ('assigned', 'completion_pending') and old.assigned_to = auth.uid()
               and new.assigned_to is not distinct from old.assigned_to and new.assigned_at is not distinct from old.assigned_at
               and new.give_up_reason is not distinct from old.give_up_reason then
                -- Their own open job: only the visit stage (Visited / Second visit needed) and its note.
                null;
            else
                -- Technicians never close a job themselves: the code check does that.
                raise exception 'Technicians can only claim an open job or give up their own job.';
            end if;
        elsif my_type in ('admin', 'sales') then
            if new.completion_method = 'otp' and old.completion_method is distinct from 'otp' then
                raise exception 'Only the customer''s WhatsApp code can close a job as completed by code.';
            end if;
            if new.status = old.status and (new.completed_at is distinct from old.completed_at
                                            or new.completed_by is distinct from old.completed_by) then
                raise exception 'The completed date and person are filled in automatically.';
            end if;
            -- A typed number could send the code to someone other than the customer.
            if new.otp_phone is distinct from old.otp_phone then
                raise exception 'The WhatsApp number for the code is filled in from the customer''s phone number.';
            end if;
            if (new.warranty_start, new.warranty_end, new.warranty_status)
               is distinct from (old.warranty_start, old.warranty_end, old.warranty_status) then
                raise exception 'The warranty is worked out from the customer card and cannot be changed here.';
            end if;
            if new.customer_id is distinct from old.customer_id and new.customer_id is not null then
                -- Linking to another customer: same rules as raising, and the details follow the card.
                select a.customer_name, a.consumer_no, a.phone_number, a.stage, a.deleted_at
                into customer
                from public.admin a where a.id = new.customer_id;
                if not found or customer.deleted_at is not null or customer.stage is distinct from 'COMPLETED' then
                    raise exception 'Complaints can only be raised for completed customers.';
                end if;
                new.consumer_no := coalesce(nullif(left(btrim(customer.consumer_no), 100), ''), new.consumer_no);
                new.customer_name := coalesce(nullif(left(btrim(customer.customer_name), 160), ''), new.customer_name);
                new.otp_phone := public.clean_indian_mobile(customer.phone_number);
                select w.warranty_start, w.warranty_end, w.warranty_status
                into new.warranty_start, new.warranty_end, new.warranty_status
                from public.customer_warranty(new.customer_id) w;
            elsif new.customer_id is null and old.customer_id is not null
                  and exists (select 1 from public.admin a where a.id = old.customer_id) then
                -- Only deleting the customer for good unlinks a complaint; otherwise the
                -- code could be pointed at a typed number.
                raise exception 'A complaint raised from a customer card stays linked. Link it to the right customer instead.';
            elsif new.customer_id is null and new.customer_phone is distinct from old.customer_phone then
                -- Not in the CRM: the code goes to the phone typed on the complaint.
                new.otp_phone := public.clean_indian_mobile(new.customer_phone);
            end if;
            if new.status = 'completion_pending' and old.status <> 'completion_pending' then
                raise exception 'A job waits for the code only after the technician sends it.';
            end if;
            -- Another technician must send a fresh code.
            if new.status = 'completion_pending' and new.assigned_to is distinct from old.assigned_to then
                new.status := 'assigned';
            end if;
            if new.status = 'completed' and old.status <> 'completed' then
                if new.completion_method is distinct from 'office_override' then
                    raise exception 'Use "Completed without code" to close a job from the office.';
                end if;
                if coalesce(new.override_reason, '') !~ '[^[:space:]]' then
                    raise exception 'Enter a reason for closing this job without the customer''s code.';
                end if;
                new.override_reason := btrim(new.override_reason);
                new.completed_at := now();
                new.completed_by := auth.uid();
            elsif new.status = 'completed' and new.completion_method is distinct from old.completion_method then
                raise exception 'Reopen the job before changing how it was closed.';
            elsif new.status = 'completed' and new.override_reason is distinct from old.override_reason then
                if new.completion_method is distinct from 'office_override' then
                    raise exception 'This job was closed with the customer''s code, so it has no office reason.';
                end if;
                if coalesce(new.override_reason, '') !~ '[^[:space:]]' then
                    raise exception 'Enter a reason for closing this job without the customer''s code.';
                end if;
                new.override_reason := btrim(new.override_reason);
            end if;
            if new.status = 'cancelled' then
                if coalesce(new.cancel_reason, '') !~ '[^[:space:]]' then
                    raise exception 'Enter a reason for cancelling this complaint.';
                end if;
                new.cancel_reason := btrim(new.cancel_reason);
            end if;
            if new.status = 'open' then
                new.assigned_to := null;
                new.assigned_at := null;
            elsif new.status = 'assigned' and (old.status <> 'assigned' or new.assigned_to is distinct from old.assigned_to) then
                if not exists (select 1 from public.profiles p
                               where p.id = new.assigned_to and p.user_type = 'technician'
                                 and coalesce(p.status, 'active') <> 'inactive') then
                    raise exception 'Choose an active technician for this job.';
                end if;
                new.assigned_at := now();
            elsif new.assigned_to is distinct from old.assigned_to and new.assigned_to is not null
                  and not exists (select 1 from public.profiles p
                                  where p.id = new.assigned_to and p.user_type = 'technician') then
                -- Closed or cancelled jobs: visits and pay follow this person.
                raise exception 'Choose a technician for this job.';
            end if;
            -- One open complaint per customer, also when reopening or linking.
            if new.customer_id is not null and new.status in ('open', 'assigned', 'completion_pending')
               and (old.status not in ('open', 'assigned', 'completion_pending') or new.customer_id is distinct from old.customer_id) then
                perform pg_advisory_xact_lock(hashtextextended('service_issue_customer:' || new.customer_id::text, 0));
                open_ticket := public.active_complaint_ticket(new.customer_id);
                if open_ticket is not null then
                    raise exception 'Complaint #% is already open for this customer.', open_ticket;
                end if;
            end if;
            -- Reopening clears how the job was closed or cancelled.
            if new.status <> 'completed' then
                new.completion_method := null;
                new.override_reason := null;
                new.completed_at := null;
                new.completed_by := null;
            end if;
            if new.status <> 'cancelled' then
                new.cancel_reason := null;
            end if;
            if new.status in ('open', 'assigned') then
                new.completion_requested_at := null;
            end if;
        else
            raise exception 'Your account cannot change complaints.';
        end if;
    end if;
    -- Visit stage: only on an open job, and its date is always the server's.
    -- Back in the queue, or reopened after closing: the stage starts again.
    if new.status = 'open' or (old.status in ('completed', 'cancelled') and new.status in ('assigned', 'completion_pending')) then
        new.visit_stage := null;
        new.visit_stage_note := null;
    end if;
    if new.visit_stage is distinct from old.visit_stage or new.visit_stage_note is distinct from old.visit_stage_note then
        new.visit_stage_note := nullif(left(btrim(coalesce(new.visit_stage_note, '')), 500), '');
        new.visit_stage_at := case when new.visit_stage is null then null else now() end;
    else
        new.visit_stage_at := old.visit_stage_at;
    end if;
    new.updated_at := now();
    return new;
end;
$$;
create or replace trigger service_issue_guard before update on public.service_issues
for each row execute function public.guard_service_issue_update();
-- A new complaint starts with no visit stage (runs after fill_service_issue_from_customer).
create or replace function public.reset_service_issue_stage()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
    new.visit_stage := null;
    new.visit_stage_note := null;
    new.visit_stage_at := null;
    return new;
end;
$$;
create or replace trigger service_issue_stage_reset before insert on public.service_issues
for each row execute function public.reset_service_issue_stage();

-- 3. History --------------------------------------------------------------------------------

create table if not exists public.service_issue_events (
    id uuid primary key default gen_random_uuid(),
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    event text not null,
    note text,
    actor_id uuid,
    actor_name text,
    created_at timestamptz not null default now()
);
alter table public.service_issue_events drop constraint if exists service_issue_events_event_check;
alter table public.service_issue_events add constraint service_issue_events_event_check check (event in (
    'raised', 'assigned', 'claimed', 'visited', 'second_visit', 'code_sent', 'completed', 'cancelled',
    'reopened', 'gave_up', 'returned'));
create index if not exists service_issue_events_issue_idx on public.service_issue_events (issue_id, created_at);

alter table public.service_issue_events enable row level security;
drop policy if exists service_issue_events_read on public.service_issue_events;
-- Anyone who can see the complaint (the complaint's own read rule decides).
create policy service_issue_events_read on public.service_issue_events
for select to authenticated
using (exists (select 1 from public.service_issues issue where issue.id = service_issue_events.issue_id));
revoke all on public.service_issue_events from public, anon, authenticated;
grant select on public.service_issue_events to authenticated;
grant all on public.service_issue_events to service_role;

-- Writes one row per step. Security definer: the app never writes history itself.
create or replace function public.log_service_issue_event()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    who uuid := auth.uid();
    who_name text;
    tech_name text;
    steps text[] := array[]::text[];
    notes text[] := array[]::text[];
    i int;
begin
    if who is not null then
        select p.name into who_name from public.profiles p where p.id = who;
    end if;
    if new.assigned_to is not null then
        select p.name into tech_name from public.profiles p where p.id = new.assigned_to;
    end if;
    if tg_op = 'INSERT' then
        steps := steps || 'raised'::text; notes := notes || nullif(btrim(new.problem_type), '');
    else
        if new.status is distinct from old.status or new.assigned_to is distinct from old.assigned_to then
            if new.status = 'assigned' and old.status = 'open' and who = new.assigned_to then
                steps := steps || 'claimed'::text; notes := notes || tech_name;
            elsif new.status = 'assigned' and old.status in ('completed', 'cancelled') then
                steps := steps || 'reopened'::text; notes := notes || tech_name;
            elsif new.status = 'assigned' then
                steps := steps || 'assigned'::text; notes := notes || tech_name;
            elsif new.status = 'completion_pending' and old.status <> 'completion_pending' then
                steps := steps || 'code_sent'::text; notes := notes || null::text;
            elsif new.status = 'completed' and old.status <> 'completed' then
                steps := steps || 'completed'::text;
                notes := notes || case when new.completion_method = 'otp' then 'Closed with the customer''s code'
                                       else 'Closed by office: ' || coalesce(new.override_reason, '') end;
            elsif new.status = 'cancelled' and old.status <> 'cancelled' then
                steps := steps || 'cancelled'::text; notes := notes || new.cancel_reason;
            elsif new.status = 'open' and old.status in ('completed', 'cancelled') then
                steps := steps || 'reopened'::text; notes := notes || null::text;
            elsif new.status = 'open' and new.give_up_reason is distinct from old.give_up_reason and new.give_up_reason is not null then
                steps := steps || 'gave_up'::text; notes := notes || new.give_up_reason;
            elsif new.status = 'open' then
                steps := steps || 'returned'::text; notes := notes || null::text;
            end if;
        end if;
        if new.visit_stage is not null and (new.visit_stage is distinct from old.visit_stage
                                            or new.visit_stage_note is distinct from old.visit_stage_note) then
            steps := steps || new.visit_stage; notes := notes || new.visit_stage_note;
        end if;
    end if;
    for i in 1 .. coalesce(array_length(steps, 1), 0) loop
        insert into public.service_issue_events (issue_id, event, note, actor_id, actor_name)
        values (new.id, steps[i], left(notes[i], 600), who, who_name);
    end loop;
    return null;
end;
$$;
create or replace trigger service_issue_history after insert or update on public.service_issues
for each row execute function public.log_service_issue_event();

-- Back-fill the dates complaints already have (once: only complaints with no history yet).
insert into public.service_issue_events (issue_id, event, note, actor_id, actor_name, created_at)
select issue.id, step.event, step.note, step.actor_id, p.name, step.at
from public.service_issues issue
cross join lateral (values
    ('raised', nullif(btrim(issue.problem_type), ''), issue.created_by, issue.created_at),
    ('assigned', (select t.name from public.profiles t where t.id = issue.assigned_to), null::uuid, issue.assigned_at),
    ('completed', case when issue.completion_method = 'otp' then 'Closed with the customer''s code'
                       when issue.override_reason is not null then 'Closed by office: ' || issue.override_reason end,
     issue.completed_by, case when issue.status = 'completed' then issue.completed_at end),
    ('cancelled', issue.cancel_reason, null::uuid, case when issue.status = 'cancelled' then issue.updated_at end)
) as step(event, note, actor_id, at)
left join public.profiles p on p.id = step.actor_id
where step.at is not null
  and not exists (select 1 from public.service_issue_events e where e.issue_id = issue.id);

-- 4. "Reached site" marks the job Visited -------------------------------------------------
-- Security definer so it can read and update the complaint; the update guard still checks
-- that the job belongs to the technician. A failure never stops "Reached site" being saved.
create or replace function public.mark_service_issue_visited()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.reached_at is not null and old.reached_at is null then
        begin
            update public.service_issues issue
            set visit_stage = 'visited', visit_stage_note = null
            where issue.id = new.issue_id and issue.assigned_to = new.technician_id
              and issue.status in ('assigned', 'completion_pending')
              and issue.visit_stage is distinct from 'visited';
        exception when others then
            raise warning 'mark_service_issue_visited: %', sqlerrm;
        end;
    end if;
    return null;
end;
$$;
create or replace trigger service_trip_reached_visited after update of reached_at on public.service_trips
for each row execute function public.mark_service_issue_visited();

-- 5. Combined visits (one trip, several houses) ------------------------------------------------

alter table public.service_visits add column if not exists trip_group uuid;
create index if not exists service_visits_trip_group_idx on public.service_visits (trip_group) where trip_group is not null;

-- 6. Channel partner phone ---------------------------------------------------------------------

alter table public.metadata add column if not exists phone text;
alter table public.metadata drop constraint if exists metadata_phone_check;
alter table public.metadata add constraint metadata_phone_check check (phone is null or phone ~ '^[6-9][0-9]{9}$');

-- 7. Customer card details of a complaint ---------------------------------------------------------
-- Office: any complaint. Technician: only a job assigned to them. Partners read the customer
-- card directly under their own rules, so they are not served here.
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
declare
    my_type text := coalesce(public.get_my_user_type(), '');
begin
    if not exists (select 1 from public.service_issues issue where issue.id = p_issue_id
                   and (my_type in ('admin', 'sales')
                        or (my_type = 'technician' and issue.assigned_to = auth.uid()))) then
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

revoke all on function public.reset_service_issue_stage() from public, anon;
revoke all on function public.log_service_issue_event() from public, anon;
revoke all on function public.mark_service_issue_visited() from public, anon;
revoke all on function public.service_job_customer(uuid) from public, anon;
grant execute on function public.reset_service_issue_stage() to authenticated, service_role;
grant execute on function public.service_job_customer(uuid) to authenticated;

commit;

-- Check (expect stage_columns 3, history_rows > 0 when complaints exist, the 3 new triggers,
-- trip_group 1 and partner_phone 1):
select
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'service_issues'
    and column_name in ('visit_stage', 'visit_stage_note', 'visit_stage_at')) as stage_columns_3,
  (select count(*) from public.service_issue_events) as history_rows,
  (select count(*) from pg_trigger where tgname in ('service_issue_stage_reset', 'service_issue_history',
    'service_trip_reached_visited') and not tgisinternal) as new_triggers_3,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'service_visits'
    and column_name = 'trip_group') as trip_group_1,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'metadata'
    and column_name = 'phone') as partner_phone_1;
