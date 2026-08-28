-- ─── Backfill profiles.channel_partner ("Branch / Partner") ──────────────────
-- Branch-scoped roles are filtered by channel_partner everywhere in the app, so
-- a blank value leaves the user seeing nothing (or, with a blank ilike filter,
-- everything). New users can no longer be created without it; this fills in the
-- rows that predate that check.
--
-- The value is inferred from whoever created the row (profiles.created_by),
-- falling back to that creator's own name when their channel_partner is blank.
--
-- Run in the Supabase SQL editor. STEP 1 is a read-only preview — check it
-- before running STEP 2. Take a backup/snapshot first; STEP 2 is not reversible.
-- ────────────────────────────────────────────────────────────────────────────

-- STEP 1 — preview: what would change, and to what.
select
    p.id,
    p.name,
    p.email,
    p.user_type,
    p.channel_partner                                   as current_branch,
    coalesce(nullif(trim(c.channel_partner), ''), c.name) as would_become,
    c.name                                              as created_by_name
from profiles p
left join profiles c on c.id = p.created_by
where p.user_type in ('channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2')
  and nullif(trim(coalesce(p.channel_partner, '')), '') is null
order by p.user_type, p.name;

-- Rows the preview leaves with would_become = NULL have no usable creator.
-- Those need filling by hand — list them:
select p.id, p.name, p.email, p.user_type
from profiles p
left join profiles c on c.id = p.created_by
where p.user_type in ('channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2')
  and nullif(trim(coalesce(p.channel_partner, '')), '') is null
  and coalesce(nullif(trim(c.channel_partner), ''), c.name) is null;


-- STEP 2 — apply. Only touches branch roles whose branch is currently blank.
update profiles p
set channel_partner = coalesce(nullif(trim(c.channel_partner), ''), c.name)
from profiles c
where c.id = p.created_by
  and p.user_type in ('channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2')
  and nullif(trim(coalesce(p.channel_partner, '')), '') is null
  and coalesce(nullif(trim(c.channel_partner), ''), c.name) is not null;


-- STEP 3 — verify nothing branch-scoped is left blank.
select count(*) as still_blank
from profiles
where user_type in ('channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2')
  and nullif(trim(coalesce(channel_partner, '')), '') is null;
