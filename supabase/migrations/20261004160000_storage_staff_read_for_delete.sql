-- Let office staff "see" stored customer files so they can delete them.
--
-- Why: deleting a document removes its row from public.documents first, then
-- removes the stored file. Storage only lets you delete a file you can SELECT,
-- and the read policy (customer_documents_read) needs that documents row, which
-- is already gone. The file stayed behind with no error shown.
--
-- This mirrors the existing DELETE policy (customer_documents_delete) exactly:
-- admin/Office for any customer file, CPO/office2 for customers they can see.
-- Uploaders are already covered by customer_documents_owner_read.
-- Safe to run more than once.
drop policy if exists customer_documents_staff_read on storage.objects;
create policy customer_documents_staff_read on storage.objects
for select to authenticated
using (
    bucket_id = 'customer-documents'
    and (
        public.get_my_user_type() in ('admin', 'sales')
        or (
            public.get_my_user_type() in ('channel_partner_office', 'office2')
            and exists (select 1 from public.admin a where objects.name like a.id::text || '/%')
        )
    )
);

-- Check: should return one row.
select policyname, cmd from pg_policies
where schemaname = 'storage' and tablename = 'objects' and policyname = 'customer_documents_staff_read';
