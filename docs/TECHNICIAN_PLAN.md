# Technician role, WhatsApp completion code, warranty - plan

Written 12 Oct 2026. Builds on the switched-off module (`TECHNICIAN_FEATURE_ENABLED = false`, `ServiceIssuesView.jsx`, `service_issues` / `service_visits` / `service_issue_files`). Client setup steps for Meta: https://claude.ai/artifact/STupMdXguCBz1LmqfdYthW

## Decisions so far

| Topic | Decision |
|---|---|
| Km pay | **Estimated from two points** (the client asked for "two pincodes + 5 km grace", 12 Oct). Start = phone location when the technician taps **Start trip**, or the pincode they type if location fails. End = the customer's saved location if there is one, else the exact **Reached site** location if tapped, else the customer's pincode. Km = straight line x 1.3 road x 2 (there and back) + 5 km grace, rounded up. The office sees the working on "Record a visit payment", can change the km with a note, and still types the amount. Not proof of the route: a browser cannot track a phone in the background, and fake-GPS apps exist. A "pro" mode with Google road km is built but off (see "Simple vs Pro km"). |
| Out-of-warranty complaints | Allowed, tagged **"Out of warranty"**. Customer also listed on a separate Expired Warranty page. |
| Warranty start | **Commissioning date, read from `installation_date`** (decided 12 Oct). Falls back to `material_delivery_date`, then `completed_at` (IST date). End = start + 5 years - 1 day. Matches agreement clause 18. |
| WhatsApp number | **92744 04398** (not on WhatsApp). An agency manages Watersun's Facebook; the setup page is written for them too. |
| WhatsApp | Direct Meta Cloud API, no BSP. Watersun (client) already has Facebook: use their existing business portfolio, check it matches the GST certificate, and check whether it is already Verified (if so, the code template should not be held back). They invite the developer with Full control. |
| Phones | All Android. |

## Dates on a customer (`admin` table)

| Field | What it is | Catch |
|---|---|---|
| `created_at` | Lead created | - |
| `registration_date` | PM Surya Ghar portal registration | - |
| `loan_registration_date` | Loan application | Loan customers only |
| `discom_submission.date` (JSON) | DISCOM file submitted | - |
| `stages_remarks.discom_agreement_date` (JSON) | DISCOM agreement executed | - |
| `bom.paper_prepared_date`, `bom.material_loaded_date` | BOM paperwork / truck loaded | Separate `bom` table |
| `material_delivery_date` | Material delivered. Invoice No. is typed on the same tab, so this is the nearest thing to an invoice date | Cleared when a customer is removed from a delivery batch (`DeliveryBatchesView.jsx:412,466,1055`) |
| `installation_date` | Installation date | The Meter Installation tab edits the **same column** as "Meter Installation Date" (`MeterInstallationTab.jsx:82-115`), so for some customers it is the meter date |
| `vendor_paid_date` | Vendor paid | - |
| `completed_at` | Moved to Completed | Cleared if moved out of Completed, reset on re-entry (`set_completed_at`) |
| `hold_procurement.hold_date` | Put on hold / lost | - |

There is no invoice date and no separate commissioning date. **The customer agreement says the warranty is "5 years from the date of commissioning"** (`agreement/Page4.jsx`, clause 18). An invoice-date warranty ends earlier than the contract promises.

**Recommendation:** add a stored, admin-locked `warranty_start_date` (+ `warranty_start_source`). Back-fill from whichever source the client picks (invoice -> `material_delivery_date`; commissioning -> `installation_date`), fall back to the other, then `completed_at`. End date = start + 5 years - 1 day. Run the pre-check below first; PM Surya Ghar began in 2024, so the Expired page will probably be empty until 2029.

## Status (built 12 Oct, not deployed)

