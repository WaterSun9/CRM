-- ============================================================================
-- Orphaned login accounts: rows in auth.users with no matching profile.
--
-- CAUSE (now fixed in UserManagementView.jsx): deleting a user called the
-- edge function but never checked its error, then deleted the profile row
-- regardless. When the auth deletion failed, the profile vanished but the
-- login survived - so the account disappeared from User Management while its
-- email stayed taken, and recreating it failed with "email exists" with no
-- way to fix it from the UI.
--
-- Run block 1 first. Nothing is deleted until you uncomment block 3.
-- ============================================================================


-- ── 1. LOOK: which logins have no profile? (read only) ──────────────────────
-- These are the emails that will report "already exists" on re-creation.
select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    case when u.email_confirmed_at is null then 'never confirmed' else 'confirmed' end as email_state
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
order by u.created_at desc;


-- ── 2. Reverse check: profiles with no login (read only) ────────────────────
-- These users appear in User Management but can never sign in.
-- EXPECT: 0 rows.
select p.id, p.name, p.email, p.role, p.user_type
from public.profiles p
left join auth.users u on u.id = p.id
where u.id is null
order by p.name;


-- ── 3. FIX: delete the orphaned logins (uncomment to run) ───────────────────
-- Deletes ONLY auth users that have no profile row, so it cannot touch a
-- live account. Frees the email addresses for re-creation.
--
-- Check block 1 first and make sure every row listed is genuinely one you
-- deleted. This is irreversible.
--
-- delete from auth.users u
--  where not exists (select 1 from public.profiles p where p.id = u.id)
-- returning u.id, u.email;


-- ── 4. Target a single email instead (safer, uncomment to run) ──────────────
-- Use this if you only need to free up one address you are trying to re-add.
--
-- delete from auth.users u
--  where u.email = 'REPLACE_WITH_THE_EMAIL'
--    and not exists (select 1 from public.profiles p where p.id = u.id)
-- returning u.id, u.email;


-- ── 5. Re-run block 1 afterwards. EXPECT: 0 rows. ───────────────────────────
