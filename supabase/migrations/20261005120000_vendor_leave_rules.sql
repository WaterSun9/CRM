-- Vendor availability calendar rules (client request, 5 Oct 2026):
--   1. Vendors book unavailable dates at least 2 days ahead (today and
--      tomorrow, India time, are closed).
--   2. Once saved, a vendor cannot remove an entry. Admin and Office can.
--   3. Clean up repeats: an entry whose dates sit entirely inside another
--      entry of the same vendor is deleted (that is what showed one vendor
--      three times on the same day). No dates are lost.
-- Safe to run more than once.

begin;

drop policy if exists crm_availability_create on public.crm_availability;
create policy crm_availability_create on public.crm_availability
for insert to authenticated
with check (
    user_id = (select auth.uid())
    and reviewed_at is null
    and reviewed_by is null
    and public.get_my_user_type() = 'vendor'
    and entry_kind = 'vendor_unavailable'
    and status = 'approved'
    and start_date >= ((now() at time zone 'Asia/Kolkata')::date + 2)
);

drop policy if exists crm_availability_remove on public.crm_availability;
drop policy if exists crm_availability_office_remove on public.crm_availability;
create policy crm_availability_office_remove on public.crm_availability
for delete to authenticated
using (
    public.get_my_user_type() in ('admin', 'sales')
    and entry_kind = 'vendor_unavailable'
);
grant delete on public.crm_availability to authenticated;

-- Repeats: delete entries fully covered by a different, wider entry of the
-- same vendor. (Exact repeats are already impossible: unique constraint.)
delete from public.crm_availability inner_entry
using public.crm_availability outer_entry
where inner_entry.user_id = outer_entry.user_id
  and inner_entry.entry_kind = outer_entry.entry_kind
  and inner_entry.id <> outer_entry.id
  and outer_entry.start_date <= inner_entry.start_date
  and outer_entry.end_date >= inner_entry.end_date
  and (outer_entry.end_date - outer_entry.start_date) > (inner_entry.end_date - inner_entry.start_date);

commit;

-- Check: policies should be crm_availability_read, crm_availability_create,
-- crm_availability_office_remove.
select policyname, cmd from pg_policies where tablename = 'crm_availability' order by 1;
