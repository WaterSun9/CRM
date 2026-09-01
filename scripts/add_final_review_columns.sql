-- ============================================================================
-- 2026-09-01
--   1. Three optional free-text columns for Final Review
--   2. phone_number numeric -> text  (fixes search on 3 screens)
--   3. consumer_no: deliberately LEFT AS TEXT - see the reasoning below
-- ============================================================================


-- ── 1. Final Review free-text columns ───────────────────────────────────────
-- sfdc_photo and warranty_card already exist as BOOLEAN checklist flags
-- (set on all 3,831 rows). These are separate free-text siblings, so the
-- checkboxes keep working and can be left empty.
-- file_status does not currently exist at all - it was dropped previously.
ALTER TABLE public.admin
  ADD COLUMN IF NOT EXISTS sfdc_photo_text    text NULL,
  ADD COLUMN IF NOT EXISTS warranty_card_text text NULL,
  ADD COLUMN IF NOT EXISTS file_status        text NULL;


-- ── 2. phone_number: numeric -> text ────────────────────────────────────────
-- WHY: SubsidyView, InstallationView and LoanView all search with
--
--   .or('customer_name.ilike.%x%,phone_number.ilike.%x%,consumer_no.ilike.%x%')
--
-- `ilike` does not exist for a numeric column, so the WHOLE or() fails with
--   42883: operator does not exist: numeric ~~* unknown
-- and those three search boxes return nothing for ANY term today. The error is
-- swallowed by `if (!error && data)`, so nothing is shown to the user.
--
-- PostgREST cannot cast inside or() (PGRST100: failed to parse logic tree), so
-- the column itself has to be text. A phone number is an identifier, not a
-- quantity - nothing adds or averages it - so text is the correct type anyway,
-- and it stops future leading zeros and +91 prefixes being destroyed.
--
-- Safe: every numeric value converts to its own digits. Exact lookups keep
-- working (PostgREST sends the value as a string either way).
ALTER TABLE public.admin
  ALTER COLUMN phone_number TYPE text USING phone_number::text;

-- text does not police what goes in, so put the rule in the database rather
-- than trusting every entry point forever. AddLeadModal already strips
-- non-digits (replace(/[^0-9]/g,'')) and caps at 10, but a CSV import or a
-- future form would not.
--
-- Allows an optional leading + and 1-15 digits (E.164 maximum). NULL stays
-- allowed - 20 rows have no phone number.
--
-- Every existing row passes: measured 2026-09-01, all 3,811 values are pure
-- digits (3,807 of them exactly 10), zero contain a letter.
ALTER TABLE public.admin
  DROP CONSTRAINT IF EXISTS admin_phone_number_format;

ALTER TABLE public.admin
  ADD CONSTRAINT admin_phone_number_format
  CHECK (phone_number IS NULL OR phone_number ~ '^\+?[0-9]{1,15}$');


-- ── 3. consumer_no: DO NOT convert to a number ──────────────────────────────
-- Requested, but the data says not to. Measured 2026-09-01 over 3,831 rows:
--
--   * consumer_no is TEXT today, and `consumer_no.ilike` is the ONLY part of
--     the search above that currently WORKS. Making it numeric breaks it in
--     exactly the same way phone_number is broken.
--   * 5 rows already start with 0 ("00000000000"). As a number those become 0.
--     Real consumer numbers beginning with 0 would be silently corrupted.
--   * Lengths run 3 to 12 digits - it is an identifier, not a quantity.
--     Nothing in the app does arithmetic on it.
--
-- If it must be numeric later, the search in all three views has to be
-- rewritten first, or those screens lose search entirely.
--
-- ALTER TABLE public.admin
--   ALTER COLUMN consumer_no TYPE bigint USING consumer_no::bigint;   -- NOT RUN


-- ── Verify ──────────────────────────────────────────────────────────────────
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'admin'
  and column_name in ('sfdc_photo','sfdc_photo_text','warranty_card','warranty_card_text',
                      'file_status','phone_number','consumer_no','stamp','insurance_status')
order by column_name;
