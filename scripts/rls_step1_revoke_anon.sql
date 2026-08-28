-- ─── RLS STEP 1 — revoke anonymous access ───────────────────────────────────
-- RLS is enabled on every table, but four tables carry policies granting the
-- `anon` role full access. The anon key is embedded in the shipped JS bundle,
-- so those tables are readable/writable by anyone who views source.
--
-- Postgres OR's permissive policies together: one `true` policy defeats every
-- scoped policy beside it. Removing the blanket ones is what makes the scoped
-- ones start working.
--
-- This step does NOT touch the `admin` table — that needs its scoped policies
-- rewritten first (they predate agent2 / office2). Step 1 is safe on its own.
-- Run each section, then the verification at the bottom.
-- ────────────────────────────────────────────────────────────────────────────

-- ── bom / bom_items ─────────────────────────────────────────────────────────
-- Safe: an authenticated-only ALL policy already exists on both, so dropping
-- the anon policy changes nothing for a logged-in user.
drop policy if exists "Allow anon and auth full access to bom"       on public.bom;
drop policy if exists "Allow anon and auth full access to bom_items" on public.bom_items;


-- ── documents ───────────────────────────────────────────────────────────────
-- The anon policy is the ONLY one covering UPDATE. Dropping it alone would
-- break document remarks (utils.jsx updateDocumentRemark), so add the
-- authenticated UPDATE policy first, then drop.
create policy "auth_update_documents" on public.documents
    for update to authenticated
    using (true) with check (true);

drop policy if exists "Allow all document operations" on public.documents;


-- ── verification ────────────────────────────────────────────────────────────
-- Expect: no rows mentioning anon/public for these three tables.
select tablename, policyname, cmd, roles
from pg_policies
where schemaname = 'public'
  and tablename in ('bom', 'bom_items', 'documents')
order by tablename, policyname;

-- Expect: documents has SELECT, INSERT, UPDATE and DELETE for authenticated.
select cmd, count(*) as policies
from pg_policies
where schemaname = 'public' and tablename = 'documents'
group by cmd order by cmd;
