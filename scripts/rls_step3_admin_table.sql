-- ─── RLS STEP 3 — scope the `admin` table (3,801 customer records) ──────────
-- Today `read_admin` and `update_admin` have qual = true, so ANY authenticated
-- user can read and modify every customer row by calling the API directly. The
-- correctly-scoped admin_select / admin_update policies sit beside them and are
-- therefore dead: Postgres OR's permissive policies together.
--
-- The existing scoped policies are also stale — they predate agent2, office2
-- and stamp, and they match `agent` on channel_partner = name, which is wrong
-- (an agent's channel_partner is their BRANCH). So the scoped policies are
-- rewritten first, then the blanket ones dropped, in one transaction.
--
-- ⚠ HIGHEST-RISK STEP SO FAR. Run it, then test every role before walking away.
--   Rollback is at the bottom.
-- ────────────────────────────────────────────────────────────────────────────

begin;

-- ── SELECT ──────────────────────────────────────────────────────────────────
drop policy if exists admin_select on public.admin;
create policy admin_select on public.admin
    for select to authenticated
    using (
        -- Head office sees everything
        get_my_user_type() in ('admin', 'sales')

        -- CPO and Manager: their branch
        or (get_my_user_type() in ('channel_partner_office', 'office2')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))

        -- Agent and Sub-Agent: leads filed under their own name
        or (get_my_user_type() in ('agent', 'agent2')
            and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), ''))))

        -- Vendor: jobs assigned to them
        or (get_my_user_type() = 'vendor'
            and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), '')))
            and deleted_at is null)

        -- Stamp maker: only records sent to stamp
        or (get_my_user_type() = 'stamp'
            and (discom_submission ->> 'sent_to_stamp_maker') = 'true')
    );

-- ── UPDATE ──────────────────────────────────────────────────────────────────
drop policy if exists admin_update on public.admin;
create policy admin_update on public.admin
    for update to authenticated
    using (
        get_my_user_type() in ('admin', 'sales')
        or (get_my_user_type() in ('channel_partner_office', 'office2')
            and lower(trim(coalesce(channel_partner, ''))) = lower(trim(coalesce(get_my_channel_partner(), ''))))
        or (get_my_user_type() in ('agent', 'agent2')
            and lower(trim(coalesce(sub_channel_partner, ''))) = lower(trim(coalesce(get_my_name(), ''))))
        or (get_my_user_type() = 'vendor'
            and lower(trim(coalesce(vendor, ''))) = lower(trim(coalesce(get_my_name(), ''))))
        or (get_my_user_type() = 'stamp'
            and (discom_submission ->> 'sent_to_stamp_maker') = 'true')
    );

-- ── INSERT ──────────────────────────────────────────────────────────────────
-- Adds agent2 and office2, who can both create leads in the current app.
drop policy if exists admin_insert on public.admin;
create policy admin_insert on public.admin
    for insert to authenticated
    with check (
        get_my_user_type() in
            ('admin', 'sales', 'agent', 'agent2', 'channel_partner_office', 'office2')
    );

-- ── Drop the blanket policies that were defeating all of the above ──────────
drop policy if exists read_admin        on public.admin;
drop policy if exists update_admin      on public.admin;
drop policy if exists insert_admin      on public.admin;
drop policy if exists auth_select_admin on public.admin;
drop policy if exists auth_update_admin on public.admin;
drop policy if exists auth_insert_admin on public.admin;
-- DELETE is already Admin-only (admin_delete_admin + no_delete_admin) — left alone.

commit;


-- ── verification ────────────────────────────────────────────────────────────
select policyname, cmd, roles
from pg_policies
where schemaname = 'public' and tablename = 'admin'
order by cmd, policyname;
-- Expect exactly: admin_delete_admin, no_delete_admin (DELETE),
--                 admin_insert (INSERT), admin_select (SELECT), admin_update (UPDATE)


-- ── ROLLBACK, if any role loses access ──────────────────────────────────────
-- Restores the previous permissive behaviour immediately. Only a stopgap —
-- it re-opens the whole table to every authenticated user.
--
-- create policy read_admin   on public.admin for select to authenticated using (true);
-- create policy update_admin on public.admin for update to authenticated using (true);
-- create policy insert_admin on public.admin for insert to authenticated with check (true);
