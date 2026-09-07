# RD-3 — Paused deployment batch

Deployment status: **PAUSED — do not deploy until this checklist is verified and approved.**

- [x] Show Bank Name and Bank Branch in Leads only when Payment Type is Loan.
- [x] Place those loan bank fields before the document checklist.
- [x] Make Material Order notes readable and editable on phone screens without clipping.
- [x] Add Dealer filtering after a Channel Partner/CPO is selected.
- [x] Add creation-month filtering and matching count to Leads.
- [x] Add registration-month filtering and matching count to Registration.
- [x] Add one-click ZIP download for all documents attached to one customer.
- [x] Show File No., Panel, and WP on customer cards, including tag views.
- [x] Remove Completed customers from Loan, Subsidy, and Installation tag views.
- [x] Include Loan-stage customers in the Loan Tags "All" view before a tag is assigned.
- [x] Align the three sidebar tag counts with the eligibility rules used inside each tag view.
- [x] Make Dealer a global child filter across dashboard metrics, every stage, global search, export, and all tag views.
- [x] Parallelize startup Auth/Profile verification and remove the duplicate immediate heartbeat.
- [x] Prioritize tag-view customer records before launching background count queries.
- [x] Reduce Activity Log payload and remove the repeated Profile join.
- [ ] Run `scripts/optimize_activity_log_reads.sql` by itself for newest-first Activity Log reads.
- [x] Persist mobile sessions while Camera/Gallery/Files is open and tolerate transient focus-network errors.
- [ ] Run `scripts/sync_sidebar_tag_counts.sql` and confirm each sidebar/inside pair matches.
- [x] Show Installation Payments only after a vendor is selected.
- [x] Use the same browser Save As flow for PDF and PNG downloads.
- [x] Add Loan By using the Registration By dropdown list.
- [ ] Run `scripts/add_loan_by_column.sql` in Supabase and verify `loan_by_added = true` before deployment.
- [x] Run build and targeted lint.
- [x] Verify the responsive controls locally without writing customer data.
- [x] Run the final read-only load test for this batch (admin/vendor succeeded; six stored test credentials need refreshing).
- [ ] Obtain approval before production deployment.

## Deferred Activity Log improvements

- [ ] Add a Role filter (Admin, Sales/Office, CPO, Manager, CP, Dealer, Vendor, Stamp).
- [ ] Record account-role changes as a dedicated `role_change` action showing old role → new role and who changed it.
- [ ] Add quick filters for customer edits, stage changes, account changes, errors, uploads, and deletions.
- [ ] Store reliable field-level before/after values so a reported reversion can be traced without treating the current row as the only source of truth.
- [ ] Add date/month filtering and customer File Number/Consumer Number search.
- [ ] Review retention and access rules before adding database-level audit history, because it will create additional audit records.
