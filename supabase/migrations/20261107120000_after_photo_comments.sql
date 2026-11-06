-- After photo comments, 7 Nov 2026. Run after 20261105120000_technician_visits.sql.
--   * Each After photo can carry a comment (up to 300 characters), e.g. "Replaced MC4
--     connector on string 2". Optional.
--   * Only the technician who took the photo, while the job is theirs and open, can add
--     or change it (service_photo_note). Everyone who can see the photo sees the comment.
--   * Installation photos are no longer taken from the technician job (they come from
--     the office or the vendor on the customer card); old 'site' rows stay readable.
--
-- Safe to run more than once. Run this BEFORE deploying the site that shows comments.
set lock_timeout = '8s';
begin;

alter table public.service_issue_files add column if not exists note text;
alter table public.service_issue_files drop constraint if exists service_issue_files_note_check;
alter table public.service_issue_files add constraint service_issue_files_note_check
    check (note is null or length(note) <= 300);

create or replace function public.service_photo_note(p_file_id uuid, p_note text)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    photo record;
    clean text := nullif(left(btrim(coalesce(p_note, '')), 300), '');
begin
    select f.id, f.issue_id, f.uploaded_by, f.kind into photo
    from public.service_issue_files f where f.id = p_file_id for update;
    if not found then
        raise exception 'Photo not found. Refresh the list.';
    end if;
    if photo.kind is distinct from 'after' then
        raise exception 'Only After photos take a comment.';
    end if;
    perform public.require_my_open_job(photo.issue_id);
    if photo.uploaded_by is distinct from auth.uid() then
        raise exception 'You can only comment on your own photos.';
    end if;
    update public.service_issue_files set note = clean where id = photo.id;
    return clean;
end;
$$;

revoke all on function public.service_photo_note(uuid, text) from public, anon;
grant execute on function public.service_photo_note(uuid, text) to authenticated;

commit;

-- Check (expect note_column_1, function_1):
select
  (select count(*) from information_schema.columns where table_schema = 'public'
     and table_name = 'service_issue_files' and column_name = 'note') as note_column_1,
  (select count(*) from pg_proc where proname = 'service_photo_note') as function_1;
