-- Watersun CRM - the complete database backend in one file.
--
-- Generated read-only from the LIVE project on 2026-10-04 (after the 4 Oct
-- release, red flags, customer-file scoping and the team chat rules of
-- migration 20261004140000).
-- Every table, constraint, index, function, view, trigger, access rule (RLS),
-- grant, storage bucket, realtime table and scheduled job the app uses.
-- Checked: built twice on an empty Postgres; policies, constraints, function
-- bodies, triggers and grants compared identical to live.
--
-- USE IT TO:
--   * set up the CRM for ANOTHER CLIENT (a new, empty Supabase project), or
--   * build a staging / disaster-recovery copy.
-- New project steps (full list in docs/OPERATIONS.md, "New client setup"):
--   1. Create the Supabase project. SQL Editor > New query > paste this whole
--      file > Run. It is safe to run twice.
--   2. Create the first admin (section 10 at the bottom).
--   3. Deploy the edge functions (supabase/functions) and set their secrets.
--   4. Point the frontend at the new project (.env) and deploy.
--
-- DO NOT run it on the live Watersun project: it is not needed there. Future
-- changes go in supabase/migrations/, then this file is regenerated.
--
-- Not included (data, not structure): customers, users, files, dropdown lists
-- (metadata), vendors, drivers. Migrations written but NOT run on live are not
-- in here either: 20261004000200 (uploader role), 20261004120000 (technician
-- role); 20261004130000 was superseded by 20261004140000.

set check_function_bodies = false;
set search_path = public, extensions;

begin;


-- ============================================================================
-- 1. Extensions
-- ============================================================================

create extension if not exists pg_stat_statements with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto with schema extensions;
create extension if not exists supabase_vault with schema vault;
do $$ begin
    create extension if not exists pg_cron with schema pg_catalog;
exception when others then
    raise notice 'pg_cron could not be enabled here (%). Enable it under Database > Extensions, then run the cron line at the end again.', sqlerrm;
end $$;


-- ============================================================================
-- 2. Tables
-- ============================================================================

create table if not exists public.activity_log (
    id uuid default gen_random_uuid() not null,
    user_id uuid,
    action text not null,
    message text not null,
    new_value text,
    created_at timestamp with time zone default now(),
    customer_id uuid
);

create table if not exists public.admin (
    id uuid default gen_random_uuid() not null,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    deleted_at timestamp with time zone,
    customer_name text not null,
    phone_number text,
    email_address text,
    payment_type text,
    villages text,
    folder_no numeric,
    system_capacity_kwp numeric,
    module_brand text,
    registration_date date,
    panel_serial_no json,
    inverter_serial_no text,
    invoice_no text,
    adhaar_card_front boolean default false,
    pan_card boolean default false,
    index_2 boolean default false,
    light_bill boolean default false,
    bank_details boolean default false,
    house_geo_tag_photo boolean default false,
    application_done_by text,
    consumer_no text,
    channel_partner text,
    sub_channel_partner text,
    sub_divisions text,
    stage text default 'LEADS'::text,
    subsidy_history jsonb default '[]'::jsonb,
    follow_ups jsonb default '[]'::jsonb,
    internal_remarks text,
    module_wp numeric,
    loan_registration_date date,
    panel text,
    sfdc_photo boolean default false,
    warranty_card boolean default false,
    insurance_status boolean default false,
    stages_remarks json,
    subsidy_tag text,
    completed_at timestamp with time zone,
    registration_by text,
    loan_history jsonb default '[]'::jsonb,
    loan_tag text,
    registration_no text,
    vendor text,
    installation_status text default 'No'::text,
    geo_tag_status text default 'Pending'::text,
    cash_details jsonb,
    hold_procurement text default 'Project lost'::text,
    meter_installation text,
    driver_phone_number numeric,
    driver_name text,
    dcr_certificate boolean,
    discom_submission json,
    discom_inspection text,
    installation_date date,
    feasibilty_document boolean,
    subsidy_token_photo boolean,
    vendor_payment_status text default 'Pending'::text,
    vendor_paid_date date,
    vendor_paid_by text,
    signature_pic boolean,
    stamp boolean default false,
    geo_tag_image boolean default false,
    roof_shed text,
    dc_cable numeric,
    ac_cable numeric,
    invoice_value numeric,
    adhaar_card_back boolean default false,
    no_of_modules integer,
    extra_docs boolean default false,
    digital_certificate boolean,
    structure_front_leg_height numeric,
    structure_rear_leg_height numeric,
    material_order_notes text,
    inverter_make text,
    vendor_note text,
    installation_note text,
    vendor_give_up_approved boolean default false,
    vendor_quote numeric,
    material_delivery_date date,
    pm_surya_ghar_stamp boolean default false,
    meter_installation_photo boolean default false,
    delivery_batch_id text,
    vehicle_number text,
    application_acknowledgment boolean default false,
    vendor_feasibility boolean default false,
    site_feasibility boolean default false,
    delivery_status text default 'PENDING'::text,
    jansamarth_application_no text,
    feasibility_no text,
    bank_name text,
    bank_branch text,
    sfdc_photo_text text,
    warranty_card_text text,
    file_status text,
    district text,
    loan_by text,
    pcr_certificate boolean default false not null,
    plant_commissioning_report boolean default false not null,
    full_address text,
    pincode text,
    discom_agreement boolean default false not null
);

create table if not exists public.admin_history (
    id bigint generated always as identity not null,
    customer_id uuid not null,
    changed_at timestamp with time zone default now() not null,
    changed_by uuid,
    action text not null,
    changes jsonb not null
);

