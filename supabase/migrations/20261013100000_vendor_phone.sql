-- Vendor WhatsApp number (NOT YET RUN - needs the owner's go-ahead).
--
--   * vendors.phone: the vendor's WhatsApp number, 10 digits (9876543210), or
--     empty. Office types it in Operations > Vendors Allotment, next to the email.
--   * When a lead is sent to a vendor, send-lead-to-vendor still sends the Brevo
--     email as before, and also sends the 'watersun_vendor_lead' WhatsApp to this
--     number (only once WA_ENABLED is 'true' and a number is saved).
--   * Nothing else changes: the vendors access rules stay as they are (every
--     signed-in user can read the directory, as with the email; office can edit;
--     a vendor can edit their own row).
--
-- Run it before the new send-lead-to-vendor and the new Operations screen go
-- live (both still work without it: the email is sent, the WhatsApp is skipped).
-- Safe to run more than once. After running, regenerate supabase/schema.sql.
set lock_timeout = '8s';
begin;

alter table public.vendors add column if not exists phone text;

-- Only a clean 10-digit Indian mobile, so the edge function never has to guess.
-- The app cleans "+91 98765-43210" to 9876543210 before saving.
alter table public.vendors drop constraint if exists vendors_phone_check;
alter table public.vendors add constraint vendors_phone_check
    check (phone is null or phone ~ '^[6-9][0-9]{9}$');

comment on column public.vendors.phone is
    'Vendor WhatsApp number, 10 digits. Gets the watersun_vendor_lead message with the Brevo email.';

commit;

-- Check (expect the phone column, the check constraint, and the same four
-- vendors_*_scoped policies as before):
-- select column_name, data_type, is_nullable from information_schema.columns
--  where table_schema = 'public' and table_name = 'vendors' order by ordinal_position;
-- select pg_get_constraintdef(oid) from pg_constraint where conname = 'vendors_phone_check';
-- select policyname, cmd from pg_policies where schemaname = 'public' and tablename = 'vendors' order by 1;
-- select name, phone from public.vendors order by name;
