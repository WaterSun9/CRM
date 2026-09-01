-- ============================================================================
-- Align lead records to the official branch/firm names  (Option 2)
--
-- THE PROBLEM THIS FIXES
-- 5 Channel Partner Office logins currently see ZERO of their own leads,
-- because `profiles.channel_partner` holds the FIRM name while
-- `admin.channel_partner` holds the PERSON's name, and RLS matches the two:
--
--     login           branch (profiles)   leads under branch   under their name
--     PRAVINBHAI      Radhe Solar                0                    1,060
--     MANOJ           Er Manoj Solar             0                      395
--     BHAVESH JOSHI   bhavesh solar              0                      247
--     BHAVESHBHAI     Kadi Solar                 0                      143
--     RAVJIBHAI       Gurudev                    0                      132
--                                                                    -------
--                                                                      1,977
--
-- WHY THE FIRM NAME WINS: the 38 dealer logins are ALREADY organised under
-- firm names (Radhe Solar, Er Manoj Solar, Sandip Trivedi, BHAGVAN THAKOR).
-- The lead records are the only thing on the other naming system.
--
-- SAFE TO RUN:
--   * all 5 firm names already exist in the channel_partner dropdown (uppercase)
--   * NO profile uses the old person-names as its branch, so the org structure
--     is untouched
--   * RLS matching is case-insensitive (lower(trim(...))), so the uppercase
--     values below still match the mixed-case branch names in profiles
--
-- Reversible from backups/full-backup-2026-09-01T11-13-01.json
-- ============================================================================


-- ── 1. PREVIEW. Read-only. Run this first ───────────────────────────────────
select channel_partner as current_value,
       count(*)        as rows_to_change,
       case channel_partner
           when 'PRAVINBHAI'    then 'RADHE SOLAR'
           when 'MANOJ'         then 'ER MANOJ SOLAR'
           when 'BHAVESH JOSHI' then 'BHAVESH SOLAR'
           when 'BHAVESHBHAI'   then 'KADI SOLAR'
           when 'RAVJIBHAI'     then 'GURUDEV'
       end as new_value
from public.admin
where channel_partner in ('PRAVINBHAI','MANOJ','BHAVESH JOSHI','BHAVESHBHAI','RAVJIBHAI')
group by channel_partner
order by count(*) desc;
-- EXPECT: PRAVINBHAI 1060 | MANOJ 395 | BHAVESH JOSHI 247 | BHAVESHBHAI 143 | RAVJIBHAI 132
--         total 1,977


-- ── 2. THE RENAME ───────────────────────────────────────────────────────────
begin;

update public.admin set channel_partner = 'RADHE SOLAR'    where channel_partner = 'PRAVINBHAI';
update public.admin set channel_partner = 'ER MANOJ SOLAR' where channel_partner = 'MANOJ';
update public.admin set channel_partner = 'BHAVESH SOLAR'  where channel_partner = 'BHAVESH JOSHI';
update public.admin set channel_partner = 'KADI SOLAR'     where channel_partner = 'BHAVESHBHAI';
update public.admin set channel_partner = 'GURUDEV'        where channel_partner = 'RAVJIBHAI';

commit;


-- ── 3. Retire the old dropdown entries ──────────────────────────────────────
-- After step 2 nothing uses these, and leaving them lets someone file a NEW
-- lead under the person-name and recreate the exact problem this fixes.
-- Guarded: only deletes an entry that no admin row still references.
delete from public.metadata m
 where m.category = 'channel_partner'
   and upper(trim(m.label)) in ('PRAVINBHAI','MANOJ','BHAVESH JOSHI','BHAVESHBHAI','RAVJIBHAI')
   and not exists (
       select 1 from public.admin a
        where lower(trim(coalesce(a.channel_partner,''))) = lower(trim(m.label))
   );


-- ── 4. OPTIONAL: make profiles use the same spelling ────────────────────────
-- Not required - RLS lowercases both sides, so "Radhe Solar" already matches
-- "RADHE SOLAR". Run it only if you want one identical string everywhere.
-- Touches the 5 CPO logins AND their dealers (both hold the branch name).
--
-- update public.profiles set channel_partner = 'RADHE SOLAR'    where lower(trim(channel_partner)) = 'radhe solar';
-- update public.profiles set channel_partner = 'ER MANOJ SOLAR' where lower(trim(channel_partner)) = 'er manoj solar';
-- update public.profiles set channel_partner = 'BHAVESH SOLAR'  where lower(trim(channel_partner)) = 'bhavesh solar';
-- update public.profiles set channel_partner = 'KADI SOLAR'     where lower(trim(channel_partner)) = 'kadi solar';
-- update public.profiles set channel_partner = 'GURUDEV'        where lower(trim(channel_partner)) = 'gurudev';


-- ── 5. VERIFY: every CPO can now see their own leads ────────────────────────
select p.name                as login,
       p.channel_partner     as branch,
       count(a.id)           as leads_now_visible
from public.profiles p
left join public.admin a
       on lower(trim(coalesce(a.channel_partner,''))) = lower(trim(coalesce(p.channel_partner,'')))
where p.user_type in ('channel_partner_office','office2')
group by p.name, p.channel_partner
order by count(a.id) desc;
-- EXPECT the five that were 0 to now read:
--   PRAVINBHAI 1060 | MANOJ 395 | BHAVESH JOSHI 247 | BHAVESHBHAI 143 | RAVJIBHAI 132
-- CPM5 and CPO stay at 0 - they are test logins on the "admin" branch.

-- and nothing should be left pointing at a person-name:
select count(*) as should_be_zero
from public.admin
where channel_partner in ('PRAVINBHAI','MANOJ','BHAVESH JOSHI','BHAVESHBHAI','RAVJIBHAI');
