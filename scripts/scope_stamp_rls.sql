-- ============================================================================
-- Tighten the `stamp` clause on the admin table's RLS.  Covers audit items
-- #15 (a stamp maker can read every other maker's customer rows) and
-- #16 (the stamp clause is the only one missing `deleted_at is null`).
--
-- CURRENT stamp clause, in both admin_select and admin_update:
--     get_my_user_type() = 'stamp'
--     AND discom_submission->>'sent_to_stamp_maker' = 'true'
--
-- Two problems:
--   1. No assignment check. Every stamp maker can read EVERY stamped record -
--      customer name, phone, consumer no, invoice value - not just their own.
--      The app now filters server-side in the query, but a hand-written API
--      call with the anon key still gets everything. The query is convenience;
--      this is the boundary.
--   2. No deleted_at filter, unlike the vendor clause directly above it. Soft
--      deleted records stay readable by the stamp role.
--
-- AFTER this, a stamp maker can only ever see records that are:
--   sent to stamp  AND  assigned to them by name  AND  not deleted.
--
-- ⚠️  Records with NO assigned_stamp_maker become invisible to every stamp
--     maker. That is intended (it matches the portal), but assign your existing
--     unassigned records FIRST or they will vanish from the queue - see the
--     query at the bottom.
-- ============================================================================

-- ── 1. SAVE THE CURRENT POLICIES. This is your rollback. ────────────────────
select policyname, cmd, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'admin' and policyname in ('admin_select', 'admin_update');


-- ── 2. Which records would disappear? Run BEFORE applying. EXPECT 0. ────────
select customer_name, consumer_no,
       discom_submission->>'sent_to_stamp_maker_by' as sent_by,
       discom_submission->>'sent_to_stamp_maker_at' as sent_at
from public.admin
where deleted_at is null
  and discom_submission->>'sent_to_stamp_maker' = 'true'
  and coalesce(discom_submission->>'stamp_sent', 'false') <> 'true'
  and coalesce(discom_submission->>'assigned_stamp_maker', '') = ''
order by sent_at;


-- ── 3. APPLY (uncomment once block 2 returns 0 rows) ────────────────────────
-- Replace ONLY the stamp clause. Every other role's clause is unchanged - copy
-- the rest verbatim from what block 1 printed, then swap the stamp branch for:
--
--     ((get_my_user_type() = 'stamp'::text)
--       AND (deleted_at IS NULL)
--       AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text)
--       AND (lower(TRIM(BOTH FROM COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text)))
--            = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
--
-- Do this for admin_select AND admin_update (a stamp maker must still be able
-- to write the stamp back on their own assigned records).


-- ── 4. Verify: as a stamp account, the row count must equal their own queue ──
-- node scripts/test_profiles_escalation.mjs  covers profiles, not this;
-- easiest check is to sign in as two stamp accounts and confirm neither sees
-- the other's customers in the Pending Queue.
