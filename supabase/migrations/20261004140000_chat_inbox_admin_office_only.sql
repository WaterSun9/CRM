-- Team chat rules (4 Oct 2026). Replaces 20261004130000 (branch inbox).
-- NOT YET RUN - the owner runs it in the SQL Editor, BEFORE deploying the
-- frontend that has the new chat screen.
--
-- THE IDEA: the office (Admin + Office staff) sees every chat and can reply in
-- any of them. Everyone else sees only their own chats and announcements.
--
-- WHO CAN READ
--   * Admin: every message.
--   * Office (sales): every message, except private chats between two OTHER
--     office people (e.g. Admin <-> another Office person).
--   * Everyone else: messages they sent, messages to them (or copied to them),
--     and announcements to everyone or to their own group.
--
-- WHO CAN SEND
--   * Announcements (everyone / a group): Admin and Office.
--   * "Office team" group chat (no recipient): everyone outside the office.
--   * Directly to a person:
--       - Admin / Office: anyone. They may also copy a second person (cc_id),
--         which is how they reply inside a chat between two people, e.g. a
--         CPO and their dealer, so that both see the reply.
--       - CPO / CPO staff: Admin, Office, and people in their own branch
--         (their staff and dealers).
--       - Dealers: their own branch's CPO / CPO staff.
--       - Anyone: back to a person who has messaged them (reply).
--   "Branch" = coalesce(channel_partner, name), trimmed, case-insensitive -
--   the same rule used for customer access.
--
-- Undo: re-run 20261003233000_restrict_private_chat.sql (read policy) and the
-- crm_chat_send policy from supabase/schema.sql; the cc_id column can stay.
set lock_timeout = '8s';
begin;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'crm_chat_messages'
          and policyname not in ('crm_chat_read', 'crm_chat_send')
    ) then
        raise exception 'Unexpected extra policy on crm_chat_messages; review it first';
    end if;
end $$;

-- Second recipient, used only when the office replies inside a two-person chat.
alter table public.crm_chat_messages add column if not exists cc_id uuid references auth.users(id);
alter table public.crm_chat_messages drop constraint if exists crm_chat_cc_valid;
alter table public.crm_chat_messages add constraint crm_chat_cc_valid check (
    cc_id is null
    or (audience = 'admin' and recipient_id is not null and cc_id <> recipient_id and cc_id <> sender_id)
);
create index if not exists crm_chat_messages_cc_idx on public.crm_chat_messages (cc_id) where cc_id is not null;

-- Is this person Admin or Office?
create or replace function public.chat_is_office(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((select user_type in ('admin', 'sales') from public.profiles where id = p_user), false)
$$;

-- Branch of a profile, as used by customer access.
create or replace function public.chat_branch_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select lower(btrim(coalesce(nullif(btrim(channel_partner), ''), name, '')))
    from public.profiles where id = p_user
$$;

-- May the signed-in user send a direct message to p_recipient?
create or replace function public.chat_recipient_allowed(p_recipient uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
    v_me uuid := auth.uid();
    v_my_type text;
    v_their_type text;
    v_my_branch text;
begin
    if v_me is null or p_recipient is null or p_recipient = v_me then
        return false;
    end if;
    select user_type into v_their_type from public.profiles where id = p_recipient;
    if v_their_type is null then
        return false;
    end if;
    -- Reply: anyone may answer a person who has messaged them (or copied them).
    if exists (select 1 from public.crm_chat_messages
               where sender_id = p_recipient and (recipient_id = v_me or cc_id = v_me)) then
        return true;
    end if;
    select user_type into v_my_type from public.profiles where id = v_me;
    if v_my_type in ('admin', 'sales') then
        return true;
    end if;
    v_my_branch := public.chat_branch_of(v_me);
    if v_my_type in ('channel_partner_office', 'office2') then
        return v_their_type in ('admin', 'sales')
            or (v_their_type in ('channel_partner_office', 'office2', 'agent2')
                and v_my_branch <> '' and public.chat_branch_of(p_recipient) = v_my_branch);
    end if;
    if v_my_type = 'agent2' then
        return v_their_type in ('channel_partner_office', 'office2')
            and v_my_branch <> '' and public.chat_branch_of(p_recipient) = v_my_branch;
    end if;
    return false;
end;
$$;

-- Names and roles the chat screen needs: people you may message, plus anyone
-- you share a message with. Admin and Office get everyone.
create or replace function public.chat_directory()
returns table (id uuid, name text, user_type text, email text, can_message boolean)
language sql
stable
security definer
set search_path = public
as $$
    select p.id, p.name, p.user_type,
           case when public.chat_is_office(auth.uid()) then p.email end,
           public.chat_recipient_allowed(p.id)
    from public.profiles p
    where p.id <> auth.uid()
      and coalesce(p.status, 'active') <> 'inactive'
      and (
          public.chat_is_office(auth.uid())
          or public.chat_recipient_allowed(p.id)
          or exists (select 1 from public.crm_chat_messages m
                     where auth.uid() in (m.sender_id, m.recipient_id, m.cc_id)
                       and p.id in (m.sender_id, m.recipient_id, m.cc_id))
      )
    order by p.name
$$;

revoke all on function public.chat_is_office(uuid) from public, anon;
revoke all on function public.chat_branch_of(uuid) from public, anon;
revoke all on function public.chat_recipient_allowed(uuid) from public, anon;
revoke all on function public.chat_directory() from public, anon;
grant execute on function public.chat_is_office(uuid) to authenticated;
grant execute on function public.chat_branch_of(uuid) to authenticated;
grant execute on function public.chat_recipient_allowed(uuid) to authenticated;
grant execute on function public.chat_directory() to authenticated;

drop policy if exists crm_chat_read on public.crm_chat_messages;
create policy crm_chat_read on public.crm_chat_messages
for select to authenticated
using (
    (select public.get_my_user_type()) = 'admin'
    or sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or cc_id = (select auth.uid())
    or audience = 'public'
    or (audience = 'role' and (
        target_role = (select public.get_my_user_type())
        or (target_role = 'channel_partner_office'
            and (select public.get_my_user_type()) in ('office2', 'channel_partner_office_manager'))
    ))
    -- Office staff: everything except private chats between two other office people.
    or ((select public.get_my_user_type()) = 'sales' and audience = 'admin' and (
        recipient_id is null
        or not (public.chat_is_office(sender_id) and public.chat_is_office(recipient_id))
    ))
);

drop policy if exists crm_chat_send on public.crm_chat_messages;
create policy crm_chat_send on public.crm_chat_messages
for insert to authenticated
with check (
    sender_id = (select auth.uid())
    and (
        (audience in ('public', 'role')
            and (select public.get_my_user_type()) in ('admin', 'sales'))
        or (audience = 'admin' and recipient_id is null
            and (select public.get_my_user_type()) in
                ('channel_partner_office', 'office2', 'agent', 'agent2', 'vendor', 'stamp', 'technician'))
        or (audience = 'admin' and recipient_id is not null
            and public.chat_recipient_allowed(recipient_id)
            and (cc_id is null or (select public.get_my_user_type()) in ('admin', 'sales')))
    )
);

commit;

-- Check after running (expect 2 policies, 4 functions, and the cc_id column):
-- select policyname, cmd from pg_policies where tablename = 'crm_chat_messages';
-- select proname from pg_proc where proname in ('chat_is_office', 'chat_branch_of', 'chat_recipient_allowed', 'chat_directory');
-- select column_name from information_schema.columns where table_name = 'crm_chat_messages' and column_name = 'cc_id';
