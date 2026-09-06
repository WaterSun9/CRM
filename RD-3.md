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
- [ ] Run `scripts/sync_sidebar_tag_counts.sql` and confirm each sidebar/inside pair matches.
- [x] Show Installation Payments only after a vendor is selected.
- [x] Use the same browser Save As flow for PDF and PNG downloads.
- [x] Add Loan By using the Registration By dropdown list.
- [ ] Run `scripts/add_loan_by_column.sql` in Supabase and verify `loan_by_added = true` before deployment.
- [x] Run build and targeted lint.
- [x] Verify the responsive controls locally without writing customer data.
- [x] Run the final read-only load test for this batch (admin/vendor succeeded; six stored test credentials need refreshing).
- [ ] Obtain approval before production deployment.
