-- Read-only preflight/verification for CRM project cjskyhxameobcqlfiuav.
-- Run in the Supabase SQL Editor before and after
-- supabase/migrations/20261003230000_scope_customer_documents.sql and
-- supabase/migrations/20261004000100_restore_customer_document_uploads.sql.

select id, public from storage.buckets where id = 'customer-documents';

select count(*) as document_rows,
       count(*) filter (where storage_path not like customer_id::text || '/%') as legacy_paths,
       count(*) filter (where storage_path like 'http%') as external_urls
from public.documents;

select count(*) as paths_linked_to_multiple_customers
from (
    select storage_path from public.documents
    group by storage_path having count(distinct customer_id) > 1
) duplicated;

select count(*) as stored_objects,
       count(*) filter (where not exists (
           select 1 from public.documents d where d.storage_path = o.name
       )) as objects_without_document_rows
from storage.objects o
where o.bucket_id = 'customer-documents';

-- After the upload fix, customer_documents_owner_read must be present as a
-- SELECT policy. It is limited to an object owned by the signed-in user in a
-- customer folder visible under public.admin RLS.
select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where (schemaname = 'storage' and tablename = 'objects')
   or (schemaname = 'public' and tablename = 'documents')
order by schemaname, tablename, policyname;

select has_table_privilege('authenticated', 'public.documents', 'UPDATE') as table_update,
       has_column_privilege('authenticated', 'public.documents', 'remark', 'UPDATE') as remark_update,
       has_column_privilege('authenticated', 'public.documents', 'customer_id', 'UPDATE') as customer_id_update;
