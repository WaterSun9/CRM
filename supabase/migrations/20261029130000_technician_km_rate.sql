-- Technicians can read the km settings (NOT YET RUN). Asked for by the owner on 29 Oct 2026:
-- when a trip ends, the technician's screen shows the km travelled, the grace km, round trip
-- or one way, the rate per km and the amount, using the settings admin sets in Operations.
--
--   * Read only: active technicians may read the one settings row. Changing it stays
--     admin / office (sales), unchanged.
--   * The amount on the technician's screen is an estimate; the office still saves the
--     visit payment and may change it.
--
-- Safe to run more than once.
set lock_timeout = '8s';
begin;

drop policy if exists service_km_settings_technician_read on public.service_km_settings;
create policy service_km_settings_technician_read on public.service_km_settings
for select to authenticated using (public.get_my_user_type() = 'technician');

commit;

-- Check (expect read_policies_2):
select count(*) as read_policies_2 from pg_policies
where schemaname = 'public' and tablename = 'service_km_settings' and cmd = 'SELECT';
