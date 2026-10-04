-- Limit one-to-one messages to their sender and intended recipient.
-- Messages sent to the staff inbox (audience=admin, recipient_id=null) remain
-- readable by staff so incoming requests are not lost. Public and role
-- announcements retain their existing audience.
begin;

alter table public.crm_chat_messages enable row level security;

-- Another permissive SELECT/ALL policy would be OR-ed with this one and
-- could still expose direct messages. Stop rather than report a false fix.
do $$
begin
    if exists (
        select 1 from pg_policies
        where schemaname = 'public' and tablename = 'crm_chat_messages'
          and cmd in ('SELECT', 'ALL') and policyname <> 'crm_chat_read'
    ) then
        raise exception 'Review other crm_chat_messages read policies before restricting private chat';
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
    or (audience = 'admin' and recipient_id is null
        and (select public.get_my_user_type()) in ('admin', 'sales', 'channel_partner_office', 'office2'))
);

commit;
