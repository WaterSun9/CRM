# Release 2026-11-20 (late): OEM claims / Tata form, reading-photo fixes, tests

Branch `fix/tests-reading-photos` on top of live `main` fea38d3.
- OEM replacement claims (all OEMs) and the Tata Field Service Report easy fill: switched on (`OEM_CLAIMS = true`).
- Reading photos: a double tap no longer loses a photo quietly; a technician cannot delete a reading photo after the visit is closed (SQL).
- Tests: the 2 that always failed now pass (255 / 255).
- OEM past data stays off (D-050).

## Order
1. Read-only pre-check (changes nothing). Expect 0 rows, then null / 0:
   ```sql
   select distinct event from public.service_issue_events
   where event not in ('raised','assigned','claimed','visited','second_visit','code_sent','completed','cancelled','reopened','gave_up','returned','trip_started','reached','readings','fixed','revisit','inverter_added','inverter_replaced','oem_claim','oem_pdf_sent','oem_ticket','oem_part_received');
   select to_regclass('public.service_oem_claims') as claims_table,
          (select count(*) from pg_proc where proname in ('service_oem_ticket','service_oem_form','service_oem_claim_stamp')) as funcs;
   ```
2. SQL Editor: `supabase/migrations/20261116140000_oem_claims.sql`. Expect claims_table = 1, rls = true, events_ok = true, form_values = 1.
3. SQL Editor: `supabase/migrations/20261120180000_reading_photo_delete_closed.sql`. Expect closed_visit_rule = true.
4. Deploy the app (OEM claims must be live in the database first, step 2).

Do not run `20261116130000_oem_past_data.sql` yet.
