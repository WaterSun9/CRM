# Watersun CRM — Full Maintenance Checklist

Use this checklist for the planned full-maintenance window. Do not run the
database-changing sections while staff are actively working.

## 1. Before the maintenance window

- [ ] Announce the maintenance start/end time to all users.
- [ ] Ask everyone to finish current edits and sign out.
- [ ] Deploy the existing `maintenance/` page.
- [ ] Confirm the custom domain shows the maintenance page with HTTP 200.
- [ ] Record the current production commit and deployment ID for rollback.
- [ ] Commit or safely preserve every intended local code change.
- [ ] Review `git diff` and exclude unrelated/generated changes.

## 2. Backups and recovery proof

- [ ] Create a fresh Supabase database backup immediately before any SQL.
- [ ] Export these critical tables separately: `admin`, `profiles`, `documents`,
      `activity_log`, `metadata`, `vendors`, `delivery_batches`, and `bom`.
- [ ] Export Storage object names/paths and bucket policies.
- [ ] Save current RLS policies, functions, triggers, indexes, and constraints.
- [ ] Confirm the backup timestamp and file sizes.
- [ ] Test restoring the backup into a separate project/database.
- [ ] Write down the exact rollback steps before applying changes.

## 3. Isolated test environment

- [ ] Create a staging Supabase project or isolated staging schema.
- [ ] Use fake accounts only; never use real employee passwords for testing.
- [ ] Create one active fake account for every supported role:
  - [ ] Admin
  - [ ] Sales
  - [ ] Office
  - [ ] CPO (`channel_partner_office`)
  - [ ] CPO Manager (`channel_partner_office_manager`)
  - [ ] Office 2
  - [ ] CP/dealer roles (`agent` and `agent2`)
  - [ ] Vendor
  - [ ] Stamp maker
- [ ] Create clearly named fake customers such as `ZZ SYSTEM TEST`.
- [ ] Assign test customers to the fake CPO, dealer, and vendor.
- [ ] Upload dummy documents/photos only.
- [ ] Keep a cleanup tag so every test row and file can be removed safely.

## 4. Identity and ownership cleanup

- [ ] Export the current CPO, CP, dealer, branch, and user-name mappings.
- [ ] Identify duplicate accounts and names before changing anything.
- [ ] Give every person one primary operational role/login.
- [ ] Do not use display-name matching as the permanent identity mechanism.
- [ ] Plan stable ID-based ownership for CPO, dealer, vendor, and branch.
- [ ] Preserve the original imported names in an audit/mapping record.
- [ ] Review deboarded CPs and ignore their sub-agent names in visibility rules.
- [ ] Remove sub-agent accounts only after exporting and confirming the list.
- [ ] Never delete customer leads as part of identity cleanup.

## 5. Visibility and RLS verification

- [ ] Verify Admin and Sales can see all permitted records.
- [ ] Verify Office capabilities and restricted fields/stages.
- [ ] Verify CPO sees all leads owned by its CPO, including valid dealers below it.
- [ ] Verify CPO Manager has the intended CPO-equivalent visibility and limits.
- [ ] Verify CP-only records ignore dealer/sub-dealer values.
- [ ] Verify valid dealer records are visible to that dealer and parent CPO.
- [ ] Verify an unknown dealer under a CPO remains visible to the CPO, not another dealer.
- [ ] Verify deboarded CP records ignore sub-channel-partner names.
- [ ] Verify Vendor sees only assignments matching the vendor identity.
- [ ] Verify Stamp sees only explicitly assigned/sent documents.
- [ ] Test SELECT and UPDATE separately for every role.
- [ ] Confirm an RLS-rejected update displays a visible error and does not show success.
- [ ] Run Supabase security/performance advisors after policy changes.

## 6. Database integrity

- [ ] Compare application fields with the real `admin` table columns.
- [ ] Confirm enum/check constraints support every role and stage used by the app.
- [ ] Confirm `updated_at` is maintained by the backend trigger.
- [ ] Confirm `move_stage` permissions are restricted to intended roles.
- [ ] Add foreign-key or stable-ID relationships where safe and staged.
- [ ] Audit duplicate BOM rows, duplicate users, orphan profiles, and orphan documents.
- [ ] Audit unnamed customers and document how each record will be handled.
- [ ] Check null/blank values separately; do not mass-replace without approval.
- [ ] Run every cleanup first as a SELECT preview with counts and sample rows.
- [ ] Apply changes in small transactions with verification after each one.

### Vendor/Site Feasibility field migration decision

- [ ] Do not merely relabel existing `vendor_feasibility` or `site_feasibility`
      data: old checked values and uploaded files would be falsely presented as
      PCR or Plant Commissioning documents.
- [ ] Count existing true values and uploaded documents for both old types.
- [ ] Decide and approve the exact mapping, if any:
  - [ ] `vendor_feasibility` → PCR Certificate
  - [ ] `site_feasibility` → Plant Commissioning Report
- [ ] If historical records really represent the new documents, migrate both
      the boolean field and `documents.doc_type` in one reviewed transaction.
- [ ] If they do not represent the same documents, leave them historical and
      add dedicated fields only if reporting requires boolean columns.
- [ ] Prefer document rows as the source of truth when the item is only an
      optional upload; this avoids unnecessary columns and data backfills.
