# Watersun CRM

Customer pipeline system for Watersun Electrical Solutions Pvt Ltd, a rooftop solar installer (PM Surya Ghar / DISCOM work). Office staff, channel partners, dealers, vendors, stamp makers and technicians each get their own view of the same customer records.

**This is a live production system.** About 5,000 customers and real staff use it every day. Read the golden rules at the bottom before changing anything.

Other docs:

- [docs/OPERATIONS.md](docs/OPERATIONS.md) - releases, database changes, backups, secrets, emergencies.
- [docs/BACKLOG.md](docs/BACKLOG.md) - open work, known risks, history.

## Stack

| Part | What |
|---|---|
| Frontend | React 18 + Vite 8 + Tailwind 3, plain JavaScript (some TypeScript in `src/quotations/template`) |
| Hosting | GitHub Pages (custom domain via `public/CNAME`), repo `WaterSun9/CRM` |
| Backend | Supabase (Pro plan): Postgres with RLS, Auth (email/password), Storage, Realtime, pg_cron |
| Project | Supabase project ref `cjskyhxameobcqlfiuav` |
| Server code | Two Supabase Edge Functions (Deno) |
| Email | Brevo API, called from the edge functions |
| Backups | GitHub Action "Daily Supabase Backup" to a private backup repo |

## Folder layout

| Path | What it is |
|---|---|
| `src/` | The app. `App.jsx` routes each role to its portal. `constants.js` holds stages, tags, roles, BOM templates. `supabase.js` is the client. |
| `src/components/` | Screens: `Dashboard`, `CustomerDetailModal` (+ `modal-tabs/`), `AgentPortal`, `VendorPortal`, `StampPortal`, `DeliveryBatchesView`, `UserManagementView`, `ServiceIssuesView`, `TeamChat`, `agreement/` (PM Surya Ghar agreement pages) and more. |
| `src/quotations/` | Quotation Maker: list, form, 3-page A4 preview, PDF export, Supabase repository. |
| `src/utils/`, `src/utils.jsx` | Helpers: save checks, stage requirements, BOM, uploads, CSV export, vendor payment workbook. |
| `supabase/schema.sql` | The whole backend in one file (tables, functions, triggers, RLS, grants, buckets, cron). For a new/empty project only. See OPERATIONS. |
| `supabase/migrations/` | Database changes, one file per change, named `<timestamp>_<name>.sql`. |
| `supabase/functions/add_user` | Create / deactivate / reactivate / delete users, change email or password. Admin, or a CPO for their own branch. |
| `supabase/functions/send-lead-to-vendor` | Emails a job to the customer's saved vendor. |
| `scripts/backup/` | `export_tables.py`, used by the daily backup workflow. |
| `scripts/write_version.js` | Writes `public/version.json` at build time (drives the "new version" banner). |
| `scripts/*.sql` | Older one-off SQL. Everything in them that is live is now in `supabase/schema.sql`. History only. |
| `tests/` | Node unit tests (`*.test.mjs`) and quotation tests (`tests/quotations/`). `*.browser.mjs` need a browser. |
| `public/` | Static files: `404.html` (SPA fallback), images used by quotations/agreements, `CNAME`, `version.json`. |

## Roles

The role is `profiles.user_type`. Access is enforced by RLS in the database, not only by the UI. Summary from the live policies in `supabase/schema.sql`:

| user_type | Name in app | Customers they can read | Can edit customers | Other access |
|---|---|---|---|---|
| `admin` | Admin | All | Yes; only role that can move stages via `move_stage` and hard-delete | Users, audit history (`admin_history`), drivers, delivery batches, payments ledger, trash, export |
| `sales` | Office | All | Yes (no hard delete) | Delivery batches, documents delete, service issues, all quotations |
| `channel_partner_office` | CPO | Own branch (`admin.channel_partner` = their branch) | Own branch | Creates and manages own branch staff (`office2`, `agent2`) |
| `office2` | Manager (CPO staff) | Own branch | Own branch | No user management |
| `channel_partner_office_manager` | (legacy CPO manager) | Own branch | No (not in insert/update policies) | Not offered in the app; 0 accounts on 3 Oct |
| `agent` | Channel Partner | Leads where `channel_partner` = their name | Only rows where `sub_channel_partner` = their name (see BACKLOG P1) | Own quotations, red flags, raise service issues |
| `agent2` | Dealer | `sub_channel_partner` = their name AND `channel_partner` = their registered branch | Rows where `sub_channel_partner` = their name | Own quotations, red flags, raise service issues |
| `vendor` | Vendor | Jobs where `admin.vendor` = their name (not deleted) | Those jobs | Geo photos, own unavailable dates, payments view |
| `stamp` | Stamp maker | Records sent to stamp maker and assigned to their name | Those records | "My record" summary |
| `technician` | Technician | None | No | Open service queue (summary only), claim/give up jobs |

