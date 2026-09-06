-- SAFE PRODUCTION PATCH
-- 1) Adds one nullable text column; existing lead rows remain unchanged.
-- 2) Adds read-path indexes; no lead/profile/document rows are rewritten.
-- 3) Recreates only public.admin's SELECT policy with identical visibility rules,
--    but evaluates profile helper functions once per statement instead of per row.
--
-- Run this BEFORE deploying the matching frontend build.

begin;

alter table public.admin
  add column if not exists district text;

-- The Supabase SQL Editor runs the submission in a transaction, so these use
-- ordinary CREATE INDEX rather than CREATE INDEX CONCURRENTLY. At the current
-- table size this should complete quickly.
create index if not exists admin_channel_partner_normalized_idx
  on public.admin ((lower(btrim(coalesce(channel_partner, '')))));

create index if not exists admin_sub_channel_partner_normalized_idx
  on public.admin ((lower(btrim(coalesce(sub_channel_partner, '')))));

create index if not exists admin_vendor_normalized_active_idx
  on public.admin ((lower(btrim(coalesce(vendor, '')))))
  where deleted_at is null;

create index if not exists admin_created_at_desc_idx
  on public.admin (created_at desc);

do $$
begin
  if to_regprocedure('public.get_my_user_type()') is null
     or to_regprocedure('public.get_my_channel_partner()') is null
     or to_regprocedure('public.get_my_name()') is null then
    raise exception 'Required RLS helper function is missing; transaction rolled back';
  end if;
end $$;

drop policy if exists admin_select on public.admin;

create policy admin_select
on public.admin
for select
to authenticated
using (
  (select get_my_user_type()) in ('admin', 'sales')
  or (
    (select get_my_user_type()) in (
      'channel_partner_office',
      'office2',
      'channel_partner_office_manager'
    )
    and lower(btrim(coalesce(channel_partner, ''))) =
        lower(btrim(coalesce((select get_my_channel_partner()), '')))
  )
  or (
    (select get_my_user_type()) = 'agent'
    and lower(btrim(coalesce(channel_partner, ''))) =
        lower(btrim(coalesce((select get_my_name()), '')))
  )
  or (
    (select get_my_user_type()) = 'agent2'
    and lower(btrim(coalesce(sub_channel_partner, ''))) =
        lower(btrim(coalesce((select get_my_name()), '')))
    and lower(btrim(coalesce(channel_partner, ''))) =
        lower(btrim(coalesce((select get_my_channel_partner()), '')))
  )
  or (
    (select get_my_user_type()) = 'vendor'
    and lower(btrim(coalesce(vendor, ''))) =
        lower(btrim(coalesce((select get_my_name()), '')))
    and deleted_at is null
  )
  or (
    (select get_my_user_type()) = 'stamp'
    and deleted_at is null
    and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    and coalesce(discom_submission ->> 'assigned_stamp_maker', '') <> ''
    and lower(btrim(coalesce(discom_submission ->> 'assigned_stamp_maker', ''))) =
        lower(btrim(coalesce((select get_my_name()), '')))
  )
);

commit;

-- Verification only: returns metadata, not customer data.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'admin'
  and column_name = 'district';

select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'admin'
  and policyname = 'admin_select';
