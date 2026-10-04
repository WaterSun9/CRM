-- Read-only checks to run in the WaterSun CRM SQL Editor after applying
-- 20261003233000_restrict_private_chat.sql.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public' and tablename = 'crm_chat_messages'
order by policyname;

-- Direct messages should have a recipient. Shared inbox requests have none.
-- This reports counts only and does not expose message bodies.
select audience,
       (recipient_id is not null) as has_recipient,
       count(*) as message_count
from public.crm_chat_messages
group by audience, (recipient_id is not null)
order by audience, has_recipient;

-- Diagnose the reported test message without returning its text or user IDs.
-- 'public' reaches every signed-in account; 'role' reaches the named group;
-- 'admin' with a recipient is intended as one-to-one.
select created_at, audience, target_role,
       (recipient_id is not null) as has_recipient
from public.crm_chat_messages
where body ilike '%checking personel chat%'
order by created_at desc;
