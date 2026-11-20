-- Release 20 Nov 2026: read-only checks. Run BEFORE any of the 3 files. Changes nothing.
-- Expect: query 1 = 0 rows, query 2 = 0 rows, query 3 = all null / 0.

-- 1. Photo kinds outside the new list
select distinct kind from public.service_issue_files
where kind not in ('problem','before','after','site','reading');

-- 2. Complaint history events outside the new list
select distinct event from public.service_issue_events
where event not in ('raised','assigned','claimed','visited','second_visit','code_sent','completed','cancelled','reopened','gave_up','returned','trip_started','reached','readings','fixed','revisit','inverter_added','inverter_replaced','oem_claim','oem_pdf_sent','oem_ticket','oem_part_received');

-- 3. Nothing from these files is live already
select to_regclass('public.oem_past_records') as oem_past_records,
       to_regclass('public.oem_past_finish') as oem_past_finish,
       to_regclass('public.service_oem_claims') as service_oem_claims,
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='service_issue_files' and column_name='trip_id') as trip_col,
       (select count(*) from pg_proc
         where proname in ('service_customer_oem_past','service_oem_ticket','service_oem_form','oem_past_stamp','service_oem_claim_stamp')) as funcs;
