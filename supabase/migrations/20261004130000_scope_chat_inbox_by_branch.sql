-- Scope the shared office inbox by branch (NOT YET RUN - owner runs it).
--
-- Messages that vendors / channel partners / dealers / stamp makers send "to the
-- office" (audience = 'admin', no recipient) were readable by every staff
-- member, including every branch's CPO. After this:
--   * Admin and Office (sales) still read the whole inbox.
--   * A CPO and their staff (office2) read only inbox messages from people in
--     their own branch. "Branch" uses the same rule as customer access:
--     coalesce(channel_partner, name), compared trimmed and case-insensitive.
--     Vendors and stamp makers have no branch, so their messages go to Admin
--     and Office only.
-- Everything else is unchanged: your own sent/received messages, announcements
-- to everyone and to your group. Sending rules are not touched.
--
-- The sender's branch is read through profiles' own access rules, which already
-- let a CPO / office2 read profiles in their branch - exactly the match needed.
--
-- Rollback: re-run supabase/migrations/20261003233000_restrict_private_chat.sql.
set lock_timeout = '8s';
begin;

do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'crm_chat_messages'
          and cmd in ('SELECT', 'ALL') and policyname <> 'crm_chat_read'
    ) then
        raise exception 'Another read policy exists on crm_chat_messages; review it first';
    end if;
end $$;

drop policy if exists crm_chat_read on public.crm_chat_messages;
create policy crm_chat_read on public.crm_chat_messages
for select to authenticated
using (
    sender_id = (select auth.uid())
    or recipient_id = (select auth.uid())
    or audience = 'public'
    or (audience = 'role' and (
        target_role = (select public.get_my_user_type())
        or (target_role = 'channel_partner_office'
            and (select public.get_my_user_type()) in ('office2', 'channel_partner_office_manager'))
    ))
    or (audience = 'admin' and recipient_id is null and (
        (select public.get_my_user_type()) in ('admin', 'sales')
        or ((select public.get_my_user_type()) in ('channel_partner_office', 'office2')
            and lower(btrim(coalesce((select public.get_my_channel_partner()), ''))) <> ''
            and exists (
                select 1 from public.profiles sender
                where sender.id = crm_chat_messages.sender_id
                  and lower(btrim(coalesce(nullif(btrim(sender.channel_partner), ''), sender.name, '')))
                      = lower(btrim(coalesce((select public.get_my_channel_partner()), '')))
            ))
    ))
);

commit;

-- Check after running (expect one SELECT policy mentioning get_my_channel_partner):
-- select policyname, cmd, qual from pg_policies where tablename = 'crm_chat_messages';
