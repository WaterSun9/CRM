-- ─── Ensure Automatic Lead Creation Timestamp in Supabase Backend ────────────
-- Table: public.admin
-- Description: Ensures created_at column exists, defaults to now(), and is guaranteed
--              by a BEFORE INSERT trigger so that every lead is always timestamped.
-- ────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Ensure created_at column exists with timestamptz and default now()
alter table public.admin
    add column if not exists created_at timestamptz default now();

-- 2. Backfill any existing null created_at values
update public.admin
set created_at = now()
where created_at is null;

-- 3. Trigger function to enforce created_at is never null on insert
create or replace function public.set_admin_created_at()
returns trigger as $$
begin
    if new.created_at is null then
        new.created_at = now();
    end if;
    return new;
end;
$$ language plpgsql;

-- 4. Attach BEFORE INSERT trigger
drop trigger if exists trigger_set_admin_created_at on public.admin;

create trigger trigger_set_admin_created_at
    before insert on public.admin
    for each row
    execute function public.set_admin_created_at();

commit;

-- ── Verification ─────────────────────────────────────────────────────────────
select column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'created_at';
