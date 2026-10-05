-- Personal (private) chats between an Admin and one other person (client request, 5 Oct 2026).
--
-- A message marked is_private is readable ONLY by its sender and recipient -
-- not by other admins, not by Office staff. Allowed only between:
--   * an Admin and a CPO / CPO staff (office2), a vendor, a CP (agent / agent2)
--     or Office staff (sales), in either direction.
-- Everything else (Office team chat, announcements, office replies) is unchanged.
-- Safe to run more than once. Run BEFORE deploying the app version that has
-- personal chats.
set lock_timeout = '8s';
begin;

alter table public.crm_chat_messages add column if not exists is_private boolean not null default false;
alter table public.crm_chat_messages drop constraint if exists crm_chat_private_valid;
alter table public.crm_chat_messages add constraint crm_chat_private_valid check (
    not is_private or (audience = 'admin' and recipient_id is not null and cc_id is null)
);

-- May the signed-in user send a PRIVATE message to p_recipient?
create or replace function public.chat_private_allowed(p_recipient uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce((
        select (me.user_type = 'admin' and them.user_type in ('channel_partner_office', 'office2', 'vendor', 'agent', 'agent2', 'sales'))
            or (me.user_type in ('channel_partner_office', 'office2', 'vendor', 'agent', 'agent2', 'sales') and them.user_type = 'admin')
        from public.profiles me, public.profiles them
        where me.id = auth.uid() and them.id = p_recipient and p_recipient <> auth.uid()
    ), false)
$$;
revoke all on function public.chat_private_allowed(uuid) from public, anon;
grant execute on function public.chat_private_allowed(uuid) to authenticated;

drop policy if exists crm_chat_read on public.crm_chat_messages;
create policy crm_chat_read on public.crm_chat_messages
for select to authenticated
using (
    -- Personal chats: only the two people in them.
    (is_private and (sender_id = (select auth.uid()) or recipient_id = (select auth.uid())))
    or (not is_private and (
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
    and (not is_private or public.chat_private_allowed(recipient_id))
);

commit;

-- Check: column exists and the two policies are back.
select column_name from information_schema.columns where table_name = 'crm_chat_messages' and column_name = 'is_private';
select policyname, cmd from pg_policies where tablename = 'crm_chat_messages' order by 1;
