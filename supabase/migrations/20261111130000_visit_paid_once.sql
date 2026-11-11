-- A trip paid twice, 11 Nov 2026.
--
-- On a slow network a saved visit could be saved again by a second tap on Save:
-- only visits linked to a trip (trip_id) were protected, and combined trips and
-- typed-km visits were not. Each form opening now sends one save key (combined
-- trips reuse their trip_group); one row per key and complaint is allowed.
--
-- Only adds a column and two indexes; no existing row changes. Safe to run more
-- than once. The app works before and after this runs.

alter table public.service_visits add column if not exists save_key uuid;

create unique index if not exists service_visits_save_key
    on public.service_visits (save_key, issue_id) where save_key is not null;

-- A combined trip has one row per complaint. If this fails, the same combined
-- trip was already saved twice; find the pairs with:
--   select trip_group, issue_id, count(*) from public.service_visits
--   where trip_group is not null group by 1, 2 having count(*) > 1;
create unique index if not exists service_visits_group_issue
    on public.service_visits (trip_group, issue_id) where trip_group is not null;
