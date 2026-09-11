-- REVIEW ONLY: not applied by Codex. Run in a staging database first.
-- Additive restriction for the quotations table supplied by the project owner.
-- Does not change public.admin, profiles, existing lead policies, or customer records.
-- Existing quotation policies still determine ownership; this policy adds a role gate.
begin;
drop policy if exists quotations_permitted_roles on public.quotations;
create policy quotations_permitted_roles
on public.quotations as restrictive for all to authenticated
using (
    exists (select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('agent', 'agent2', 'admin', 'sales')
          and coalesce(p.status, '') <> 'inactive')
)
with check (
    exists (select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.user_type in ('agent', 'agent2', 'admin', 'sales')
          and coalesce(p.status, '') <> 'inactive')
);
commit;
-- Rollback only this added restriction if staging reveals incompatibility:
-- drop policy quotations_permitted_roles on public.quotations;
