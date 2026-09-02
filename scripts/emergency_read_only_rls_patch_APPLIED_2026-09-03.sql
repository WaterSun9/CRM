-- APPLIED TO PRODUCTION ON 2026-09-03
-- Exact retained copy of the emergency SELECT-only RLS patch.
-- No INSERT, UPDATE, DELETE, profile, lead, or metadata rows are changed.

begin;

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
  get_my_user_type() in ('admin', 'sales')
  or (
    get_my_user_type() in (
      'channel_partner_office',
      'office2',
      'channel_partner_office_manager'
    )
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'agent'
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
  )
  or (
    get_my_user_type() = 'agent2'
    and lower(trim(coalesce(sub_channel_partner, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'vendor'
    and lower(trim(coalesce(vendor, ''))) =
        lower(trim(coalesce(get_my_name(), '')))
    and deleted_at is null
  )
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

select policyname, cmd, roles, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'admin'
  and policyname = 'admin_select';

