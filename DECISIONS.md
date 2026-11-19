# Decision Log

Every choice Mahvish made between options, numbered and dated. Newest entries go at the **bottom**. Don't undo or re-ask a decision here unless Mahvish brings it up. If a decision is replaced, add a new entry and mark the old one **Superseded by D-0XX**.

D-001 to D-035 were reconstructed on 2026-11-16 from past Claude Code chats (their saved memory notes and the questions Mahvish answered), the git history, `README.md` and `docs/`. Wording is summarised, not quoted. Where only the month is known, the date is approximate.

No prices or billing here: this repo is the client's. Commercial decisions live in `~/Desktop/sales deeproot systems/WaterSun/`.

**Entry template**
```
## D-0XX · YYYY-MM-DD · Short title
- Context: what was asked or the problem
- Options: A) ... B) ... C) ...
- Decision: what was chosen
- Why: the reason
- Status: Active | Superseded by D-0XX
```

---

## D-001 · 2026-08-26 · Keep the client's role names
- Context: proposed new names with short codes (CP / CPO / CPM / SCP) for the partner roles.
- Options: the new names and short codes, or keep the old names.
- Decision: keep the old names, no short codes. Suggest easier names to the client later.
- Why: the client prefers the old names and dislikes short codes.
- Status: Active (in the code, `agent` = Channel Partner, `agent2` = Dealer, `channel_partner_office` = CPO)

## D-002 · 2026-08-27 · Build features so they can be reused for other clients
- Context: asked whether feature toggles were needed for a second client.
- Decision: treat Watersun as the first version of a template. Features (loan tags, delivery batches, DISCOM submission and so on) should be stand-alone, so they can be removed for another company by editing few files. Don't break Watersun doing it.
- Why: Mahvish has other solar clients in mind with their own feature requests.
- Status: Active as a goal. Per-client feature flags are not built (see `docs/BACKLOG.md`, Deferred features). A Teraiya Solar fork was made in Sep 2026 (`~/Desktop/teriyan(watersun)`).

## D-003 · 2026-08-29 · Vendor commission field and installation payments
- Options: for "Commission Quote (₹)" in the Vendor Portal: keep, make optional, or remove. For Installation Payments: admin only, or Office can see it too.
- Decision: remove the commission field from the Vendor Portal entirely. Installation Payments: first Office was allowed to see it and mark lines paid, then the same day Mahvish said only admin has access.
- Status: Active. Installation payments ledger is admin only (as in README). (Office part: uncertain.)

## D-004 · 2026-08-29 · Drivers table for delivery batches
- Options: keep a free-text driver name, or a new `drivers` table (name, phone, vehicle number).
- Decision: new `drivers` table, added in Operations. Delivery batches use a strict dropdown; phone and vehicle fill in automatically. Old typed-in driver names are dropped. Admin can edit everything.
- Why: the old batch data was test data.
- Status: Active

## D-005 · 2026-08-31 · Colour scheme
- Options: A) a full brand palette pass, or keep the old amber scheme.
- Decision: try A, and go back to the old colours if it doesn't work out. It was reverted the same day.
- Status: Active: keep amber. Don't swap amber for blue (BACKLOG, Deferred features).

## D-006 · 2026-09-01 · Importing the real customer data
- Context: the CRM had 3,831 rows before the real data arrived.
- Options: add to the existing rows, or replace them.
- Decision: replace. The existing rows are test data, except rows staff had already entered as real work: delete what the admin uploaded, keep the rest, keep `serial_no`. Data is cleaned in Google Sheets and uploaded as CSV. Mahvish runs the import.
- Status: Done (1 Sep 2026)

## D-007 · 2026-10-03 · Rules for database changes
- Context: a combined SQL file deadlocked on the live database on 3 Oct.
- Decision: Mahvish runs all SQL in the Supabase SQL Editor; AI tools only hand over SQL files. One transaction per file, starting with `set lock_timeout = '8s';`. Back up first.
- Status: Active (README golden rules 1–3)

## D-008 · 2026-10-12 · Client-facing documents are short
- Context: Mahvish rejected a 5-page setup PDF as too complicated.
- Decision: one page of plain numbered steps. No checklists, who-does-what tables, risk notes or cost breakdowns unless asked.
- Why: Mahvish forwards these to non-technical people (Watersun staff, their Facebook agency).
- Status: Active

