-- Complaint photos (Before / After, technician only) and a comment thread on each
-- complaint (NOT YET RUN - needs the owner's go-ahead). Agreed with the owner on 23 Oct 2026.
-- On live: run AFTER docs/sql/RUN_19OCT_service_jobs_and_trips.sql, then redeploy
-- service-otp, then the app. Does not need 20261013090000 / 20261013100000 /
-- 20261013120000, and still works if they are run later.
--
--   * Raising a complaint (office and channel partners) = details + comment only. No
--     files when raising. Partners raise only for their own customers (unchanged:
--     fill_service_issue_from_customer reads the customer card with the caller's rules).
--   * Photos: only the technician the job is assigned to adds them, while the job is
--     'assigned' or 'completion_pending' (and the technician is switched on). Two kinds,
--     'before' and 'after', at most 10 of each per complaint, images only
--     (jpeg / png / webp). Files added when raising before today stay as kind 'problem'
--     (view only). Stored at service-issues/{complaint id}/{technician id}/...
--   * Anyone who can see the complaint can see its photos. Admin / office (sales) can
--     delete any photo; the technician can delete their own while the job is still theirs
--     and open. Partners only look.
--   * Channel partners (channel_partner_office, channel_partner_office_manager, office2,
--     agent, agent2) now see every complaint of a customer card they can see, also those
--     raised by the office - not only the ones they raised. They still cannot change a job.
--   * Comments: anyone who can see the complaint (office, partners, the assigned
--     technician) can add one. Name and role come from the login's profile, never from
--     the app. No editing; only admin can delete.
--   * The completion code needs at least 1 Before and 1 After photo: the service-otp edge
--     function checks this before it sends a code and before it closes the job, and the
--     database refuses to close a job by code without them (so a photo deleted at that very
--     moment cannot slip through). Office "Completed without code" needs no photos.
--   * A photo's date is the time it was added, and its name is cut to 200 characters,
--     whatever the app sends.
--   * The service role (edge functions) and the SQL editor are not limited by any of this.
--
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

-- 1. Photo kind ------------------------------------------------------------------------

-- Existing files (added when the complaint was raised) become 'problem'.
alter table public.service_issue_files add column if not exists kind text not null default 'problem';
alter table public.service_issue_files drop constraint if exists service_issue_files_kind_check;
alter table public.service_issue_files add constraint service_issue_files_kind_check
    check (kind in ('problem', 'before', 'after'));
-- The 10-per-kind limit and the edge function's "1 Before and 1 After" count.
create index if not exists service_issue_files_issue_kind_idx on public.service_issue_files (issue_id, kind);

-- 2. Helpers ---------------------------------------------------------------------------

-- Complaint id from a storage path "{complaint id}/{user id}/{file}", or null when the
-- first part is not an id (so a bad path is refused instead of raising an error).
create or replace function public.service_issue_of_path(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $$
    select case when split_part(p_name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                then split_part(p_name, '/', 1)::uuid end
$$;

-- The signed-in login is a technician who is switched on. Switched-off technicians keep
-- their login until it expires, so the access rules check this too.
create or replace function public.is_active_technician()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
    select exists (select 1 from public.profiles p
                   where p.id = auth.uid() and p.user_type = 'technician'
                     and coalesce(p.status, 'active') <> 'inactive')
$$;

-- 3. Limit: 10 Before + 10 After photos per complaint; closing by code needs photos ---
-- Security definer so the count sees every photo of the complaint, whoever adds one.
-- Two uploads at the same moment wait in turn (advisory lock), so the limit holds.
create or replace function public.limit_service_issue_files()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    perform pg_advisory_xact_lock(hashtextextended(new.issue_id::text, 0));
    -- No signed-in user = service role or the SQL editor: not limited.
    if auth.uid() is not null then
        if new.kind is distinct from 'before' and new.kind is distinct from 'after' then
            raise exception 'Only Before and After photos can be added to a complaint.';
        end if;
        if new.mime_type is null or new.mime_type not in ('image/jpeg', 'image/png', 'image/webp') then
            raise exception 'Only photos (JPG, PNG or WebP) can be added to a complaint.';
        end if;
        if (select count(*) from public.service_issue_files f
            where f.issue_id = new.issue_id and f.kind = new.kind) >= 10 then
            raise exception 'A complaint can have at most 10 % photos. Delete one first.', initcap(new.kind);
        end if;
        -- The photo's date cannot be set back, and a very long name is cut.
        new.created_at := now();
        new.file_name := left(coalesce(nullif(btrim(new.file_name), ''), new.kind || '.jpg'), 200);
    end if;
    return new;
end;
$$;
create or replace trigger service_issue_file_limit before insert on public.service_issue_files
for each row execute function public.limit_service_issue_files();

-- Closing a job by code needs 1 Before and 1 After photo. The edge function checks first
-- and gives the technician the plain message; this is the last word, at the moment the job
-- closes. FOR SHARE waits for a photo delete that is still going on, and a photo that is
-- gone by then does not count. Office "Completed without code" is not checked.
create or replace function public.check_service_code_photos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
    if new.status = 'completed' and new.completion_method = 'otp'
       and (old.status is distinct from 'completed' or old.completion_method is distinct from 'otp') then
        perform 1 from public.service_issue_files f where f.issue_id = new.id and f.kind = 'before' limit 1 for share;
        if not found then
            raise exception 'Add at least one Before photo and one After photo first.';
        end if;
        perform 1 from public.service_issue_files f where f.issue_id = new.id and f.kind = 'after' limit 1 for share;
        if not found then
            raise exception 'Add at least one Before photo and one After photo first.';
        end if;
    end if;
    return new;
end;
$$;
-- Runs after service_issue_guard (triggers run in name order).
create or replace trigger service_issue_photo_check before update on public.service_issues
for each row execute function public.check_service_code_photos();

-- 4. Photo rows: who can see, add and delete ---------------------------------------------

alter table public.service_issue_files enable row level security;

-- Anyone who can see the complaint (the complaint's own read rule decides).
drop policy if exists service_issue_files_read on public.service_issue_files;
create policy service_issue_files_read on public.service_issue_files
for select to authenticated
using (exists (select 1 from public.service_issues issue where issue.id = service_issue_files.issue_id));

-- Only the technician of the open job, into their own folder of that complaint.
drop policy if exists service_issue_files_create on public.service_issue_files;
create policy service_issue_files_create on public.service_issue_files
for insert to authenticated
with check (
    (select public.is_active_technician())
    and uploaded_by = (select auth.uid())
    and kind in ('before', 'after')
    and storage_path like issue_id::text || '/' || (select auth.uid())::text || '/%'
    and exists (select 1 from public.service_issues issue
                where issue.id = service_issue_files.issue_id
                  and issue.assigned_to = (select auth.uid())
                  and issue.status in ('assigned', 'completion_pending'))
);

-- Office any photo; the technician their own while the job is still theirs and open.
drop policy if exists service_issue_files_remove on public.service_issue_files;
create policy service_issue_files_remove on public.service_issue_files
for delete to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales')
    or (uploaded_by = (select auth.uid())
        and (select public.is_active_technician())
        and exists (select 1 from public.service_issues issue
                    where issue.id = service_issue_files.issue_id
                      and issue.assigned_to = (select auth.uid())
                      and issue.status in ('assigned', 'completion_pending')))
);

-- No update rule: a photo's kind or path is never changed.
revoke all on public.service_issue_files from public, anon, authenticated;
grant select, insert, delete on public.service_issue_files to authenticated;
grant all on public.service_issue_files to service_role;

-- 5. Stored photo files (bucket service-issues) --------------------------------------------
-- Storage lets you delete or sign a link only for a file you can read, and every
-- uploader and deleter below can read the complaint.

-- Photos only from now on. Files already stored (PDFs too) stay readable. Optional: the
-- rules below already allow only the technician, and the photo rows only images.
do $$ begin
    update storage.buckets set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
    where id = 'service-issues';
exception when others then
    raise notice 'Bucket service-issues not changed (%). Optional: Storage > service-issues > Edit > allowed types image/jpeg, image/png, image/webp.', sqlerrm;
end $$;

drop policy if exists service_issue_storage_read on storage.objects;
create policy service_issue_storage_read on storage.objects
for select to authenticated
using (
    bucket_id = 'service-issues'
    and exists (select 1 from public.service_issues issue
                where issue.id = public.service_issue_of_path(objects.name))
);

drop policy if exists service_issue_storage_upload on storage.objects;
create policy service_issue_storage_upload on storage.objects
for insert to authenticated
with check (
    bucket_id = 'service-issues'
    and split_part(name, '/', 2) = (select auth.uid())::text
    and (select public.is_active_technician())
    and exists (select 1 from public.service_issues issue
                where issue.id = public.service_issue_of_path(objects.name)
                  and issue.assigned_to = (select auth.uid())
                  and issue.status in ('assigned', 'completion_pending'))
);

drop policy if exists service_issue_storage_remove on storage.objects;
create policy service_issue_storage_remove on storage.objects
for delete to authenticated
using (
    bucket_id = 'service-issues'
    and (
        (select public.get_my_user_type()) in ('admin', 'sales')
        or (split_part(name, '/', 2) = (select auth.uid())::text
            and (select public.is_active_technician())
            and exists (select 1 from public.service_issues issue
                        where issue.id = public.service_issue_of_path(objects.name)
                          and issue.assigned_to = (select auth.uid())
                          and issue.status in ('assigned', 'completion_pending')))
    )
);

-- 6. Who can see a complaint ---------------------------------------------------------------
-- Same as before, plus: channel partners see every complaint of a customer card they can
-- see. "exists ... public.admin" runs with the caller's own rules on the customer cards,
-- so a branch never sees another branch's complaints. (The admin rules do not read
-- service_issues, so there is no loop.)
drop policy if exists service_issues_read on public.service_issues;
create policy service_issues_read on public.service_issues
for select to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales')
    or created_by = (select auth.uid())
    or ((select public.get_my_user_type()) = 'technician' and assigned_to = (select auth.uid()))
    or ((select public.get_my_user_type()) in ('channel_partner_office', 'channel_partner_office_manager',
                                               'office2', 'agent', 'agent2')
        and customer_id is not null
        and exists (select 1 from public.admin a where a.id = service_issues.customer_id))
);

-- 7. Comments ----------------------------------------------------------------------------

create table if not exists public.service_issue_comments (
    id uuid primary key default gen_random_uuid(),
    issue_id uuid not null references public.service_issues(id) on delete cascade,
    -- Filled with the signed-in login when the app leaves it out. Set null when a login
    -- is deleted, so old comments never block removing a user.
    author_id uuid default auth.uid() references auth.users(id) on delete set null,
    author_name text not null,
    author_role text not null,
    body text not null,
    created_at timestamptz not null default now()
);

alter table public.service_issue_comments drop constraint if exists service_issue_comments_body_check;
alter table public.service_issue_comments add constraint service_issue_comments_body_check
    check (length(btrim(body)) between 1 and 2000);

create index if not exists service_issue_comments_issue_time_idx on public.service_issue_comments (issue_id, created_at);

-- Name and role from the profile (whatever the app sends is replaced), body trimmed,
-- time = now.
create or replace function public.fill_service_issue_comment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    me record;
begin
    new.body := regexp_replace(coalesce(new.body, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
    if new.body = '' then
        raise exception 'Type a comment first.';
    end if;
    if length(new.body) > 2000 then
        raise exception 'A comment can be at most 2000 characters.';
    end if;
    if auth.uid() is not null then
        select p.name, p.user_type into me from public.profiles p where p.id = auth.uid();
        new.author_name := left(coalesce(nullif(btrim(me.name), ''), 'Unknown'), 160);
        new.author_role := case
            when me.user_type = 'admin' then 'Admin'
            when me.user_type = 'sales' then 'Office'
            when me.user_type = 'technician' then 'Technician'
            when me.user_type in ('channel_partner_office', 'channel_partner_office_manager',
                                  'office2', 'agent', 'agent2') then 'Channel partner'
            else 'User'
        end;
        new.created_at := now();
    else
        -- Service role / SQL editor.
        new.author_name := coalesce(nullif(btrim(new.author_name), ''), 'Watersun office');
        new.author_role := coalesce(nullif(btrim(new.author_role), ''), 'Office');
        new.created_at := coalesce(new.created_at, now());
    end if;
    return new;
end;
$$;
create or replace trigger fill_service_issue_comment before insert on public.service_issue_comments
for each row execute function public.fill_service_issue_comment();

alter table public.service_issue_comments enable row level security;

drop policy if exists service_issue_comments_read on public.service_issue_comments;
create policy service_issue_comments_read on public.service_issue_comments
for select to authenticated
using (exists (select 1 from public.service_issues issue where issue.id = service_issue_comments.issue_id));

-- Switched-off logins cannot comment (they keep their login until it expires).
drop policy if exists service_issue_comments_create on public.service_issue_comments;
create policy service_issue_comments_create on public.service_issue_comments
for insert to authenticated
with check (
    author_id = (select auth.uid())
    and exists (select 1 from public.profiles p
                where p.id = (select auth.uid())
                  and p.user_type in ('admin', 'sales', 'channel_partner_office', 'channel_partner_office_manager',
                                      'office2', 'agent', 'agent2', 'technician')
                  and coalesce(p.status, 'active') <> 'inactive')
    and exists (select 1 from public.service_issues issue where issue.id = service_issue_comments.issue_id)
);

drop policy if exists service_issue_comments_remove on public.service_issue_comments;
create policy service_issue_comments_remove on public.service_issue_comments
for delete to authenticated
using ((select public.get_my_user_type()) = 'admin');

-- No update right: comments are never edited.
revoke all on public.service_issue_comments from public, anon, authenticated;
grant select, insert, delete on public.service_issue_comments to authenticated;
grant all on public.service_issue_comments to service_role;

-- 8. Function rights -------------------------------------------------------------------------

revoke all on function public.service_issue_of_path(text) from public, anon;
revoke all on function public.is_active_technician() from public, anon;
revoke all on function public.limit_service_issue_files() from public, anon;
revoke all on function public.fill_service_issue_comment() from public, anon;
revoke all on function public.check_service_code_photos() from public, anon;
-- The access rules and triggers run these as the caller.
grant execute on function public.service_issue_of_path(text) to authenticated, service_role;
grant execute on function public.is_active_technician() to authenticated, service_role;
grant execute on function public.limit_service_issue_files() to authenticated, service_role;
grant execute on function public.fill_service_issue_comment() to authenticated, service_role;
grant execute on function public.check_service_code_photos() to authenticated, service_role;

commit;

-- Check (shows after running; expect kind_column 1, the 3 file rules, the 3 storage rules,
-- the partner clause in the complaint read rule, comments with RLS on and 3 rules,
-- photos_only true and the close-by-code photo check 1):
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'service_issue_files' and column_name = 'kind') as kind_column_1,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'service_issue_files'
    and policyname in ('service_issue_files_read', 'service_issue_files_create', 'service_issue_files_remove')) as file_rules_3,
  (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('service_issue_storage_read', 'service_issue_storage_upload', 'service_issue_storage_remove')) as storage_rules_3,
  (select qual like '%agent2%' from pg_policies where schemaname = 'public' and tablename = 'service_issues'
    and policyname = 'service_issues_read') as partners_see_complaints,
  (select relrowsecurity from pg_class where oid = 'public.service_issue_comments'::regclass) as comments_rls_on,
  (select count(*) from pg_policies where schemaname = 'public' and tablename = 'service_issue_comments') as comment_rules_3,
  (select allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'] from storage.buckets
    where id = 'service-issues') as photos_only,
  (select count(*) from pg_trigger where tgrelid = 'public.service_issues'::regclass
    and tgname = 'service_issue_photo_check' and tgenabled <> 'D') as code_photo_check_1;
-- Files per kind (old ones all 'problem'):
-- select kind, mime_type, count(*) from public.service_issue_files group by 1, 2 order by 1, 2;
-- select policyname, cmd, roles from pg_policies
--  where tablename in ('service_issue_files', 'service_issue_comments', 'service_issues') order by 1, 2;
-- select grantee, privilege_type from information_schema.role_table_grants
--  where table_name in ('service_issue_files', 'service_issue_comments') and grantee in ('anon', 'authenticated') order by 1, 2;
