-- Vendor emails and shared dropdown lists: changes by Admin and Office only, 11 Nov 2026.
--
-- A Channel Partner Office or Manager could change ANY vendor's email (lead
-- emails then go to that address) and rename or delete any shared list entry,
-- including another partner's phone number shown to technicians. No partner
-- screen does this - only Admin's Operations screen - so this only closes the
-- way around the screens.
--
-- Unchanged: everyone can still read both; partners can still ADD list entries
-- (a new branch, module brand) as the screens do when saving users and leads;
-- a vendor can still update their own vendor row.
-- Safe to run more than once.
--
-- To undo: run the same four policies with 'channel_partner_office' and 'office2'
-- added back to each list of types.

drop policy if exists vendors_insert_scoped on public.vendors;
create policy vendors_insert_scoped on public.vendors for insert to authenticated
    with check ((select public.get_my_user_type()) in ('admin', 'sales'));

drop policy if exists vendors_update_scoped on public.vendors;
create policy vendors_update_scoped on public.vendors for update to authenticated
    using ((select public.get_my_user_type()) in ('admin', 'sales')
        or ((select public.get_my_user_type()) = 'vendor'
            and lower(trim(coalesce(name, ''))) = lower(trim(coalesce((select public.get_my_name()), '')))))
    with check ((select public.get_my_user_type()) in ('admin', 'sales')
        or ((select public.get_my_user_type()) = 'vendor'
            and lower(trim(coalesce(name, ''))) = lower(trim(coalesce((select public.get_my_name()), '')))));

drop policy if exists vendors_delete_scoped on public.vendors;
create policy vendors_delete_scoped on public.vendors for delete to authenticated
    using ((select public.get_my_user_type()) in ('admin', 'sales'));

drop policy if exists metadata_update_scoped on public.metadata;
create policy metadata_update_scoped on public.metadata for update to authenticated
    using ((select public.get_my_user_type()) in ('admin', 'sales'))
    with check ((select public.get_my_user_type()) in ('admin', 'sales'));

drop policy if exists metadata_delete_scoped on public.metadata;
create policy metadata_delete_scoped on public.metadata for delete to authenticated
    using ((select public.get_my_user_type()) in ('admin', 'sales'));

-- Check: no other policy still lets partners change these tables.
--   select tablename, policyname, cmd, roles from pg_policies
--   where tablename in ('vendors', 'metadata') order by 1, 3;
