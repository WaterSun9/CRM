-- PCR Certificate + Plant Commissioning Report
--
-- Run during the maintenance window, after taking a fresh backup.
-- This does not delete, rename, or rewrite any existing customer/document data.
-- Both fields are optional and default to false.

begin;

alter table public.admin
    add column if not exists pcr_certificate boolean not null default false,
    add column if not exists plant_commissioning_report boolean not null default false;

commit;

-- Verification: expect both rows with data_type = boolean and null count = 0.
select
    column_name,
    data_type,
    is_nullable,
    column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'admin'
  and column_name in ('pcr_certificate', 'plant_commissioning_report')
order by column_name;

select
    count(*) filter (where pcr_certificate) as pcr_checked,
    count(*) filter (where plant_commissioning_report) as plant_commissioning_checked
from public.admin;
