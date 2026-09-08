-- Additive-only schema patch for the automated Solar Feasibility Report.
-- This does not delete, rename, overwrite, or backfill any existing data.
begin;

alter table public.admin
    add column if not exists full_address text,
    add column if not exists pincode text;

commit;

select
    exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'admin' and column_name = 'full_address'
    ) as full_address_added,
    exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'admin' and column_name = 'pincode'
    ) as pincode_added;