## D-009 · 2026-10-12 · When the 5-year warranty starts
- Context: Mahvish first chose the invoice date, but there is no invoice date column (only invoice number).
- Decision: the commissioning date, read from `installation_date`. Fall back to `material_delivery_date`, then the IST date of `completed_at`. End = start + 5 years − 1 day.
- Why: matches the agreement clause "5 years from commissioning".
- Status: Active

## D-010 · 2026-10-12 · WhatsApp through the Meta Cloud API directly
- Options: a third-party WhatsApp provider (BSP), or Meta Cloud API directly.
- Decision: direct, no BSP. Watersun's own non-WhatsApp number under Watersun's Meta business account. Mahvish sends the client the setup steps.
- Why: a BSP's monthly minimum is too much for under 100 messages a month.
- Status: Superseded by D-014

## D-011 · 2026-10-12 · Technician km pay
- Options: phone app tracking, Google road distance, or manual entry.
- Decision: manual km and amount for now. Then an estimate: from a one-tap phone location or a typed pincode, km = straight line × 1.3 × 2 (round trip) + 5 km grace, rounded up. Office can override with a note. Round trip to be confirmed with the client.
- Why: a website can't track in the background.
- Status: Partly superseded by D-020 (Google road km) and D-031 (GPS tracker)

## D-012 · 2026-10-18 · Completion code by Firebase Phone Auth SMS
- Options: Message Central SMS, WhatsApp verification, or Firebase Phone Auth.
- Decision: Firebase Phone Auth. Message Central dropped.
- Why: Message Central has a monthly minimum (found only at checkout); about 100 codes a month; Firebase has a free daily allowance.
- Status: Active. Don't suggest providers with monthly minimums.

## D-013 · 2026-10-19 · Don't rush the warranty go-live
- Options: A) pause and verify more first, B) go live the same day.
- Decision: A. Verify, then go live about two days later.
- Status: Done. Warranty went live on 29 Oct 2026.

## D-014 · 2026-10-23 · WhatsApp parked
- Decision: the client dropped WhatsApp. The code stays in the repo, switched off (`WA_ENABLED`, `WHATSAPP_QUOTATION_ENABLED`, `VENDOR_WHATSAPP_ENABLED`).
- Status: Active

## D-015 · 2026-10-23 · Complaint rules
- Decision: anyone raising a complaint gives details and a comment only, no uploads. Partners raise only for their own customers and see all complaints for them, with a comment thread. Photos only by the assigned technician, Before and After; at least one of each before the code can be sent. Office "close without code" is exempt.
- Status: Active

## D-016 · 2026-10-28 · Complaints only for customers in warranty
- Context: before this, out-of-warranty complaints were allowed.
- Decision: complaints are raised from Warranty customers only. Out of warranty or no date is refused. Admin has an exception.
- Status: Active

## D-017 · 2026-10-28 · "Only a CPO adds its managers and dealers" shelved
- Decision: built (7cf9e14), then reverted (5cb9b20) so it doesn't ship. Kept on branch `shelved/cpo-only-managers-dealers`.
- Status: Shelved. To bring it back: cherry-pick 7cf9e14, then deploy `add_user`.

## D-018 · 2026-10-29 · The 29 Oct handoff file stays local
- Decision: `docs/handoff-2026-10-29/HANDOFF.md` is not committed (listed in `.git/info/exclude`). Don't commit, push or edit it unless Mahvish asks.
- Status: Active. On 2026-11-16 the folder held only `.DS_Store`, so the file may be gone (uncertain).

## D-019 · 2026-11-05 · Quote redesign
- Context: staff found the 3-page vs 1-page quotes confusing.
- Decision: one format, several quotes per client with up to 3 brand options, "Client picked this one" with a confirm, which opens a filled lead form. History hidden behind an arrow.
- Status: Active. Live from 6–7 Nov. On 7 Nov quotes print in full (3 pages) again.

