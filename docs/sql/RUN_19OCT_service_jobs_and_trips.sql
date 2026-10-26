-- Run this whole file once in Supabase SQL Editor (19 Oct 2026).
-- = migrations 20261012190000_service_jobs_v2.sql + 20261013110000_service_trips.sql, in order.
-- Each part has its own begin/commit; on an error, stop and send the message.

-- ===================== PART 1: service_jobs_v2 =====================
-- Service jobs v2: complaints for completed customers, completion codes, 5-year warranty
-- (NOT YET RUN - needs the owner's go-ahead). Background: docs/TECHNICIAN_PLAN.md.
--
--   * Allows technician accounts (same as 20261004120000_allow_technician_role.sql,
--     so only this file needs to be run).
--   * A complaint is raised from a COMPLETED customer card (customer_id). The
--     database fills the name, consumer no., the WhatsApp number for the code
--     (otp_phone) and the warranty from the customer. One open complaint per customer.
--     Ticket numbers, otp_phone and the warranty can never be typed or edited.
--   * Statuses: open -> assigned -> completion_pending (code sent on WhatsApp)
--     -> completed. Office can also cancel, reopen, or close a job without the
--     code (completion_method 'office_override' + reason).
--   * Only the service-otp edge function (service role) can close a job with a
--     code (completion_method 'otp'). Codes are kept only as hashes in
--     service_completion_otps, which the app cannot change. Admin can see the
--     sends (not the hash) if a customer disputes a job.
--   * Switched-off (inactive) technicians cannot see the queue or claim jobs.
--   * Warranty: start = installation date, else material delivery date, else the
--     day the customer was moved to Completed (India time). End = start + 5 years
--     - 1 day. src/utils/warranty.js uses the same rule.
--   * Old completed complaints are marked "Closed before completion codes".
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Technician accounts ------------------------------------------------------

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check (user_type = any (array[
    'admin', 'sales', 'channel_partner_office', 'office2', 'agent2', 'agent',
    'vendor', 'stamp', 'channel_partner_office_manager', 'dealer', 'technician'
]::text[]));

-- 2. Helpers ------------------------------------------------------------------
-- (Only helpers that read existing columns go here: the SQL editor checks a
-- SQL function's body when it is created, before the new columns exist.)

-- Last day of the 5-year warranty. Postgres turns 29 Feb + 5 years into 28 Feb.
create or replace function public.warranty_end_for(p_start date)
returns date
language sql
immutable
security definer
set search_path = public, pg_temp
as $$
    select (p_start + interval '5 years')::date - 1
$$;

-- 10-digit Indian mobile from whatever was typed ("+91 98765-43210" -> 9876543210), else null.
create or replace function public.clean_indian_mobile(p_phone text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
    select case when cleaned ~ '^[6-9][0-9]{9}$' then cleaned end
    from (
        select case
            when length(digits) = 13 and digits like '910%' then substr(digits, 4)
            when length(digits) = 12 and digits like '91%' then substr(digits, 3)
            when length(digits) = 11 and digits like '0%' then substr(digits, 2)
            else digits
        end as cleaned
        from (select regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g') as digits) raw
    ) phone
$$;

-- Warranty of a customer card by the 5-year rule (same as src/utils/warranty.js).
-- Security invoker: the card is read with the caller's own access rules.
create or replace function public.customer_warranty(p_customer_id uuid,
    out warranty_start date, out warranty_end date, out warranty_status text)
language sql
stable
set search_path = public, pg_temp
as $$
    select start_date, public.warranty_end_for(start_date),
           case when start_date is null then 'unknown'
                when (now() at time zone 'Asia/Kolkata')::date > public.warranty_end_for(start_date) then 'out_of_warranty'
                else 'in_warranty' end
    from (select coalesce(a.installation_date, a.material_delivery_date,
                          (a.completed_at at time zone 'Asia/Kolkata')::date) as start_date
          from public.admin a where a.id = p_customer_id) customer
$$;

-- 3. Update guard (replaced first so the back-fill below can switch it off) ---

create or replace function public.guard_service_issue_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
    my_type text;
    tech_fields constant text[] := array['status', 'assigned_to', 'assigned_at', 'give_up_reason', 'updated_at'];
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
    new.updated_at := now();
    return new;
end;
$$;
create or replace trigger service_issue_guard before update on public.service_issues
for each row execute function public.guard_service_issue_update();

-- 4. New columns and back-fill --------------------------------------------------

-- Switched off only for the back-fill, so old rows keep their real updated_at.
alter table public.service_issues disable trigger service_issue_guard;

alter table public.service_issues add column if not exists customer_id uuid;
alter table public.service_issues add column if not exists otp_phone text;
alter table public.service_issues add column if not exists warranty_start date;
alter table public.service_issues add column if not exists warranty_end date;
alter table public.service_issues add column if not exists warranty_status text not null default 'unknown';
alter table public.service_issues add column if not exists completion_requested_at timestamptz;
alter table public.service_issues add column if not exists completed_at timestamptz;
alter table public.service_issues add column if not exists completed_by uuid;
alter table public.service_issues add column if not exists completion_method text;
alter table public.service_issues add column if not exists override_reason text;
alter table public.service_issues add column if not exists cancel_reason text;

-- Ticket numbers from 1001; existing complaints numbered in the order they were raised.
do $$ begin
    if not exists (select 1 from information_schema.columns
                   where table_schema = 'public' and table_name = 'service_issues' and column_name = 'ticket_no') then
        alter table public.service_issues add column ticket_no bigint generated by default as identity (start with 1001);
        update public.service_issues issue set ticket_no = numbered.ticket_no
        from (select id, 1000 + row_number() over (order by created_at, id) as ticket_no
              from public.service_issues) numbered
        where numbered.id = issue.id;
    end if;
end $$;
-- From now on numbers come only from the sequence: nobody can type or change one.
alter table public.service_issues alter column ticket_no set generated always;

-- Ticket no. of the customer's open complaint. Security definer because the
-- person raising a complaint may not be allowed to see one raised by someone else.
-- Answers only the server and the people who may raise complaints.
create or replace function public.active_complaint_ticket(p_customer_id uuid)
returns bigint
language sql
security definer
set search_path = public, pg_temp
as $$
    select issue.ticket_no from public.service_issues issue
    where issue.customer_id = p_customer_id
      and issue.status in ('open', 'assigned', 'completion_pending')
      and (auth.uid() is null or public.get_my_user_type() in ('admin', 'sales', 'channel_partner_office',
           'channel_partner_office_manager', 'office2', 'agent', 'agent2'))
    order by issue.created_at
    limit 1
$$;

alter table public.service_issues drop constraint if exists service_issues_status_check;
alter table public.service_issues drop constraint if exists service_issue_assignment_matches_status;

-- Complaints closed before this change had no code.
update public.service_issues
set completion_method = 'office_override',
    override_reason = 'Closed before completion codes',
    completed_at = coalesce(completed_at, updated_at, now())
where status = 'completed' and completion_method is null;

-- Link old complaints to a customer only when the consumer no. matches exactly
-- one customer, and never two open complaints to the same customer (oldest wins).
with candidates as (
    select issue.id, issue.status, issue.created_at, (array_agg(a.id))[1] as match_id
    from public.service_issues issue
    join public.admin a on a.deleted_at is null and btrim(a.consumer_no) = btrim(issue.consumer_no)
    where issue.customer_id is null
    group by issue.id
    having count(*) = 1
), ranked as (
    select candidates.*,
           row_number() over (partition by match_id, status in ('open', 'assigned', 'completion_pending')
                              order by created_at, id) as position
    from candidates
)
update public.service_issues issue
set customer_id = ranked.match_id
from ranked
where ranked.id = issue.id
  and (ranked.status not in ('open', 'assigned', 'completion_pending')
       or (ranked.position = 1 and public.active_complaint_ticket(ranked.match_id) is null));

-- Warranty and code number for linked complaints, from the customer.
update public.service_issues issue
set warranty_start = w.warranty_start,
    warranty_end = w.warranty_end,
    warranty_status = w.warranty_status,
    otp_phone = coalesce(issue.otp_phone, public.clean_indian_mobile(a.phone_number))
from public.admin a, lateral public.customer_warranty(a.id) w
where a.id = issue.customer_id and issue.warranty_start is null;

-- Unlinked complaints: code number from the phone typed on the complaint.
update public.service_issues
set otp_phone = public.clean_indian_mobile(customer_phone)
where customer_id is null and otp_phone is null and public.clean_indian_mobile(customer_phone) is not null;

alter table public.service_issues enable trigger service_issue_guard;

-- 5. Constraints and indexes ---------------------------------------------------

alter table public.service_issues add constraint service_issues_status_check
    check (status in ('open', 'assigned', 'completion_pending', 'completed', 'cancelled'));
alter table public.service_issues add constraint service_issue_assignment_matches_status check (
    (status = 'open' and assigned_to is null)
    or (status in ('assigned', 'completion_pending') and assigned_to is not null)
    or (status = 'completed' and (assigned_to is not null or completion_method = 'office_override'))
    or status = 'cancelled'
);
alter table public.service_issues drop constraint if exists service_issues_warranty_status_check;
alter table public.service_issues add constraint service_issues_warranty_status_check
    check (warranty_status in ('in_warranty', 'out_of_warranty', 'unknown'));
alter table public.service_issues drop constraint if exists service_issues_completion_method_check;
alter table public.service_issues add constraint service_issues_completion_method_check
    check (completion_method in ('otp', 'office_override'));
alter table public.service_issues drop constraint if exists service_issues_override_reason_check;
alter table public.service_issues add constraint service_issues_override_reason_check
    check (length(override_reason) <= 500);
alter table public.service_issues drop constraint if exists service_issues_cancel_reason_check;
alter table public.service_issues add constraint service_issues_cancel_reason_check
    check (length(cancel_reason) <= 500);
alter table public.service_issues drop constraint if exists service_issues_otp_phone_check;
alter table public.service_issues add constraint service_issues_otp_phone_check
    check (otp_phone ~ '^[6-9][0-9]{9}$');

do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_customer_id_fkey' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_customer_id_fkey foreign key (customer_id) references public.admin(id) on delete set null;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_completed_by_fkey' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_completed_by_fkey foreign key (completed_by) references auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_ticket_no_key' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_ticket_no_key unique (ticket_no);
end if; end $$;

create unique index if not exists service_issues_one_active_per_customer on public.service_issues (customer_id)
    where customer_id is not null and status in ('open', 'assigned', 'completion_pending');
create index if not exists service_issues_customer_idx on public.service_issues (customer_id, created_at desc);

-- 6. Filling a new complaint from the customer -----------------------------------

-- Security invoker: the customer is read with the caller's own access rules,
-- so a branch can only raise complaints for customers it can see.
create or replace function public.fill_service_issue_from_customer()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
    customer record;
    open_ticket bigint;
begin
    if new.customer_id is not null then
        select a.customer_name, a.consumer_no, a.phone_number, a.full_address, a.villages, a.sub_divisions,
               a.district, a.channel_partner, a.module_brand, a.system_capacity_kwp, a.stage, a.deleted_at
        into customer
        from public.admin a where a.id = new.customer_id;
        if not found or customer.deleted_at is not null or customer.stage is distinct from 'COMPLETED' then
            raise exception 'Complaints can only be raised for completed customers.';
        end if;
        -- Two people raising at the same moment wait in turn, so the second gets the message below.
        perform pg_advisory_xact_lock(hashtextextended('service_issue_customer:' || new.customer_id::text, 0));
        open_ticket := public.active_complaint_ticket(new.customer_id);
        if open_ticket is not null then
            raise exception 'Complaint #% is already open for this customer.', open_ticket;
        end if;
        new.consumer_no := left(coalesce(nullif(btrim(customer.consumer_no), ''), btrim(new.consumer_no)), 100);
        if coalesce(new.consumer_no, '') = '' then
            raise exception 'Add the consumer number on the customer card first.';
        end if;
        new.customer_name := left(coalesce(nullif(btrim(customer.customer_name), ''), btrim(new.customer_name)), 160);
        if coalesce(new.customer_name, '') = '' then
            raise exception 'Add the customer name on the customer card first.';
        end if;
        new.customer_phone := coalesce(nullif(btrim(new.customer_phone), ''), nullif(btrim(customer.phone_number), ''));
        new.service_address := coalesce(nullif(btrim(new.service_address), ''), nullif(btrim(customer.full_address), ''),
            nullif(concat_ws(', ', nullif(btrim(customer.villages), ''), nullif(btrim(customer.sub_divisions), ''),
                             nullif(btrim(customer.district), '')), ''));
        new.channel_partner_name := coalesce(nullif(btrim(new.channel_partner_name), ''), nullif(btrim(customer.channel_partner), ''));
        new.system_company_name := coalesce(nullif(btrim(new.system_company_name), ''), nullif(btrim(customer.module_brand), ''));
        new.system_kw := coalesce(new.system_kw, customer.system_capacity_kwp);
        -- The code always goes to the customer's registered number, never a typed one.
        new.otp_phone := public.clean_indian_mobile(customer.phone_number);
        select w.warranty_start, w.warranty_end, w.warranty_status
        into new.warranty_start, new.warranty_end, new.warranty_status
        from public.customer_warranty(new.customer_id) w;
    else
        if auth.uid() is not null and coalesce(public.get_my_user_type(), '') not in ('admin', 'sales') then
            raise exception 'Raise a complaint from the completed customer card.';
        end if;
        new.otp_phone := public.clean_indian_mobile(new.customer_phone);
        new.warranty_start := null;
        new.warranty_end := null;
        new.warranty_status := 'unknown';
    end if;
    -- A new complaint always starts in the open queue, dated now.
    new.status := 'open';
    new.assigned_to := null;
    new.assigned_at := null;
    new.give_up_reason := null;
    new.completion_requested_at := null;
    new.completed_at := null;
    new.completed_by := null;
    new.completion_method := null;
    new.override_reason := null;
    new.cancel_reason := null;
    if auth.uid() is not null then
        new.created_at := now();
        new.updated_at := now();
    end if;
    return new;
end;
$$;
create or replace trigger fill_service_issue_from_customer before insert on public.service_issues
for each row execute function public.fill_service_issue_from_customer();

-- 7. Completion codes (written only by the service-otp edge function) ---------------

create table if not exists public.service_completion_otps (
    id uuid primary key default gen_random_uuid(),
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    phone text not null,
    -- 'sms': Message Central made the code and checks it (mc_verification_id);
    -- 'firebase': Google sent it from the technician's phone and signed the result;
    -- 'whatsapp': we made it and keep only its salted hash.
    provider text not null default 'sms' check (provider in ('sms', 'firebase', 'whatsapp')),
    mc_verification_id text,
    code_salt text,
    code_hash text,
    expires_at timestamptz not null,
    attempts integer not null default 0,
    verified_at timestamptz,
    superseded_at timestamptz,
    requested_by uuid references auth.users(id),
    wa_message_id text,
    send_error text,
    created_at timestamptz not null default now()
);
-- For a table made by an earlier run of this file.
alter table public.service_completion_otps add column if not exists provider text not null default 'sms';
alter table public.service_completion_otps add column if not exists mc_verification_id text;
alter table public.service_completion_otps alter column code_salt drop not null;
alter table public.service_completion_otps alter column code_hash drop not null;
create index if not exists service_completion_otps_issue_time_idx on public.service_completion_otps (issue_id, created_at desc);
alter table public.service_completion_otps enable row level security;
revoke all on public.service_completion_otps from public, anon, authenticated;
grant all on public.service_completion_otps to service_role;
-- Admin can look at sent codes if a customer disputes a job, but never the salt
-- and hash: a 6-digit code can be worked out from those in seconds.
drop policy if exists service_completion_otps_admin_read on public.service_completion_otps;
create policy service_completion_otps_admin_read on public.service_completion_otps
for select to authenticated using (public.get_my_user_type() = 'admin');
grant select (id, issue_id, phone, provider, expires_at, attempts, verified_at, superseded_at, requested_by,
              wa_message_id, send_error, created_at) on public.service_completion_otps to authenticated;

-- A code stops working once the job leaves its technician (give up, reassign,
-- cancel, office close) or the number changes. Sending a code (assigned ->
-- completion_pending) keeps it.
create or replace function public.supersede_service_completion_codes()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.assigned_to is distinct from old.assigned_to
       or new.otp_phone is distinct from old.otp_phone
       or new.status not in ('assigned', 'completion_pending') then
        update public.service_completion_otps
        set superseded_at = now()
        where issue_id = new.id and verified_at is null and superseded_at is null;
    end if;
    return null;
end;
$$;
-- Not "update of <columns>": the guard changes otp_phone and status itself, and
-- column lists only see what the app sent.
create or replace trigger service_issue_supersede_codes after update on public.service_issues
for each row execute function public.supersede_service_completion_codes();

-- 8. App functions ------------------------------------------------------------

-- Switched-off technicians keep their login until it expires, so check here too.
create or replace function public.claim_service_issue(p_issue_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare claimed_id uuid;
begin
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'technician'
                   and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Technician account required';
    end if;
    update public.service_issues issue
    set status = 'assigned', assigned_to = auth.uid(), assigned_at = now(), give_up_reason = null
    where issue.id = p_issue_id and issue.status = 'open'
    returning issue.id into claimed_id;
    return claimed_id is not null;
end;
$$;

create or replace function public.give_up_service_issue(p_issue_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare changed_id uuid;
begin
    if public.get_my_user_type() is distinct from 'technician' or coalesce(p_reason, '') !~ '[^[:space:]]' then
        raise exception 'Technician account and give-up reason required';
    end if;
    update public.service_issues issue
    set status = 'open', assigned_to = null, assigned_at = null, give_up_reason = btrim(p_reason)
    where issue.id = p_issue_id and issue.status in ('assigned', 'completion_pending')
      and issue.assigned_to = auth.uid()
    returning issue.id into changed_id;
    if changed_id is not null then
        -- A code already sent for this job can no longer close it.
        update public.service_completion_otps
        set superseded_at = now()
        where issue_id = changed_id and verified_at is null and superseded_at is null;
    end if;
    return changed_id is not null;
end;
$$;

-- Return type changed (ticket no., warranty), so drop and create.
drop function if exists public.open_service_issue_queue();
create function public.open_service_issue_queue()
returns table(id uuid, ticket_no bigint, customer_name text, problem_type text, required_date date,
              status text, give_up_reason text, warranty_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.user_type = 'technician'
                   and coalesce(p.status, 'active') <> 'inactive') then
        raise exception 'Technician account required';
    end if;
    -- No phone or address until the job is claimed.
    return query select issue.id, issue.ticket_no, issue.customer_name, issue.problem_type,
        issue.required_date, issue.status, issue.give_up_reason, issue.warranty_status
    from public.service_issues issue where issue.status = 'open'
    order by issue.required_date, issue.created_at;
end;
$$;

-- Technicians the office can assign a job to.
create or replace function public.service_technicians()
returns table(id uuid, name text)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
    if coalesce(public.get_my_user_type(), '') not in ('admin', 'sales') then
        raise exception 'Office account required';
    end if;
    return query select p.id, p.name from public.profiles p
    where p.user_type = 'technician' and coalesce(p.status, 'active') <> 'inactive'
    order by p.name;
end;
$$;

revoke all on function public.warranty_end_for(date) from public, anon;
revoke all on function public.clean_indian_mobile(text) from public, anon;
revoke all on function public.customer_warranty(uuid) from public, anon;
revoke all on function public.active_complaint_ticket(uuid) from public, anon;
revoke all on function public.claim_service_issue(uuid) from public, anon;
revoke all on function public.give_up_service_issue(uuid, text) from public, anon;
revoke all on function public.open_service_issue_queue() from public, anon;
revoke all on function public.service_technicians() from public, anon;
revoke all on function public.guard_service_issue_update() from public, anon;
revoke all on function public.fill_service_issue_from_customer() from public, anon;
revoke all on function public.supersede_service_completion_codes() from public, anon;
-- The insert and update triggers run these as the caller, including the service role.
grant execute on function public.warranty_end_for(date) to authenticated, service_role;
grant execute on function public.clean_indian_mobile(text) to authenticated, service_role;
grant execute on function public.customer_warranty(uuid) to authenticated, service_role;
grant execute on function public.active_complaint_ticket(uuid) to authenticated, service_role;
grant execute on function public.claim_service_issue(uuid) to authenticated;
grant execute on function public.give_up_service_issue(uuid, text) to authenticated;
grant execute on function public.open_service_issue_queue() to authenticated;
grant execute on function public.service_technicians() to authenticated;

-- 9. Access rules --------------------------------------------------------------
-- Read and raise rules are unchanged. Office has full update rights; the guard
-- above decides which changes are allowed.
drop policy if exists service_issues_update on public.service_issues;
create policy service_issues_update on public.service_issues
for update to authenticated
using (
    public.get_my_user_type() in ('admin', 'sales')
    or (public.get_my_user_type() = 'technician' and assigned_to = (select auth.uid()))
)
with check (
    public.get_my_user_type() in ('admin', 'sales')
    or (public.get_my_user_type() = 'technician'
        and (assigned_to = (select auth.uid()) or (status = 'open' and assigned_to is null)))
);

commit;

-- Check (expect technician in the first list, every complaint with a ticket no.,
-- old completed ones as office_override, and the three triggers):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_user_type_check';
-- select status, completion_method, warranty_status, count(*), min(ticket_no), max(ticket_no),
--        count(customer_id) as linked from public.service_issues group by 1, 2, 3 order by 1;
-- select tgname from pg_trigger where tgrelid = 'public.service_issues'::regclass and not tgisinternal order by 1;

-- ===================== PART 2: service_trips =====================
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

-- 4. Km pay settings (added 18 Oct) ------------------------------------------------
-- One row: the rate per km, the grace km and whether a visit is counted there and
-- back by default. Admin and office (sales) can read and change it. Each visit keeps
-- the round trip / grace / rate it was worked out with, so a later rate change
-- never changes what was already paid.
create table if not exists public.service_km_settings (
    id boolean primary key default true check (id),
    rate_per_km numeric(8,2) not null default 0 check (rate_per_km between 0 and 1000),
    grace_km numeric(6,1) not null default 5 check (grace_km between 0 and 100),
    round_trip boolean not null default true,
    updated_at timestamptz not null default now(),
    updated_by uuid references auth.users(id)
);
insert into public.service_km_settings (id) values (true) on conflict (id) do nothing;
alter table public.service_km_settings enable row level security;
revoke all on public.service_km_settings from public, anon, authenticated;
grant select on public.service_km_settings to authenticated;
grant update (rate_per_km, grace_km, round_trip, updated_at, updated_by) on public.service_km_settings to authenticated;
grant all on public.service_km_settings to service_role;
drop policy if exists service_km_settings_office_read on public.service_km_settings;
create policy service_km_settings_office_read on public.service_km_settings
for select to authenticated using (public.get_my_user_type() in ('admin', 'sales'));
drop policy if exists service_km_settings_office_update on public.service_km_settings;
create policy service_km_settings_office_update on public.service_km_settings
for update to authenticated
using (public.get_my_user_type() in ('admin', 'sales'))
with check (public.get_my_user_type() in ('admin', 'sales') and updated_by = (select auth.uid()));

alter table public.service_visits add column if not exists round_trip boolean;
alter table public.service_visits add column if not exists grace_km numeric(6,1);
alter table public.service_visits add column if not exists rate_per_km numeric(8,2);
alter table public.service_visits drop constraint if exists service_visits_grace_km_check;
alter table public.service_visits add constraint service_visits_grace_km_check check (grace_km between 0 and 100);
alter table public.service_visits drop constraint if exists service_visits_rate_per_km_check;
alter table public.service_visits add constraint service_visits_rate_per_km_check check (rate_per_km between 0 and 1000);

commit;

-- Check (expect the table with RLS on, 2 functions, the new visit columns and the trigger):
-- select relrowsecurity from pg_class where oid = 'public.service_trips'::regclass;
-- select proname, prosecdef, proconfig from pg_proc where proname in ('service_start_trip', 'service_mark_reached');
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'service_visits' and column_name in ('trip_id', 'km_estimate', 'km_note');
-- select tgname from pg_trigger where tgrelid = 'public.service_visits'::regclass and not tgisinternal;
-- select start_source, count(*), count(reached_at) as reached from public.service_trips group by 1;
-- select rate_per_km, grace_km, round_trip from public.service_km_settings;  -- 1 row: 0, 5, true

-- ===================== CHECK (shows after running) =====================
select
  (select pg_get_constraintdef(oid) like '%technician%' from pg_constraint where conname = 'profiles_user_type_check') as technician_allowed,
  (select count(*) from information_schema.columns where table_name = 'service_completion_otps' and column_name in ('provider', 'mc_verification_id')) as otp_columns_2,
  (select count(*) from pg_proc where proname in ('service_start_trip', 'service_mark_reached')) as trip_functions_2,
  (select count(*) from information_schema.columns where table_name = 'service_visits' and column_name in ('trip_id', 'km_estimate', 'km_note', 'round_trip', 'grace_km', 'rate_per_km')) as visit_columns_6,
  (select count(*) from public.service_km_settings) as km_settings_1;
