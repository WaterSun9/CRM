-- ============================================================================
-- READ-ONLY diagnosis of Channel Partner / Dealer scoping. Changes nothing.
--
-- For every agent-type login it shows the three numbers that matter:
--   own_leads_visible  - what RLS actually lets them see (sub_channel_partner = their name)
--   own_book_hidden    - leads filed under THEIR name as channel_partner, which
--                        they CANNOT see today (this is "we never got our data")
--   branch_book        - leads under their assigned branch. If they are `agent`
--                        or `agent2` they cannot see these. If someone was made
--                        `office2` by mistake, they CAN - that is the leak.
-- ============================================================================

-- ── 1. every agent-type login and what they can/cannot reach ────────────────
select
    p.name,
    p.user_type,
    coalesce(p.channel_partner, '(none)')                as branch,
    (select count(*) from public.admin a
      where lower(trim(coalesce(a.sub_channel_partner,''))) = lower(trim(p.name)))   as own_leads_visible,
    (select count(*) from public.admin a
      where lower(trim(coalesce(a.channel_partner,'')))     = lower(trim(p.name)))   as own_book_hidden,
    (select count(*) from public.admin a
      where p.channel_partner is not null
        and lower(trim(coalesce(a.channel_partner,'')))     = lower(trim(p.channel_partner))) as branch_book
from public.profiles p
where p.user_type in ('agent','agent2')
order by own_book_hidden desc, p.name;


-- ── 2. THE LEAK CHECK: anyone on a branch who is NOT agent/agent2 ───────────
-- office2 (Manager) and channel_partner_office match on the BRANCH, so a
-- Channel Partner accidentally created as one of those sees the whole branch.
select p.name, p.user_type, p.channel_partner,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.channel_partner,''))) = lower(trim(p.channel_partner))) as sees_this_many
from public.profiles p
where p.user_type in ('channel_partner_office','office2')
order by sees_this_many desc;
-- Any name here that you think of as a Channel Partner (not an office/manager)
-- is the cause of the leak.


-- ── 3. NAME COLLISIONS ──────────────────────────────────────────────────────
-- Two logins with the same name share everything, because get_my_name() cannot
-- tell them apart.
select lower(trim(name)) as name_key,
       count(*)          as logins,
       string_agg(name || ' [' || user_type || ']', ', ') as who
from public.profiles
group by lower(trim(name))
having count(*) > 1;
-- EXPECT 0 rows. Anything here is a real scoping hazard.


-- ── 4. Do dealers actually see only their own? ──────────────────────────────
-- For each dealer: leads that are theirs, vs leads in their branch that are NOT.
select p.name as dealer,
       p.channel_partner as branch,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.sub_channel_partner,''))) = lower(trim(p.name)))  as theirs,
       (select count(*) from public.admin a
         where lower(trim(coalesce(a.channel_partner,''))) = lower(trim(p.channel_partner))
           and lower(trim(coalesce(a.sub_channel_partner,''))) <> lower(trim(p.name)))  as branch_not_theirs
from public.profiles p
where p.user_type = 'agent2'
order by theirs desc;
-- `branch_not_theirs` is what they would see if the scoping were wrong.
-- Under current RLS they see only `theirs` - this column is the blast radius
-- if anyone changes the agent clause carelessly.


-- ── 5. Channel Partners that have a branch set (should be none) ─────────────
select name, user_type, channel_partner
from public.profiles
where user_type = 'agent' and coalesce(trim(channel_partner),'') <> '';
-- Per your rule, Channel Partners are UNIVERSAL. Every row here is a profile
-- that needs its branch cleared.