| Item | State |
|---|---|
| Technician role, claim / give up, office assign | Built. Needs the SQL below. |
| "Raise complaint" on every completed customer, warranty badge, "Out of warranty" tag | Built |
| Warranty Expired page (sidebar) | Built. Also lists "Date missing" customers. |
| Km estimate: technician **Start trip** / **Reached site**, office form pre-fills km | Built 12 Oct. Needs `20261013110000_service_trips.sql` and https. |
| "Reached site" reminder before the code; customer's saved location (office pastes a Google Maps link, or the first good "Reached site") | Built 13 Oct. Needs `20261013120000_customer_sites.sql`; until then the location box stays hidden and km works as before. |
| Google road km ("pro" km, `trip-distance`) | Built 13 Oct, **off** (`TRIP_DISTANCE_MODE = 'simple'`). Steps: `docs/GOOGLE_ROUTES_SETUP.md`. |
| Completion code (`service-otp`) + office "Completed without code" | Built. Off until `WA_ENABLED=true`. |
| WhatsApp log, delivery ticks, customer replies (`whatsapp-webhook`) | Built 12 Oct. Office sees them under "WhatsApp" on a complaint. |
| Vendor gets a WhatsApp with the lead email | Built 12 Oct. Admin adds the number in Operations > Vendors Allotment. |
| Quotation PDF on WhatsApp (Quotation Maker "WhatsApp" button) | Built 12 Oct. Counts as issuing the quotation, like Download. Hidden until WhatsApp is live (`WHATSAPP_QUOTATION_ENABLED = false`). |
| WhatsApp to real customers | Waiting on Meta (agency: verification + invite; Ravi: card + number code). Developer steps: `docs/WHATSAPP_DEV_SETUP.md`. Texts for the owner: `docs/WHATSAPP_TEMPLATES_FOR_APPROVAL.md`. |

## WhatsApp (Meta Cloud API, no BSP)

- **Cost:** Rs 0.115 + GST per delivered utility/authentication message (Meta INR rate card, effective 1 Oct 2026). About Rs 15 a month at 100 messages. Undelivered messages are not billed.
- **Must be created under Watersun's portfolio.** A WhatsApp account can never move between portfolios. An app under the developer's own portfolio becomes a Tech Provider app that needs App Review.
- **Developer steps:**
  1. Accept the invite, then create the app ("Connect with customers through WhatsApp") under Watersun's portfolio.
  2. Create a System user (Admin) and a never-expiring token with `whatsapp_business_messaging` + `whatsapp_business_management`. Store it in Supabase secrets only.
  3. Test on Meta's free test number (up to 5 registered recipients, no card).
  4. Add the real number. Verify it while the client reads the code. Accept the Cloud API terms. Then `POST /{PHONE_NUMBER_ID}/register` with a 6-digit PIN (max 10 register calls per 72 h).
  5. WABA currency **INR** (non-INR Indian accounts stop delivering on 1 Jan 2027).
  6. Submit the templates. Switch the app to Live (needs a privacy-policy URL).
- **Templates:**
  - `watersun_service_code`: AUTHENTICATION, copy-code button, 10-min expiry, security line off. Meta fixes the wording: "**482913** is your verification code."
  - `service_completed_confirm`: UTILITY. "Hello {{1}}, technician {{2}} has completed the work on your Watersun Solar service request no. {{3}} today. Warranty status: {{4}}. Please confirm if the problem is solved." Quick replies: Yes, solved / Not solved. Keep it free of offers, or Meta re-classes it as marketing (Rs 0.86).
  - Never put the code in a utility template; Meta rejects or re-classes it.
- **Not on WhatsApp:** Meta returns error 131026. The number is saved in `whatsapp_contacts`; after that `service-otp` does not try again and tells the technician to ask the office to close the job. A message from that number clears the flag.
- **Security:** `supabase/functions/phone-otp` only checks that someone is signed in, not their role. Any vendor or dealer login could send Message Central SMS to any number. Unset `MC_CUSTOMER_ID` / `MC_PASSWORD` or delete the function.

