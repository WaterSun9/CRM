-- ============================================================================
-- Legacy leads with no Payment Type.  READ ONLY until you uncomment block 3.
--
-- CAUSE (already fixed in src/utils/validation.js): the old Zod preprocessor
-- rewrote an empty Payment Type to 'Cash' BEFORE the enum checked it, so the
-- form passed validation while the raw empty value was written to the database.
-- New leads cannot do this any more - both insert paths now save the validated
-- value - but rows created before that fix keep their empty payment_type.
--
-- IMPACT: payment_type decides which stage is hidden. Empty means NEITHER the
-- Cash nor the Loan stage is hidden, so the record shows both and can be pushed
-- down the wrong path.
-- ============================================================================


-- ── 1. How many, and what evidence do they carry? (read only) ───────────────
select
    count(*) filter (where cash_details is not null)                                as looks_like_cash,
    count(*) filter (where loan_tag is not null
                        or jsonb_array_length(coalesce(loan_history, '[]'::jsonb)) > 0) as looks_like_loan,
    count(*) filter (where cash_details is null
                       and loan_tag is null
                       and jsonb_array_length(coalesce(loan_history, '[]'::jsonb)) = 0) as no_evidence,
    count(*)                                                                        as total_empty
from public.admin
where deleted_at is null
  and coalesce(trim(payment_type), '') = '';


-- ── 2. The actual records, with the evidence, so you can eyeball them ───────
select
    customer_name,
    consumer_no,
    stage,
    case
        when cash_details is not null then 'CASH (has cash_details)'
        when loan_tag is not null
          or jsonb_array_length(coalesce(loan_history, '[]'::jsonb)) > 0 then 'LOAN (has loan record)'
        else 'UNKNOWN - decide manually'
    end as inferred,
    cash_details is not null as has_cash_details,
    loan_tag,
    created_at::date as created
from public.admin
where deleted_at is null
  and coalesce(trim(payment_type), '') = ''
order by inferred, created_at desc;


-- ── 3. BACKFILL where the evidence is unambiguous (uncomment to run) ────────
-- Only touches rows that carry cash OR loan evidence, never both, and never
-- rows with no evidence at all - those stay empty for a human to decide.
--
-- update public.admin
--    set payment_type = 'Cash', updated_at = now()
--  where deleted_at is null
--    and coalesce(trim(payment_type), '') = ''
--    and cash_details is not null
--    and loan_tag is null
--    and jsonb_array_length(coalesce(loan_history, '[]'::jsonb)) = 0
-- returning customer_name, payment_type;
--
-- update public.admin
--    set payment_type = 'Loan', updated_at = now()
--  where deleted_at is null
--    and coalesce(trim(payment_type), '') = ''
--    and cash_details is null
--    and (loan_tag is not null
--      or jsonb_array_length(coalesce(loan_history, '[]'::jsonb)) > 0)
-- returning customer_name, payment_type;


-- ── 4. Re-run block 1. Only 'no_evidence' rows should remain. ───────────────
