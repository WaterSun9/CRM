# Backlog

Open work, known risks and history for Watersun CRM. Checked against `supabase/schema.sql` (live, 3 Oct 2026) and `src/`. "check" means the docs and the code disagree or it could not be confirmed; test with a real login before acting.

Every database item below is a migration file the owner runs (see [OPERATIONS.md](OPERATIONS.md#database-changes)).

## October week 2 - planned together

- Technician and field service rollout: keep its controls hidden until the week 2 release. The owner will run `supabase/migrations/20261004120000_allow_technician_role.sql` when ready. Before enabling the UI, verify the role constraint, create a real technician account, and test issue creation, attachment access, claim/give-up, and staff visit entry.
- WhatsApp integration: define the messages, recipient consent, sending provider, delivery logging, and failure handling; test with a small group before enabling it for all customers.

The database migration and the WhatsApp integration are not part of the current UI change.

## Role smoke check, 3 October

- Vendor: a real vendor login succeeded. A calendar entry marked `CODEX CALENDAR TEST - PLEASE REMOVE` was created for **31 January 2027**, read back as approved, and the vendor's calendar query returned no other vendor's entries. The owner will remove this entry. The published CRM login worked, but its vendor portal did not show a **My calendar** control; the calendar UI is in the local source and needs a frontend deploy before it can be tested live.
- Dealer: the supplied login returned `Invalid login credentials`; no dealer customer read or save was attempted. Verify the account before testing item 2. No account was deleted.
- Channel partner: still requires a real `agent` login; the developer role preview retains the original database session and cannot verify RLS.

## P1 - do next

| # | Item | Why | Where |
|---|---|---|---|
| 2 | Channel partner save gap - ON HOLD, diagnose with the client first, change nothing yet | A CP can see customers where Channel Partner = their name, but can only save ones where Dealer/sub channel partner = their name (true for leads they entered themselves). 3-4 Oct: about 1,070 visible-but-locked; 1 CP customer save in history ever. Ask the client: should a CP edit office-entered and dealer-owned customers, only their own, or stay view-only? Then decide. Fixing only touches the save rule, never who sees what. | `admin_update` policy; test with a real CP login |
| 3 | Revoke the GitHub token stored in `.git/config` | A token sits under `[branch "old-main"]`. Anyone with a copy of the folder can use it. | GitHub, Settings, Developer settings; then remove the line |
| 4 | Turn on leaked-password protection | Off in Supabase Auth. | Supabase dashboard, Authentication |
| 5 | Fix or delete `.github/workflows/deploy.yml` | Runs on every push but has never published; it suggests a deploy happened when it did not. `npm run deploy` is the real path. | `.github/workflows/deploy.yml` |
| 6 | Decide what to do with duplicate file numbers | See Pending data decisions. New customers now get max + 1, but old duplicates remain. | `admin.folder_no` |

## P2 - soon

| # | Item | Why | Where |
|---|---|---|---|
| 1 | Verify customer-file isolation after the policy fix | The owner reports applying `20261003230000_scope_customer_documents.sql` successfully; admin, stamp, and CP can open their normal documents. Cross-customer denial, fresh upload, remark save, and deletion have not yet been verified. | `scripts/check_customer_document_access.sql`; real role tests |
| 2 | BOM tables open to all logged-in roles | `bom` and `bom_items` policies are "allow all authenticated". | `bom`, `bom_items` policies |
| 3 | Column-level limits per role on `admin` | A role that can update a row can update every column through the API (e.g. a vendor could change payment fields). UI limits are not enforcement. | `admin` (trigger or column grants) |
| 4 | Metrics functions bypass RLS for non-office roles | `get_dashboard_metrics` and `get_dashboard_metrics_scoped` are SECURITY DEFINER; CPO roles are forced to their branch, but other roles can pass any partner or none and get global counts. `stamp_monthly_summary` has no role check (counts only). | Those three functions |
| 5 | Meter date shares `installation_date` | Meter Installation writes the same column as Installation Status. Needs a new column and a data move. | `admin`, `MeterInstallationTab.jsx` |
| 6 | Rename cascades are many separate requests | User Management and Channel Partner Management rename profile, directory, `admin` and `vendors` rows with separate calls; a failure part way can hide records. Move into one database function. (Renaming is off for users, still possible for directory entries.) | `UserManagementView.jsx`, `ChannelPartnerManagementView.jsx` |
| 7 | Stage move is two writes | `move_stage` commits, then the app separately writes `stages_remarks` and (for Lost Project) `hold_procurement`. The second can fail. Put them in the RPC. | `Dashboard.jsx`, `move_stage` |
| 8 | No staging database | Local dev uses the live database. A second Supabase project built from `schema.sql` would allow safe testing. | Supabase |
| 9 | Deactivation is not enforced by RLS | Policies check `user_type`, not `status`. The app signs inactive users out, but a valid token still reaches the API until sessions are revoked. | `get_my_user_type()` or policies |
| 10 | Backup completeness | Confirm the storage job copies both `customer-documents` and `service-issues`, that the optional backup secrets are set, and that a restore test has passed. | `daily-backup.yml`, GitHub secrets |
| 11 | `channel_partner_office_manager` role | Can read branch rows but is not in the insert/update policies, not offered in the app, 0 accounts. The app's "Manager" is `office2`. Decide: drop it or align it. | `admin` policies, role constraint |
| 12 | Stage validation gaps (check) | Older audit: FINAL REVIEW to COMPLETED has no required-field checks; vendor and admin check different things for Installation to Geo Tag and Geo Tag to Discom Submission. The database "stage safety net" (data-safety SQL section 2) was put on hold. | `utils/stageRequirements.js`, `VendorPortal.jsx` |
| 13 | Protect `main` on GitHub | Require a pull request so checks run before merging. | GitHub settings |
| 14 | Checks that were written but never switched on (removed 4 Oct as dead code; decide if any should be real) | Material Order mandatory fields (roof/shed, DC/AC cable, leg heights, invoice value) were never checked on save; vendor could move to Geo Tag without Installation = Yes; vendor delivery "unsaved changes" warning; vendor delete-geo-photo flow had no button. Wiring any of these changes behaviour, so only with client OK. | `MaterialOrderTab.jsx`, `VendorPortal.jsx` (git history 4 Oct) |

## P3 - when there is time

| # | Item | Where |
|---|---|---|
| 1 | Drop duplicate indexes: `idx_activity_created` = `idx_activity_log_created_at_desc`; `idx_admin_channel_partner` and `idx_admin_vendor` overlap the `*_normalized_idx` ones | `activity_log`, `admin` |
| 2 | Drop `restore_backup_2026_10_01` once no longer needed (RLS on, no policy) | `public` schema |
| 3 | Add a unique constraint on `bom.admin_id` (0 duplicate parents on 3 Oct, so safe now) | `bom` |
| 4 | 55 lint warnings (33 unused vars, 13 hook deps, 9 fast-refresh). Review hook warnings, do not just silence them | `src/` |
| 5 | Split large files: `AgentPortal.jsx` (~2,800 lines), `CustomerDetailModal.jsx` (~2,400), `VendorPortal.jsx` (~2,000) | `src/components/` |
| 6 | Integration tests for RLS denial, save failure, batch/BOM rollback; the 30-user / 5,000-row load test was never run | `tests/` |
| 7 | Low advisory: `dompurify` via `jspdf` | `package.json` |
| 8 | `tsconfig.json` has `checkJs: false`, so type checks cover little | `tsconfig.json` |
| 9 | Remove the Supabase keep-alive workflow if it still exists (not needed on Pro) (check) | `.github/workflows/` |
| 10 | Stale comment above `CUSTOMER_RED_FLAGS_ENABLED` (says deferred; it is on) | `src/constants.js` |
| 11 | Accessibility: login labels, white text on `amber-500` fails contrast (~28 places) | `src/` |
| 12 | Untrack `dist/` from git if still tracked (check) | repo |

## Accepted risks

Decided, not oversights:

- **Identity by name.** Access for vendor, CP, dealer and stamp is by `lower(trim(name))`. Renames are off; duplicate names are not allowed by practice, not by constraint. The fix is the UUID migration below.
- **Documents are optional at lead creation**; required only when advancing a stage.
- **`system_capacity_kwp` holds Wp x modules** (e.g. 32,940), not kWp, matching existing rows. Label still says kWp.
- **Branch name mismatches** in old data are not being cleaned in bulk; new data is aligned by hand.
- **Old dealer names on DEBOARDED leads are kept** for history; dealers cannot see them because the branch no longer matches.
- **The anon key is public** (it ships in the bundle). All protection is RLS; `anon` has no table access and no RPC execute.
- **Kilometres and visit amounts are typed by staff**; no Google Maps Timeline link.

## Deferred features (not built)

| Feature | Status | Source |
|---|---|---|
| Warranty page: live/expired split, invoice date + 5 years | Not built. Needs the invoice-date source and rules agreed | Rollout plan 2 Oct |
| Activity log: role filter, `role_change` action (old -> new, by whom), quick filters, date/month filter, search by file or consumer number | Not built. Only user and action filters exist | RD-3 |
| Document review fields (`review_status`, `review_remark`, `reviewed_by`, `reviewed_at`) with RLS so only staff send back and others replace only sent-back files | Not built. Send back uses a remark marker | Aug audit |
| Local draft autosave and restore for Add Lead and customer edits (offline) | Not built. Only unsaved-change warnings and an offline banner (check) | Aug audit, remediation 10.12 (paused by client) |
| Feature flags per client / reusable template (decide fork per client vs one deployment with a tenant column) | Not built, no decision | Remediation phase 8 |
| Inline PDF.js page renderer for the feasibility preview on mobile | Not built | Maintenance checklist |
| Remark text on documents attached at lead creation | Check | Fix plan 1 Sep |
| Admin-only quotation template manager (company text, terms, bank details) | Not built; template is in code | Quotation plan |
| Quotation autofill from an existing lead | Check | Quotation plan |
| Brand re-skin with semantic Tailwind tokens (`brand`, `accent`); do not swap amber for blue | Deferred; a full palette pass was reverted on 31 Aug | Fix plan |
| "One name, entered once": normalise branch and person names on every write; remove free-text branch entry in admin Add Lead | Paused by client | Remediation 7 |
| Vendor portal driver name/phone fields vs batch sync (make read-only?) | Undecided | Remediation 10.14 |

## Pending data decisions

- **File numbers:** on 3 Oct, 48 file-number values were shared by two or more customers and 49 customers had a blank or 0 file number (highest 5095). Decide: renumber, keep and mark, or leave. Do not let the auto-number trigger "fix" old rows.
- **Blank customers:** 37 non-deleted rows have a blank customer name (5 also have no village or consumer number, from the 23 Aug import). Recommended: soft-delete after review.
- **Incomplete records:** customers moved ahead with details missing are listed by `v_incomplete_customers`; the team fills them in. Two open items from 2 Oct: Dave Girdharlal Champalal (module brand GOLDI or TATA) and Nadoda Jesangbhai Dalabhai (Discom Inspection Yes or No).
- **Ownership exceptions (3 Sep audit):** 204 CPO leads with an invalid dealer pairing, 116 leads whose channel partner does not match an active CP/CPO, 195 dealer names with no login, and `MANOJ` used as both a CPO and a dealer name.
- **Channel partner list:** 54 partner names appear on leads, only 13 have logins. Keep the Operations list; never rebuild it from User Management (that would orphan about 3,000 leads from the dropdown).
- **Vendor/Site Feasibility vs PCR / Plant Commissioning:** do not relabel old `vendor_feasibility` / `site_feasibility` values. Count them, decide a mapping (or keep them historical), and migrate boolean and `documents.doc_type` together if needed.

## UUID identity migration (not started)

Goal: link people by `profiles.id` instead of by name, so a rename is one update and cannot hide anyone's records.

| Phase | What | User impact | Undo |
|---|---|---|---|
| 1 | Add `admin.sub_channel_partner_id` and `admin.vendor_id` (uuid, FK to `profiles`) plus indexes. Extend to `channel_partner` / CPO and stamp maker the same way | None | Drop columns |
| 2 | Preview which names resolve to exactly one profile; fix or consciously accept every unresolved or ambiguous name; then backfill ids | None | Set ids to null |
| 3 | App writes the id alongside the name everywhere a person is set (Add Lead, agent portal, vendor allotment, delivery batches, rename). Run for a few days; re-check for new null ids | None | Redeploy previous build |
| 4 | Switch the person clauses in `admin_select` / `admin_update` to `..._id = auth.uid()`. Save old policy text first. Log in as a dealer and a vendor and compare counts | Yes | Re-apply saved policy text |
| 5 | After a clean week: rename becomes one `profiles.name` update; turn `ALLOW_NAME_EDIT` on; names become display-only | Rename allowed | Restore cascade |

Risks: any row whose name does not resolve becomes invisible to its owner after phase 4, so phase 2 must reach zero unexpected nulls first. Duplicate names (e.g. `MANOJ`) must be resolved by hand. Do it in a quiet window with time to log in as each role. Data clean-up rules: back up first, keep original names, never delete leads or historical dealer values during this work.

## Done (history)

- **27-28 Aug 2026:** first full audit. Save now waits for the database; unsaved-change warnings; vendor email function and `add_user` locked to proper callers; vendor portal crash fixed.
- **28-29 Aug:** live RLS rebuilt: blanket `true` policies and `anon` access removed, `admin` scoped per role; login fails closed without a profile; deactivation signs users out; conflict dialog and `updated_at` trigger; atomic delivery-batch RPCs; lean list queries; tag values migrated and terminal tags lock.
- **30 Aug - 1 Sep:** fix plan: all data-destroying paths fixed (BOM wipe, delete-before-upload, zero-row "success"); branch scoping in realtime and search; dealer "Move Anyway" removed; dead code removed; branding (`BrandMark`, favicon).
- **3 Sep:** emergency read-only RLS patch to `admin_select` (dealer needs name and branch to match; CP by channel partner). Verified with three real users.
- **10 Sep:** deploy of the August/September fixes.
- **13-14 Sep:** Quotation Maker built and embedded; preview and PDF share one asset-readiness and fit routine; no silent clipping.
- **1-2 Oct:** data-safety work: 4 lost values and 141 Discom Agreement ticks restored; save check after every save; `admin_history` audit trigger; completed date stamped once; duplicate `updated_at` triggers dropped; `v_incomplete_customers`; full paged daily backup.
- **3 Oct:** repository audit; `supabase/schema.sql` generated from live and validated on a clean Postgres.
- **4 Oct release (SQL applied and verified live; frontend goes live at the next `npm run deploy`):** auto file number; BOM "Loaded" tick; hardened delivery/BOM/stage RPCs (admin/sales only, `move_stage` admin-only and refuses stale moves); documents bucket private; `anon` execute revoked; profile guard trigger; red flags; chat audiences; Quotation Maker re-enabled with lock and Revise; PDF named by customer full name.
