-- READ ONLY: optional verification for the project owner. No customer rows returned.
select c.relname, c.relrowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'quotations';
select column_name, data_type, is_nullable, is_identity, identity_generation, column_default
from information_schema.columns where table_schema = 'public' and table_name = 'quotations'
order by ordinal_position;
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid = 'public.quotations'::regclass;
select policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename = 'quotations';
select grantee, privilege_type from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'quotations' and grantee in ('anon','authenticated');
select pg_get_serial_sequence('public.quotations','quotation_no') as identity_sequence;
select has_sequence_privilege('authenticated',pg_get_serial_sequence('public.quotations','quotation_no'),'USAGE') as identity_usage;
-- Does NOT call nextval: no production quotation numbers are consumed.