create table if not exists public.bom (
    id uuid default gen_random_uuid() not null,
    admin_id uuid not null,
    bom_type text,
    material_loading_date date,
    paper_prepared_by text,
    paper_prepared_date date,
    material_loaded_by text,
    material_loaded_date date,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.bom_items (
    id uuid default gen_random_uuid() not null,
    bom_id uuid not null,
    product_name text not null,
    quantity text,
    integration_by text,
    note text,
    created_at timestamp with time zone default now() not null,
    loaded boolean default false not null
);

create table if not exists public.crm_availability (
    id uuid default gen_random_uuid() not null,
    user_id uuid not null,
    vendor_name text default ''::text not null,
    entry_kind text not null,
    start_date date not null,
    end_date date not null,
    note text default ''::text not null,
    status text default 'pending'::text not null,
    created_at timestamp with time zone default now() not null,
    reviewed_at timestamp with time zone,
    reviewed_by uuid
);

create table if not exists public.crm_chat_messages (
    id uuid default gen_random_uuid() not null,
    sender_id uuid not null,
    recipient_id uuid,
    audience text not null,
    topic text not null,
    body text not null,
    created_at timestamp with time zone default now() not null,
    target_role text,
    cc_id uuid
);

create table if not exists public.customer_payment_review_flags (
    admin_id uuid not null,
    active boolean default true not null,
    updated_by uuid not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.delivery_batches (
    id uuid default gen_random_uuid() not null,
    batch_no text,
    dispatch_date date,
    driver_name text,
    driver_phone numeric,
    vehicle_number text,
    vendor text,
    notes text,
    status text default 'IN_TRANSIT'::text,
    project_ids uuid[],
    rent_amount numeric(12,2),
    car_rent_paid text,
    car_rent_paid_by text,
    car_rent_paid_at text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone
);

create table if not exists public.documents (
    id uuid default gen_random_uuid() not null,
    customer_id uuid not null,
    file_name text not null,
    storage_path text not null,
    file_type text,
    doc_type text,
    uploaded_by uuid,
    uploaded_at timestamp with time zone default timezone('utc'::text, now()) not null,
    remark text default ''::text
);

create table if not exists public.drivers (
    id uuid default gen_random_uuid() not null,
    name text not null,
    phone text,
    vehicle_number text,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.metadata (
    id uuid default gen_random_uuid() not null,
    category text not null,
    label text not null
);

create table if not exists public.profiles (
    id uuid not null,
    name text not null,
    email text not null,
    user_type text default 'agent'::text not null,
    created_at timestamp with time zone default now(),
    role text,
    status text default 'active'::text,
    channel_partner text,
    created_by uuid
);

create table if not exists public.quotations (
    id uuid default gen_random_uuid() not null,
    quotation_no bigint generated always as identity not null,
    owner_id uuid default auth.uid() not null,
    owner_name_snapshot text,
    owner_phone_snapshot text,
    source_lead_id uuid,
    converted_lead_id uuid,
    customer_name text not null,
    customer_phone text not null,
    customer_email text,
    full_address text,
    village text,
    taluka text,
    district text,
    pincode text,
    quotation_date date default CURRENT_DATE not null,
    valid_until date,
    capacity_kw numeric(10,2),
    project_type text,
    solar_panel_make text,
    solar_panel_qty integer,
    inverter_option text,
    inverter_brand text,
    geb_geda_charge text,
    starting_price numeric(14,2),
    selected_option smallint,
    status text default 'draft'::text not null,
    lost_reason text,
    lost_remark text,
    quotation_data jsonb default '{}'::jsonb not null,
    schema_version integer default 1 not null,
    pdf_storage_path text,
    issued_at timestamp with time zone,
    converted_at timestamp with time zone,
    lost_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    panel_wattage numeric(10,2)
);

create table if not exists public.service_issue_files (
    id uuid default gen_random_uuid() not null,
    issue_id uuid not null,
    storage_path text not null,
    file_name text not null,
    mime_type text not null,
    uploaded_by uuid not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.service_issues (
    id uuid default gen_random_uuid() not null,
    channel_partner_name text,
    consumer_no text not null,
    customer_name text not null,
    customer_phone text,
    service_address text,
    problem_type text not null,
    system_company_name text,
    system_kw numeric(9,2),
    comment text default ''::text not null,
    required_date date not null,
    status text default 'open'::text not null,
    assigned_to uuid,
    assigned_at timestamp with time zone,
    give_up_reason text,
    created_by uuid not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null
);

create table if not exists public.service_visits (
    id uuid default gen_random_uuid() not null,
    issue_id uuid not null,
    technician_id uuid not null,
    visit_date date not null,
    kilometers numeric(9,2) not null,
    amount_inr numeric(12,2) not null,
    note text default ''::text not null,
    entered_by uuid not null,
    created_at timestamp with time zone default now() not null
);

create table if not exists public.vendors (
    id uuid default gen_random_uuid() not null,
    name text not null,
    email text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- ============================================================================
-- 3. Functions (helpers, RPCs, trigger functions)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.chat_branch_of(p_user uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select lower(btrim(coalesce(nullif(btrim(channel_partner), ''), name, '')))
    from public.profiles where id = p_user
$function$
;

CREATE OR REPLACE FUNCTION public.chat_directory()
 RETURNS TABLE(id uuid, name text, user_type text, email text, can_message boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select p.id, p.name, p.user_type,
           case when public.chat_is_office(auth.uid()) then p.email end,
           public.chat_recipient_allowed(p.id)
    from public.profiles p
    where p.id <> auth.uid()
      and coalesce(p.status, 'active') <> 'inactive'
      and (
          public.chat_is_office(auth.uid())
          or public.chat_recipient_allowed(p.id)
          or exists (select 1 from public.crm_chat_messages m
                     where auth.uid() in (m.sender_id, m.recipient_id, m.cc_id)
                       and p.id in (m.sender_id, m.recipient_id, m.cc_id))
      )
    order by p.name
$function$
;

CREATE OR REPLACE FUNCTION public.chat_is_office(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    select coalesce((select user_type in ('admin', 'sales') from public.profiles where id = p_user), false)
$function$
;

CREATE OR REPLACE FUNCTION public.chat_recipient_allowed(p_recipient uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_me uuid := auth.uid();
    v_my_type text;
    v_their_type text;
    v_my_branch text;
begin
    if v_me is null or p_recipient is null or p_recipient = v_me then return false; end if;
    select user_type into v_their_type from public.profiles where id = p_recipient;
    if v_their_type is null then return false; end if;
    if exists (select 1 from public.crm_chat_messages
               where sender_id = p_recipient and (recipient_id = v_me or cc_id = v_me)) then
        return true;
    end if;
    select user_type into v_my_type from public.profiles where id = v_me;
    if v_my_type in ('admin', 'sales') then return true; end if;
    v_my_branch := public.chat_branch_of(v_me);
    if v_my_type in ('channel_partner_office', 'office2') then
        return v_their_type in ('admin', 'sales')
            or (v_their_type in ('channel_partner_office', 'office2', 'agent2')
                and v_my_branch <> '' and public.chat_branch_of(p_recipient) = v_my_branch);
    end if;
    if v_my_type = 'agent2' then
        return v_their_type in ('channel_partner_office', 'office2')
            and v_my_branch <> '' and public.chat_branch_of(p_recipient) = v_my_branch;
    end if;
    return false;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.assign_folder_no()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
    if new.folder_no is null or new.folder_no = 0 then
        perform pg_advisory_xact_lock(hashtext('public.admin.folder_no'));
        select coalesce(max(folder_no), 0) + 1 into new.folder_no from public.admin;
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.claim_service_issue(p_issue_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare claimed_id uuid;
begin
    if public.get_my_user_type() <> 'technician' then
        raise exception 'Technician account required';
    end if;
    update public.service_issues issue
    set status = 'assigned', assigned_to = auth.uid(), assigned_at = now(), give_up_reason = null
    where issue.id = p_issue_id and issue.status = 'open'
    returning issue.id into claimed_id;
    return claimed_id is not null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_old_completed_activity()
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN

  DELETE FROM public.activity_log al
  WHERE al.customer_id IN (
    SELECT a.id
    FROM public.admin a
    WHERE a.stage = 'COMPLETED'
      AND a.completed_at IS NOT NULL
  )
  AND al.customer_id IN (
    SELECT customer_id
    FROM public.activity_log
    WHERE customer_id IS NOT NULL
    GROUP BY customer_id
    HAVING MAX(created_at) < NOW() - INTERVAL '3 months'
  );

END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_channel_partner()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(channel_partner, name) FROM profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_name()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT name FROM profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.get_my_user_type()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT user_type FROM profiles WHERE id = auth.uid()
$function$
;

CREATE OR REPLACE FUNCTION public.give_up_service_issue(p_issue_id uuid, p_reason text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare changed_id uuid;
begin
    if public.get_my_user_type() <> 'technician' or length(trim(coalesce(p_reason, ''))) = 0 then
        raise exception 'Technician account and give-up reason required';
    end if;
    update public.service_issues issue
    set status = 'open', assigned_to = null, assigned_at = null, give_up_reason = trim(p_reason)
    where issue.id = p_issue_id and issue.status = 'assigned' and issue.assigned_to = auth.uid()
    returning issue.id into changed_id;
    return changed_id is not null;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.guard_service_issue_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if auth.uid() is not null and public.get_my_user_type() = 'technician' then
        if (to_jsonb(new) - array['status','assigned_to','assigned_at','give_up_reason','updated_at'])
           is distinct from (to_jsonb(old) - array['status','assigned_to','assigned_at','give_up_reason','updated_at']) then
            raise exception 'Technicians cannot edit issue details';
        end if;
        if old.status = 'open' and new.status = 'assigned' and new.assigned_to = auth.uid()
           and new.assigned_at is not null and new.give_up_reason is null then
            null;
        elsif old.status = 'assigned' and old.assigned_to = auth.uid() and new.status = 'open'
           and new.assigned_to is null and new.assigned_at is null
           and length(trim(coalesce(new.give_up_reason, ''))) > 0 then
            null;
        else
            raise exception 'Only claiming an open issue or giving up your assignment is allowed';
        end if;
    end if;
    new.updated_at := now();
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.limit_service_issue_files()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    perform pg_advisory_xact_lock(hashtextextended(new.issue_id::text, 0));
    if (select count(*) from public.service_issue_files where issue_id = new.issue_id) >= 5 then
        raise exception 'A service issue can have at most 5 files';
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.open_service_issue_queue()
 RETURNS TABLE(id uuid, customer_name text, problem_type text, required_date date, status text, give_up_reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    if public.get_my_user_type() <> 'technician' then
        raise exception 'Technician account required';
    end if;
    return query select issue.id, issue.customer_name, issue.problem_type,
        issue.required_date, issue.status, issue.give_up_reason
    from public.service_issues issue where issue.status = 'open'
    order by issue.required_date, issue.created_at;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.set_admin_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_completed_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    if new.stage = 'COMPLETED' then
        if old.stage is distinct from 'COMPLETED' or old.completed_at is null then
            new.completed_at := now();
        else
            new.completed_at := old.completed_at;   -- keep the original date
        end if;
    else
        new.completed_at := null;
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_crm_availability_vendor_name()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
begin
    new.vendor_name := coalesce((select name from public.profiles where id = auth.uid()), 'Vendor');
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_quotation_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    new.updated_at := now();
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.stage_rank(p_stage text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
    select case upper(coalesce(p_stage, ''))
        when 'LEADS' then 1
        when 'REGISTRATION' then 2
        when 'LOAN' then 3
        when 'CASH' then 3
        when 'MATERIAL ORDER' then 4
        when 'MATERIAL INTEGRATION' then 5
        when 'MATERIAL DELIVERY' then 6
        when 'INSTALLATION STATUS' then 7
        when 'GEO TAG PHOTO' then 8
        when 'DISCOM SUBMISSION' then 9
        when 'METER INSTALLATION' then 10
        when 'DISCOM INSPECTION' then 11
        when 'SUBSIDY STATUS' then 12
        when 'FINAL REVIEW' then 13
        when 'COMPLETED' then 14
        else null   -- LOST PROJECT and anything unknown: never checked
    end;
$function$
;

CREATE OR REPLACE FUNCTION public.sync_driver_info_to_admin()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.project_ids is not null and array_length(new.project_ids, 1) > 0
     and new.driver_name is not null and new.driver_name <> '' then
    update public.admin
    set driver_name = new.driver_name,
        driver_phone_number = new.driver_phone
    where id = any(new.project_ids);
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_bom_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
    new.updated_at = now();
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.enforce_profile_privilege_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_caller_type text;
    v_caller_cp   text;
    privileged_changed boolean;
begin
    privileged_changed :=
           (new.user_type       is distinct from old.user_type)
        or (new.role            is distinct from old.role)
        or (new.channel_partner is distinct from old.channel_partner)
        or (new.status          is distinct from old.status)
        or (new.name            is distinct from old.name)
        or (new.email           is distinct from old.email);

    if not privileged_changed then
        return new;
    end if;

    -- Server-side callers (add_user edge function / SQL editor) have no user.
    -- The public key cannot reach this: profiles has no anon policies.
    if auth.uid() is null then
        return new;
    end if;

    v_caller_type := get_my_user_type();
    v_caller_cp   := lower(trim(coalesce(get_my_channel_partner(), '')));

    if v_caller_type = 'admin' then
        return new;
    end if;

    -- A Channel Partner Office may manage their OWN branch, and only to the two
    -- roles their UI offers. They may not move a user to another branch.
    if v_caller_type = 'channel_partner_office'
       and v_caller_cp <> ''
       and lower(trim(coalesce(old.channel_partner, ''))) = v_caller_cp
       and new.channel_partner is not distinct from old.channel_partner
       and (new.user_type is not distinct from old.user_type
            or new.user_type in ('office2', 'agent2'))
    then
        return new;
    end if;

    raise exception
        'Not permitted: name, email, role, branch and status can only be changed by an Admin (or by a Channel Partner Office within their own branch).'
        using errcode = '42501';
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(p_channel_partner text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_role text;
    v_user_branch text;
    v_effective_partner text;
    v_total int := 0;
    v_completed int := 0;
    v_live int := 0;
    v_loan int := 0;
    v_cash int := 0;
    v_installation_count int := 0;
    v_subsidy_count int := 0;
    v_loan_tag_count int := 0;
    v_stages json;
begin
    select user_type, coalesce(nullif(trim(channel_partner), ''), trim(name), '')
    into v_role, v_user_branch
    from public.profiles
    where id = auth.uid();

    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    else
        v_effective_partner := nullif(trim(p_channel_partner), '');
    end if;

    select
        count(*),
        count(*) filter (where upper(trim(stage)) = 'COMPLETED'),
        count(*) filter (where upper(trim(stage)) not in ('COMPLETED', 'LOST PROJECT')),
        count(*) filter (where payment_type ilike '%loan%' or (loan_tag is not null and trim(loan_tag) != '')),
        count(*) filter (where payment_type ilike '%cash%'),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and installation_status is not null and trim(installation_status) != ''
        ),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and subsidy_tag is not null and trim(subsidy_tag) != ''
        ),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and (
                  upper(trim(coalesce(stage, ''))) = 'LOAN'
                  or (loan_tag is not null and trim(loan_tag) != '')
              )
        )
    into v_total, v_completed, v_live, v_loan, v_cash,
         v_installation_count, v_subsidy_count, v_loan_tag_count
    from public.admin
    where deleted_at is null
      and (
          v_effective_partner is null
          or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
          or channel_partner ilike ('%' || v_effective_partner || '%')
      );

    select json_object_agg(stage_upper, count)
    into v_stages
    from (
        select upper(trim(stage)) as stage_upper, count(*) as count
        from public.admin
        where deleted_at is null
          and (
              v_effective_partner is null
              or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
              or channel_partner ilike ('%' || v_effective_partner || '%')
          )
        group by upper(trim(stage))
    ) s;

    return json_build_object(
        'totalProjects', v_total,
        'completedCount', v_completed,
        'liveProjects', v_live,
        'loanCount', v_loan,
        'cashCount', v_cash,
        'installationTagCount', v_installation_count,
        'subsidyTagCount', v_subsidy_count,
        'loanTagCount', v_loan_tag_count,
        'stageCounts', coalesce(v_stages, '{}'::json)
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics_scoped(p_channel_partner text DEFAULT NULL::text, p_dealer text DEFAULT NULL::text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_role text;
    v_user_branch text;
    v_effective_partner text;
    v_effective_dealer text;
    v_total int := 0;
    v_completed int := 0;
    v_live int := 0;
    v_loan int := 0;
    v_cash int := 0;
    v_installation_count int := 0;
    v_subsidy_count int := 0;
    v_loan_tag_count int := 0;
    v_stages json;
begin
    select user_type, coalesce(nullif(trim(channel_partner), ''), trim(name), '')
    into v_role, v_user_branch
    from public.profiles
    where id = auth.uid();

    if v_role in ('channel_partner_office', 'office2', 'channel_partner_office_manager') then
        v_effective_partner := v_user_branch;
    else
        v_effective_partner := nullif(trim(p_channel_partner), '');
    end if;
    v_effective_dealer := nullif(trim(p_dealer), '');

    select
        count(*),
        count(*) filter (where upper(trim(stage)) = 'COMPLETED'),
        count(*) filter (where upper(trim(stage)) not in ('COMPLETED', 'LOST PROJECT')),
        count(*) filter (where payment_type ilike '%loan%' or (loan_tag is not null and trim(loan_tag) != '')),
        count(*) filter (where payment_type ilike '%cash%'),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and installation_status is not null and trim(installation_status) != ''
        ),
        count(*) filter (
            where subsidy_tag is not null and trim(subsidy_tag) != ''
        ),
        count(*) filter (
            where upper(trim(coalesce(stage, ''))) != 'COMPLETED'
              and (
                  upper(trim(coalesce(stage, ''))) = 'LOAN'
                  or (loan_tag is not null and trim(loan_tag) != '')
              )
        )
    into v_total, v_completed, v_live, v_loan, v_cash,
         v_installation_count, v_subsidy_count, v_loan_tag_count
    from public.admin
    where deleted_at is null
      and (
          v_effective_partner is null
          or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
          or channel_partner ilike ('%' || v_effective_partner || '%')
      )
      and (
          v_effective_dealer is null
          or lower(trim(coalesce(sub_channel_partner, ''))) = lower(v_effective_dealer)
      );

    select json_object_agg(stage_upper, count)
    into v_stages
    from (
        select upper(trim(stage)) as stage_upper, count(*) as count
        from public.admin
        where deleted_at is null
          and (
              v_effective_partner is null
              or lower(trim(coalesce(channel_partner, ''))) = lower(trim(v_effective_partner))
              or channel_partner ilike ('%' || v_effective_partner || '%')
          )
          and (
              v_effective_dealer is null
              or lower(trim(coalesce(sub_channel_partner, ''))) = lower(v_effective_dealer)
          )
        group by upper(trim(stage))
    ) s;

    return json_build_object(
        'totalProjects', v_total,
        'completedCount', v_completed,
        'liveProjects', v_live,
        'loanCount', v_loan,
        'cashCount', v_cash,
        'installationTagCount', v_installation_count,
        'subsidyTagCount', v_subsidy_count,
        'loanTagCount', v_loan_tag_count,
        'stageCounts', coalesce(v_stages, '{}'::json)
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.log_admin_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_changes jsonb := '{}'::jsonb;
    v_old jsonb;
    v_new jsonb;
    v_key text;
begin
    if tg_op = 'INSERT' then
        insert into admin_history (customer_id, changed_by, action, changes)
        values (new.id, auth.uid(), 'INSERT',
                jsonb_build_object('customer_name', jsonb_build_object('old', null, 'new', new.customer_name),
                                   'stage',         jsonb_build_object('old', null, 'new', new.stage)));
        return new;
    elsif tg_op = 'DELETE' then
        insert into admin_history (customer_id, changed_by, action, changes)
        values (old.id, auth.uid(), 'DELETE', jsonb_build_object('row', to_jsonb(old)));
        return old;
    end if;

    v_old := to_jsonb(old);
    v_new := to_jsonb(new);
    for v_key in select jsonb_object_keys(v_new) loop
        continue when v_key in ('updated_at');
        if (v_old -> v_key) is distinct from (v_new -> v_key) then
            v_changes := v_changes || jsonb_build_object(
                v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
        end if;
    end loop;

    if v_changes <> '{}'::jsonb then
        insert into admin_history (customer_id, changed_by, action, changes)
        values (new.id, auth.uid(), 'UPDATE', v_changes);
    end if;
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.move_stage(p_customer_id uuid, p_new_stage text, p_old_stage text, p_remark text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_current_remarks TEXT;
    v_updated_remarks TEXT;
    v_append_text TEXT;
    v_formatted_time TEXT;
    v_result JSONB;
    v_current_stage TEXT;
BEGIN
    -- This function bypasses RLS. Missing identities cannot be treated as
    -- trusted callers, because anonymous API requests also have auth.uid null.
    IF auth.uid() IS NULL OR public.get_my_user_type() IS DISTINCT FROM 'admin' THEN
        RAISE EXCEPTION 'Not permitted: only an Admin can move a customer between stages.'
            USING ERRCODE = '42501';
    END IF;

    -- Lock the row for update to prevent concurrent modifications
    SELECT internal_remarks, stage INTO v_current_remarks, v_current_stage
    FROM public.admin
    WHERE id = p_customer_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Customer not found';
    END IF;
    IF v_current_stage IS DISTINCT FROM p_old_stage THEN
        RAISE EXCEPTION 'Customer stage changed; refresh before moving it.' USING ERRCODE = '40001';
    END IF;

    -- Only append a remark if one was actually provided
    IF p_remark IS NOT NULL AND TRIM(p_remark) != '' THEN
        v_formatted_time := to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD Mon, HH:MI AM');

        v_append_text := p_old_stage || ' (' || v_formatted_time || '): ' || TRIM(p_remark);

        IF v_current_remarks IS NOT NULL AND TRIM(v_current_remarks) != '' THEN
            v_updated_remarks := v_current_remarks || E'\n' || v_append_text;
        ELSE
            v_updated_remarks := v_append_text;
        END IF;
    ELSE
        v_updated_remarks := v_current_remarks;
    END IF;

    -- Update the record atomically
    UPDATE public.admin AS a
    SET
        stage = p_new_stage,
        internal_remarks = v_updated_remarks
    WHERE id = p_customer_id
    RETURNING to_jsonb(a) INTO v_result;

    RETURN v_result;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.stamp_monthly_summary()
 RETURNS TABLE(month_key text, month_label text, sent_count bigint, completed_count bigint, approved_count bigint, sent_back_count bigint)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
    with base as (
        select
            coalesce(discom_submission ->> 'stamp_sent', 'false')     as stamp_sent,
            coalesce(discom_submission ->> 'stamp_approved', 'false') as stamp_approved,
            nullif(discom_submission ->> 'sent_to_stamp_maker_at', '')::timestamptz as sent_at,
            nullif(discom_submission ->> 'stamp_completed_at', '')::timestamptz     as completed_at,
            nullif(discom_submission ->> 'stamp_approved_at', '')::timestamptz      as approved_at,
            nullif(discom_submission ->> 'stamp_sendback_at', '')::timestamptz      as sendback_at
        from public.admin
        where deleted_at is null
          and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    ),
    months as (
        select distinct to_char(d, 'YYYY-MM') as month_key
        from (
            select sent_at as d from base where sent_at is not null
            union all select completed_at from base where completed_at is not null
            union all select approved_at  from base where approved_at  is not null
            union all select sendback_at  from base where sendback_at  is not null
        ) x
    )
    select
        m.month_key,
        to_char(to_date(m.month_key, 'YYYY-MM'), 'FMMonth YYYY') as month_label,
        (select count(*) from base b
          where to_char(b.sent_at, 'YYYY-MM') = m.month_key) as sent_count,
        (select count(*) from base b
          where b.stamp_sent = 'true'
            and to_char(b.completed_at, 'YYYY-MM') = m.month_key) as completed_count,
        (select count(*) from base b
          where b.stamp_approved = 'true'
            and to_char(b.approved_at, 'YYYY-MM') = m.month_key) as approved_count,
        (select count(*) from base b
          where to_char(b.sendback_at, 'YYYY-MM') = m.month_key) as sent_back_count
    from months m
    order by m.month_key desc;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_delivery_batch_atomic(p_batch_id uuid, p_project_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_batch_no text;
    v_project_ids uuid[];
    v_project_rows integer;
begin
    if auth.uid() is null or public.get_my_user_type() not in ('admin', 'sales') then
        raise exception 'Not authorized to delete delivery batches' using errcode = '42501';
    end if;
    select batch_no, coalesce(project_ids, '{}'::uuid[])
      into v_batch_no, v_project_ids
      from public.delivery_batches where id = p_batch_id for update;
    if not found then
        raise exception 'Delivery batch not found' using errcode = 'P0002';
    end if;
    if (select array_agg(id order by id) from unnest(v_project_ids) as x(id))
       is distinct from (select array_agg(id_text::uuid order by id_text::uuid)
                         from unnest(coalesce(p_project_ids, '{}'::text[])) as x(id_text)) then
        raise exception 'Batch membership changed; refresh before deleting' using errcode = '40001';
    end if;
    perform 1 from public.admin where id = any(v_project_ids) for update;
    if (select count(*) from public.admin where id = any(v_project_ids)
          and deleted_at is null and delivery_batch_id = v_batch_no) <> cardinality(v_project_ids) then
        raise exception 'Batch customer links changed; refresh before deleting' using errcode = '40001';
    end if;
    -- Delete the batch record
    delete from public.delivery_batches
    where id = p_batch_id;

    -- Clear delivery details from all associated projects
    if array_length(p_project_ids, 1) > 0 then
        update public.admin
        set
            delivery_batch_id = null,
            delivery_status = 'PENDING',
            driver_name = null,
            driver_phone_number = null,
            vehicle_number = null,
            material_delivery_date = null,
            updated_at = now()
        where id = any(v_project_ids)
          and deleted_at is null
          and delivery_batch_id = v_batch_no;
        get diagnostics v_project_rows = row_count;
        if v_project_rows <> cardinality(v_project_ids) then
            raise exception 'Some batch customers could not be unlinked' using errcode = 'P0001';
        end if;
    end if;

    return jsonb_build_object('success', true, 'deleted_batch_id', p_batch_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_bom_atomic(p_admin_id uuid, p_bom jsonb, p_items jsonb, p_expected_bom_id uuid DEFAULT NULL::uuid, p_expected_item_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
    v_bom_id uuid;
    v_bom_count integer;
    v_old_count integer;
    v_deleted_count integer;
    v_new_ids uuid[] := '{}'::uuid[];
    v_item jsonb;
    v_item_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if jsonb_typeof(p_bom) is distinct from 'object'
       or jsonb_typeof(p_items) is distinct from 'array' then
        raise exception 'Invalid BOM payload' using errcode = '22023';
    end if;
    -- Serializes first-time BOM creation for this customer, and RLS ensures
    -- the caller can see and update the customer being edited.
    perform 1 from public.admin where id = p_admin_id and deleted_at is null for update;
    if not found then
        raise exception 'Customer is missing or inaccessible' using errcode = '42501';
    end if;
    select count(*) into v_bom_count from public.bom where admin_id = p_admin_id;
    if v_bom_count > 1 then
        raise exception 'Duplicate BOM rows exist; resolve them before saving' using errcode = '23505';
    end if;
    select id into v_bom_id from public.bom where admin_id = p_admin_id limit 1;
    if p_expected_bom_id is not null and p_expected_bom_id is distinct from v_bom_id then
        raise exception 'BOM changed; refresh before saving' using errcode = '40001';
    end if;
    if v_bom_id is null then
        insert into public.bom (
            admin_id, bom_type, paper_prepared_by, paper_prepared_date,
            material_loaded_by, material_loaded_date
        ) values (
            p_admin_id, p_bom->>'bom_type', p_bom->>'paper_prepared_by',
            nullif(p_bom->>'paper_prepared_date', '')::date,
            p_bom->>'material_loaded_by', nullif(p_bom->>'material_loaded_date', '')::date
        ) returning id into v_bom_id;
    else
        update public.bom set
            bom_type = p_bom->>'bom_type',
            paper_prepared_by = p_bom->>'paper_prepared_by',
            paper_prepared_date = nullif(p_bom->>'paper_prepared_date', '')::date,
            material_loaded_by = p_bom->>'material_loaded_by',
            material_loaded_date = nullif(p_bom->>'material_loaded_date', '')::date
        where id = v_bom_id and admin_id = p_admin_id;
        if not found then
            raise exception 'BOM update was refused' using errcode = '42501';
        end if;
    end if;
    select count(*) into v_old_count from public.bom_items where bom_id = v_bom_id;
    if (select array_agg(id order by id) from public.bom_items where bom_id = v_bom_id)
       is distinct from (select array_agg(id order by id) from unnest(p_expected_item_ids) as x(id)) then
        raise exception 'BOM lines changed; refresh before saving' using errcode = '40001';
    end if;
    delete from public.bom_items where bom_id = v_bom_id;
    get diagnostics v_deleted_count = row_count;
    if v_deleted_count <> v_old_count then
        raise exception 'BOM lines could not all be replaced' using errcode = '42501';
    end if;
    for v_item in select value from jsonb_array_elements(p_items) loop
        if nullif(trim(v_item->>'product_name'), '') is not null then
            insert into public.bom_items (bom_id, product_name, quantity, integration_by, note, loaded)
            values (
                v_bom_id,
                v_item->>'product_name',
                coalesce(v_item->>'quantity', ''),
                nullif(v_item->>'integration_by', ''),
                nullif(v_item->>'note', ''),
                coalesce((v_item->>'loaded')::boolean, false)
            ) returning id into v_item_id;
            v_new_ids := array_append(v_new_ids, v_item_id);
        end if;
    end loop;
    return jsonb_build_object('success', true, 'bom_id', v_bom_id, 'item_ids', v_new_ids);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.save_delivery_batch_atomic(p_batch jsonb, p_selected_project_ids text[], p_removed_project_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_batch_id uuid;
    v_batch_no text;
    v_dispatch_date date;
    v_driver_name text;
    v_driver_phone numeric;
    v_vehicle_number text;
    v_vendor text;
    v_status text;
    v_rent_amount numeric;
    v_car_rent_paid text;
    v_car_rent_paid_by text;
    v_car_rent_paid_at text;
    v_notes text;
    v_created_at timestamptz;
    v_selected_project_ids uuid[];
    v_removed_project_ids uuid[];
    v_existing_batch_no text;
    v_existing_project_ids uuid[] := '{}'::uuid[];
    v_project_rows integer;
begin
    if auth.uid() is null or public.get_my_user_type() not in ('admin', 'sales') then
        raise exception 'Not authorized to change delivery batches' using errcode = '42501';
    end if;
    -- Extract batch fields from JSON
    v_batch_id := (p_batch->>'id')::uuid;
    v_batch_no := p_batch->>'batch_no';
    v_dispatch_date := nullif(p_batch->>'dispatch_date', '')::date;
    v_driver_name := p_batch->>'driver_name';
    v_driver_phone := nullif(regexp_replace(coalesce(p_batch->>'driver_phone', ''), '[^0-9]', '', 'g'), '')::numeric;
    v_vehicle_number := p_batch->>'vehicle_number';
    v_vendor := p_batch->>'vendor';
    v_status := coalesce(p_batch->>'status', 'IN_TRANSIT');
    v_rent_amount := nullif(regexp_replace(coalesce(p_batch->>'rent_amount', ''), '[^0-9.-]', '', 'g'), '')::numeric;
    v_car_rent_paid := p_batch->>'car_rent_paid';
    v_car_rent_paid_by := p_batch->>'car_rent_paid_by';
    v_car_rent_paid_at := p_batch->>'car_rent_paid_at';
    v_notes := p_batch->>'notes';
    v_created_at := coalesce((p_batch->>'created_at')::timestamptz, now());
    v_selected_project_ids := array(select id_text::uuid from unnest(coalesce(p_selected_project_ids, '{}'::text[])) as u(id_text));
    v_removed_project_ids := array(select id_text::uuid from unnest(coalesce(p_removed_project_ids, '{}'::text[])) as u(id_text));
    if v_status not in ('IN_TRANSIT', 'DELIVERED') then
        raise exception 'Invalid delivery status' using errcode = '22023';
    end if;
    if cardinality(v_selected_project_ids) <> (select count(distinct id) from unnest(v_selected_project_ids) as x(id))
       or cardinality(v_removed_project_ids) <> (select count(distinct id) from unnest(v_removed_project_ids) as x(id)) then
        raise exception 'Duplicate project IDs are not allowed' using errcode = '22023';
    end if;

    select batch_no, coalesce(project_ids, '{}'::uuid[])
      into v_existing_batch_no, v_existing_project_ids
      from public.delivery_batches where id = v_batch_id for update;
    if exists (select 1 from public.delivery_batches where batch_no = v_batch_no and id <> v_batch_id) then
        raise exception 'Batch number is already in use' using errcode = '23505';
    end if;
    if exists (select 1 from unnest(v_removed_project_ids) as x(id)
               where not (x.id = any(v_existing_project_ids)))
       or exists (select 1 from unnest(v_removed_project_ids) as x(id)
                  where x.id = any(v_selected_project_ids)) then
        raise exception 'Removed projects do not match this batch' using errcode = '22023';
    end if;
    if (select array_agg(id order by id) from unnest(v_removed_project_ids) as x(id))
       is distinct from (select array_agg(id order by id) from unnest(v_existing_project_ids) as x(id)
                         where not (x.id = any(v_selected_project_ids))) then
        raise exception 'Batch membership changed; refresh before saving' using errcode = '40001';
    end if;
    -- Lock the customer rows before checking links, so two batch saves cannot
    -- claim the same customer at the same time.
    perform 1 from public.admin where id = any(v_selected_project_ids) or id = any(v_removed_project_ids) for update;
    if (select count(*) from public.admin where id = any(v_selected_project_ids) and deleted_at is null
          and (delivery_batch_id is null or delivery_batch_id = coalesce(v_existing_batch_no, v_batch_no)))
       <> cardinality(v_selected_project_ids) then
        raise exception 'A selected customer is missing or belongs to another batch' using errcode = '22023';
    end if;
    if (select count(*) from public.admin where id = any(v_removed_project_ids) and deleted_at is null
          and delivery_batch_id = v_existing_batch_no) <> cardinality(v_removed_project_ids) then
        raise exception 'A removed customer is no longer linked to this batch' using errcode = '22023';
    end if;

    -- Upsert the delivery batch row
    insert into public.delivery_batches (
        id,
        batch_no,
        dispatch_date,
        driver_name,
        driver_phone,
        vehicle_number,
        rent_amount,
        car_rent_paid,
        car_rent_paid_by,
        car_rent_paid_at,
        vendor,
        notes,
        status,
        project_ids,
        created_at,
        updated_at
    )
    values (
        v_batch_id,
        v_batch_no,
        v_dispatch_date,
        v_driver_name,
        v_driver_phone,
        v_vehicle_number,
        v_rent_amount,
        v_car_rent_paid,
        v_car_rent_paid_by,
        v_car_rent_paid_at,
        v_vendor,
        v_notes,
        v_status,
        v_selected_project_ids,
        v_created_at,
        now()
    )
    on conflict (id) do update set
        batch_no = excluded.batch_no,
        dispatch_date = excluded.dispatch_date,
        driver_name = excluded.driver_name,
        driver_phone = excluded.driver_phone,
        vehicle_number = excluded.vehicle_number,
        rent_amount = excluded.rent_amount,
        car_rent_paid = excluded.car_rent_paid,
        car_rent_paid_by = excluded.car_rent_paid_by,
        car_rent_paid_at = excluded.car_rent_paid_at,
        vendor = excluded.vendor,
        notes = excluded.notes,
        status = excluded.status,
        project_ids = excluded.project_ids,
        updated_at = now();

    -- Bulk update all newly/currently selected projects in public.admin
    if cardinality(v_selected_project_ids) > 0 then
        update public.admin
        set
            delivery_batch_id = v_batch_no,
            material_delivery_date = v_dispatch_date,
            driver_name = v_driver_name,
            driver_phone_number = v_driver_phone,
            vehicle_number = v_vehicle_number,
            vendor = coalesce(v_vendor, vendor),
            delivery_status = case 
                when v_status = 'DELIVERED' then 'DELIVERED'
                when delivery_status is null or delivery_status = 'PENDING' then v_status
                else delivery_status
            end,
            updated_at = now()
        where id = any(v_selected_project_ids)
          and deleted_at is null;
        get diagnostics v_project_rows = row_count;
        if v_project_rows <> cardinality(v_selected_project_ids) then
            raise exception 'Some selected customers could not be updated' using errcode = 'P0001';
        end if;
    end if;

    -- Bulk clear any projects that were removed/unchecked from this batch
    if cardinality(v_removed_project_ids) > 0 then
        update public.admin
        set
            delivery_batch_id = null,
            delivery_status = 'PENDING',
            driver_name = null,
            driver_phone_number = null,
            vehicle_number = null,
            material_delivery_date = null,
            updated_at = now()
        where id = any(v_removed_project_ids)
          and deleted_at is null
          and delivery_batch_id = v_existing_batch_no;
        get diagnostics v_project_rows = row_count;
        if v_project_rows <> cardinality(v_removed_project_ids) then
            raise exception 'Some removed customers could not be unlinked' using errcode = 'P0001';
        end if;
    end if;

    return jsonb_build_object('success', true, 'batch_id', v_batch_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.update_delivery_batch_status_atomic(p_batch_id uuid, p_new_status text, p_project_ids text[] DEFAULT '{}'::text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_batch_rows   int := 0;
    v_project_rows int := 0;
    v_expected     int := coalesce(array_length(p_project_ids, 1), 0);
    v_batch_project_ids uuid[];
    v_batch_no text;
begin
    if auth.uid() is null or public.get_my_user_type() not in ('admin', 'sales') then
        raise exception 'Not authorized to change delivery status' using errcode = '42501';
    end if;
    if p_new_status not in ('IN_TRANSIT', 'DELIVERED') then
        raise exception 'Invalid delivery status' using errcode = '22023';
    end if;
    select batch_no, coalesce(project_ids, '{}'::uuid[])
      into v_batch_no, v_batch_project_ids
      from public.delivery_batches where id = p_batch_id for update;
    if not found then
        raise exception 'Delivery batch not found' using errcode = 'P0002';
    end if;
    if (select array_agg(id order by id) from unnest(v_batch_project_ids) as x(id))
       is distinct from (select array_agg(id_text::uuid order by id_text::uuid)
                         from unnest(coalesce(p_project_ids, '{}'::text[])) as x(id_text)) then
        raise exception 'Batch membership changed; refresh before changing status' using errcode = '40001';
    end if;
    perform 1 from public.admin where id = any(v_batch_project_ids) for update;
    -- Update batch table
    update public.delivery_batches
    set
        status = p_new_status,
        updated_at = now()
    where id = p_batch_id;
    get diagnostics v_batch_rows = row_count;

    -- No batch matched the id. Previously this still returned success:true,
    -- so a no-op was indistinguishable from a real write. Report the failure
    -- instead and let the caller surface it.
    if v_batch_rows = 0 then
        return jsonb_build_object(
            'success',  false,
            'error',    'batch_not_found',
            'batch_id', p_batch_id
        );
    end if;

    -- Update linked admin customer rows if status is DELIVERED or IN_TRANSIT
    if v_expected > 0 then
        update public.admin
        set
            delivery_status = p_new_status,
            updated_at = now()
        where id = any(v_batch_project_ids)
          and deleted_at is null
          and delivery_batch_id = v_batch_no;
        get diagnostics v_project_rows = row_count;
        if v_project_rows <> v_expected then
            raise exception 'Some batch customers could not be updated' using errcode = 'P0001';
        end if;
    end if;

    -- A missing linked customer raises above and rolls back the whole update.
    return jsonb_build_object(
        'success',           true,
        'batch_id',          p_batch_id,
        'status',            p_new_status,
        'projects_expected', v_expected,
        'projects_updated',  v_project_rows,
        'projects_missing',  v_expected - v_project_rows
    );
end;
$function$
;


-- ============================================================================
-- 4. Keys, checks, foreign keys, indexes
-- ============================================================================

do $$ begin if not exists (select 1 from pg_constraint where conname = 'activity_log_pkey' and conrelid = 'public.activity_log'::regclass) then
    alter table public.activity_log add constraint activity_log_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'admin_phone_number_format' and conrelid = 'public.admin'::regclass) then
    alter table public.admin add constraint admin_phone_number_format CHECK (((phone_number IS NULL) OR (phone_number ~ '^\+?[0-9]{1,15}$'::text)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'admin_pkey' and conrelid = 'public.admin'::regclass) then
    alter table public.admin add constraint admin_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'admin_history_pkey' and conrelid = 'public.admin_history'::regclass) then
    alter table public.admin_history add constraint admin_history_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bom_pkey' and conrelid = 'public.bom'::regclass) then
    alter table public.bom add constraint bom_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bom_items_pkey' and conrelid = 'public.bom_items'::regclass) then
    alter table public.bom_items add constraint bom_items_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_check' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_check CHECK ((end_date >= start_date));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_check1' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_check1 CHECK ((end_date <= (start_date + 365)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_entry_kind_check' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_entry_kind_check CHECK ((entry_kind = ANY (ARRAY['vendor_unavailable'::text, 'staff_leave'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_note_check' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_note_check CHECK ((length(note) <= 500));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_pkey' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_status_check' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_user_id_entry_kind_start_date_end_date_key' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_user_id_entry_kind_start_date_end_date_key UNIQUE (user_id, entry_kind, start_date, end_date);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_cc_valid' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_cc_valid CHECK (((cc_id IS NULL) OR ((audience = 'admin'::text) AND (recipient_id IS NOT NULL) AND (cc_id <> recipient_id) AND (cc_id <> sender_id))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_audience_check' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_audience_check CHECK ((audience = ANY (ARRAY['public'::text, 'admin'::text, 'role'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_body_check' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_body_check CHECK (((length(TRIM(BOTH FROM body)) >= 1) AND (length(TRIM(BOTH FROM body)) <= 2000)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_pkey' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_topic_check' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_topic_check CHECK ((topic = ANY (ARRAY['general'::text, 'installation'::text, 'material_delivery'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_public_no_recipient' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_public_no_recipient CHECK (((audience = 'admin'::text) OR (recipient_id IS NULL)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_role_target' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_role_target CHECK ((((audience = 'role'::text) AND (target_role = ANY (ARRAY['vendor'::text, 'channel_partner_office'::text, 'agent'::text, 'agent2'::text, 'stamp'::text, 'technician'::text, 'sales'::text]))) OR ((audience <> 'role'::text) AND (target_role IS NULL))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'customer_payment_review_flags_pkey' and conrelid = 'public.customer_payment_review_flags'::regclass) then
    alter table public.customer_payment_review_flags add constraint customer_payment_review_flags_pkey PRIMARY KEY (admin_id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'delivery_batches_pkey' and conrelid = 'public.delivery_batches'::regclass) then
    alter table public.delivery_batches add constraint delivery_batches_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'documents_pkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'drivers_pkey' and conrelid = 'public.drivers'::regclass) then
    alter table public.drivers add constraint drivers_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'metadata_category_label_key' and conrelid = 'public.metadata'::regclass) then
    alter table public.metadata add constraint metadata_category_label_key UNIQUE (category, label);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'metadata_pkey' and conrelid = 'public.metadata'::regclass) then
    alter table public.metadata add constraint metadata_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_pkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_user_type_check' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_user_type_check CHECK ((user_type = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'agent2'::text, 'agent'::text, 'vendor'::text, 'stamp'::text, 'channel_partner_office_manager'::text, 'dealer'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_capacity_positive' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_capacity_positive CHECK (((capacity_kw IS NULL) OR (capacity_kw > (0)::numeric)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_converted_has_lead' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_converted_has_lead CHECK (((status <> 'converted'::text) OR (converted_lead_id IS NOT NULL)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_customer_name_not_blank' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_customer_name_not_blank CHECK ((length(TRIM(BOTH FROM customer_name)) > 0));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_data_is_object' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_data_is_object CHECK ((jsonb_typeof(quotation_data) = 'object'::text));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_geda_charge_valid' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_geda_charge_valid CHECK (((geb_geda_charge IS NULL) OR (geb_geda_charge = ANY (ARRAY['Including'::text, 'Excluding'::text]))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_lost_has_reason' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_lost_has_reason CHECK (((status <> 'lost'::text) OR (length(TRIM(BOTH FROM COALESCE(lost_reason, ''::text))) > 0)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_panel_qty_positive' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_panel_qty_positive CHECK (((solar_panel_qty IS NULL) OR (solar_panel_qty > 0)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_panel_wattage_positive' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_panel_wattage_positive CHECK (((panel_wattage IS NULL) OR (panel_wattage > (0)::numeric)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_phone_not_blank' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_phone_not_blank CHECK ((length(TRIM(BOTH FROM customer_phone)) > 0));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_pkey' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_project_type_valid' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_project_type_valid CHECK (((project_type IS NULL) OR (project_type = ANY (ARRAY['Residential'::text, 'Commercial'::text]))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_quotation_no_key' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_quotation_no_key UNIQUE (quotation_no);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_selected_option_valid' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_selected_option_valid CHECK (((selected_option IS NULL) OR ((selected_option >= 1) AND (selected_option <= 3))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_status_valid' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_status_valid CHECK ((status = ANY (ARRAY['draft'::text, 'issued'::text, 'converted'::text, 'lost'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issue_files_pkey' and conrelid = 'public.service_issue_files'::regclass) then
    alter table public.service_issue_files add constraint service_issue_files_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issue_files_storage_path_key' and conrelid = 'public.service_issue_files'::regclass) then
    alter table public.service_issue_files add constraint service_issue_files_storage_path_key UNIQUE (storage_path);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issue_assignment_matches_status' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issue_assignment_matches_status CHECK ((((status = 'open'::text) AND (assigned_to IS NULL)) OR ((status = ANY (ARRAY['assigned'::text, 'completed'::text])) AND (assigned_to IS NOT NULL))));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_comment_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_comment_check CHECK ((length(comment) <= 2000));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_consumer_no_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_consumer_no_check CHECK (((length(TRIM(BOTH FROM consumer_no)) >= 1) AND (length(TRIM(BOTH FROM consumer_no)) <= 100)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_customer_name_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_customer_name_check CHECK (((length(TRIM(BOTH FROM customer_name)) >= 1) AND (length(TRIM(BOTH FROM customer_name)) <= 160)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_pkey' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_problem_type_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_problem_type_check CHECK (((length(TRIM(BOTH FROM problem_type)) >= 1) AND (length(TRIM(BOTH FROM problem_type)) <= 160)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_status_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_status_check CHECK ((status = ANY (ARRAY['open'::text, 'assigned'::text, 'completed'::text])));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_system_kw_check' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_system_kw_check CHECK (((system_kw IS NULL) OR (system_kw >= (0)::numeric)));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_amount_inr_check' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_amount_inr_check CHECK ((amount_inr >= (0)::numeric));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_kilometers_check' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_kilometers_check CHECK ((kilometers >= (0)::numeric));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_note_check' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_note_check CHECK ((length(note) <= 1000));
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_pkey' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'vendors_name_key' and conrelid = 'public.vendors'::regclass) then
    alter table public.vendors add constraint vendors_name_key UNIQUE (name);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'vendors_pkey' and conrelid = 'public.vendors'::regclass) then
    alter table public.vendors add constraint vendors_pkey PRIMARY KEY (id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_activity_log_customer' and conrelid = 'public.activity_log'::regclass) then
    alter table public.activity_log add constraint fk_activity_log_customer FOREIGN KEY (customer_id) REFERENCES admin(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'fk_activity_log_user' and conrelid = 'public.activity_log'::regclass) then
    alter table public.activity_log add constraint fk_activity_log_user FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE SET NULL;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bom_admin_id_fkey' and conrelid = 'public.bom'::regclass) then
    alter table public.bom add constraint bom_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'bom_items_bom_id_fkey' and conrelid = 'public.bom_items'::regclass) then
    alter table public.bom_items add constraint bom_items_bom_id_fkey FOREIGN KEY (bom_id) REFERENCES bom(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_reviewed_by_fkey' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_availability_user_id_fkey' and conrelid = 'public.crm_availability'::regclass) then
    alter table public.crm_availability add constraint crm_availability_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_cc_id_fkey' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_cc_id_fkey FOREIGN KEY (cc_id) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_recipient_id_fkey' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'crm_chat_messages_sender_id_fkey' and conrelid = 'public.crm_chat_messages'::regclass) then
    alter table public.crm_chat_messages add constraint crm_chat_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'customer_payment_review_flags_admin_id_fkey' and conrelid = 'public.customer_payment_review_flags'::regclass) then
    alter table public.customer_payment_review_flags add constraint customer_payment_review_flags_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES admin(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'customer_payment_review_flags_updated_by_fkey' and conrelid = 'public.customer_payment_review_flags'::regclass) then
    alter table public.customer_payment_review_flags add constraint customer_payment_review_flags_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'documents_customer_id_fkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES admin(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'documents_uploaded_by_fkey' and conrelid = 'public.documents'::regclass) then
    alter table public.documents add constraint documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'profiles_id_fkey' and conrelid = 'public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_converted_lead_id_fkey' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_converted_lead_id_fkey FOREIGN KEY (converted_lead_id) REFERENCES admin(id) ON DELETE SET NULL;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_owner_id_fkey' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES profiles(id) ON DELETE RESTRICT;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'quotations_source_lead_id_fkey' and conrelid = 'public.quotations'::regclass) then
    alter table public.quotations add constraint quotations_source_lead_id_fkey FOREIGN KEY (source_lead_id) REFERENCES admin(id) ON DELETE SET NULL;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issue_files_issue_id_fkey' and conrelid = 'public.service_issue_files'::regclass) then
    alter table public.service_issue_files add constraint service_issue_files_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES service_issues(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issue_files_uploaded_by_fkey' and conrelid = 'public.service_issue_files'::regclass) then
    alter table public.service_issue_files add constraint service_issue_files_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_assigned_to_fkey' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_issues_created_by_fkey' and conrelid = 'public.service_issues'::regclass) then
    alter table public.service_issues add constraint service_issues_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_entered_by_fkey' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_entered_by_fkey FOREIGN KEY (entered_by) REFERENCES auth.users(id);
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_issue_id_fkey' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_issue_id_fkey FOREIGN KEY (issue_id) REFERENCES service_issues(id) ON DELETE CASCADE;
end if; end $$;
do $$ begin if not exists (select 1 from pg_constraint where conname = 'service_visits_technician_id_fkey' and conrelid = 'public.service_visits'::regclass) then
    alter table public.service_visits add constraint service_visits_technician_id_fkey FOREIGN KEY (technician_id) REFERENCES auth.users(id);
end if; end $$;
create index if not exists idx_activity_created ON public.activity_log USING btree (created_at DESC);
create index if not exists idx_activity_customer ON public.activity_log USING btree (customer_id);
create index if not exists idx_activity_log_created_at_desc ON public.activity_log USING btree (created_at DESC);
create index if not exists idx_activity_user ON public.activity_log USING btree (user_id);
create index if not exists admin_channel_partner_normalized_idx ON public.admin USING btree (lower(btrim(COALESCE(channel_partner, ''::text))));
create index if not exists admin_created_at_desc_idx ON public.admin USING btree (created_at DESC);
create index if not exists admin_sub_channel_partner_normalized_idx ON public.admin USING btree (lower(btrim(COALESCE(sub_channel_partner, ''::text))));
create index if not exists admin_vendor_normalized_active_idx ON public.admin USING btree (lower(btrim(COALESCE(vendor, ''::text)))) WHERE (deleted_at IS NULL);
create index if not exists idx_admin_channel_partner ON public.admin USING btree (lower(TRIM(BOTH FROM channel_partner)));
create index if not exists idx_admin_deleted_at ON public.admin USING btree (deleted_at);
create index if not exists idx_admin_sent_to_stamp_maker ON public.admin USING btree (((discom_submission ->> 'sent_to_stamp_maker'::text))) WHERE (deleted_at IS NULL);
create index if not exists idx_admin_stage ON public.admin USING btree (stage);
create index if not exists idx_admin_stamp_sent ON public.admin USING btree (((discom_submission ->> 'stamp_sent'::text))) WHERE (deleted_at IS NULL);
create index if not exists idx_admin_vendor ON public.admin USING btree (lower(TRIM(BOTH FROM vendor)));
create index if not exists admin_history_changed_at_idx ON public.admin_history USING btree (changed_at DESC);
create index if not exists admin_history_customer_idx ON public.admin_history USING btree (customer_id, changed_at DESC);
create index if not exists idx_bom_admin_id ON public.bom USING btree (admin_id);
create index if not exists idx_bom_type ON public.bom USING btree (bom_type);
create index if not exists idx_bom_items_bom_id ON public.bom_items USING btree (bom_id);
create index if not exists idx_bom_items_product_name ON public.bom_items USING btree (product_name);
create index if not exists crm_availability_dates_idx ON public.crm_availability USING btree (start_date, end_date);
create index if not exists crm_availability_user_idx ON public.crm_availability USING btree (user_id, start_date DESC);
create index if not exists crm_chat_messages_audience_time_idx ON public.crm_chat_messages USING btree (audience, created_at DESC);
create index if not exists crm_chat_messages_cc_idx ON public.crm_chat_messages USING btree (cc_id) WHERE (cc_id IS NOT NULL);
create index if not exists crm_chat_messages_sender_time_idx ON public.crm_chat_messages USING btree (sender_id, created_at DESC);
create index if not exists documents_storage_path_idx ON public.documents USING btree (storage_path);
create unique index if not exists drivers_name_unique_ci ON public.drivers USING btree (lower(name));
create index if not exists idx_profiles_user_type ON public.profiles USING btree (user_type);
create index if not exists quotations_converted_lead_idx ON public.quotations USING btree (converted_lead_id) WHERE (converted_lead_id IS NOT NULL);
create index if not exists quotations_customer_name_idx ON public.quotations USING btree (lower(customer_name));
create index if not exists quotations_customer_phone_idx ON public.quotations USING btree (customer_phone);
create index if not exists quotations_owner_created_idx ON public.quotations USING btree (owner_id, created_at DESC);
create index if not exists quotations_owner_status_idx ON public.quotations USING btree (owner_id, status, updated_at DESC);
create index if not exists quotations_source_lead_idx ON public.quotations USING btree (source_lead_id) WHERE (source_lead_id IS NOT NULL);
create index if not exists service_issue_files_issue_idx ON public.service_issue_files USING btree (issue_id);
create index if not exists service_issues_status_date_idx ON public.service_issues USING btree (status, required_date);
create index if not exists service_issues_technician_idx ON public.service_issues USING btree (assigned_to, required_date);
create index if not exists service_visits_issue_date_idx ON public.service_visits USING btree (issue_id, visit_date);


-- ============================================================================
-- 5. View
-- ============================================================================

create or replace view public.v_incomplete_customers with (security_invoker=true) as
 SELECT id,
    customer_name,
    folder_no,
    consumer_no,
    stage,
    channel_partner,
    array_remove(ARRAY[
        CASE
            WHEN stage_rank(stage) > 5 AND COALESCE(btrim(inverter_make), ''::text) = ''::text THEN 'Inverter make'::text
            ELSE NULL::text
        END,
        CASE
            WHEN stage_rank(stage) > 5 AND COALESCE(btrim(inverter_serial_no), ''::text) = ''::text THEN 'Inverter serial number'::text
            ELSE NULL::text
        END,
        CASE
            WHEN stage_rank(stage) > 5 AND (COALESCE(btrim(panel_serial_no #>> '{}'::text[]), ''::text) = ANY (ARRAY[''::text, '[]'::text, 'null'::text])) THEN 'Panel serial numbers'::text
            ELSE NULL::text
        END,
        CASE
            WHEN stage_rank(stage) > 6 AND COALESCE(btrim(vendor), ''::text) = ''::text THEN 'Vendor'::text
            ELSE NULL::text
        END], NULL::text) AS missing
   FROM admin a
  WHERE deleted_at IS NULL AND created_at >= '2026-09-02 00:00:00+00'::timestamp with time zone AND stage_rank(stage) > 5 AND (COALESCE(btrim(inverter_make), ''::text) = ''::text OR COALESCE(btrim(inverter_serial_no), ''::text) = ''::text OR (COALESCE(btrim(panel_serial_no #>> '{}'::text[]), ''::text) = ANY (ARRAY[''::text, '[]'::text, 'null'::text])) OR stage_rank(stage) > 6 AND COALESCE(btrim(vendor), ''::text) = ''::text);


-- ============================================================================
-- 6. Triggers
-- ============================================================================

create or replace trigger trg_admin_history AFTER INSERT OR DELETE OR UPDATE ON public.admin FOR EACH ROW EXECUTE FUNCTION log_admin_change();
create or replace trigger trg_assign_folder_no BEFORE INSERT ON public.admin FOR EACH ROW EXECUTE FUNCTION assign_folder_no();
create or replace trigger trigger_set_admin_updated_at BEFORE UPDATE ON public.admin FOR EACH ROW EXECUTE FUNCTION set_admin_updated_at();
create or replace trigger trigger_set_completed_at BEFORE UPDATE ON public.admin FOR EACH ROW EXECUTE FUNCTION set_completed_at();
create or replace trigger bom_updated_at BEFORE UPDATE ON public.bom FOR EACH ROW EXECUTE FUNCTION update_bom_updated_at();
create or replace trigger crm_availability_vendor_name BEFORE INSERT ON public.crm_availability FOR EACH ROW EXECUTE FUNCTION set_crm_availability_vendor_name();
create or replace trigger trigger_sync_driver_info AFTER INSERT OR UPDATE OF driver_name, driver_phone, project_ids ON public.delivery_batches FOR EACH ROW EXECUTE FUNCTION sync_driver_info_to_admin();
create or replace trigger trg_enforce_profile_privilege_changes BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION enforce_profile_privilege_changes();
create or replace trigger quotations_set_updated_at BEFORE UPDATE ON public.quotations FOR EACH ROW EXECUTE FUNCTION set_quotation_updated_at();
create or replace trigger service_issue_file_limit BEFORE INSERT ON public.service_issue_files FOR EACH ROW EXECUTE FUNCTION limit_service_issue_files();
create or replace trigger service_issue_guard BEFORE UPDATE ON public.service_issues FOR EACH ROW EXECUTE FUNCTION guard_service_issue_update();


-- ============================================================================
-- 7. Row level security and access rules
-- ============================================================================

alter table public.activity_log enable row level security;
alter table public.admin enable row level security;
alter table public.admin_history enable row level security;
alter table public.bom enable row level security;
alter table public.bom_items enable row level security;
alter table public.crm_availability enable row level security;
alter table public.crm_chat_messages enable row level security;
alter table public.customer_payment_review_flags enable row level security;
alter table public.delivery_batches enable row level security;
alter table public.documents enable row level security;
alter table public.drivers enable row level security;
alter table public.metadata enable row level security;
alter table public.profiles enable row level security;
alter table public.quotations enable row level security;
alter table public.service_issue_files enable row level security;
alter table public.service_issues enable row level security;
alter table public.service_visits enable row level security;
alter table public.vendors enable row level security;

drop policy if exists customer_documents_delete on storage.objects;
create policy customer_documents_delete on storage.objects as PERMISSIVE for DELETE to authenticated
    using (((bucket_id = 'customer-documents'::text) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((owner_id = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (objects.name ~~ ((a.id)::text || '/%'::text))))) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (objects.name ~~ ((a.id)::text || '/%'::text))))))));

drop policy if exists customer_documents_owner_read on storage.objects;
create policy customer_documents_owner_read on storage.objects as PERMISSIVE for SELECT to authenticated
    using (((bucket_id = 'customer-documents'::text) AND (owner_id = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (objects.name ~~ ((a.id)::text || '/%'::text))))));

drop policy if exists customer_documents_read on storage.objects;
create policy customer_documents_read on storage.objects as PERMISSIVE for SELECT to authenticated
    using (((bucket_id = 'customer-documents'::text) AND (EXISTS ( SELECT 1
   FROM documents d
  WHERE ((d.storage_path = objects.name) AND (EXISTS ( SELECT 1
           FROM admin a
          WHERE (a.id = d.customer_id))))))));

drop policy if exists customer_documents_upload on storage.objects;
create policy customer_documents_upload on storage.objects as PERMISSIVE for INSERT to authenticated
    with check (((bucket_id = 'customer-documents'::text) AND (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'agent'::text, 'agent2'::text, 'vendor'::text, 'stamp'::text])) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (objects.name ~~ ((a.id)::text || '/%'::text))))));

drop policy if exists service_issue_storage_read on storage.objects;
create policy service_issue_storage_read on storage.objects as PERMISSIVE for SELECT to authenticated
    using (((bucket_id = 'service-issues'::text) AND (EXISTS ( SELECT 1
   FROM service_issues issue
  WHERE (((issue.id)::text = split_part(objects.name, '/'::text, 1)) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (issue.created_by = ( SELECT auth.uid() AS uid)) OR (issue.assigned_to = ( SELECT auth.uid() AS uid))))))));

drop policy if exists service_issue_storage_remove on storage.objects;
create policy service_issue_storage_remove on storage.objects as PERMISSIVE for DELETE to authenticated
    using (((bucket_id = 'service-issues'::text) AND ((split_part(name, '/'::text, 2) = (( SELECT auth.uid() AS uid))::text) OR (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])))));

drop policy if exists service_issue_storage_upload on storage.objects;
create policy service_issue_storage_upload on storage.objects as PERMISSIVE for INSERT to authenticated
    with check (((bucket_id = 'service-issues'::text) AND (split_part(name, '/'::text, 2) = (( SELECT auth.uid() AS uid))::text) AND (EXISTS ( SELECT 1
   FROM service_issues issue
  WHERE (((issue.id)::text = split_part(objects.name, '/'::text, 1)) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (issue.created_by = ( SELECT auth.uid() AS uid))))))));

drop policy if exists activity_log_delete_scoped on public.activity_log;
create policy activity_log_delete_scoped on public.activity_log as PERMISSIVE for DELETE to authenticated
    using ((get_my_user_type() = 'admin'::text));

drop policy if exists activity_log_insert_scoped on public.activity_log;
create policy activity_log_insert_scoped on public.activity_log as PERMISSIVE for INSERT to authenticated
    with check ((auth.uid() IS NOT NULL));

drop policy if exists activity_log_select_scoped on public.activity_log;
create policy activity_log_select_scoped on public.activity_log as PERMISSIVE for SELECT to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (user_id = auth.uid()) OR ((customer_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = activity_log.customer_id))))));

drop policy if exists activity_log_update_scoped on public.activity_log;
create policy activity_log_update_scoped on public.activity_log as PERMISSIVE for UPDATE to authenticated
    using ((get_my_user_type() = 'admin'::text))
    with check ((get_my_user_type() = 'admin'::text));

drop policy if exists admin_delete_admin on public.admin;
create policy admin_delete_admin on public.admin as PERMISSIVE for DELETE to public
    using (((auth.role() = 'authenticated'::text) AND (EXISTS ( SELECT 1
   FROM profiles
  WHERE ((profiles.id = auth.uid()) AND (profiles.user_type = 'admin'::text))))));

drop policy if exists admin_insert on public.admin;
create policy admin_insert on public.admin as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'agent'::text, 'agent2'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists admin_select on public.admin;
create policy admin_select on public.admin as PERMISSIVE for SELECT to authenticated
    using (((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['channel_partner_office'::text, 'office2'::text, 'channel_partner_office_manager'::text])) AND (lower(btrim(COALESCE(channel_partner, ''::text))) = lower(btrim(COALESCE(( SELECT get_my_channel_partner() AS get_my_channel_partner), ''::text))))) OR ((( SELECT get_my_user_type() AS get_my_user_type) = 'agent'::text) AND (lower(btrim(COALESCE(channel_partner, ''::text))) = lower(btrim(COALESCE(( SELECT get_my_name() AS get_my_name), ''::text))))) OR ((( SELECT get_my_user_type() AS get_my_user_type) = 'agent2'::text) AND (lower(btrim(COALESCE(sub_channel_partner, ''::text))) = lower(btrim(COALESCE(( SELECT get_my_name() AS get_my_name), ''::text)))) AND (lower(btrim(COALESCE(channel_partner, ''::text))) = lower(btrim(COALESCE(( SELECT get_my_channel_partner() AS get_my_channel_partner), ''::text))))) OR ((( SELECT get_my_user_type() AS get_my_user_type) = 'vendor'::text) AND (lower(btrim(COALESCE(vendor, ''::text))) = lower(btrim(COALESCE(( SELECT get_my_name() AS get_my_name), ''::text)))) AND (deleted_at IS NULL)) OR ((( SELECT get_my_user_type() AS get_my_user_type) = 'stamp'::text) AND (deleted_at IS NULL) AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text) AND (COALESCE((discom_submission ->> 'assigned_stamp_maker'::text), ''::text) <> ''::text) AND (lower(btrim(COALESCE((discom_submission ->> 'assigned_stamp_maker'::text), ''::text))) = lower(btrim(COALESCE(( SELECT get_my_name() AS get_my_name), ''::text)))))));

drop policy if exists admin_update on public.admin;
create policy admin_update on public.admin as PERMISSIVE for UPDATE to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text))))) OR ((get_my_user_type() = ANY (ARRAY['agent'::text, 'agent2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))) OR ((get_my_user_type() = 'vendor'::text) AND (lower(TRIM(BOTH FROM COALESCE(vendor, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))) OR ((get_my_user_type() = 'stamp'::text) AND (deleted_at IS NULL) AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text) AND (COALESCE((discom_submission ->> 'assigned_stamp_maker'::text), ''::text) <> ''::text) AND (lower(TRIM(BOTH FROM COALESCE((discom_submission ->> 'assigned_stamp_maker'::text), ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))));

drop policy if exists no_delete_admin on public.admin;
create policy no_delete_admin on public.admin as PERMISSIVE for DELETE to authenticated
    using (false);

drop policy if exists admin_history_select_admin on public.admin_history;
create policy admin_history_select_admin on public.admin_history as PERMISSIVE for SELECT to authenticated
    using ((get_my_user_type() = 'admin'::text));

drop policy if exists "Allow all actions for authenticated users on bom" on public.bom;
create policy "Allow all actions for authenticated users on bom" on public.bom as PERMISSIVE for ALL to authenticated
    using (true)
    with check (true);

drop policy if exists "Allow all actions for authenticated users on bom_items" on public.bom_items;
create policy "Allow all actions for authenticated users on bom_items" on public.bom_items as PERMISSIVE for ALL to authenticated
    using (true)
    with check (true);

drop policy if exists crm_availability_create on public.crm_availability;
create policy crm_availability_create on public.crm_availability as PERMISSIVE for INSERT to authenticated
    with check (((user_id = ( SELECT auth.uid() AS uid)) AND (reviewed_at IS NULL) AND (reviewed_by IS NULL) AND (get_my_user_type() = 'vendor'::text) AND (entry_kind = 'vendor_unavailable'::text) AND (status = 'approved'::text)));

drop policy if exists crm_availability_read on public.crm_availability;
create policy crm_availability_read on public.crm_availability as PERMISSIVE for SELECT to authenticated
    using (((entry_kind = 'vendor_unavailable'::text) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])) OR ((get_my_user_type() = 'vendor'::text) AND (user_id = ( SELECT auth.uid() AS uid))))));

drop policy if exists crm_availability_remove on public.crm_availability;
create policy crm_availability_remove on public.crm_availability as PERMISSIVE for DELETE to authenticated
    using (((get_my_user_type() = 'vendor'::text) AND (user_id = ( SELECT auth.uid() AS uid)) AND (entry_kind = 'vendor_unavailable'::text)));

drop policy if exists crm_chat_read on public.crm_chat_messages;
create policy crm_chat_read on public.crm_chat_messages as PERMISSIVE for SELECT to authenticated
    using (((( SELECT get_my_user_type() AS get_my_user_type) = 'admin'::text) OR (sender_id = ( SELECT auth.uid() AS uid)) OR (recipient_id = ( SELECT auth.uid() AS uid)) OR (cc_id = ( SELECT auth.uid() AS uid)) OR (audience = 'public'::text) OR ((audience = 'role'::text) AND ((target_role = ( SELECT get_my_user_type() AS get_my_user_type)) OR ((target_role = 'channel_partner_office'::text) AND (( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['office2'::text, 'channel_partner_office_manager'::text]))))) OR ((( SELECT get_my_user_type() AS get_my_user_type) = 'sales'::text) AND (audience = 'admin'::text) AND ((recipient_id IS NULL) OR (NOT (chat_is_office(sender_id) AND chat_is_office(recipient_id)))))));

drop policy if exists crm_chat_send on public.crm_chat_messages;
create policy crm_chat_send on public.crm_chat_messages as PERMISSIVE for INSERT to authenticated
    with check (((sender_id = ( SELECT auth.uid() AS uid)) AND (((audience = ANY (ARRAY['public'::text, 'role'::text])) AND (( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text]))) OR ((audience = 'admin'::text) AND (recipient_id IS NULL) AND (( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['channel_partner_office'::text, 'office2'::text, 'agent'::text, 'agent2'::text, 'vendor'::text, 'stamp'::text, 'technician'::text]))) OR ((audience = 'admin'::text) AND (recipient_id IS NOT NULL) AND chat_recipient_allowed(recipient_id) AND ((cc_id IS NULL) OR (( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text])))))));

drop policy if exists customer_payment_flags_create on public.customer_payment_review_flags;
create policy customer_payment_flags_create on public.customer_payment_review_flags as PERMISSIVE for INSERT to authenticated
    with check (((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'channel_partner_office_manager'::text, 'agent'::text, 'agent2'::text])) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM admin customer
  WHERE ((customer.id = customer_payment_review_flags.admin_id) AND (customer.deleted_at IS NULL))))));

drop policy if exists customer_payment_flags_read on public.customer_payment_review_flags;
create policy customer_payment_flags_read on public.customer_payment_review_flags as PERMISSIVE for SELECT to authenticated
    using (((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'channel_partner_office_manager'::text, 'agent'::text, 'agent2'::text])) AND (EXISTS ( SELECT 1
   FROM admin customer
  WHERE ((customer.id = customer_payment_review_flags.admin_id) AND (customer.deleted_at IS NULL))))));

drop policy if exists customer_payment_flags_update on public.customer_payment_review_flags;
create policy customer_payment_flags_update on public.customer_payment_review_flags as PERMISSIVE for UPDATE to authenticated
    using (((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'channel_partner_office_manager'::text, 'agent'::text, 'agent2'::text])) AND (EXISTS ( SELECT 1
   FROM admin customer
  WHERE ((customer.id = customer_payment_review_flags.admin_id) AND (customer.deleted_at IS NULL))))))
    with check (((( SELECT get_my_user_type() AS get_my_user_type) = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'channel_partner_office_manager'::text, 'agent'::text, 'agent2'::text])) AND (updated_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM admin customer
  WHERE ((customer.id = customer_payment_review_flags.admin_id) AND (customer.deleted_at IS NULL))))));

drop policy if exists delivery_batches_delete_scoped on public.delivery_batches;
create policy delivery_batches_delete_scoped on public.delivery_batches as PERMISSIVE for DELETE to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])));

drop policy if exists delivery_batches_insert_scoped on public.delivery_batches;
create policy delivery_batches_insert_scoped on public.delivery_batches as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])));

