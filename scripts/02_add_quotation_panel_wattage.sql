-- Run once in the Supabase SQL Editor after public.quotations exists.
-- Additive only: no table, policy, or existing quotation is removed.

begin;

alter table public.quotations
    add column if not exists panel_wattage numeric(10, 2);

-- Backfill quotations that already stored panel wattage in quotation_data JSON.
update public.quotations
set panel_wattage = (quotation_data #>> '{form,panel_wattage}')::numeric
where panel_wattage is null
  and trim(quotation_data #>> '{form,panel_wattage}') ~ '^[0-9]+([.][0-9]+)?$'
  and (quotation_data #>> '{form,panel_wattage}')::numeric > 0;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conrelid = 'public.quotations'::regclass
          and conname = 'quotations_panel_wattage_positive'
    ) then
        alter table public.quotations
            add constraint quotations_panel_wattage_positive
            check (panel_wattage is null or panel_wattage > 0);
    end if;
end
$$;

commit;

-- Verification: should return panel_wattage with data type numeric.
select column_name, data_type, numeric_precision, numeric_scale
from information_schema.columns
where table_schema = 'public'
  and table_name = 'quotations'
  and column_name = 'panel_wattage';