## Completion flow

`open` -> `assigned` (tech claims, or office assigns) -> `completion_pending` (tech taps "Work done - send code") -> `completed` (code verified, method `otp`).

- Office override: **Completed without code**, admin/office only, with a reason (no WhatsApp / confirmed by call / no network / WhatsApp not live yet / other). Sets `completion_method = 'office_override'`.
- Code rules: 6 digits made on the server, only a hash stored, 10-min expiry, 5 wrong tries then locked, resend after 45 s, at most 3 per hour.
- Technicians see phone/address only after claiming (as today).

## As built

- `supabase/migrations/20261012190000_service_jobs_v2.sql`. One file, which also adds the technician role, so `20261004120000_allow_technician_role.sql` is not needed.
  - `service_issues` gains:
    - `customer_id` and `ticket_no` (from 1001, never typed);
    - `otp_phone` (from the customer card, never typed);
    - `warranty_start` / `warranty_end` / `warranty_status`;
    - `completion_requested_at`, `completed_at`, `completed_by`, `completion_method` (`otp` | `office_override`), `override_reason`, `cancel_reason`.
  - Statuses: `open`, `assigned`, `completion_pending`, `completed`, `cancelled`.
  - The insert trigger fills a complaint from the customer card. It refuses customers that are not Completed, and refuses a second open complaint ("Complaint #n is already open").
  - The guard trigger stops technicians closing jobs, and stops office faking `otp` or editing `otp_phone` / warranty.
  - `service_completion_otps` keeps hashes only. Admin can read the send log, but not the salt or hash.
  - Tested on real Postgres 17: 264 attack cases. SQL warranty dates match `src/utils/warranty.js`.
- `supabase/functions/service-otp/`: `send` / `verify`.
  - Secrets: `WA_ENABLED`, `WA_TOKEN`, `WA_PHONE_NUMBER_ID`, plus optional `WA_GRAPH_VERSION`, `WA_OTP_TEMPLATE`, `WA_DONE_TEMPLATE`, `WA_TEMPLATE_LANG` and `WA_TEST_TO`. Header comment has the details.
  - Delete `WA_TEST_TO` before going live.
- `supabase/migrations/20261013090000_whatsapp_log.sql`:
  - `whatsapp_messages`: every template sent. The row is written before Meta is called, then `sent` / `failed`, then `delivered` / `read` from the webhook. Template values (code, names) are never stored.
  - `whatsapp_inbound`: customer replies, linked to the complaint or quotation. `whatsapp_contacts`: numbers not on WhatsApp, last auto-reply.
  - Only the edge functions write. Admin and office read everything; anyone else reads only the messages they sent.
- `supabase/migrations/20261013100000_vendor_phone.sql`: `vendors.phone` (10 digits, or empty).
- `supabase/migrations/20261013110000_service_trips.sql`:
  - `service_trips`: start point (phone location or typed pincode) and an optional "Reached site" point. Written only through `service_start_trip` / `service_mark_reached`: own assigned job, at most 6 trips per job per day, "Reached site" once and within 12 h.
  - `service_visits` gains `trip_id`, `km_estimate`, `km_note`. A km different from the estimate needs a note (the database checks it too). One visit per trip.
