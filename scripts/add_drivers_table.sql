-- ============================================================================
-- Drivers directory (Operations → Manage Drivers)
--
-- A driver carries three linked fields (name, phone, vehicle), so it cannot
-- live in `metadata`, which has a single `label` column. This mirrors the
-- existing `vendors` table pattern instead.
--
-- Safe to re-run: everything is if-not-exists / drop-if-exists.
-- ============================================================================

begin;

create table if not exists public.drivers (
    id             uuid primary key default gen_random_uuid(),
    name           text not null,
    phone          text,
    vehicle_number text,
    created_at     timestamptz not null default now(),
    updated_at     timestamptz not null default now()
);

-- One driver per name, case-insensitive, so the Delivery Batch dropdown
-- can key off the name without ambiguity.
create unique index if not exists drivers_name_unique_ci
    on public.drivers (lower(name));

alter table public.drivers enable row level security;

-- Clear any earlier/blanket policies before recreating - Postgres OR's
-- permissive policies, so a leftover `true` policy would cancel these out.
drop policy if exists "Allow all for authenticated users" on public.drivers;
drop policy if exists "drivers_all"            on public.drivers;
drop policy if exists "drivers_select_scoped"  on public.drivers;
drop policy if exists "drivers_insert_scoped"  on public.drivers;
drop policy if exists "drivers_update_scoped"  on public.drivers;
drop policy if exists "drivers_delete_scoped"  on public.drivers;

-- Read: admin + sales (Office), matching who can open Delivery Batches.
create policy "drivers_select_scoped" on public.drivers
    for select to authenticated
    using (get_my_user_type() = any (array['admin', 'sales']));

-- Write: admin only, matching who can open Operations.
create policy "drivers_insert_scoped" on public.drivers
    for insert to authenticated
    with check (get_my_user_type() = 'admin');

create policy "drivers_update_scoped" on public.drivers
    for update to authenticated
    using (get_my_user_type() = 'admin')
    with check (get_my_user_type() = 'admin');

create policy "drivers_delete_scoped" on public.drivers
    for delete to authenticated
    using (get_my_user_type() = 'admin');

commit;


-- ── Optional: seed test drivers so you can try the flow before real data ────
-- Delete these rows once you enter real drivers.
insert into public.drivers (name, phone, vehicle_number) values
    ('Test Driver 1', '9876543210', 'MH12AB1234'),
    ('Test Driver 2', '9876500002', 'MH14CD5678'),
    ('Test Driver 3', '9876500003', 'GJ01EF9012')
on conflict do nothing;


-- ── Verify (read only) ──────────────────────────────────────────────────────
-- EXPECT: 3 seeded rows, and 4 policies named drivers_*_scoped.
select name, phone, vehicle_number from public.drivers order by name;

select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'drivers'
order by policyname;
