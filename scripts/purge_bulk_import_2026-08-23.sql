-- ============================================================================
-- Remove the 23 Aug bulk upload, KEEP everything staff created by hand.
--
-- HOW THE TWO ARE TOLD APART (verified 2026-09-01, two independent signals
-- that agree with zero disagreement):
--
--   1. created_at. The bulk load inserted 3,769 rows in a 12-second burst on
--      2026-08-23 15:58:21-32, thousands of rows sharing the exact same
--      microsecond timestamp. Hand-created rows each have a unique created_at.
--
--   2. activity_log. A row created through the UI writes a 'create' entry.
--         bulk rows with a create log :    0 / 3769
--         hand rows with a create log :   53 / 62
--      Not one bulk row has one. (9 of the 62 lack one because they predate
--      the logging, not because they were imported.)
--
--   => bulk  = 3,769 rows   (delete)
--      hand  =    62 rows   (keep)
--
-- WHAT ELSE POINTS AT THOSE ROWS - all must go first or the FKs block it:
--      documents        193 rows   (+ their files in storage)
--      activity_log     950 rows   (fk_activity_log_customer)
--      delivery batches  10 rows currently linked
--
-- RUN BLOCK 1 ONLY, FIRST. It changes nothing.
-- ============================================================================


-- ── 1. LOOK. Read-only. Run this and check the numbers before anything else ─
with bulk as (
    select a.id
    from public.admin a
    join (
        select created_at
        from public.admin
        group by created_at
        having count(*) > 1          -- the bulk-insert signature
    ) c on c.created_at = a.created_at
)
select
    (select count(*) from public.admin)                                    as admin_total,
    (select count(*) from bulk)                                            as will_delete,
    (select count(*) from public.admin) - (select count(*) from bulk)      as will_keep,
    (select count(*) from public.documents    where customer_id in (select id from bulk)) as documents_removed,
    (select count(*) from public.activity_log where customer_id in (select id from bulk)) as logs_removed,
    (select count(*) from public.admin        where delivery_batch_id is not null
                                               and id in (select id from bulk))          as batch_links_cleared;
-- EXPECT roughly: admin_total 3831 | will_delete 3769 | will_keep 62
--                 documents_removed 193 | logs_removed 950 | batch_links_cleared 10


-- ── 2. The 62 rows that will SURVIVE. Read them before deleting anything ────
select created_at, customer_name, stage, consumer_no
from public.admin
where created_at in (select created_at from public.admin group by created_at having count(*) = 1)
order by created_at;
-- Many of these are obviously tests ("Test Lead 7317", "testing thing",
-- "check for sandi", "79797", "866"). Decide which of THOSE you also want
-- gone - block 5 below handles them, by name, only if you fill it in.


-- ── 3. BACKUP. Run this and SAVE THE OUTPUT before block 4 ─────────────────
-- Nothing here is reversible once block 4 runs.
select json_agg(a) from public.admin a;                     -- every customer row
select json_agg(d) from public.documents d;                 -- every document row


-- ============================================================================
-- EVERYTHING BELOW THIS LINE DELETES DATA. Run only after blocks 1-3.
-- Run the four statements in this order - the FKs require it.
-- ============================================================================

-- ── 4. DELETE (uncomment to run) ───────────────────────────────────────────
-- begin;
--
-- create temp table bulk_ids as
--     select a.id
--     from public.admin a
--     join (select created_at from public.admin group by created_at having count(*) > 1) c
--       on c.created_at = a.created_at;
--
-- -- 4a. unlink from delivery batches (plain column, no FK, but leaves the
-- --     batch pointing at nothing otherwise)
-- update public.admin
--    set delivery_batch_id = null, delivery_status = 'PENDING'
--  where id in (select id from bulk_ids) and delivery_batch_id is not null;
--
-- -- 4b. activity_log rows (fk_activity_log_customer). Detach rather than
-- --     delete, so the audit history of who did what survives the purge.
-- update public.activity_log
--    set customer_id = null
--  where customer_id in (select id from bulk_ids);
--
-- -- 4c. document rows. NOTE: this removes the DB rows only - the actual files
-- --     stay in the `customer-documents` storage bucket and become orphaned.
-- --     Clearing those is a separate storage operation.
-- delete from public.documents
--  where customer_id in (select id from bulk_ids);
--
-- -- 4d. finally the customers themselves
-- delete from public.admin
--  where id in (select id from bulk_ids);
--
-- commit;


-- ── 5. OPTIONAL: also drop the obvious test leads among the 62 ─────────────
-- Fill in the names from block 2 that you want gone. Left empty on purpose -
-- I am not guessing which of your colleagues' records are real.
--
-- delete from public.admin
--  where customer_name in (
--      -- 'Test Lead 7317',
--      -- 'testing thing',
--  );


-- ── 6. VERIFY after the delete ─────────────────────────────────────────────
-- select count(*) from public.admin;                       -- EXPECT 62
-- select count(*) from public.documents;                   -- EXPECT 249
-- select count(*) from public.activity_log;                -- EXPECT 2113 (none deleted)
