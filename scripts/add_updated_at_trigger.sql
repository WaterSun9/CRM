-- ─── Add updated_at Column & Automatic Trigger to public.admin ──────────────
-- Ensures that any UPDATE to public.admin automatically sets updated_at = now()
-- providing a reliable timestamp for optimistic concurrency / conflict detection.
-- ────────────────────────────────────────────────────────────────────────────

begin;

-- 1. Ensure updated_at column exists on public.admin with timezone
alter table public.admin
    add column if not exists updated_at timestamptz default now();

-- 2. Create or replace trigger function
create or replace function public.set_admin_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- 3. Attach BEFORE UPDATE trigger
drop trigger if exists trigger_set_admin_updated_at on public.admin;

create trigger trigger_set_admin_updated_at
    before update on public.admin
    for each row
    execute function public.set_admin_updated_at();

commit;

-- ── Verification Query ───────────────────────────────────────────────────────
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'admin' and column_name = 'updated_at';