Notes:

- `technician` is in the app and the service policies, but the live check constraint `profiles_user_type_check` does not allow it yet, so technician accounts cannot be created. It also still allows a legacy `dealer` value. See BACKLOG P1.
- Red flags: admin, sales, CPO, office2, CPO manager, agent, agent2 can set or clear them on customers they can see. Vendors cannot.
- Chat: staff (admin, sales, CPO, office2) see all messages and can write to everyone, a group (role) or one person. Others write to the office and see their own thread plus messages addressed to them.

## Stage pipeline

From `PRIMARY_STAGES` in `src/constants.js` (stage ids are stored in `admin.stage`):

1. LEADS
2. REGISTRATION
3. LOAN or CASH (by payment type)
4. MATERIAL ORDER
5. MATERIAL INTEGRATION
6. MATERIAL DELIVERY
7. INSTALLATION STATUS
8. GEO TAG PHOTO
9. DISCOM SUBMISSION
10. METER INSTALLATION
11. DISCOM INSPECTION
12. SUBSIDY STATUS
13. FINAL REVIEW
14. COMPLETED

`LOST PROJECT` is a side stage; it keeps the stage the project was lost from so it can be resumed.

Tag views run alongside the stages: Loan tags, Subsidy tags, Installation tags. The last tag in each set (`Total Loan Payment Received`, `Received`, `Installed`) locks the record for everyone except Admin.

## Key features

- Dashboard: stage columns, tag views, sidebar counts, global search, CPO and Dealer filters, month filters on Leads and Registration.
- Customer window: full record from the database, save check after every save, conflict dialog when two people edit the same field.
- Stage rules: required fields per stage (`src/utils/stageRequirements.js`); stage moves go through `move_stage` and refuse stale moves.
- Auto file number: a new customer with blank or 0 file number gets highest + 1 (trigger `trg_assign_folder_no`).
- Documents: private bucket `customer-documents`, upload, crop, send back, ZIP "Download all".
- Material Integration: BOM per customer, saved in one transaction (`save_bom_atomic`), "Loaded" tick per line.
- Delivery batches: atomic save/delete/status RPCs, truck loading sheet, stop order, driver info synced to customers.
- Agent/Dealer portal, Vendor portal, Stamp portal: role-specific views of the same records.
- Vendor calendar (unavailable dates) and vendor payments Excel download.
- Installation payments ledger (admin).
- Quotation Maker: 3-page PDF, locked after download, "Revise" makes Quote-<no>-R1, R2; "Add to Leads"; PDF named by customer full name.
- Red flags on customers (table `customer_payment_review_flags`).
- Team chat with audiences: everyone, a group, one person.
- Service issues: raise from a completed customer, technician claims and gives up, staff enter visits; private bucket `service-issues`.
- Audit: `activity_log` (app-written) and `admin_history` (database trigger, admin-only).
- Agreement generator (PM Surya Ghar), CSV export (admin), "new version" banner.

## Run locally

Needs Node 22.

```bash
npm ci --legacy-peer-deps      # plain npm ci fails: vite 8 vs @vitejs/plugin-react 4
npm run dev
```

Create a `.env` file in the repo root first. It needs `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Never commit `.env`.

**Warning:** there is no staging database. Local dev talks to the live database with your real login. Do not test destructive actions locally.

## Test

All three must pass before any deploy:

```bash
npx eslint . --quiet
node --test tests/*.test.mjs tests/quotations/*.test.mjs
npm run build
```

`--quiet` shows errors only; there are about 55 known warnings (see BACKLOG).

## Deploy

`npm run deploy` is the only thing that publishes the site. Pushing to `main` does not deploy. Full checklist: [docs/OPERATIONS.md](docs/OPERATIONS.md#release-checklist).

## Golden rules

1. **It is live.** Every database change hits real customers immediately. Take a backup first.
2. **The owner runs all SQL** in the Supabase SQL Editor. AI tools have read-only database access and must hand over SQL files, never run them.
3. **One transaction per SQL file**, starting with `set lock_timeout = '8s';`. Split big changes into parts. A combined file deadlocked live on 3 Oct.
4. **People are matched by name.** Vendor, channel partner, dealer and stamp access compares `lower(trim(name))` in `profiles` with text in `admin` (`vendor`, `channel_partner`, `sub_channel_partner`, `discom_submission.assigned_stamp_maker`).
5. **Do not rename users.** A rename empties that person's portal. Renaming is off in the app (`ALLOW_NAME_EDIT = false`) and the profile guard trigger blocks name, email, role, branch and status changes except by Admin (or a CPO inside their own branch). If a rename is truly needed, see OPERATIONS.
6. **Two people must not share a name.** Name-based RLS would show each the other's records.
7. **Never delete profile rows in the Supabase table editor.** Use User Management, otherwise an orphaned login is left behind.
8. **Never put secrets in the repo or the docs.** Names only.
