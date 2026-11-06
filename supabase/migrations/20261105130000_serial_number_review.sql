-- Tables for the Inverter page (NOT YET RUN). 5 Nov 2026.
--
-- serial_number_review: sheet rows to check by hand ("File no mismatch" tab). The client's
-- inverter list and the vendor csv had rows whose name and file / consumer no disagree, so
-- the import left them out. Admin and staff (sales) fill a card from the row or dismiss it.
--   * kind 'name_differs': admin_id is the card on that number, which has another name.
--   * kind 'swapped': the name belongs to a card on another number. admin_id is that card
--     (the name wins, offered first); alt_admin_id is the card on the sheet's number.
--   * Rows are loaded by docs/inverter-import-2026-11-05/review_rows.sql (run after this).
--     Admin and staff can read them and mark them done; nobody inserts from the app.
--
-- serial_number_import: what docs/inverter-import-2026-11-05/import.sql wrote to each card
-- ("Uploaded from sheet" tab). Read only for admin and staff; import.sql fills it.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

create table if not exists public.serial_number_review (
    id bigint generated always as identity primary key,
    source text not null,
    kind text not null default 'name_differs' check (kind in ('name_differs', 'swapped')),
    admin_id uuid not null references public.admin(id) on delete cascade,
    alt_admin_id uuid references public.admin(id) on delete set null,
    sheet_name text,
    sheet_number text,
    card_name text,
    inverter_make text,
    inverter_serial_no text,
    panel_serial_no text,
    resolution text check (resolution is null or resolution in ('filled', 'filled_other', 'dismissed')),
    resolved_by uuid,
    resolved_at timestamptz,
    created_at timestamptz not null default now(),
    unique (source, admin_id)
);

alter table public.serial_number_review enable row level security;

drop policy if exists serial_number_review_office_read on public.serial_number_review;
create policy serial_number_review_office_read on public.serial_number_review
for select to authenticated using (public.get_my_user_type() in ('admin', 'sales'));

drop policy if exists serial_number_review_office_resolve on public.serial_number_review;
create policy serial_number_review_office_resolve on public.serial_number_review
for update to authenticated
using (public.get_my_user_type() in ('admin', 'sales'))
with check (public.get_my_user_type() in ('admin', 'sales'));

grant select, update on public.serial_number_review to authenticated;

create table if not exists public.serial_number_import (
    id bigint generated always as identity primary key,
    admin_id uuid not null unique references public.admin(id) on delete cascade,
    source text,
    sheet_name text,
    inverter_make text,
    inverter_serial_no text,
    panel_serial_no text,
    imported_at timestamptz not null default now()
);

alter table public.serial_number_import enable row level security;

drop policy if exists serial_number_import_office_read on public.serial_number_import;
create policy serial_number_import_office_read on public.serial_number_import
for select to authenticated using (public.get_my_user_type() in ('admin', 'sales'));

grant select on public.serial_number_import to authenticated;

commit;

-- Check (expect 3 policies):
select count(*) as policies_3 from pg_policies where schemaname = 'public' and tablename in ('serial_number_review', 'serial_number_import');
