-- ============================================================================
-- Scope `profiles` SELECT.  Currently: USING (true) - every authenticated user
-- can read EVERY profile row: names, emails, roles, branch.
--
-- Do this AFTER fix_profiles_privilege_escalation.sql, and test before trusting it.
--
-- What each role actually reads from `profiles` (audited in the code):
--   everyone   own row                       App.jsx, LoginScreen, StampPortal
--   admin      all rows                      UserManagementView, ChannelPartnerManagementView,
--                                            ActivityLogView (joins profiles(name))
--   sales      dealer lists + stamp makers   fetchAgent2SubAgents(), DiscomSubmissionTab
--              (Office is not branch-scoped, so it needs a broad read)
--   CPO/office2  their own branch            UserManagementView
--              + stamp makers                DiscomSubmissionTab (they can send to stamp)
--   vendor / agent / agent2 / stamp   own row only
--
-- Note: agent2 (Dealer) no longer needs the sub-agent list - the Dealer field is
-- auto-assigned and hidden for them - so an empty result there is harmless.
-- ============================================================================

begin;

drop policy if exists "profiles_select_policy" on public.profiles;

create policy "profiles_select_scoped" on public.profiles
    for select to authenticated
    using (
        -- your own row, always
        id = auth.uid()

        -- Admin and Office need to see people to run the system
        or get_my_user_type() = any (array['admin', 'sales'])

        -- a Channel Partner Office / Manager sees their own branch
        or (
            get_my_user_type() = any (array['channel_partner_office', 'office2'])
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), '')))
        )

        -- ...and the stamp makers, so the "Send to which Stamp Maker" dropdown
        -- in Discom Submission can be populated
        or (
            get_my_user_type() = any (array['channel_partner_office', 'office2'])
            and user_type = 'stamp'
        )
    );

commit;


-- ── Verify (read only) ──────────────────────────────────────────────────────
select policyname, cmd, qual
from pg_policies
where schemaname = 'public' and tablename = 'profiles'
order by policyname;


-- ── ROLLBACK, if a portal breaks ────────────────────────────────────────────
-- drop policy if exists "profiles_select_scoped" on public.profiles;
-- create policy "profiles_select_policy" on public.profiles
--     for select to authenticated using (true);
