-- EMERGENCY ROLLBACK ONLY if the document access migration breaks the CRM.
-- Restores the customer-document policies captured in supabase/schema.sql.
-- This restores the old security exposure; use only to recover functionality.
-- No files or document rows are deleted.
set lock_timeout = '8s';

begin;

drop policy if exists customer_documents_read on storage.objects;
drop policy if exists customer_documents_upload on storage.objects;
drop policy if exists customer_documents_update on storage.objects;
drop policy if exists customer_documents_delete on storage.objects;

create policy customer_documents_read on storage.objects
    for select to authenticated using (bucket_id = 'customer-documents');
create policy customer_documents_upload on storage.objects
    for insert to authenticated with check (bucket_id = 'customer-documents');
create policy customer_documents_update on storage.objects
    for update to authenticated
    using (bucket_id = 'customer-documents')
    with check (bucket_id = 'customer-documents');
create policy customer_documents_delete on storage.objects
    for delete to authenticated using (bucket_id = 'customer-documents');

drop policy if exists documents_insert_scoped on public.documents;
create policy documents_insert_scoped on public.documents
    for insert to authenticated
    with check (public.get_my_user_type() in
        ('admin', 'sales', 'channel_partner_office', 'office2',
         'agent', 'agent2', 'vendor', 'stamp'));

drop policy if exists documents_update_scoped on public.documents;
create policy documents_update_scoped on public.documents
    for update to authenticated
    using (public.get_my_user_type() in
        ('admin', 'sales', 'channel_partner_office', 'office2',
         'agent', 'agent2', 'vendor', 'stamp'))
    with check (public.get_my_user_type() in
        ('admin', 'sales', 'channel_partner_office', 'office2',
         'agent', 'agent2', 'vendor', 'stamp'));

grant update on public.documents to authenticated;

drop policy if exists documents_delete_scoped on public.documents;
create policy documents_delete_scoped on public.documents
    for delete to authenticated
    using (public.get_my_user_type() in
        ('admin', 'sales', 'channel_partner_office', 'office2'));

commit;
