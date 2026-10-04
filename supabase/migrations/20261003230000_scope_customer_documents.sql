-- Scope customer files to the customer visible to the signed-in user.
-- Apply only in CRM project cjskyhxameobcqlfiuav after reviewing the preflight
-- at the bottom. This does not move or delete any files or document rows.
-- Undo: restore the four customer_documents_* policies and four documents_*
-- policies from the pre-change schema snapshot; restore the prior UPDATE grant.
set lock_timeout = '8s';

begin;

create index if not exists documents_storage_path_idx
    on public.documents (storage_path);

-- A stored object is readable only when a visible document row links to it.
-- The documents and admin SELECT policies supply the existing role/customer
-- scope. This also keeps legacy paths working when they do not start with a
-- customer UUID. Uploads create the object before the document row, so INSERT
-- uses the current app's <customer UUID>/<file> path instead.
drop policy if exists "Allow all storage operations on customer-documents" on storage.objects;
drop policy if exists customer_documents_read on storage.objects;
drop policy if exists customer_documents_upload on storage.objects;
drop policy if exists customer_documents_update on storage.objects;
drop policy if exists customer_documents_delete on storage.objects;
update storage.buckets set public = false where id = 'customer-documents';

create policy customer_documents_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'customer-documents'
        and exists (
            select 1 from public.documents d
            where d.storage_path = objects.name
              and exists (select 1 from public.admin a where a.id = d.customer_id)
        )
    );

create policy customer_documents_upload on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'customer-documents'
        and public.get_my_user_type() in
            ('admin', 'sales', 'channel_partner_office', 'office2',
             'agent', 'agent2', 'vendor', 'stamp')
        and exists (
            select 1 from public.admin a
            where objects.name like a.id::text || '/%'
        )
    );

-- The CRM uploads replacements as new objects (upsert: false), then removes
-- the old object. It has no storage UPDATE call, so no UPDATE policy is needed.
-- Staff can clean up legacy paths. Other uploaders can remove their own files
-- under customers they can still access, including cleanup after a failed
-- document-row insert. The customer path check blocks cross-customer deletes.
create policy customer_documents_delete on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'customer-documents'
        and (
            public.get_my_user_type() in ('admin', 'sales')
            or (
                owner_id = (select auth.uid())::text
                and exists (
                    select 1 from public.admin a
                    where objects.name like a.id::text || '/%'
                )
            )
            or (
                public.get_my_user_type() in ('channel_partner_office', 'office2')
                and exists (
                    select 1 from public.admin a
                    where objects.name like a.id::text || '/%'
                )
            )
        )
    );

-- The metadata row must be attached to a customer the caller can see.
-- New rows must use that customer's folder. Existing legacy rows are retained
-- and may still receive remark edits. Only remark is writable through the API;
-- without this grant limit, UPDATE RLS would also permit customer_id changes.
drop policy if exists documents_insert_scoped on public.documents;
create policy documents_insert_scoped on public.documents
    for insert to authenticated
    with check (
        public.get_my_user_type() in
            ('admin', 'sales', 'channel_partner_office', 'office2',
             'agent', 'agent2', 'vendor', 'stamp')
        and storage_path like customer_id::text || '/%'
        and exists (select 1 from public.admin a where a.id = documents.customer_id)
    );

drop policy if exists documents_update_scoped on public.documents;
create policy documents_update_scoped on public.documents
    for update to authenticated
    using (
        public.get_my_user_type() in
            ('admin', 'sales', 'channel_partner_office', 'office2',
             'agent', 'agent2', 'vendor', 'stamp')
        and exists (select 1 from public.admin a where a.id = documents.customer_id)
    )
    with check (
        public.get_my_user_type() in
            ('admin', 'sales', 'channel_partner_office', 'office2',
             'agent', 'agent2', 'vendor', 'stamp')
        and exists (select 1 from public.admin a where a.id = documents.customer_id)
    );

revoke update on public.documents from public, authenticated;
grant update (remark) on public.documents to authenticated;

drop policy if exists documents_delete_scoped on public.documents;
create policy documents_delete_scoped on public.documents
    for delete to authenticated
    using (
        public.get_my_user_type() in
            ('admin', 'sales', 'channel_partner_office', 'office2')
        and exists (select 1 from public.admin a where a.id = documents.customer_id)
    );

commit;

-- Preflight: run BEFORE the migration, and save the results. A nonzero legacy
-- count is supported for reads, but those paths may leave an orphaned object
-- after a CPO deletes its metadata row; staff can clean up those objects.
-- select count(*) as documents_total,
--        count(*) filter (where storage_path not like customer_id::text || '/%')
--          as legacy_paths,
--        count(*) filter (where storage_path like 'http%') as external_urls
-- from public.documents;
-- select storage_path, count(*) as links, count(distinct customer_id) as customers
-- from public.documents group by storage_path
-- having count(distinct customer_id) > 1 limit 20;
-- select policyname, cmd, qual, with_check from pg_policies
-- where schemaname = 'storage' and tablename = 'objects'
--   and (policyname like 'customer_documents_%'
--        or qual like '%customer-documents%'
--        or with_check like '%customer-documents%');
-- select id, public from storage.buckets where id = 'customer-documents';

-- Verification after applying: only customer_documents_read/upload/delete
-- should remain, with no customer_documents_update policy. Check that
-- authenticated has UPDATE on remark and no table-wide UPDATE grant:
-- select policyname, cmd, qual, with_check from pg_policies
-- where (schemaname, tablename) in (('storage','objects'),('public','documents'))
--   and policyname like any (array['customer_documents_%','documents_%']);
-- select has_table_privilege('authenticated', 'public.documents', 'UPDATE')
--          as table_update,
--        has_column_privilege('authenticated', 'public.documents', 'remark', 'UPDATE')
--          as remark_update,
--        has_column_privilege('authenticated', 'public.documents', 'customer_id', 'UPDATE')
--          as customer_id_update;
