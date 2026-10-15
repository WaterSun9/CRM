# Parked work (12–13 Oct): warranty, service, WhatsApp

Written 15 Oct 2026. This work is **not live**. It is saved on the git branch
`warranty-pending-15oct` (commit babcb49), not in `main`, so deploying `main`
ships only the 15 Oct changes.

## What is parked

- **Warranty**: 5-year warranty badge on completed customers, Warranty Expired page
  (`WarrantyBadge.jsx`, `WarrantyExpiredView.jsx`, `utils/warranty.js`).
- **Service / complaints**: complaints from completed customers, service jobs and trips,
  completion code (`ServiceIssuesView.jsx`, `components/service/`, `utils/tripKm.js`,
  `utils/mapLink.js`, functions `service-otp`, `trip-distance`).
- **WhatsApp (Meta API)**: send quotation PDF straight to the customer's number,
  delivery ticks, replies (`quotations/whatsapp.js`, functions `whatsapp-send-quotation`,
  `whatsapp-webhook`, `_shared/`, `supabase/whatsapp/`, `scripts/whatsapp_templates.mjs`).
  Off until Meta setup is done – see `docs/WHATSAPP_DEV_SETUP.md` on that branch.
- **Vendor notification**: WhatsApp to the vendor with the lead email
  (`utils/vendorNotification.js`, function `send-lead-to-vendor`).
- **Other edits**: `App.jsx`, `Dashboard.jsx`, `AgentPortal.jsx`, `CustomerCard.jsx`,
  `ChannelPartnerManagementView.jsx`, `InstallationView.jsx`, `constants.js`, `src/data/`,
  Gujarat pincodes script, customer card warranty badge + "Raise complaint" button.
- **Database migrations** (not yet run): `20261012190000_service_jobs_v2`,
  `20261013090000_whatsapp_log`, `20261013100000_vendor_phone`,
  `20261013110000_service_trips`, `20261013120000_customer_sites`.
- **Docs/tests**: README, BACKLOG, OCTOBER, GOOGLE_ROUTES_SETUP, TECHNICIAN_PLAN,
  WHATSAPP_* docs; tests for mapLink, tripKm, warranty, quotations/whatsapp.

The branch also contains the 15 Oct changes, so it is the complete latest code.

## How to look at it

    git checkout warranty-pending-15oct   # see / run the parked code
    git checkout main                     # back to what is live

## How to make it live later

    git checkout main
    git merge warranty-pending-15oct

Then run the five migrations above in Supabase, deploy the edge functions,
and `npm run deploy`. The quotation WhatsApp screen will need a small tidy-up
on merge (main has the phone-share popup, the branch also has the Meta API button).
