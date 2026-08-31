-- ============================================================================
-- admin_select / admin_update: tighten ONLY the `stamp` clause.
-- Audit #15 (stamp makers can read each other's customers) and #16 (the stamp
-- clause is the only one missing `deleted_at is null`).
--
-- Every other role's clause below is copied VERBATIM from the live policies.
-- The stamp branch gains two conditions:
--     AND deleted_at IS NULL
--     AND the record is assigned to THIS stamp maker
--
-- PREREQUISITE: the "records that would disappear" query must return 0 rows.
-- Yours returned one blank test record - recall or ignore it first.
--
-- NOTE ON `TO authenticated`: your remediation work revoked `anon` across all
-- tables, and the app only ever reads as an authenticated user, so this is
-- correct and marginally tighter. If your existing policies were TO PUBLIC and
-- you want that preserved, change both `to authenticated` to `to public`.
-- ============================================================================

begin;

-- ── SELECT ──────────────────────────────────────────────────────────────────
drop policy if exists "admin_select" on public.admin;

create policy "admin_select" on public.admin
    for select to authenticated
    using (
        (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text]))
        OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))
        OR ((get_my_user_type() = ANY (ARRAY['agent'::text, 'agent2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        OR ((get_my_user_type() = 'vendor'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(vendor, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text))))
            AND (deleted_at IS NULL))
        -- CHANGED: was `stamp AND sent_to_stamp_maker = true` only.
        OR ((get_my_user_type() = 'stamp'::text)
            AND (deleted_at IS NULL)
            AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text)
            -- must actually be assigned to somebody...
            AND (COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text) <> ''::text)
            -- ...and that somebody must be this stamp maker
            AND (lower(TRIM(BOTH FROM COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text)))
                 = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
    );

-- ── UPDATE ──────────────────────────────────────────────────────────────────
-- A stamp maker must still be able to write the stamp back on their OWN
-- assigned records, so the same clause applies here.
drop policy if exists "admin_update" on public.admin;

create policy "admin_update" on public.admin
    for update to authenticated
    using (
        (get_my_user_type() = ANY (ARRAY['admin'::text, 'sales'::text]))
        OR ((get_my_user_type() = ANY (ARRAY['channel_partner_office'::text, 'office2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_channel_partner(), ''::text)))))
        OR ((get_my_user_type() = ANY (ARRAY['agent'::text, 'agent2'::text]))
            AND (lower(TRIM(BOTH FROM COALESCE(sub_channel_partner, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        -- unchanged: the live UPDATE policy has no deleted_at here (SELECT does).
        -- Left as-is deliberately - adding it would change vendor behaviour and
        -- is a separate decision.
        OR ((get_my_user_type() = 'vendor'::text)
            AND (lower(TRIM(BOTH FROM COALESCE(vendor, ''::text))) = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
        OR ((get_my_user_type() = 'stamp'::text)
            AND (deleted_at IS NULL)
            AND ((discom_submission ->> 'sent_to_stamp_maker'::text) = 'true'::text)
            AND (COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text) <> ''::text)
            AND (lower(TRIM(BOTH FROM COALESCE(discom_submission ->> 'assigned_stamp_maker'::text, ''::text)))
                 = lower(TRIM(BOTH FROM COALESCE(get_my_name(), ''::text)))))
    );

commit;


-- ── Verify ──────────────────────────────────────────────────────────────────
select policyname, cmd, roles::text
from pg_policies
where schemaname = 'public' and tablename = 'admin'
order by policyname;

-- Then sign in as TWO different stamp accounts and confirm neither sees the
-- other's customers in the Pending Queue.
