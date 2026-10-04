-- Read-only. Lists stored customer files that no document row points to.
-- (4 Oct 2026: 465 files, 97 MB; 456 of them belong to customers that were
-- permanently deleted.) SQL cannot delete storage files - Supabase blocks it
-- (protect_objects_delete trigger) and it would not remove the real file
-- anyway. Delete from Dashboard > Storage > customer-documents, folder by folder.

-- 1) One line per folder (folder name = customer id)
select split_part(o.name, '/', 1) as folder,
       exists (select 1 from public.admin a where a.id::text = split_part(o.name, '/', 1)) as customer_still_exists,
       count(*) as files,
       pg_size_pretty(sum(coalesce((o.metadata->>'size')::bigint, 0))) as size,
       max(o.created_at)::date as newest
from storage.objects o
where o.bucket_id = 'customer-documents'
  and not exists (select 1 from public.documents d where d.storage_path = o.name)
group by 1, 2
order by 2, 3 desc;

-- 2) Every file (for customers that still exist, check before deleting)
-- select o.name, o.created_at, (o.metadata->>'size')::bigint as bytes
-- from storage.objects o
-- where o.bucket_id = 'customer-documents'
--   and not exists (select 1 from public.documents d where d.storage_path = o.name)
-- order by o.name;
