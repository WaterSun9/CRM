-- Who finances a Loan customer, 13 Nov 2026 (client request of 12 Nov).
-- Set on the customer card's Loan tab. Run this before (or with) the app update:
-- until it runs, choosing who finances a loan there fails to save. Nothing else
-- depends on it.
--
-- 'PM Surya Ghar loan' (the scheme's bank loan) or 'Private finance' (any other
-- bank, NBFC or finance company). Empty for Cash and Undecided customers.
-- Payment type 'Undecided' needs no database change (payment_type is free text).
-- Safe to run more than once.
--
-- To undo (only if no customer has it set yet):
--   alter table public.admin drop column finance_type;
set lock_timeout = '8s';
begin;

alter table public.admin add column if not exists finance_type text;
alter table public.admin drop constraint if exists admin_finance_type_check;
alter table public.admin add constraint admin_finance_type_check
    check (finance_type is null or finance_type in ('PM Surya Ghar loan', 'Private finance'));

-- The customer field limits (watch mode): whoever may change Payment Type may
-- change this too, so normal use is not flagged.
insert into public.admin_field_rules (user_type, field, note)
select user_type, 'finance_type', 'with payment_type, 13 Nov'
from public.admin_field_rules where field = 'payment_type'
on conflict do nothing;

commit;

-- Check (expect column_1):
select count(*) as column_1 from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'finance_type';
