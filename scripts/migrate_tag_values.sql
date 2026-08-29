-- ─── Migrate tag values to the new sets (2026-08-29) ────────────────────────
-- The tag ids in src/constants.js changed. Counts are computed with
--   ilike('<column>', '%<tag id>%')
-- so any row still holding an old value matches NO tag and vanishes from the
-- tag screens entirely — silently, with no error. Exactly what happened with
-- the 'No' installation values.
--
-- Run STEP 1 first and check the mapping looks right for your data.
-- STEP 2 is not reversible; take a snapshot.
-- ────────────────────────────────────────────────────────────────────────────

-- STEP 1 — what is currently stored, and what it will become.
select 'subsidy' as tag, subsidy_tag as current_value, count(*) as rows
from public.admin where deleted_at is null group by subsidy_tag
union all
select 'loan', loan_tag, count(*)
from public.admin where deleted_at is null group by loan_tag
union all
select 'installation', installation_status, count(*)
from public.admin where deleted_at is null group by installation_status
order by 1, 3 desc;

-- Mapping applied by STEP 2:
--   subsidy      : 'In Process'  -> 'Inprocess'
--                  (Received / Redeemed / Returned / Approved unchanged)
--   loan         : 'In Progress' -> 'Inprocess'
--                  'Processed'   -> 'Inprocess'      (value removed from the set)
--                  'Rejected'    -> 'Reject'
--                  'All Clear'   -> 'Total Loan Payment Received'
--                  (Sanctioned / Returned / 1st Payment / 2nd Payment unchanged)
--   installation : 'Yes'      -> 'Installed'
--                  'Process'  -> 'In process'
--                  'Give Up'  -> 'Giveup'
--                  'No'       -> 'Pending'   (already normalised earlier)
--                  (Pending unchanged)


-- STEP 2 — apply.
begin;

update public.admin set subsidy_tag = 'Inprocess'
where deleted_at is null and lower(trim(subsidy_tag)) = 'in process';

update public.admin set loan_tag = 'Inprocess'
where deleted_at is null and lower(trim(loan_tag)) in ('in progress', 'processed');

update public.admin set loan_tag = 'Reject'
where deleted_at is null and lower(trim(loan_tag)) = 'rejected';

update public.admin set loan_tag = 'Total Loan Payment Received'
where deleted_at is null and lower(trim(loan_tag)) = 'all clear';

update public.admin set installation_status = 'Installed'
where deleted_at is null and lower(trim(installation_status)) = 'yes';

update public.admin set installation_status = 'In process'
where deleted_at is null and lower(trim(installation_status)) = 'process';

update public.admin set installation_status = 'Giveup'
where deleted_at is null and lower(trim(installation_status)) in ('give up', 'giveup');

update public.admin set installation_status = 'Pending'
where deleted_at is null and lower(trim(installation_status)) in ('no', '');

commit;


-- STEP 3 — verify. Every row should now hold a value from the new sets,
-- or be null. Anything else will not appear under any tag.
select 'subsidy' as tag, subsidy_tag as value, count(*) as rows
from public.admin
where deleted_at is null and subsidy_tag is not null
  and subsidy_tag not in ('Inprocess','Redeemed','Returned','Approved','Received')
group by subsidy_tag
union all
select 'loan', loan_tag, count(*)
from public.admin
where deleted_at is null and loan_tag is not null
  and loan_tag not in ('Inprocess','Sanctioned','Returned','Reject','1st Payment','2nd Payment','Total Loan Payment Received')
group by loan_tag
union all
select 'installation', installation_status, count(*)
from public.admin
where deleted_at is null and installation_status is not null
  and installation_status not in ('Giveup','In process','Pending','Installed')
group by installation_status;
-- Expect: zero rows.