## D-020 · 2026-11-06 · Google road km and its billing
- Decision: `TRIP_DISTANCE_MODE = 'pro'` (Google road km, two-wheeler, once per trip, cached). Mahvish does every Google step in the `watersun-crm` project: Routes API only key, ₹500 budget alert, secret set in Supabase. Billing stays on Mahvish's own billing account.
- Why: the client won't pay for it; usage is expected to stay free.
- Status: Active. If the client ever pays, they open a new business billing account and the project is relinked.

## D-021 · 2026-11-06 · Deploy from a clean build
- Decision: build releases from a clean worktree of `main`, not from the main folder, which holds other uncommitted work.
- Status: Active (since 13 Nov: `.claude/worktrees/deploy-main`)

## D-022 · 2026-11-06 · Installation photos and After-photo comments
- Options: keep 10 named installation photo slots in the technician job, or not. Comment length on each After photo.
- Decision: installation photos are added by office/admin or vendors, not from the technician job. Each After photo has a comment of up to 300 characters.
- Status: Active

## D-023 · 2026-11-09 · Phone app proposal to the client
- Context: report `docs/app-feasibility-2026-11-05/REPORT.md` compared a PWA, Capacitor, a Play Store wrapper and a rewrite.
- Decision: offer Sandeep a hybrid app: the same CRM, same login, opened like a phone app (not just a home-screen shortcut), for vendors, technicians, CPs and dealers. Price was in the message (see sales folder).
- Status: Proposal sent. Followed by D-031 and D-032.

## D-024 · 2026-11-11 · Screenshots and OK before deploying client requests
- Decision: for client-requested changes, show screenshots and get Mahvish's explicit OK before deploying.
- Status: Active

## D-025 · 2026-11-11 · Partner phone screens
- Decision: home screen of boxes; Warranty & Complaints is one box and one page with two tabs, named as in the website menu (the client insisted). Stage icons are amber when the stage has customers, grey when empty. One Back button on every phone screen.
- Status: Active. Live (a8ac01b).

## D-026 · 2026-11-11 · Customer field limits in watch mode first
- Options: block edits outside each role's allowed fields now, or log them first.
- Decision: watch mode. Each role's allowed list was seeded from 180 days of history; edits outside it are only logged. Review the log around 18 Nov; block only if Mahvish chooses.
- Why: Mahvish never wants anyone blocked by surprise.
- Status: Active

## D-027 · 2026-11-11 · Park all user-management work
- Decision: do user management later, in one focused block: the CPO-to-Admin fix (ready on `fix/cpo-admin`, not live), moving name matching to IDs, activity log gaps. Deactivated users were already locked out that day.
- Status: Parked. Don't push these unprompted; raise the CPO-to-Admin issue when Mahvish asks what's next.

## D-028 · 2026-11-13 · Run SQL at the end
- Decision: Mahvish runs all SQL for waiting branches at the end, right before deploying. Don't ask mid-work; list the files at deploy time.
- Status: Active

## D-029 · 2026-11-13 · Payment Type stage and private finance
- Options: an "Undecided" option in the payment dropdown, or a new pipeline stage. Label the bank field "Bank / finance company" or keep "Bank Name".
- Decision: a new **Payment Type** stage between Registration and Loan/Cash, offering only Loan or Cash. Who finances a loan ("PM Surya Ghar loan" / "Private finance") is chosen on the customer card's Loan tab only, with a confirm popup. For private finance the JanSamarth number is locked and not required. The Leads payment dropdown stays, optional (Cash/Loan). Keep "Bank Name".
- Status: Active. Live (d788aae).

## D-030 · 2026-11-13 · Quote PDFs in lead documents
- Decision: no backfill for old leads missing their quote PDF; from now on only. Add a Quotation upload item at the end of the lead documents.
- Status: Active

## D-031 · 2026-11-14 · Technician GPS tracking as a native APK
- Context: the client asked for more automatic km tracking. A website can't track a locked phone.
- Options: a web "chained day km", or a native tracker app. Delivery by Play Store or a direct APK. Km from Google or from the GPS path.
- Decision: native tracker app, delivered as a direct APK; km = the GPS path, with Google road km shown beside it as a check.
- Status: Built on `feat/gps-tracker`, not live

