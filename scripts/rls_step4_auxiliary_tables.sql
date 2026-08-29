-- ─── RLS STEP 4 — scope auxiliary tables & tighten remaining policies ────────
-- Tables covered:
--   1. profiles         (close open INSERT, retain required SELECT for UI joins)
--   2. metadata         (open SELECT for dropdowns; scoped INSERT/UPDATE/DELETE)
--   3. vendors          (open SELECT for dropdowns; scoped INSERT/UPDATE/DELETE)
--   4. delivery_batches (scoped SELECT, INSERT, UPDATE, DELETE)
--   5. activity_log     (open INSERT for audit events; customer/admin-scoped SELECT; admin-only DELETE/UPDATE)
--   6. documents        (customer-scoped SELECT; scoped INSERT/UPDATE; admin/office-only DELETE)
--
-- Safe because get_my_user_type() / get_my_channel_partner() / get_my_name()
-- are STABLE SECURITY DEFINER and bypass RLS.
-- ────────────────────────────────────────────────────────────────────────────

begin;

-- ============================================================================
-- 1. PROFILES
-- ============================================================================
-- Client inserts should only come from Admin or the user themselves (initial auth setup).
-- User creation in UserManagement routes via the Edge Function (service_role, bypasses RLS).
drop policy if exists "Allow authenticated profile insert" on public.profiles;
drop policy if exists "profiles_insert_policy" on public.profiles;
drop policy if exists "profiles_insert_scoped" on public.profiles;

create policy "profiles_insert_scoped" on public.profiles
    for insert to authenticated
    with check (
        get_my_user_type() = 'admin'
        or id = auth.uid()
    );


-- ============================================================================
-- 2. METADATA
-- ============================================================================
alter table public.metadata enable row level security;

-- Drop all existing / legacy / public policies
drop policy if exists "auth_modify_metadata" on public.metadata;
drop policy if exists "Allow authenticated delete metadata" on public.metadata;
drop policy if exists "no_delete_meta" on public.metadata;
drop policy if exists "auth_insert_metadata" on public.metadata;
drop policy if exists "insert_meta" on public.metadata;
drop policy if exists "auth_select_metadata" on public.metadata;
drop policy if exists "read_meta" on public.metadata;
drop policy if exists "update_meta" on public.metadata;
drop policy if exists "Allow anon and auth full access to metadata" on public.metadata;
drop policy if exists "Allow anon read metadata" on public.metadata;
drop policy if exists "metadata_select_policy" on public.metadata;
drop policy if exists "metadata_write_policy" on public.metadata;
drop policy if exists "metadata_select_scoped" on public.metadata;
drop policy if exists "metadata_insert_scoped" on public.metadata;
drop policy if exists "metadata_update_scoped" on public.metadata;
drop policy if exists "metadata_delete_scoped" on public.metadata;

-- Read: all authenticated users need metadata for dropdowns across portals
create policy "metadata_select_scoped" on public.metadata
    for select to authenticated
    using (true);

-- Write: only Admin, Sales, and Branch/Office users
create policy "metadata_insert_scoped" on public.metadata
    for insert to authenticated
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

create policy "metadata_update_scoped" on public.metadata
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    )
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

create policy "metadata_delete_scoped" on public.metadata
    for delete to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );


-- ============================================================================
-- 3. VENDORS
-- ============================================================================
alter table public.vendors enable row level security;

-- Drop all existing legacy policies
drop policy if exists "Allow authenticated delete on vendors" on public.vendors;
drop policy if exists "Allow authenticated insert on vendors" on public.vendors;
drop policy if exists "Allow authenticated read on vendors" on public.vendors;
drop policy if exists "Allow authenticated update on vendors" on public.vendors;
drop policy if exists "Allow anon and auth full access to vendors" on public.vendors;
drop policy if exists "vendors_select_policy" on public.vendors;
drop policy if exists "vendors_write_policy" on public.vendors;
drop policy if exists "vendors_select_scoped" on public.vendors;
drop policy if exists "vendors_insert_scoped" on public.vendors;
drop policy if exists "vendors_update_scoped" on public.vendors;
drop policy if exists "vendors_delete_scoped" on public.vendors;

-- Read: all authenticated users (needed for Material Delivery, Installation, Batches dropdowns)
create policy "vendors_select_scoped" on public.vendors
    for select to authenticated
    using (true);

-- Insert/Delete: Admin / Office only
create policy "vendors_insert_scoped" on public.vendors
    for insert to authenticated
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

create policy "vendors_delete_scoped" on public.vendors
    for delete to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

-- Update: Admin / Office or Vendor updating own record
create policy "vendors_update_scoped" on public.vendors
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
        or (get_my_user_type() = 'vendor' and lower(trim(coalesce(name, ''))) = lower(trim(coalesce(get_my_name(), ''))))
    )
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
        or (get_my_user_type() = 'vendor' and lower(trim(coalesce(name, ''))) = lower(trim(coalesce(get_my_name(), ''))))
    );


