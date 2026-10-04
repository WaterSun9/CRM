-- Supabase Storage uploads INSERT ... RETURNING the new storage.objects row.
-- The existing customer_documents_read policy needs a public.documents row,
-- but the CRM creates that row only after the upload succeeds. Let the person
-- who uploaded the object read it while it is in a customer folder they can
-- access. All other users still need a visible documents row.
-- This changes only a SELECT policy. No objects or document rows are changed.
set lock_timeout = '8s';

begin;

drop policy if exists customer_documents_owner_read on storage.objects;
create policy customer_documents_owner_read on storage.objects
    for select to authenticated
    using (
        bucket_id = 'customer-documents'
        and owner_id = (select auth.uid())::text
        and exists (
            select 1 from public.admin a
            where objects.name like a.id::text || '/%'
        )
    );

commit;
