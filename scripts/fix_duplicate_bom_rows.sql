-- ============================================================================
-- Duplicate `bom` rows — the cause of "Material Integration data disappeared".
--
-- HOW IT HAPPENED (now fixed in MaterialIntegrationTab.jsx):
--   1. Before saving, the code looked up the existing bom row but did NOT
--      capture the query's error.
--   2. If that read failed, `existing` was undefined, so it took the INSERT
--      branch and created a SECOND bom row for the same admin_id.
--   3. loadBomForCustomer then used .maybeSingle(), which ERRORS when more than
--      one row matches — so from that point the BOM could never be read again.
--   4. The error was swallowed and a blank template was shown instead.
--      The data was never deleted. It was unreachable.
--
-- Saving again repeated step 2, and bom_items were written against the newest
-- (empty) row while the original row's items sat orphaned.
--
-- Nothing below deletes until you uncomment block 3.
-- ============================================================================


-- ── 1. Which customers have more than one bom row? (read only) ──────────────
-- EXPECT: 0 rows. Any row here is a customer whose BOM currently shows blank.
select
    b.admin_id,
    a.customer_name,
    count(*)                          as bom_rows,
    min(b.created_at)                 as first_created,
    max(b.created_at)                 as last_created
from public.bom b
left join public.admin a on a.id = b.admin_id
group by b.admin_id, a.customer_name
having count(*) > 1
order by count(*) desc, a.customer_name;


-- ── 2. For those customers, which row actually holds the data? ─────────────
-- Use this to decide which row to keep: the one with the most items and with
-- the paper/material milestone fields filled in.
select
    b.id            as bom_id,
    b.admin_id,
    a.customer_name,
    b.created_at,
    b.bom_type,
    b.paper_prepared_by,
    b.material_loaded_by,
    (select count(*) from public.bom_items i where i.bom_id = b.id) as item_count
from public.bom b
left join public.admin a on a.id = b.admin_id
where b.admin_id in (
    select admin_id from public.bom group by admin_id having count(*) > 1
)
order by a.customer_name, b.created_at;


-- ── 3. FIX: keep the richest row per customer, delete the empty extras ──────
-- "Richest" = most bom_items, tie-broken by earliest created_at.
-- Review block 2 first — if a customer's data is SPLIT across two rows, sort
-- that one out by hand instead of running this.
--
-- with ranked as (
--     select
--         b.id,
--         b.admin_id,
--         row_number() over (
--             partition by b.admin_id
--             order by (select count(*) from public.bom_items i where i.bom_id = b.id) desc,
--                      b.created_at asc
--         ) as rn
--     from public.bom b
--     where b.admin_id in (
--         select admin_id from public.bom group by admin_id having count(*) > 1
--     )
-- )
-- delete from public.bom
--  where id in (select id from ranked where rn > 1)
-- returning id, admin_id;
--
-- bom_items rows referencing a deleted bom are removed by the FK cascade.
-- If there is no cascade on your schema, run this FIRST:
-- delete from public.bom_items
--  where bom_id not in (select id from public.bom);


-- ── 4. Prevent it recurring at the database level (recommended) ────────────
-- One BOM per customer, enforced by Postgres. With this in place the old code
-- path could not have created a duplicate even if the read failed.
-- Run it only AFTER block 3 reports 0 duplicates.
--
-- create unique index if not exists bom_admin_id_unique on public.bom (admin_id);


-- ── 5. Re-run block 1. EXPECT: 0 rows. ─────────────────────────────────────

-- Orphaned items (belonging to no bom row at all) — should be 0.
select count(*) as orphaned_bom_items
from public.bom_items i
where not exists (select 1 from public.bom b where b.id = i.bom_id);