## D-032 · 2026-11-14 · One Watersun app for everyone, and the order of work
- Options: separate apps per role, or one app.
- Decision: one "Watersun" app that loads the live CRM; tracking and the arrival card only for technicians. Order: 1) wait for Sandeep's files, 2) do the 14 Nov changes, 3) then build the app.
- Status: Active

## D-033 · 2026-11-14 · Simpler technician flow (client meeting)
- Context: the client said the technician portal is too complicated. Notes: `docs/client-requests-2026-11-14/NOTES.md`.
- Decision (client): dealer raises, technician claims, visits with readings and photos. OEM replacement flow with an OEM ticket number (Tata pays per site; Adani replaces parts itself). Km comes out of the warranty job and is tracked by the GPS tracker.
- Status: Being built on `feat/client-nov14`. Tata form and installation photo list received 2026-11-19; both built on `claude/nov14-tata-install-photos-13fa44` (not deployed, see the 2026-11-19 changelog).

## D-034 · 2026-11-16 · Geo tag photo moves the stage
- Context: first read as part of the warranty job; Mahvish clarified.
- Decision: on the customer card (and vendor portal), uploading the Geo Tag Photo moves GEO TAG PHOTO → DISCOM SUBMISSION. Not the warranty job.
- Status: Built on `feat/client-nov14`, not live

## D-035 · 2026-11-16 · OEM past data page
- Options: per-customer Submit with a count, or a simple search page.
- Decision: fields only; anyone in the office can type. The page searches all COMPLETED customers (nobody knows how many papers there are). "All papers typed in" button tells Mahvish to remove the page; the records stay. Inverter/panel entries have "Replaced?" (default No); Yes updates the serials on the card.
- Status: Built on `feat/client-nov14`, SQL not run. The entry shape is superseded by D-037.

## D-036 · 2026-11-16 · Make the project portable across AI agents
- Context: Mahvish wants to switch Claude accounts or agents (Gemini, Codex) without losing context.
- Options: one `DECISIONS.md` file, or numbered ADR files.
- Decision: `AGENTS.md` as the main handoff file, with `CLAUDE.md` and `GEMINI.md` pointing to it, plus `DECISIONS.md` (this file) and `CHANGELOG.md` in the project folder.
- Why: AGENTS.md is the shared standard that Codex, Cursor and others read. Claude and Gemini read their own file names. Everything stays in the folder, not in one account.
- Status: Active

## D-037 · 2026-11-16 · OEM past data: one entry = one past visit
- Context: Mahvish said each paper record may or may not have a replacement; the office should record the readings, the date and any extra comment.
- Options: A) entry = a part change with "Replaced? Yes/No" (D-035), B) entry = a past visit with optional readings and a replacement choice.
- Decision: B. One entry = one past visit: date (if on the paper), the six site readings plus Float (any may be blank, same names as the technician's form), Replacement = None (default) / Inverter / Panel / Other part, and comments. Old/new number, OEM and ticket no. only show when there is a replacement. At least one thing must be filled in. An inverter replacement puts the new number on the card (latest by date only); a panel replacement swaps the old number for the new one in the card's panel list. The customer card and the warranty card read the same customer record, so both show the change.
- Why: the papers are visit records; most visits have readings and no replacement.
- Status: Built on `feat/client-nov14`, SQL `20261116130000_oem_past_data.sql` not run

## D-038 · 2026-11-16 · OEM replacement claims for all OEMs except Tata
- Context: D-033 has two parts, Tata (CSN / CRN, Rs 800 per site, waiting for Tata's form from Sandeep) and the other OEMs. Mahvish asked to build the other OEMs now, with everything (all values and all photos) in one PDF to share.
- Decision: an "OEM replacement" box on each complaint. Office starts a claim (OEM, faulty part, faulty serial, what is wrong; filled from the customer card), downloads or shares one PDF (claim, customer and site, system and warranty, latest readings, complaint, every photo with the reading value under it), marks "PDF sent", enters the OEM ticket no. (the technician on the job can enter it too), marks "New part received"; the technician fixes it on the next visit. Each step goes into the complaint history. Tata gets its own steps later.
- Why: the office sends the OEM one file instead of many messages; the technician sees where the claim is.
- Status: Built on `feat/client-nov14`, SQL `20261116140000_oem_claims.sql` not run. 2026-11-19: Tata added on `claude/nov14-tata-install-photos-13fa44`: same steps, and the PDF starts with Tata's own Field Service Report filled in (no new SQL).

## D-039 · 2026-11-16 · CP / dealer rules fixed in one click, after a confirm
- Context: Mahvish asked for rules that fix the mismatched CP / CPO / dealer names themselves, e.g. a CP written as a dealer who has a CP login goes to the CP box, with the whole list shown under each rule and one confirm at the end.
- Options: A) answer every row on the Data Review page (unfinished, old data), B) a rules page that checks today's live cards and logins and fixes what the client's rules (5 Nov summary, rules 1-11) already decide.
- Decision: B, a new admin page "CP / dealer rules" on `feat/cp-dealer-rules` (from `main`). Four rules: CP written as dealer -> CP box; dealer under an independent CP -> emptied; dealer of another CPO -> emptied; spelling -> login's spelling. All listed and ticked, untick to skip, download CSV, one confirm. Cards changed since the check are skipped; every change is logged. Unclear cases (no login, look-alike names) stay for the Data Review page.
- Why: most mismatches follow rules the client already gave; one click with a review list is faster and safer than row by row.
- Status: Built, not deployed. No SQL. Docs: `docs/cp-dealer-rules-2026-11-16/README.md` (on that branch).

