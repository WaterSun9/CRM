-- Allow technician accounts (NOT YET RUN - needs the owner's go-ahead).
-- Live profiles_user_type_check is missing 'technician', so the service module
-- cannot get any technicians. Same list as live plus 'technician'; 'dealer'
-- is kept so nothing that exists today is refused.
-- After running, also edit the same constraint in supabase/schema.sql.
set lock_timeout = '8s';
begin;

alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check check (user_type = any (array[
    'admin', 'sales', 'channel_partner_office', 'office2', 'agent2', 'agent',
    'vendor', 'stamp', 'channel_partner_office_manager', 'dealer', 'technician'
]::text[]));

commit;

-- Check (expect the list to include technician):
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_user_type_check';
