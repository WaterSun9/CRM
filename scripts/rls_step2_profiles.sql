-- ─── RLS STEP 2 — close anonymous access to profiles ────────────────────────
-- `Allow authenticated profile updates` is misnamed: it grants ALL commands to
-- the `anon` role with qual/with_check = true. Anyone holding the anon key from
-- the shipped JS bundle can read every user's email and role, and modify them,
-- without logging in.
--
-- It cannot simply be dropped: User Management writes to OTHER users' profile
-- rows from the client, and those writes are the primary path (they throw on
-- error; the edge function runs afterwards). Dropping the blanket policy with
-- nothing in its place breaks role, branch, email, status and delete edits.
--
-- Safe because get_my_user_type() / get_my_channel_partner() are STABLE
-- SECURITY DEFINER, so they bypass RLS and cannot recurse on this table.
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Replacement UPDATE policy: yourself, an Admin, or a CPO/Manager acting
--    strictly inside their own branch. with_check uses the same rule, so a CPO
--    cannot move a user out of their branch.
create policy "profiles_update_scoped" on public.profiles
    for update to authenticated
    using (
        id = auth.uid()
        or get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
        )
    )
    with check (
        id = auth.uid()
        or get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
        )
    );

-- 2. DELETE had no policy of its own — it relied entirely on the anon ALL rule.
create policy "profiles_delete_scoped" on public.profiles
    for delete to authenticated
    using (
        get_my_user_type() = 'admin'
        or (
            get_my_user_type() in ('channel_partner_office', 'office2')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
        )
    );

-- 3. Now the anon policy can go, plus the old JWT-metadata one it superseded
--    (that read user_type from JWT metadata, which this app never populates).
drop policy if exists "Allow authenticated profile updates" on public.profiles;
drop policy if exists "profiles_update_policy" on public.profiles;


-- ── verification ────────────────────────────────────────────────────────────
-- Expect: no anon/public rows; SELECT + INSERT + UPDATE + DELETE all present.
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by cmd, policyname;


-- ── LEFT DELIBERATELY ALONE (tighten later, not in this step) ───────────────
-- profiles_select_policy : SELECT, authenticated, qual = true
--     Any logged-in user can read every profile. Narrowing it risks breaking
--     the sub-agent dropdown and the branch list, so it needs its own pass.
-- profiles_insert_policy : INSERT, authenticated, with_check = true
--     Client never inserts profiles (the edge function uses service_role), so
--     this can likely be restricted to Admin — verify before changing.