-- ============================================================================
-- 4. DELIVERY_BATCHES
-- ============================================================================
alter table public.delivery_batches enable row level security;

-- Drop all existing legacy policies
drop policy if exists "Allow all for authenticated users" on public.delivery_batches;
drop policy if exists "Authenticated users can write delivery_batches" on public.delivery_batches;
drop policy if exists "Authenticated users can read delivery_batches" on public.delivery_batches;
drop policy if exists "delivery_batches_all" on public.delivery_batches;
drop policy if exists "delivery_batches_select_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_insert_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_update_scoped" on public.delivery_batches;
drop policy if exists "delivery_batches_delete_scoped" on public.delivery_batches;

-- Select: Office/Admin & Vendors
create policy "delivery_batches_select_scoped" on public.delivery_batches
    for select to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2', 'vendor')
    );

-- Insert/Update/Delete: Office/Admin
create policy "delivery_batches_insert_scoped" on public.delivery_batches
    for insert to authenticated
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

create policy "delivery_batches_update_scoped" on public.delivery_batches
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    )
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

create policy "delivery_batches_delete_scoped" on public.delivery_batches
    for delete to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );


-- ============================================================================
-- 5. ACTIVITY_LOG
-- ============================================================================
alter table public.activity_log enable row level security;

-- Drop all existing / legacy / public policies
drop policy if exists "auth_insert_activity_log" on public.activity_log;
drop policy if exists "insert_log" on public.activity_log;
drop policy if exists "auth_select_activity_log" on public.activity_log;
drop policy if exists "read_log" on public.activity_log;
drop policy if exists "activity_log_select_policy" on public.activity_log;
drop policy if exists "activity_log_insert_policy" on public.activity_log;
drop policy if exists "activity_log_select_scoped" on public.activity_log;
drop policy if exists "activity_log_insert_scoped" on public.activity_log;
drop policy if exists "activity_log_update_scoped" on public.activity_log;
drop policy if exists "activity_log_delete_scoped" on public.activity_log;

-- Insert: any authenticated user logging their actions
create policy "activity_log_insert_scoped" on public.activity_log
    for insert to authenticated
    with check (auth.uid() is not null);

-- Select: Admin/Sales, user's own logged events, or events on customers visible to the user
create policy "activity_log_select_scoped" on public.activity_log
    for select to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
        or user_id = auth.uid()
        or (
            customer_id is not null and exists (
                select 1 from public.admin a
                where a.id = activity_log.customer_id
            )
        )
    );

-- Update/Delete: Admin only
create policy "activity_log_update_scoped" on public.activity_log
    for update to authenticated
    using (get_my_user_type() = 'admin')
    with check (get_my_user_type() = 'admin');

create policy "activity_log_delete_scoped" on public.activity_log
    for delete to authenticated
    using (get_my_user_type() = 'admin');


-- ============================================================================
-- 6. DOCUMENTS
-- ============================================================================
alter table public.documents enable row level security;

drop policy if exists "auth_update_documents" on public.documents;
drop policy if exists "Allow all document operations" on public.documents;
drop policy if exists "Allow authenticated delete on documents" on public.documents;
drop policy if exists "Allow authenticated insert on documents" on public.documents;
drop policy if exists "Allow authenticated read on documents" on public.documents;
drop policy if exists "documents_select_scoped" on public.documents;
drop policy if exists "documents_insert_scoped" on public.documents;
drop policy if exists "documents_update_scoped" on public.documents;
drop policy if exists "documents_delete_scoped" on public.documents;

-- Select: Admin/Sales or any user who has access to the customer row
create policy "documents_select_scoped" on public.documents
    for select to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
        or (
            customer_id is not null and exists (
                select 1 from public.admin a
                where a.id = documents.customer_id
            )
        )
    );

-- Insert: authenticated roles uploading docs for accessible customer
create policy "documents_insert_scoped" on public.documents
    for insert to authenticated
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2', 'agent', 'agent2', 'vendor', 'stamp')
    );

-- Update: remark updates by authenticated roles
create policy "documents_update_scoped" on public.documents
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2', 'agent', 'agent2', 'vendor', 'stamp')
    )
    with check (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2', 'agent', 'agent2', 'vendor', 'stamp')
    );

-- Delete: restricted to Admin and Office/CPO (matches Item 10.8)
create policy "documents_delete_scoped" on public.documents
    for delete to authenticated
    using (
        get_my_user_type() in ('admin', 'sales', 'channel_partner_office', 'office2')
    );

commit;


-- ── Verification Query ───────────────────────────────────────────────────────
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('profiles', 'metadata', 'vendors', 'delivery_batches', 'activity_log', 'documents')
order by tablename, cmd, policyname;
