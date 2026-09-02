-- CP / CPO / Dealer lead visibility remediation
-- IMPORTANT: Sections 1 and 2 are read-only. Section 3 changes only the
-- admin SELECT and UPDATE RLS policies. It does not rewrite profiles or leads.

-- Confirmed access model:
--   channel_partner_office / office2: branch book via profiles.channel_partner
--   agent (Channel Partner): own book via profiles.name; ignore Dealer entirely
--   agent2 (Dealer): assignments via profiles.name only when the lead's CPO
--                    also equals the Dealer's registered branch

-- --------------------------------------------------------------------------
-- 1. READ-ONLY INVENTORY
-- --------------------------------------------------------------------------
select
  p.id,
  p.name,
  p.email,
  p.user_type,
  p.role as display_role,
  p.status,
  p.channel_partner as profile_branch,
  count(a.id) filter (
    where lower(trim(coalesce(a.channel_partner, ''))) = lower(trim(p.name))
      and a.deleted_at is null
  ) as cp_owned_leads,
  count(a.id) filter (
    where lower(trim(coalesce(a.sub_channel_partner, ''))) = lower(trim(p.name))
      and a.deleted_at is null
  ) as dealer_assigned_leads,
  count(a.id) filter (
    where nullif(trim(coalesce(p.channel_partner, '')), '') is not null
      and lower(trim(coalesce(a.channel_partner, ''))) = lower(trim(p.channel_partner))
      and a.deleted_at is null
  ) as branch_leads
from public.profiles p
left join public.admin a on (
     lower(trim(coalesce(a.channel_partner, ''))) = lower(trim(p.name))
  or lower(trim(coalesce(a.sub_channel_partner, ''))) = lower(trim(p.name))
  or (
    nullif(trim(coalesce(p.channel_partner, '')), '') is not null
    and lower(trim(coalesce(a.channel_partner, ''))) = lower(trim(p.channel_partner))
  )
)
where p.user_type in ('channel_partner_office', 'office2', 'agent', 'agent2')
group by p.id, p.name, p.email, p.user_type, p.role, p.status, p.channel_partner
order by p.user_type, p.name;

-- Same normalized name on multiple accounts is unsafe while RLS is name-based.
select
  lower(trim(name)) as normalized_name,
  count(*) as account_count,
  string_agg(name || ' <' || email || '> [' || user_type || ']', ', ' order by email) as accounts
from public.profiles
where nullif(trim(coalesce(name, '')), '') is not null
group by lower(trim(name))
having count(*) > 1
order by normalized_name;

-- Profile role label drift. Permissions use user_type, not role.
select id, name, email, user_type, role
from public.profiles
where (user_type = 'channel_partner_office' and role <> 'Channel Partner Office')
   or (user_type = 'office2' and role <> 'Channel Partner Manager')
   or (user_type = 'agent' and role <> 'Channel Partners')
   or (user_type = 'agent2' and role <> 'Dealer')
order by user_type, name;

-- CHIRAG control check: expected 253 before applying the policy.
select
  count(*) filter (where deleted_at is null) as expected_visible,
  count(*) filter (where deleted_at is not null) as deleted_not_visible
from public.admin
where lower(trim(coalesce(channel_partner, ''))) = 'chirag mama'
   or lower(trim(coalesce(sub_channel_partner, ''))) = 'chirag mama';

-- --------------------------------------------------------------------------
-- 2. CAPTURE CURRENT POLICY DEFINITIONS BEFORE CHANGING ANYTHING
-- Save these results outside Supabase so rollback uses the actual live policy.
-- --------------------------------------------------------------------------
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'admin'
order by policyname;

-- --------------------------------------------------------------------------
-- 3. APPLY ONLY AFTER REVIEWING SECTIONS 1 AND 2
-- This splits agent and agent2. Dealer scope is unchanged.
-- --------------------------------------------------------------------------
begin;

drop policy if exists admin_select on public.admin;
create policy admin_select
on public.admin
for select
to authenticated
using (
  get_my_user_type() in ('admin', 'sales')
  or (
    get_my_user_type() in ('channel_partner_office', 'office2')
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'agent'
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
  )
  or (
    get_my_user_type() = 'agent2'
    and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'vendor'
    and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), '')))
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

drop policy if exists admin_update on public.admin;
create policy admin_update
on public.admin
for update
to authenticated
using (
  get_my_user_type() in ('admin', 'sales')
  or (
    get_my_user_type() in ('channel_partner_office', 'office2')
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'agent'
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
  )
  or (
    get_my_user_type() = 'agent2'
    and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'vendor'
    and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), '')))
  )
  or (
    get_my_user_type() = 'stamp'
    and deleted_at is null
    and discom_submission ->> 'sent_to_stamp_maker' = 'true'
    and coalesce(discom_submission ->> 'assigned_stamp_maker', '') <> ''
    and lower(trim(coalesce(discom_submission ->> 'assigned_stamp_maker', ''))) =
        lower(trim(coalesce(get_my_name(), '')))
  )
)
with check (
  get_my_user_type() in ('admin', 'sales')
  or (
    get_my_user_type() in ('channel_partner_office', 'office2')
    and lower(trim(coalesce(channel_partner, ''))) =
        lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'agent'
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
  )
  or (
    get_my_user_type() = 'agent2'
    and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), '')))
    and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
  )
  or (
    get_my_user_type() = 'vendor'
    and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), '')))
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

-- --------------------------------------------------------------------------
-- 4. POST-APPLY CHECKS (read-only)
-- --------------------------------------------------------------------------
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename = 'admin'
  and policyname in ('admin_select', 'admin_update')
order by policyname;

-- Then sign in as CHIRAG MAMA. The portal and an authenticated count query
-- should both return exactly 253 active leads.
