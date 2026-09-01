-- ============================================================================
-- STEP 2 of the reimport: clear admin, documents, bom, bom_items.
--
-- THIS DELETES EVERY CUSTOMER RECORD - all 3,831, including the 62 that staff
-- created by hand. That is a change from the earlier plan (which kept those 62).
-- It is correct only if your cleaned import file already contains those 62.
-- If it does not, they are gone.
--
-- Row counts at the time of writing (2026-09-01):
--     admin        3,831
--     documents      442
--     bom             54
--     bom_items    2,165
--     activity_log 2,113   <- NOT deleted, see below
--
-- BEFORE RUNNING, confirm you have:
--   [ ] backups/full-backup-2026-09-01T11-13-01.json   (all 8 tables, 9.8 MB)
--   [ ] backups/serials_by_consumer.csv                (130 serials, 22 customers)
--   [ ] your cleaned import file, containing the staff-created records
--
-- ORDER MATTERS. Children before parents, or the foreign keys reject it.
-- ============================================================================

begin;

-- 1. bom_items -> bom  (bom_items.bom_id references bom.id)
delete from public.bom_items;

-- 2. bom -> admin      (bom.admin_id references admin.id)
delete from public.bom;

-- 3. documents -> admin
--    NOTE: this removes the database rows only. The actual files stay in the
--    `customer-documents` storage bucket and become unreachable. Clearing them
--    is a separate storage operation, not SQL.
delete from public.documents;

-- 4. activity_log -> admin  (fk_activity_log_customer, confirmed real)
--    DETACHED, not deleted: this keeps the record of who did what and when,
--    which is the only history of the old system that survives. Change this to
--    `delete from public.activity_log;` if you want that history gone too.
update public.activity_log set customer_id = null where customer_id is not null;

-- 5. delivery batches point at customers by id and by an array of ids.
--    Clear the batches so they do not reference rows that no longer exist.
delete from public.delivery_batches;

-- 6. finally, the customers
delete from public.admin;

commit;


-- ── Verify ──────────────────────────────────────────────────────────────────
select 'admin' as table_name, count(*) from public.admin
union all select 'documents',        count(*) from public.documents
union all select 'bom',              count(*) from public.bom
union all select 'bom_items',        count(*) from public.bom_items
union all select 'delivery_batches', count(*) from public.delivery_batches
union all select 'activity_log',     count(*) from public.activity_log;
-- EXPECT: admin 0 | documents 0 | bom 0 | bom_items 0 | delivery_batches 0
--         activity_log 2113  (unchanged - detached, not deleted)


-- ── What is deliberately NOT touched ────────────────────────────────────────
--   profiles          (66)  - your logins. Deleting these locks everyone out.
--   metadata         (116)  - channel partner list, brands, dropdowns.
--   vendors            (4)
--   drivers            (7)
-- Re-importing customers does not require clearing any of these.