drop policy if exists delivery_batches_select_scoped on public.delivery_batches;
create policy delivery_batches_select_scoped on public.delivery_batches as PERMISSIVE for SELECT to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])));

drop policy if exists delivery_batches_update_scoped on public.delivery_batches;
create policy delivery_batches_update_scoped on public.delivery_batches as PERMISSIVE for UPDATE to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])))
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])));

drop policy if exists documents_delete_scoped on public.documents;
create policy documents_delete_scoped on public.documents as PERMISSIVE for DELETE to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = documents.customer_id)))));

drop policy if exists documents_insert_scoped on public.documents;
create policy documents_insert_scoped on public.documents as PERMISSIVE for INSERT to authenticated
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'agent'::text, 'agent2'::text, 'vendor'::text, 'stamp'::text])) AND (storage_path ~~ ((customer_id)::text || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = documents.customer_id)))));

drop policy if exists documents_select_scoped on public.documents;
create policy documents_select_scoped on public.documents as PERMISSIVE for SELECT to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((customer_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = documents.customer_id))))));

drop policy if exists documents_update_scoped on public.documents;
create policy documents_update_scoped on public.documents as PERMISSIVE for UPDATE to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'agent'::text, 'agent2'::text, 'vendor'::text, 'stamp'::text])) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = documents.customer_id)))))
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text, 'agent'::text, 'agent2'::text, 'vendor'::text, 'stamp'::text])) AND (EXISTS ( SELECT 1
   FROM admin a
  WHERE (a.id = documents.customer_id)))));

