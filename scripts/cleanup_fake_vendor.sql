-- ============================================================================
-- Clear the fabricated "Test Vendor (Solar Tech)" placeholder off real records.
--
-- It used to be prepended to every vendor dropdown unconditionally, so it was
-- selectable and could be saved onto a customer as the allotted vendor.
-- The code no longer offers it; this cleans up anything already stored.
-- ============================================================================

-- ── 1. LOOK FIRST (read only). How many records are affected? ───────────────
select 'admin.vendor' as location, count(*) as rows_affected
from public.admin
where deleted_at is null
  and vendor ilike '%test vendor%'
union all
select 'delivery_batches.vendor', count(*)
from public.delivery_batches
where vendor ilike '%test vendor%'
union all
select 'vendors directory row', count(*)
from public.vendors
where name ilike '%test vendor%';


-- ── 2. See exactly which customers, before changing anything ────────────────
select crn, customer_name, stage, installation_status, vendor
from public.admin
where deleted_at is null
  and vendor ilike '%test vendor%'
order by customer_name;


-- ── 3. FIX (uncomment and run once you are happy with what 1 and 2 showed) ──
-- Sets the placeholder back to NULL so the UI correctly shows
-- "No vendor allotted yet" instead of a fabricated name.
--
-- update public.admin
--    set vendor = null,
--        updated_at = now()
--  where deleted_at is null
--    and vendor ilike '%test vendor%';
--
-- update public.delivery_batches
--    set vendor = null, updated_at = now()
--  where vendor ilike '%test vendor%';
--
-- Remove the placeholder from the vendors directory itself, if it was ever
-- actually inserted there (the old code only ever faked it client-side, so
-- this usually affects 0 rows):
-- delete from public.vendors where name ilike '%test vendor%';


-- ── 4. Re-run block 1 afterwards. EXPECT: all counts 0. ─────────────────────