## D-040 · 2026-11-16 · CP / dealer rules: a choice per row, no-login names, unused logins
- Context: Mahvish asked for choices instead of one fixed action: dealer of another CPO can move to that CPO or have the dealer emptied; spelling can be "different people"; names with no login (dealer, CP, CPO) and logins with no customers listed too; "No change" as the default where unsure; and an option to move customers to DEBOARDED.
- Decision: every row has a choice with a default. Clear cases default to the fix; no-login names (grouped) and unused logins default to No change / Keep. DEBOARDED = CP box "DEBOARDED" with the old name kept in the Dealer box (as on existing DEBOARDED leads). "Remove" a login = deactivate (reversible), not delete.
- Why: the clear cases stay one click; the unclear ones need a person, so nothing changes unless picked.
- Status: Built on `feat/cp-dealer-rules`, not deployed, no SQL. Supersedes the single-action part of D-039.


## D-041 · 2026-11-19 · Installation photos: geo tag required, the 17 optional to start
- Context: Sandeep sent the list of 17 installation photos on 2026-11-19 (`docs/client-requests-2026-11-14/installation-photos.md`).
- Options: A) all 17 photos required before the installation is complete, B) geo tag photo required, the 17 optional to start.
- Decision: B. The geo tag photo is compulsory and stays its own slot (none of the 17 is the geo tag photo); the customer can't move on from Geo Tag Photo without it. The 17 named photos are optional records: shown as named slots with progress (e.g. 12/17) and what is missing, never blocking. Only the geo tag photo upload moves the stage automatically (D-034); uploading any of the 17 never moves the stage or sets an installation status.
- Why: start gently; can tighten later.
- Status: Built on `claude/nov14-tata-install-photos-13fa44`, not deployed, no SQL

## D-042 · 2026-11-19 · Geo tag photo: preview and confirm before the stage moves
- Context: the geo tag photo moves the customer from Geo Tag Photo to Discom Submission on upload (D-034), but the uploaded photo can be a bad one.
- Options: A) auto-move on upload (as built), B) preview + confirm, then auto-move.
- Decision: B. After a geo tag photo is picked it is shown big with "Can you see the geo tag (location, date, time) clearly on this photo?". Yes = upload it and move the stage as before. No, upload another = the photo is discarded (never uploaded) and the gallery / file picker opens again straight away (staff upload a photo already taken with a geo tag camera app, not the in-app camera); the X discards it too. An unconfirmed photo never reaches the database, so it can never move the stage. Applies everywhere a geo tag photo is uploaded: the customer card (every checklist row for the geo tag photo) and the vendor portal. On the customer card the geo tag photo now skips the crop step, which could cut off the geo tag. No SQL.
- Why: a bad photo shouldn't move the stage.
- Status: Built on `claude/nov14-tata-install-photos-13fa44`, not deployed