- `supabase/functions/_shared/whatsapp.ts`: one sender for all functions (log row, test number, plain error wording).
- `supabase/functions/whatsapp-webhook/`: delivery ticks and replies from Meta, signature checked. Deployed with `--no-verify-jwt`. Secrets `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, optional `WA_AUTO_REPLY_TEXT`. A "Not solved" tap is saved on the complaint and highlighted for the office; it does not reopen the job.
- `supabase/functions/send-lead-to-vendor/`: same email as before, plus `watersun_vendor_lead` when the vendor has a number (at most 2 per customer + vendor per hour).
- `supabase/functions/whatsapp-send-quotation/`: the quotation PDF with `watersun_quotation` (at most 3 per quotation per hour, 60 s between two sends of one quotation, and per person 10 per hour and 30 in the last 24 hours). Optional secret `WA_QUOTATION_TEMPLATE`. The button stays hidden until `WHATSAPP_QUOTATION_ENABLED = true` in `src/quotations/whatsapp.js` (after `WA_ENABLED=true`).
- Templates: `supabase/whatsapp/templates.json`, created on Meta by `scripts/whatsapp_templates.mjs`.
- `supabase/migrations/20261013120000_customer_sites.sql`:
  - `customer_sites`: one saved map point per customer. Office (admin / sales) sets or clears it only through `set_customer_site` / `clear_customer_site`. `service_mark_reached` is replaced (same answers) so the first "Reached site" with accuracy 100 m or better saves it, unless it is within 500 m of a phone-location start (a mis-tap right after Start trip); it never overwrites a saved point. Read by whoever can read the customer card, and by the technician while that customer's complaint is assigned to them.
  - `service_visits` gains `km_source` (`estimate` | `google` | `manual`) and `route_km` (Google one-way km). Filled only in "pro" mode; empty for "simple" visits.
  - `trip_distance_lookups`: one row per Google lookup, for the daily limits. Admin reads it.
  - If `20261013110000` is ever run again, run this file again after it.
- `supabase/functions/trip-distance/`: Google Routes road km for "pro" mode (admin / sales only; 200 lookups per person and 1000 in total per India day). Secret `GOOGLE_MAPS_API_KEY`; without it the answer is "not set up" and the app uses the estimate.
- Km estimate: `src/utils/tripKm.js` + `tests/tripKm.test.mjs`.
  - Example of the working the office sees: "Start 385340 (phone location) to customer 385350: 18.2 km x 1.3 road x 2 + 5 km grace = 53 km".
  - The rule is in `src/constants.js` (`TRIP_ROAD_FACTOR`, `TRIP_ROUND_TRIP`, `TRIP_GRACE_KM`). Round trip can be switched off later if technicians go site to site.
  - Pincode points: `src/data/gujaratPincodes.json`, 988 Gujarat pincodes from India Post's "All India Pincode Directory" (data.gov.in, GODL licence), rebuilt by `scripts/build_gujarat_pincodes.mjs`. 22 pincodes with wrong coordinates were left out (e.g. Shankheshwar 384246). For those the office types the km.
- UI:
  - `src/components/service/` (form, technician panel, office panel, `TripPanel.jsx`, `VisitForm.jsx`, `WhatsAppLog.jsx`, `CustomerPin.jsx` + `customerSite.js` for the saved location, `roadKm.js` for "pro" km);
  - `src/utils/mapLink.js` + `tests/mapLink.test.mjs`: reads a pasted Google Maps link or coordinates (short `maps.app.goo.gl` links cannot be read: the office opens them and copies the numbers);
  - `ServiceIssuesView.jsx`, `WarrantyBadge.jsx`, `WarrantyExpiredView.jsx`;
  - `src/utils/warranty.js` + `tests/warranty.test.mjs`;
  - Quotation Maker "WhatsApp" button (`src/quotations/whatsapp.js`; `WHATSAPP_QUOTATION_ENABLED = false` hides it until WhatsApp is live);
  - vendor WhatsApp number in Operations > Vendors Allotment (admin only).
  - `TECHNICIAN_FEATURE_ENABLED = true`.

## Deploy in this order

The new screens fail against the old database, so the SQL comes first.

1. Supabase SQL editor: run these in order, each followed by its "Check" queries. Skip any file that already ran.
   1. `20261012190000_service_jobs_v2.sql`
   2. `20261013090000_whatsapp_log.sql` (before any function below: a WhatsApp with no log row is never sent)
   3. `20261013100000_vendor_phone.sql`
   4. `20261013110000_service_trips.sql`
   5. `20261013120000_customer_sites.sql` (saved customer location, km source columns, Google lookup log). Safe while `TRIP_DISTANCE_MODE` is `'simple'`. If file 4 is ever run again, run this one again after it.
2. Deploy the functions. No new secrets needed yet (WhatsApp stays off; the vendor email keeps working; `trip-distance` answers "not set up" without `GOOGLE_MAPS_API_KEY`, and the app does not call it while `TRIP_DISTANCE_MODE` is `'simple'`):

   ```bash
   supabase functions deploy service-otp
   supabase functions deploy send-lead-to-vendor
   supabase functions deploy whatsapp-send-quotation
   supabase functions deploy whatsapp-webhook --no-verify-jwt
   supabase functions deploy trip-distance
   ```

3. GitHub Pages > Settings > Pages: tick **Enforce HTTPS**. `service-otp` refuses `http://` pages, and phone location only works on https.
4. `npm run deploy`.
5. User Management: create a technician. Test: raise a complaint, technician claims, taps **Start trip** (allow location), then **Reached site**; office opens the complaint, sees "Customer location saved (from technician, ...)" when the phone fix was good, opens "Record a visit payment" and sees the estimated km, then "Completed without code".
6. Regenerate `supabase/schema.sql`.
7. Separately: `supabase secrets unset MC_CUSTOMER_ID MC_PASSWORD`. The old `phone-otp` lets any login send SMS.
8. When Meta is ready: `docs/WHATSAPP_DEV_SETUP.md` (secrets, webhook, templates, test number, then the real number). Then set `WHATSAPP_QUOTATION_ENABLED = true` and deploy the app again.
9. Only when the developer has tested it and the client has its own Google key: "pro" km, `docs/GOOGLE_ROUTES_SETUP.md`.

