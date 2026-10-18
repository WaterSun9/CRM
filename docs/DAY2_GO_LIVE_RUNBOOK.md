# Day 2: warranty / technician go-live (developer runbook, 18 Oct 2026)

Branch: `warranty-merge-18oct`. Supabase project: the live one (there is no staging).
Run every SQL step in **Supabase Dashboard > SQL Editor**, one file per new query tab.
Each migration file has its own `begin; ... commit;`, so a failure rolls that file back.
If a file fails, stop and send me the error. Don't run the next one.

## 0. Before you start

1. Take a backup: `python3 scripts/backup/export_tables.py` (same as usual).
2. Pre-checks. Paste these into the SQL Editor and run them:

```sql
-- a) 15 Oct and 17 Oct migrations are live (expect 2 rows: delivery_partial, loaded_at)
select table_name, column_name from information_schema.columns
 where table_schema = 'public'
   and ((table_name = 'admin' and column_name = 'delivery_partial')
     or (table_name = 'delivery_batches' and column_name = 'loaded_at'));

-- b) service tables exist and are empty (expect 0, 0, 0)
select (select count(*) from public.service_issues) as issues,
       (select count(*) from public.service_visits) as visits,
       (select count(*) from public.service_issue_files) as files;

-- c) technician not allowed yet (expect a list WITHOUT 'technician')
select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_user_type_check';
```

If (a) returns fewer than 2 rows, tell me first: a 15 or 17 Oct migration was never run.

## 1. The five migrations, in this order

Open each file from `supabase/migrations/`, paste the whole file and run it. Then run the check below it.

### 1.1 `20261012190000_service_jobs_v2.sql`: complaints, completion codes, warranty, technician role
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'profiles_user_type_check';  -- now includes 'technician'
select tgname from pg_trigger where tgrelid = 'public.service_issues'::regclass and not tgisinternal order by 1;  -- 3 triggers
select column_name from information_schema.columns
 where table_name = 'service_completion_otps' and column_name in ('provider', 'mc_verification_id');  -- 2 rows
```

### 1.2 `20261013090000_whatsapp_log.sql`: message log (used by vendor WhatsApp later)
```sql
select relname, relrowsecurity from pg_class
 where oid in ('public.whatsapp_messages'::regclass, 'public.whatsapp_inbound'::regclass, 'public.whatsapp_contacts'::regclass);  -- 3 rows, all true
select table_name, grantee, string_agg(privilege_type, ', ') from information_schema.role_table_grants
 where table_name like 'whatsapp\_%' and grantee in ('anon', 'authenticated') group by 1, 2;  -- at most SELECT, nothing else
```

### 1.3 `20261013100000_vendor_phone.sql`: vendors.phone
```sql
select pg_get_constraintdef(oid) from pg_constraint where conname = 'vendors_phone_check';  -- 1 row
select policyname, cmd from pg_policies where tablename = 'vendors' order by 1;  -- same 4 vendors_*_scoped policies
```

### 1.4 `20261013110000_service_trips.sql`: trips and km
```sql
select relrowsecurity from pg_class where oid = 'public.service_trips'::regclass;  -- true
select proname from pg_proc where proname in ('service_start_trip', 'service_mark_reached');  -- 2 rows
select column_name from information_schema.columns
 where table_name = 'service_visits' and column_name in ('trip_id', 'km_estimate', 'km_note');  -- 3 rows
```

### 1.5 `20261013120000_customer_sites.sql`: saved customer location (must run after 1.4)
```sql
select relname, relrowsecurity from pg_class
 where oid in ('public.customer_sites'::regclass, 'public.trip_distance_lookups'::regclass);  -- 2 rows, true
select column_name from information_schema.columns
 where table_name = 'service_visits' and column_name in ('km_source', 'route_km');  -- 2 rows
```

When all five are done, tell me. I'll check them from here, regenerate `supabase/schema.sql`, and deploy the functions.

## 2. Secrets (Dashboard > Edge Functions > Secrets, set them yourself, not in chat)

- `OTP_TEST_TO`: your own 10-digit mobile. While it is set, every completion code goes to you, not the customer.
- `OTP_CHANNEL`: leave it unset (it defaults to SMS).
- `MC_CUSTOMER_ID` and `MC_PASSWORD` are already set.

## 3. Functions (I deploy these)

- `service-otp`, `phone-otp` and `send-lead-to-vendor`. The last one still only emails, because `WA_ENABLED` is not set.
- Not deployed yet: `whatsapp-webhook`, `whatsapp-send-quotation` and `trip-distance`. They wait for Meta setup or Google "pro" km.

## 4. End-to-end test (local app on your Mac, against the live database)

The live site still runs `main`. You test the new screens with `npm run dev`, which uses the same database.

1. **Make a technician.** Sign in as Admin, open Users, Add user, and choose role **Technician**. Use a test email you own.
2. **Raise a complaint.** As Admin, open a Completed customer whose mobile number is correct.
   - Check the warranty badge in the header: "In warranty until …" or "Out of warranty".
   - Press **Raise complaint**, fill in the issue and save. It gets a ticket number.
3. **Claim it.** In a private window, sign in as the technician. Open **Open jobs** and press **Claim this job**.
4. **Trip.** Press **Start trip**: allow location, or type a pincode. Then press **Reached site**.
5. **Code.** Press **Work done - send code to customer**.
   - The screen should say "Code sent by SMS to ******1234".
   - The SMS reaches YOUR phone, because `OTP_TEST_TO` is set.
6. **Wrong code.** Type a wrong code. It should say "Wrong code… try again".
7. **Right code.** Type the right code. The job should move to Completed.
8. **Office.** Back as Admin, open the complaint.
   - It shows "Closed with the customer's code".
   - Add the visit. The km comes pre-filled from the trip. Change it, and a note should be required.
9. **Office override.** Raise a second complaint and close it with **Completed without code** and a reason.
10. **Expired page.** Open the Warranty Expired page. It should list only customers past 5 years.
11. **Lockout check.** Sign in as a channel partner and run this in the browser console:
    `await supabase.functions.invoke('phone-otp', {body:{action:'send', phone:'9999999999'}})`.
    It should return 403.
12. **Clean up.** Cancel the test complaints, and set the test technician to Inactive if you don't want them yet.

## 5. Going live after the test passes

1. Delete `OTP_TEST_TO`.
2. Merge `warranty-merge-18oct` into `main` and push. GitHub Actions deploys the site.
3. Check that "Enforce HTTPS" is on in GitHub Pages settings. Phone location needs HTTPS.
