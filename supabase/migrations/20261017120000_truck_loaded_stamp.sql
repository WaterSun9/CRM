-- Truck loaded: who marked a delivery batch's truck as loaded, and when.
-- The truck loading sheet's "Truck loaded" button writes these columns and the
-- sheet shows "Loaded by NAME on DATE, TIME" at the top from then on.
-- A trigger stamps the database time and the signed-in user, so the record
-- cannot be back-dated or put in someone else's name from a browser.
-- The ticks themselves stay where they are (bom_items.loaded, panel_loading).
-- save_delivery_batch_atomic does not list these columns, so editing a batch
-- keeps the stamp.
-- The owner applies this file in the Supabase SQL Editor. Safe to run twice.
set lock_timeout = '8s';

begin;

alter table public.delivery_batches add column if not exists loaded_at timestamptz;
alter table public.delivery_batches add column if not exists loaded_by uuid;
alter table public.delivery_batches add column if not exists loaded_by_name text;

-- Definer rights only to read the caller's own name from profiles.
create or replace function public.stamp_delivery_batch_loaded()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_uid uuid := (select auth.uid());
begin
    -- SQL Editor (no signed-in user) may backfill old trucks as given.
    if v_uid is null then
        return new;
    end if;
    if tg_op = 'UPDATE' and new.loaded_at is not distinct from old.loaded_at then
        -- Not a loading change: the stamp stays as it was.
        new.loaded_by := old.loaded_by;
        new.loaded_by_name := old.loaded_by_name;
        return new;
    end if;
    if new.loaded_at is null then
        new.loaded_by := null;
        new.loaded_by_name := null;
    else
        new.loaded_at := now();
        new.loaded_by := v_uid;
        new.loaded_by_name := coalesce(
            (select nullif(btrim(p.name), '') from public.profiles p where p.id = v_uid),
            nullif(btrim(new.loaded_by_name), '')
        );
    end if;
    return new;
end;
$$;

drop trigger if exists stamp_delivery_batch_loaded on public.delivery_batches;
create trigger stamp_delivery_batch_loaded
before insert or update on public.delivery_batches
for each row execute function public.stamp_delivery_batch_loaded();

commit;

-- Verification after commit: three rows (loaded_at, loaded_by, loaded_by_name).
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'delivery_batches' and column_name like 'loaded_%'
order by column_name;

-- Undo (only if something breaks; the stamps are lost):
-- drop trigger if exists stamp_delivery_batch_loaded on public.delivery_batches;
-- drop function if exists public.stamp_delivery_batch_loaded();
-- alter table public.delivery_batches drop column if exists loaded_at, drop column if exists loaded_by, drop column if exists loaded_by_name;
