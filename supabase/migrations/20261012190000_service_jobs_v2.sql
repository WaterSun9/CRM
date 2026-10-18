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
    code_salt text not null,
    code_hash text not null,
    expires_at timestamptz not null,
    attempts integer not null default 0,
    verified_at timestamptz,
    superseded_at timestamptz,
    requested_by uuid references auth.users(id),
    wa_message_id text,
    send_error text,
    created_at timestamptz not null default now()
);
create index if not exists service_completion_otps_issue_time_idx on public.service_completion_otps (issue_id, created_at desc);
alter table public.service_completion_otps enable row level security;
revoke all on public.service_completion_otps from public, anon, authenticated;
grant all on public.service_completion_otps to service_role;
-- Admin can look at sent codes if a customer disputes a job, but never the salt
-- and hash: a 6-digit code can be worked out from those in seconds.
drop policy if exists service_completion_otps_admin_read on public.service_completion_otps;
create policy service_completion_otps_admin_read on public.service_completion_otps
for select to authenticated using (public.get_my_user_type() = 'admin');
grant select (id, issue_id, phone, expires_at, attempts, verified_at, superseded_at, requested_by,
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