drop policy if exists drivers_delete_scoped on public.drivers;
create policy drivers_delete_scoped on public.drivers as PERMISSIVE for DELETE to authenticated
    using ((get_my_user_type() = 'admin'::text));

drop policy if exists drivers_insert_scoped on public.drivers;
create policy drivers_insert_scoped on public.drivers as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = 'admin'::text));

drop policy if exists drivers_select_scoped on public.drivers;
create policy drivers_select_scoped on public.drivers as PERMISSIVE for SELECT to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])));

drop policy if exists drivers_update_scoped on public.drivers;
create policy drivers_update_scoped on public.drivers as PERMISSIVE for UPDATE to authenticated
    using ((get_my_user_type() = 'admin'::text))
    with check ((get_my_user_type() = 'admin'::text));

drop policy if exists metadata_delete_scoped on public.metadata;
create policy metadata_delete_scoped on public.metadata as PERMISSIVE for DELETE to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists metadata_insert_scoped on public.metadata;
create policy metadata_insert_scoped on public.metadata as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists metadata_select_scoped on public.metadata;
create policy metadata_select_scoped on public.metadata as PERMISSIVE for SELECT to authenticated
    using (true);

drop policy if exists metadata_update_scoped on public.metadata;
create policy metadata_update_scoped on public.metadata as PERMISSIVE for UPDATE to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])))
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists profiles_delete_scoped on public.profiles;
create policy profiles_delete_scoped on public.profiles as PERMISSIVE for DELETE to authenticated
    using (((get_my_user_type() = 'admin'::text) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))));

