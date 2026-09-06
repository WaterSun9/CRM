-- RD-3 additive schema patch. Existing customer rows and values are unchanged.
begin;

alter table public.admin
  add column if not exists loan_by text;

commit;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'admin'
  and column_name = 'loan_by';
