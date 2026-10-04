-- Record the authenticated uploader in the database, including a snapshot of
-- their role and display name at upload time. Existing documents stay intact;
-- a historic role cannot be inferred reliably from today's profile.
set lock_timeout = '8s';

begin;

alter table public.documents
    add column if not exists uploaded_by_role text,
    add column if not exists uploaded_by_name text;

create or replace function public.stamp_document_uploader()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    -- Service-role imports may have no user JWT. For normal CRM requests,
    -- ignore any uploader identity supplied by the browser.
    if auth.uid() is not null then
        new.uploaded_by := auth.uid();
        new.uploaded_by_role := public.get_my_user_type();
        new.uploaded_by_name := public.get_my_name();
    end if;
    return new;
end;
$$;

drop trigger if exists documents_stamp_uploader on public.documents;
create trigger documents_stamp_uploader
    before insert on public.documents
    for each row execute function public.stamp_document_uploader();

commit;

-- Read-only verification after applying:
-- select column_name from information_schema.columns
-- where table_schema = 'public' and table_name = 'documents'
--   and column_name in ('uploaded_by', 'uploaded_by_role', 'uploaded_by_name');
-- select tgname from pg_trigger
-- where tgrelid = 'public.documents'::regclass
--   and tgname = 'documents_stamp_uploader' and not tgisinternal;