drop policy if exists profiles_insert_scoped on public.profiles;
create policy profiles_insert_scoped on public.profiles as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = 'admin'::text));

drop policy if exists profiles_select_scoped on public.profiles;
create policy profiles_select_scoped on public.profiles as PERMISSIVE for SELECT to authenticated
    using (((id = auth.uid()) OR (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text))))) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (user_type = 'stamp'::text))));

drop policy if exists profiles_update_scoped on public.profiles;
create policy profiles_update_scoped on public.profiles as PERMISSIVE for UPDATE to authenticated
    using (((id = auth.uid()) OR (get_my_user_type() = 'admin'::text) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))))
    with check (((id = auth.uid()) OR (get_my_user_type() = 'admin'::text) OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text])) AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))));

drop policy if exists quotations_delete on public.quotations;
create policy quotations_delete on public.quotations as PERMISSIVE for DELETE to authenticated
    using ((((owner_id = ( SELECT auth.uid() AS uid)) AND (status = 'draft'::text)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['admin'::text, 'sales'::text])))))));

drop policy if exists quotations_insert on public.quotations;
create policy quotations_insert on public.quotations as PERMISSIVE for INSERT to authenticated
    with check ((((owner_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['agent'::text, 'agent2'::text])))))) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['admin'::text, 'sales'::text])))))));

