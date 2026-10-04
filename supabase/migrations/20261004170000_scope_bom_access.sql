-- Scope the Bill of Materials to the customers each user can already see.
--
-- Before: bom and bom_items had "Allow all actions for authenticated users"
-- (USING true). Any logged-in account - vendor, dealer, agent, stamp - could
-- read, change or delete every customer's BOM directly through the API.
--
-- After:
--   read   - anyone who can see the customer (the customer table's own rules
--            decide that, so agents/dealers/vendors only see their customers).
--   change - admin, Office (sales), CPO and office2, for customers they can see.
--            These are the roles that edit Material Integration today.
-- save_bom_atomic runs as the caller, so it follows these rules too.
-- Safe to run more than once.

begin;

drop policy if exists "Allow all actions for authenticated users on bom" on public.bom;
drop policy if exists "Allow all actions for authenticated users on bom_items" on public.bom_items;

drop policy if exists bom_read on public.bom;
create policy bom_read on public.bom for select to authenticated
using (exists (select 1 from public.admin a where a.id = bom.admin_id));

drop policy if exists bom_write on public.bom;
create policy bom_write on public.bom for all to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.admin a where a.id = bom.admin_id)
)
with check (
    (select public.get_my_user_type()) in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.admin a where a.id = bom.admin_id)
);

drop policy if exists bom_items_read on public.bom_items;
create policy bom_items_read on public.bom_items for select to authenticated
using (exists (
    select 1 from public.bom b join public.admin a on a.id = b.admin_id
    where b.id = bom_items.bom_id
));

drop policy if exists bom_items_write on public.bom_items;
create policy bom_items_write on public.bom_items for all to authenticated
using (
    (select public.get_my_user_type()) in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.bom b join public.admin a on a.id = b.admin_id where b.id = bom_items.bom_id)
)
with check (
    (select public.get_my_user_type()) in ('admin', 'sales', 'channel_partner_office', 'office2')
    and exists (select 1 from public.bom b join public.admin a on a.id = b.admin_id where b.id = bom_items.bom_id)
);

commit;

-- Check: should list bom_read, bom_write, bom_items_read, bom_items_write
-- and no "Allow all actions" policies.
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('bom', 'bom_items') order by 1, 2;

-- Undo (only if something breaks): put the old open policies back.
-- create policy "Allow all actions for authenticated users on bom" on public.bom for all to authenticated using (true) with check (true);
-- create policy "Allow all actions for authenticated users on bom_items" on public.bom_items for all to authenticated using (true) with check (true);
