-- ============================================================================
-- Loan card: Bank Name, Bank Branch, Loan Date
--
-- Loan Date needs NO new column - `loan_registration_date` already exists and
-- was previously unused by the app. The two bank fields are new.
--
-- All three are deliberately OPTIONAL: nullable, no default, and not part of
-- any stage-advance requirement.
-- ============================================================================

alter table public.admin add column if not exists bank_name   text;
alter table public.admin add column if not exists bank_branch text;

-- PostgREST caches the schema; without this the app reports the new columns as
-- "Could not find the 'bank_name' column of 'admin' in the schema cache".
notify pgrst, 'reload schema';


-- ── Verify. EXPECT 3 rows. ──────────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name   = 'admin'
  and column_name in ('bank_name', 'bank_branch', 'loan_registration_date')
order by column_name;