drop policy if exists quotations_select on public.quotations;
create policy quotations_select on public.quotations as PERMISSIVE for SELECT to authenticated
    using (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['admin'::text, 'sales'::text])))))));

drop policy if exists quotations_update on public.quotations;
create policy quotations_update on public.quotations as PERMISSIVE for UPDATE to authenticated
    using (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['admin'::text, 'sales'::text])))))))
    with check (((owner_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM profiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.user_type = ANY (ARRAY['admin'::text, 'sales'::text])))))));

drop policy if exists service_issue_files_create on public.service_issue_files;
create policy service_issue_files_create on public.service_issue_files as PERMISSIVE for INSERT to authenticated
    with check (((uploaded_by = ( SELECT auth.uid() AS uid)) AND (storage_path ~~ ((((issue_id)::text || '/'::text) || (( SELECT auth.uid() AS uid))::text) || '/%'::text)) AND (EXISTS ( SELECT 1
   FROM service_issues issue
  WHERE ((issue.id = service_issue_files.issue_id) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (issue.created_by = ( SELECT auth.uid() AS uid))))))));

drop policy if exists service_issue_files_read on public.service_issue_files;
create policy service_issue_files_read on public.service_issue_files as PERMISSIVE for SELECT to authenticated
    using ((EXISTS ( SELECT 1
   FROM service_issues issue
  WHERE ((issue.id = service_issue_files.issue_id) AND ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (issue.created_by = ( SELECT auth.uid() AS uid)) OR (issue.assigned_to = ( SELECT auth.uid() AS uid)))))));

