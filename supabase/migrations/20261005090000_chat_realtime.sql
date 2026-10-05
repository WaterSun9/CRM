-- Live chat: send new chat messages over Supabase Realtime, so the unread
-- number on the chat button (and an open chat) updates straight away instead
-- of on the next poll. The chat read rules (RLS) still decide which messages
-- each person receives. Safe to run more than once. Without it the app still
-- works: the number refreshes every minute and when the tab is reopened.
do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'crm_chat_messages'
    ) then
        alter publication supabase_realtime add table public.crm_chat_messages;
    end if;
end $$;

-- Check: crm_chat_messages should be in this list.
select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1;
