-- ─── Add per-lead ownership to public.admin ─────────────────────────────────
-- Needed for "a Channel Partner sees only their own leads". Today the admin
-- table has no owner column at all — the only per-person marker is
-- application_done_by, a plain name string written in two places
-- (Dashboard.jsx:593 and AgentPortal.jsx:359).
--
-- This adds a real FK owner, then backfills it by matching that name string
-- against profiles.name.
--
-- Written WITHOUT having seen the admin table definition, so STEP 0 confirms
-- the columns first. Run STEP 0 and the STEP 2 preview before STEP 3.
-- Take a snapshot first: STEP 3 writes to every matched row.
-- ────────────────────────────────────────────────────────────────────────────

-- STEP 0 — confirm the columns this script relies on actually exist.
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public' and table_name = 'admin'
  and column_name in ('id', 'created_by', 'application_done_by',
                      'channel_partner', 'sub_channel_partner', 'created_at')
order by column_name;
-- Expect: id, application_done_by, channel_partner, sub_channel_partner,
-- created_at. If created_by is already listed, skip STEP 1.


-- STEP 1 — add the owner column, FK and index. Safe to re-run.
alter table public.admin
    add column if not exists created_by uuid null;

do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'admin_created_by_fkey'
    ) then
        alter table public.admin
            add constraint admin_created_by_fkey
            foreign key (created_by) references public.profiles (id)
            on delete set null;
    end if;
end $$;

create index if not exists idx_admin_created_by on public.admin using btree (created_by);


-- STEP 2 — preview the backfill.
-- 2a: how many leads can be matched by name, and how many cannot.
select
    count(*) filter (where p.id is not null)                    as will_be_set,
    count(*) filter (where p.id is null
                       and nullif(trim(coalesce(a.application_done_by,'')),'') is not null)
                                                                as name_not_found,
    count(*) filter (where nullif(trim(coalesce(a.application_done_by,'')),'') is null)
                                                                as no_name_recorded
from public.admin a
left join lateral (
    select pr.id
    from public.profiles pr
    where upper(trim(pr.name)) = upper(trim(a.application_done_by))
    limit 2
) p on true
where a.created_by is null;

-- 2b: names that match MORE THAN ONE profile — ambiguous, skipped by STEP 3.
select upper(trim(name)) as duplicate_name, count(*) as profile_count
from public.profiles
group by upper(trim(name))
having count(*) > 1
order by profile_count desc;

-- 2c: leads whose application_done_by matches no profile — these stay NULL.
select distinct a.application_done_by, count(*) as lead_count
from public.admin a
where a.created_by is null
  and nullif(trim(coalesce(a.application_done_by,'')),'') is not null
  and not exists (
      select 1 from public.profiles pr
      where upper(trim(pr.name)) = upper(trim(a.application_done_by))
  )
group by a.application_done_by
order by lead_count desc;


-- STEP 3 — apply. Only unambiguous single-profile name matches are set.
update public.admin a
set created_by = m.id
from (
    select pr.id, upper(trim(pr.name)) as uname
    from public.profiles pr
    where upper(trim(pr.name)) in (
        select upper(trim(name)) from public.profiles
        group by upper(trim(name)) having count(*) = 1
    )
) m
where a.created_by is null
  and nullif(trim(coalesce(a.application_done_by,'')),'') is not null
  and upper(trim(a.application_done_by)) = m.uname;


-- STEP 4 — what is still unowned after the backfill.
select count(*) as leads_without_owner
from public.admin
where created_by is null;


-- ─── Unrelated but worth checking ───────────────────────────────────────────
-- profiles has BOTH `branch` and `channel_partner`. The app reads and writes
-- channel_partner only; `branch` is referenced nowhere in src/. Check whether
-- it holds real data before treating channel_partner as the source of truth.
select
    count(*)                                                        as total,
    count(*) filter (where nullif(trim(coalesce(branch,'')),'') is not null)          as has_branch,
    count(*) filter (where nullif(trim(coalesce(channel_partner,'')),'') is not null) as has_channel_partner,
    count(*) filter (where nullif(trim(coalesce(branch,'')),'') is not null
                       and nullif(trim(coalesce(channel_partner,'')),'') is null)     as branch_only
from public.profiles;