drop policy if exists service_issue_files_remove on public.service_issue_files;
create policy service_issue_files_remove on public.service_issue_files as PERMISSIVE for DELETE to authenticated
    using (((uploaded_by = ( SELECT auth.uid() AS uid)) OR (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text]))));

drop policy if exists service_issues_create on public.service_issues;
create policy service_issues_create on public.service_issues as PERMISSIVE for INSERT to authenticated
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'channel_partner_office_manager'::text, 'office2'::text, 'agent'::text, 'agent2'::text])) AND (created_by = ( SELECT auth.uid() AS uid)) AND (status = 'open'::text) AND (assigned_to IS NULL)));

drop policy if exists service_issues_read on public.service_issues;
create policy service_issues_read on public.service_issues as PERMISSIVE for SELECT to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR (created_by = ( SELECT auth.uid() AS uid)) OR ((get_my_user_type() = 'technician'::text) AND (assigned_to = ( SELECT auth.uid() AS uid)))));

drop policy if exists service_issues_update on public.service_issues;
create policy service_issues_update on public.service_issues as PERMISSIVE for UPDATE to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((get_my_user_type() = 'technician'::text) AND (assigned_to = ( SELECT auth.uid() AS uid)))))
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((get_my_user_type() = 'technician'::text) AND ((assigned_to = ( SELECT auth.uid() AS uid)) OR ((status = 'open'::text) AND (assigned_to IS NULL))))));