## Simple vs Pro km

The developer picks one with `TRIP_DISTANCE_MODE` in `src/constants.js`.

- **Simple** (`'simple'`, the default and what the live CRM uses): straight line between the two points x 1.3 road x 2 + 5 km grace. No Google, no key, no cost. The app never calls `trip-distance`.
- **Pro** (`'pro'`): the same two points sent to Google Routes through `trip-distance` (two-wheeler by default, `TRIP_TRAVEL_MODE`; by car when Google has no two-wheeler route). Km = road km x 2 + 5 km grace, rounded up, e.g. "Road distance (Google, two-wheeler): 23.4 km x 2 + 5 km grace = 52 km". If Google is not set up, fails or hits a limit, the form shows "Road distance not available, using the estimate" and uses the simple km. Needs `20261013120000_customer_sites.sql`, `trip-distance` deployed, and `GOOGLE_MAPS_API_KEY`.
- Both modes: the customer end is the saved customer location, else "Reached site", else the customer's pincode. The office can always change the km with a note. Pro visits store `km_source` and `route_km`; simple visits leave them empty.
- To go back from Pro: set `'simple'` and deploy the app, or at once `supabase secrets unset GOOGLE_MAPS_API_KEY` (the app then uses the estimate).

## This week

| Day | Work |
|---|---|
| Tue | Done 12 Oct: webhook (delivery status, 131026, replies saved, one auto-reply), vendor and quotation WhatsApp, km estimate. Still open: should "Not solved" reopen the job? Today it is only shown to the office. Turn on `WA_ENABLED` when Meta approves. |
| Wed | Stored `warranty_start_date` + admin edit. Completed list filter (In warranty / Expired / Date missing). |
| Thu | Technician payout Excel (on `buildMultiSheetWorkbook`). Optional odometer photos on the visit. |
| Fri | Role tests (wrong roles refused), docs, regenerate `schema.sql`. |

**Later, only if km disputes start:** wrap the CRM as an Android APK (Capacitor + background-geolocation plugin). That gives the real route driven and mock-GPS detection. 2-5 days, no Play Store needed. A website can't do this: browsers stop location updates when the page is in the background.
