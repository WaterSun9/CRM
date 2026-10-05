-- Residential / Commercial on each lead (client request, 5 Oct 2026).
-- Commercial leads need the full document set (Aadhaar, PAN, Index-2, house
-- photo) even when paid in cash; the app shows those checklists for them.
-- Existing leads stay blank, which the app treats as Residential.
-- Run this BEFORE deploying the app version that has the field.
-- Safe to run more than once.
alter table public.admin add column if not exists property_type text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'admin_property_type_check') then
        alter table public.admin add constraint admin_property_type_check
            check (property_type is null or property_type in ('Residential', 'Commercial'));
    end if;
end $$;

-- Check: one row, data_type text.
select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'property_type';