drop policy if exists service_visits_create on public.service_visits;
create policy service_visits_create on public.service_visits as PERMISSIVE for INSERT to authenticated
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) AND (entered_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM service_issues issue
  WHERE ((issue.id = service_visits.issue_id) AND (issue.assigned_to = service_visits.technician_id))))));

drop policy if exists service_visits_read on public.service_visits;
create policy service_visits_read on public.service_visits as PERMISSIVE for SELECT to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text])) OR ((get_my_user_type() = 'technician'::text) AND (technician_id = ( SELECT auth.uid() AS uid)))));

drop policy if exists vendors_delete_scoped on public.vendors;
create policy vendors_delete_scoped on public.vendors as PERMISSIVE for DELETE to authenticated
    using ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists vendors_insert_scoped on public.vendors;
create policy vendors_insert_scoped on public.vendors as PERMISSIVE for INSERT to authenticated
    with check ((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])));

drop policy if exists vendors_select_scoped on public.vendors;
create policy vendors_select_scoped on public.vendors as PERMISSIVE for SELECT to authenticated
    using (true);

drop policy if exists vendors_update_scoped on public.vendors;
create policy vendors_update_scoped on public.vendors as PERMISSIVE for UPDATE to authenticated
    using (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])) OR ((get_my_user_type() = 'vendor'::text) AND (lower(TRIM(BOTH FROM COALESCE(name, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))))
    with check (((get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text, 'channel_partner_office'::text, 'office2'::text])) OR ((get_my_user_type() = 'vendor'::text) AND (lower(TRIM(BOTH FROM COALESCE(name, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))));


-- ============================================================================
-- 8. Grants (only where they differ from Supabase defaults)
-- ============================================================================

revoke all on public.admin_history from anon, authenticated;
grant select, truncate, references, trigger, maintain on public.admin_history to authenticated;
revoke all on public.crm_availability from anon, authenticated;
grant insert, select, delete, truncate, references, trigger, maintain on public.crm_availability to authenticated;
revoke all on public.crm_chat_messages from anon, authenticated;
grant all on public.crm_chat_messages to authenticated;
revoke all on public.customer_payment_review_flags from anon, authenticated;
grant all on public.customer_payment_review_flags to authenticated;
revoke all on public.documents from anon, authenticated;
grant all on public.documents to anon;
grant insert, select, delete, truncate, references, trigger, maintain on public.documents to authenticated;
revoke all on public.quotations from anon, authenticated;
grant insert, select, update, delete on public.quotations to authenticated;
revoke all on public.service_issue_files from anon, authenticated;
grant all on public.service_issue_files to authenticated;
revoke all on public.service_issues from anon, authenticated;
grant all on public.service_issues to authenticated;
revoke all on public.service_visits from anon, authenticated;
grant all on public.service_visits to authenticated;
grant update (remark) on public.documents to authenticated;

revoke execute on function public.assign_folder_no from public, anon;
revoke execute on function public.chat_branch_of from public, anon;
revoke execute on function public.chat_directory from public, anon;
revoke execute on function public.chat_is_office from public, anon;
revoke execute on function public.chat_recipient_allowed from public, anon;
revoke execute on function public.claim_service_issue from public, anon;
revoke execute on function public.delete_delivery_batch_atomic from public, anon;
revoke execute on function public.enforce_profile_privilege_changes from public, anon;
revoke execute on function public.get_dashboard_metrics from public, anon;
revoke execute on function public.get_dashboard_metrics_scoped from public, anon;
revoke execute on function public.give_up_service_issue from public, anon;
revoke execute on function public.log_admin_change from public, anon;
revoke execute on function public.move_stage from public, anon;
revoke execute on function public.open_service_issue_queue from public, anon;
revoke execute on function public.rls_auto_enable from public, anon;
revoke execute on function public.save_bom_atomic from public, anon;
revoke execute on function public.save_delivery_batch_atomic from public, anon;
revoke execute on function public.stamp_monthly_summary from public, anon;
revoke execute on function public.sync_driver_info_to_admin from public, anon;
revoke execute on function public.update_delivery_batch_status_atomic from public, anon;


-- ============================================================================
-- 9. Storage buckets, realtime, nightly cleanup job, auto-RLS
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
    ('customer-documents', 'customer-documents', false, null, null),
    ('service-issues', 'service-issues', false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = excluded.public,
    file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        create publication supabase_realtime;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'admin') then
        alter publication supabase_realtime add table public.admin;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles') then
        alter publication supabase_realtime add table public.profiles;
    end if;
end $$;

do $$ begin
    perform cron.schedule('delete-old-completed-activity', '0 2 * * *', 'SELECT public.delete_old_completed_activity();');
exception when others then
    raise notice 'Nightly cleanup job not scheduled (%). Enable pg_cron, then run: select cron.schedule(''delete-old-completed-activity'', ''0 2 * * *'', ''SELECT public.delete_old_completed_activity();'');', sqlerrm;
end $$;

do $$ begin
    if not exists (select 1 from pg_event_trigger where evtname = 'ensure_rls') then
        create event trigger ensure_rls on ddl_command_end
            when tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
            execute function public.rls_auto_enable();
    end if;
exception when others then
    raise notice 'Auto-RLS event trigger not created (%). Optional: it only switches RLS on for tables created later.', sqlerrm;
end $$;

commit;


-- ============================================================================
-- 10. First admin account (new project only - run separately, after this file)
-- ============================================================================
-- Nobody can log in until one admin exists, and the in-app "Add user" needs an
-- admin. So for a brand-new project:
--   1. Supabase dashboard > Authentication > Users > Add user: email + password,
--      tick "Auto confirm".
--   2. Run this, with that email and the person's name:
--
-- insert into public.profiles (id, name, email, user_type, role, status)
-- select id, 'Owner Name', email, 'admin', 'Admin', 'active'
-- from auth.users where email = 'owner@example.com'
-- on conflict (id) do nothing;
--
-- Every other user is then added from the app (User Management > Add user).
