-- EMERGENCY WEEKDAY PATCH: SELECT VISIBILITY ONLY
-- No INSERT, UPDATE, DELETE, profile, lead, or metadata rows are changed.
-- Run this entire file once in the Supabase SQL Editor.

begin;

-- Fail closed if the expected helper functions do not exist.
do $$
begin
  if to_regprocedure('public.get_my_user_type()') is null
     or to_regprocedure('public.get_my_channel_partner()') is null
     or to_regprocedure('public.get_my_name()') is null then
    raise exception 'Required RLS helper function is missing; no policy change applied';
  end if;
end $$;

drop policy if exists admin_select on public.admin;

create policy admin_select
on public.admin
for select
to authenticated
using (
  -- Admin and Office: unchanged, all rows.
  get_my_user_type() in ('admin', 'sales')

  -- CPO and CPO Manager: the complete branch book.
  or (
    get_my_user_type() in (
      'channel_partner_office',
      'office2',
      'channel_partner_office_manager'
    )
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )

  -- Independent CP: own channel_partner book. Ignore Dealer completely.
  or (
    get_my_user_type() = 'agent'
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
  )

  -- Dealer: both their own name AND registered CPO branch must match.
  or (
    get_my_user_type() = 'agent2'
    and lower(trim(coalesce(sub_channel_partner, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )

  -- Vendor: preserve the existing vendor scope.
  or (
    get_my_user_type() = 'vendor'
    and lower(trim(coalesce(vendor, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
    and deleted_at is null
  )

  -- Stamp maker: preserve the existing assigned-stamp scope.
  or (
    get_my_user_type() = 'stamp'
    and deleted_at is null
    and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    and coalesce(discom_submission ->> 'assigned_stamp_maker', '') <> ''
    and lower(trim(coalesce(discom_submission ->> 'assigned_stamp_maker', ''))) =
        lower(trim(coalesce(get_my_name(), '')))
  )
);

commit;

-- Confirmation output. This is read-only.
select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'admin'
  and policyname = 'admin_select';

