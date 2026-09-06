-- Run this file by itself in the Supabase SQL editor.
-- It adds a read-performance index only. No activity or customer rows are
-- inserted, updated, or deleted.

create index concurrently if not exists idx_activity_log_created_at_desc
    on public.activity_log (created_at desc);
