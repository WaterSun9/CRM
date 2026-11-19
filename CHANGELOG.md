# Changelog

A dated history of changes to this project and of events with the client. The newest entries are at the **top**. Every agent adds to this list; see `AGENTS.md`.

Entries before 2026-11-16 were reconstructed on that date from the git history (about 470 commits across all branches, 8 Aug to 16 Nov 2026), past Claude Code and Codex chats, and `docs/`. They summarise by week, not commit by commit. Use `git log` for detail.

## 2026-11-19
- `claude/nov14-tata-install-photos-13fa44` (from `feat/client-nov14` 85be0ed), not deployed, **no new SQL**:
  - Saved the client's files: `docs/client-requests-2026-11-14/installation-photos.md` (the 17 names as written, Gujarati included) and the blank Tata form in `docs/client-requests-2026-11-14/tata-oem-form/` (also `src/assets/tata-field-service-report.pdf` for the app).
  - Installation photos: 17 big photo boxes with a count (e.g. 12/17) and the missing names, on the customer card (Installation Status) and in the vendor portal (Installation tab). Each photo is a customer document with its own type (`install_*`), so no SQL. Optional: never blocks or moves the stage (Mahvish's rule, next line). None of the 17 is the geo tag photo, which stays separate.
  - Tata OEM claim: same steps as the other OEMs (D-038). The PDF is Tata's Field Service Report (N010652 rev 04) filled in from the complaint, customer card and latest visit, then the usual claim pages with every photo. Sales order no., battery checks, loads, array current, customer's remarks and both signatures are left blank to fill by hand.
  - Fixed an out-of-date test (`tests/complaintPhotos.test.mjs` did not know the 14 Nov "reading" photo group).
  - Screenshots and a sample filled Tata PDF (fake data) in `docs/client-requests-2026-11-14/installation-photos/` and `tata-oem-form/`. Lint and build pass; tests 204/206 (the 2 failures are the known `src/quotations/repository.js` import, also failing on `main`).
- Client sent the installation photo list (17 photos, not 10) and the Tata OEM form ("FIELD SERVICE REPORT FOR SPV PRODUCTS", Doc No N010652 Rev 04). Mahvish's rules: the geo tag photo is compulsory, and only the geo tag upload moves the stage automatically. The 17 installation photos start as optional and never move the stage or set a status. Work started on branch `feat/nov14-tata-install-photos` (from `feat/client-nov14`).
- Client bug: the panel brand was not printed on the quotation. Fixed in 42054ca on `claude/quote-panel-brand-482e16` (the Solar modules row now shows the brand). Not deployed.
- Client bug: a quotation converted to a lead doesn't show in the Add Lead pop-up or on the customer card until a page refresh, so staff add it again. Fix in progress on its own branch from `main`.

## 2026-11-16
- `feat/cp-dealer-rules` take 1 (a41c982): only the first 4 topics shown; the other 4 hidden for later. **Task 2** written in `docs/BACKLOG.md`: live-data test, switch on the hidden topics, remember "no change". Not deployed.
- `feat/cp-dealer-rules`: page now has a header and one tab per topic, Miscellaneous last (empty CP, office staff as dealer, CPO name as dealer). UUID identity work left for later at Mahvish's request; DEBOARDED kept as a filing name, not a branch.
- `feat/cp-dealer-rules`: per-row choices, CP/CPO with no login and dealer with no login (grouped, default no change, DEBOARDED or pick a login), logins with no customers (keep or deactivate) (D-040). Tested in the demo. Not deployed.
- New branch `feat/cp-dealer-rules` (from `main`): admin page "CP / dealer rules" (D-039). Checks all cards against the CP/CPO/dealer rules and today's logins, lists every customer per rule, fixes the ticked ones after one confirm, logs each change. Tested in a demo; not deployed; no SQL. Also looked at the Data Review page (built, not live, old 1 Nov data; its demo was out of date).
- Open question: "photo of the filled paper form" (14 Nov notes) may mean the one-PDF of all values and photos (already built, D-038) or a photo of the paper service form. Mahvish asks Sandeep on 2026-11-17.
- Mistake, fixed: a commit meant for `feat/client-nov14` was made in the main folder by accident (b731962 on `warranty-merge-18oct`, local only, never pushed). It swept in untracked files including the real-customer spreadsheets. Undone straight away with a soft reset; every file is back as it was (untracked). The work itself is committed on `feat/client-nov14` as fa7e858.
- `feat/client-nov14`: OEM replacement claims for all OEMs except Tata (D-038): claim box on each complaint (office and the technician on the job), one-PDF download or phone share with all values and photos, PDF sent / OEM ticket no. / new part received steps in the complaint history. New SQL `20261116140000_oem_claims.sql` (not run). Screenshots and a demo PDF in `docs/client-requests-2026-11-14/oem-claims/`. Not deployed.
- `feat/client-nov14`: OEM past data reworked (D-037). Each entry is a past visit: date, readings, Replacement None/Inverter/Panel/Other part, comments. Inverter or panel replacements update the card's numbers (customer card and warranty card share the record). The page searches all completed customers in the database. Earlier: no per-customer Submit or count. Both new SQL files now run in one transaction with `set lock_timeout = '8s'`. Screenshots in `docs/client-requests-2026-11-14/oem-past-data/`. SQL not run, not deployed.
- Committed the work that sat uncommitted in the main folder (branch `warranty-merge-18oct`) as **b116490 "WIP snapshot: uncommitted work as of 2026-11-16"**. It contained:
  - app changes in `src/App.jsx`, `AgentPortal.jsx`, `Dashboard.jsx`, `ServiceIssuesView.jsx`, `ComplaintPhotos.jsx`, `WarrantyCustomerPanel.jsx`, `QuotationModule.jsx`, CSS, `index.html`, `public/version.json`;
  - PWA files (`public/manifest.webmanifest`, `sw.js`, `offline.html`, app icons), not live;
  - the unfinished Data Review page (`src/components/DataReviewView.jsx`, `supabase/migrations/20261105150000_data_review.sql`, not run);
  - local demo pages `portal-demo.html`, `data-review-demo.html`, `src/dev/portalDemo.jsx`, `src/dev/dataReviewDemo.jsx`;
  - dated docs folders from 22 Oct to 14 Nov (audits, client requests, deploy SQL, screenshots, warranty guide PDFs, quote sample, serial report SQL, complaints video).
- Left uncommitted on purpose: `.claude/` (local tool config and worktrees), `dist/index.html` (build output), `app-demo.html` and `src/dev/appDemo.jsx` (an earlier instruction says never commit them), and four files with real customer names and phones: `docs/serial-report-2026-11-11/report.csv` and its `.xlsx`, `docs/import-issues-2026-11-05/import-issues.xlsx` and `seed_data_review.sql`.
- Added `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `DECISIONS.md` (D-001 to D-036) and this `CHANGELOG.md`.
- On `feat/client-nov14` (worktree, uncommitted): a photo per reading on technician visits, geo tag photo moves the customer card stage, OEM past data page. SQL `20261116120000_reading_photos.sql` and `20261116130000_oem_past_data.sql` not run.
- Request: Nilesh of Shree Power wants a custom link (details uncertain).

## 2026-11-14
- Client meeting: the technician portal is too complicated. Simpler flow, OEM replacement, km out of the warranty job. Notes in `docs/client-requests-2026-11-14/NOTES.md`. See D-033.
- Built the technician GPS tracker app (Capacitor, direct APK) on `feat/gps-tracker`, uncommitted; SQL not run live. Decided one Watersun app for everyone (D-031, D-032).

## 2026-11-13
- Released the 11 Nov and 12 Nov client requests: Payment Type stage, Loan tab "Financed by" with private finance, quote name required, quote PDF saved to lead documents with retries, Quotation item in lead documents, Sandeep's requests (Quotations first, lead pincode required, SC/ST/General category, partners edit warranty address). Both SQL files run by Mahvish first. Live as `main` d788aae.
- Later: pincode required to move a lead on, on the customer card too. Live as `main` 5cde914 (current live).

## 2026-11-11 – 2026-11-12
- Security and fixes batch live (a30171f): deactivated users lose access, vendor and list edits office-only, `phone-otp` staff-only, IST dates, search with commas, paging fixes.
- Month filter with years, chat loads newest first, hard delete keeps the log (9bd0f5c). Dashboard numbers scoped by role, customer field limits in watch mode (cb019e6).
- Technician portal fixes live (4f7e508). Partner phone screens redesigned and live (a8ac01b).
- Sandeep's requests received; serial number Excel sent to him (792 missing inverter, 51 missing panels, 155 mismatches).
- CPO-to-Admin fix built on `fix/cpo-admin`, not live; all user-management work parked (D-027).
- GitHub token removed from `.git/config`; revoking it on GitHub is still for Mahvish to do.
- 12 Nov: client asked for quote PDF in lead documents, private finance and a payment "Undecided" default.

## 2026-11-08 – 2026-11-10
- Full code and security audit: `docs/audit-2026-11-08/AUDIT.md` (security found weak; CPO can make itself Admin).
- Phone app options written up (`docs/app-feasibility-2026-11-05/REPORT.md`); hybrid app proposal sent to Sandeep on 9 Nov (D-023).

## 2026-11-05 – 2026-11-07
- Technician portal (phone only, visits, readings, Reached site, After photos, trip km by Google road distance).
- Quote redesign (D-019). Inverter page and inverter/panel serial import from the client's sheet (SQL split into 9 files).
- Import issues audit (`docs/import-issues-2026-11-05/`), Data Review page started (not finished, not live).
- Google Routes key and billing set up (D-020).
- 7 Nov: warranty, quotes and inverter page merged into `main` (b59d191) and deployed; later the same day client fixes live (a2ba57f, b3c88c2). Test complaint and test technician set up for an end-to-end test.

## 2026-10-26 – 2026-10-29
- Complaints get stage tabs and history; Warranty customer panel; combined trips (Next house / End trip); complaints only for in-warranty customers (D-016).
- Quotations simplified (1 or 3 options, Open/Won/Lost, Add to leads).
- 29 Oct: **warranty and complaints live** (deac302, then 0ae55a2). Client guide PDFs in `docs/warranty-guide-2026-10-29/`.
- "Only a CPO adds its managers and dealers" built and shelved (D-017).

## 2026-10-18 – 2026-10-23
- Branch `warranty-merge-18oct` created from the parked warranty work. Completion code by Firebase SMS (D-012). Warranty page, complaint wrench colours, km pay settings, Day 2 go-live runbook.
- 19 Oct: go-live paused to verify more (D-013).
- 22 Oct: quotation Won flow, editable final quotations, layout fixes; code audit `docs/audit-2026-10-22/`.
- 23 Oct: client dropped WhatsApp (D-014). Complaint photo and comment rules (D-015).

## 2026-10-02 – 2026-10-17
- Daily Supabase backup made strict (2 Oct). Releases on 3–5 Oct: truck sheet, vendor calendar, chat, photo crop, unsaved-changes prompt. A combined SQL file deadlocked live on 3 Oct (D-007).
- 9–10 Oct: CP/dealer issues sheet prepared for the client (`~/Desktop/10-octWaterSun_Client_Issues.xlsx`); 356 old-CP customers grouped under DEBOARDED.
- 10 Oct: Quotation Maker live for partners, Won/Lost, delivery Excel, fuzzy search.
- 12 Oct: technician role, complaints and WhatsApp built and planned (D-009 to D-011); 15 Oct parked on a branch. Truck sheet loading ticks, partly delivered (15–17 Oct).

## 2026-09-12 – 2026-10-01
- No commits in this repo (approx.).

## 2026-09-01 – 2026-09-11
- 1 Sep: real customer data imported (D-006). CP / CPO / dealer access fixes, lead time stamps, quotation amount.
- 6 Sep: CRM paused for maintenance for round RD-3. Vendor feasibility, DISCOM, phone view fixes, duplicate dealer names, clean-up of unused folders.
- 7 Sep: a copy was forked as "Teraiya Solar" in `~/Desktop/teriyan(watersun)`.

## 2026-08-08 – 2026-08-31
- 8 Aug: project started. About 190 commits in numbered review rounds ("rd").
- Built: logins and password reset, roles and portals (agent, dealer, vendor, stamp), customer card and documents, BOM, delivery batches with drivers (D-004), realtime, mobile views.
- 26–27 Aug: audit found a role-switching backdoor in the production build; removed 27 Aug. Template goal agreed (D-002); role names kept (D-001).
- 31 Aug: custom domain, logo; colour change tried and reverted (D-005).