- [ ] Preview affected row counts and filenames before any migration.
- [ ] Keep a reversible mapping table/export and verify after migration.

## 7. Activity-log reliability

- [ ] Record exact old and new values for every successful stage change.
- [ ] Cover normal moves, skip-forward, admin rollback, Lost Project, resume, and completion.
- [ ] Do not create activity entries for no-op saves.
- [ ] Do not create success entries when the database rejects a write.
- [ ] Record role changes, account activation/deactivation, vendor assignment,
      dealer/CPO reassignment, document uploads/deletes, and permission changes.
- [ ] Prefer a database-level audit trigger for critical fields so direct SQL/API
      changes cannot bypass history.
- [ ] Define retention, access, and privacy rules before enabling the trigger.
- [ ] Add activity filters for user, action, customer, field, and date.
- [ ] Verify newest-first indexes and paging.

## 8. Documents and Storage

- [ ] Verify upload, preview, download, Download All, replacement, send-back, and delete.
- [ ] Require confirmation before explicit permanent deletion.
- [ ] Confirm failed backend deletion leaves the document visible.
- [ ] Confirm replacement uploads the new file before deleting the old one.
- [ ] Verify storage rows and objects do not become orphaned.
- [ ] Confirm Download All is available to intended roles and hidden from Vendor/Stamp.
- [ ] Test ZIP speed with customers having small and large document sets.
- [ ] Evaluate a server-side single-PDF Download All flow for mixed PDFs and images; preserve originals, page quality, orientation, ordering, and reasonable memory use before replacing ZIP.
- [ ] Verify browser Save As behaviour for PDF, PNG/JPG, and ZIP where supported.
- [ ] Verify PCR Certificate uploads as a document without requiring a new boolean column.

## 9. Workflow regression test

- [ ] Create one fake Loan customer and one fake Cash customer.
- [ ] Walk each customer through every applicable stage.
- [ ] At each stage, test incomplete requirements and confirm the exact missing-item message.
- [ ] Verify successful moves appear in the new stage and disappear from the old stage.
- [ ] Verify Completed removes the customer from Loan, Subsidy, and Installation tag queues.
- [ ] Verify Loan customers appear in Loan Tags.
- [ ] Verify Installation Payments shows customers only after a vendor is selected.
- [ ] Verify Vendor can inspect future tabs but cannot edit/upload until unlocked.
- [ ] Verify Vendor can upload Geo Tag only at Geo Tag Photo stage.
- [ ] Verify month filters affect Leads and Registration only.
- [ ] Verify sidebar counts exactly match inside counts for every scoped role/filter.
- [ ] Verify global CPO and dealer filters apply consistently across all stages.
- [ ] Verify agreements do not substitute a fake district when District is empty.

## 10. Performance and reliability

- [ ] Run a clean production build and targeted lint on every changed file.
- [ ] Run `git diff --check`.
- [ ] Run a local production-bundle stress test.
- [ ] Run the read-only Supabase load test with valid fake accounts for every role.
- [ ] Record p50, p95, p99, maximum latency, failures, and roles exercised.
- [ ] Investigate repeated requests above two seconds.
- [ ] Verify dashboard, activity log, vendor list, documents, payout ledger, and searches.
- [ ] Confirm indexes exist for stage/count queries and newest-first activity reads.
- [ ] Avoid loading full customer rows for cards/counts; fetch full details on open.
- [ ] Verify mobile session persistence when selecting files/photos outside the browser.
- [ ] Check browser console for uncaught errors and failed requests.

## 11. Release procedure

- [ ] Freeze database/schema changes during final verification.
- [ ] Review the final code diff with the requested-change list.
- [ ] Build once from the exact commit intended for production.
- [ ] Deploy the CRM while the maintenance page is active.
- [ ] Verify the custom domain serves the new build and version ID.
- [ ] Clear service-worker/CDN caches if applicable.
- [ ] Test Admin first using fake data.
- [ ] Test each fake role and the isolated fake customer.
- [ ] Remove the maintenance page only after all release gates pass.
- [ ] Monitor errors, activity logs, auth failures, and latency closely for one hour.
- [ ] Keep the previous production commit ready for immediate rollback.

## 12. Cleanup and handover

- [ ] Delete only tagged fake customers and dummy documents after verification.
- [ ] Confirm no test files remain in Storage.
- [ ] Restore test-account passwords or deactivate the accounts.
- [ ] Never delete real activity history to clean up testing.
- [ ] Document SQL applied, counts before/after, deployment commit, and test results.
- [ ] Give the client a short description of visible changes and known limitations.
- [ ] Schedule remaining architectural work instead of making rushed live changes.

## Production release gates — all must be true

- [ ] Fresh backup exists and restore has been proven.
- [ ] No unexplained data-count change.
- [ ] All supported roles pass login, visibility, and allowed-write tests.
- [ ] Full Loan and Cash workflow tests pass using fake customers.
- [ ] Stage changes and critical edits appear correctly in Activity Log.
- [ ] No failed requests or uncaught browser errors in the smoke test.
- [ ] Sidebar and inside counts match under role, CPO, dealer, and month filters.
- [ ] Performance is acceptable at expected concurrency.
- [ ] Rollback procedure is written and ready.
- [ ] Maintenance page remains available if rollback is required.
