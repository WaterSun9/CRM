# Quotation and loading update — 22 October 2026

- Customer entry stays first. Pricing includes separate Module Wp, module count and calculated kWp for each panel option. Notes and review follow pricing on the same step.
- Comparison quotes keep three options. After selecting an option and saving the lead, a separate final quotation opens for editing. Converted records also have a Final quotation button for reopening/retry.
- Final quotations keep all THREE pages. Page 2 contains one selected option. Page 1 retains the introduction; page 3 retains terms, warranty, BOM and bank details, with the selected equipment values filled in.
- The original comparison stays locked after export. The separate final remains editable after export, and edits do not rewrite the original comparison or existing saved loan PDFs.
- Final records link to the converted customer through source_lead_id. Loan tab includes preview/edit/download and save-to-Loan controls. Download & save on a final quote uploads a loan_quotation PDF to existing customer document storage. This uses existing tables/columns and existing authorization rules.
- Truck-loaded confirmation saves the server-stamped loader name alongside the existing BOM material-loaded date. Material Integration reads current milestone values even when its items came from an older customer/cache snapshot. Direct loading in Material Integration also stamps the signed-in person's name.

Validation: ESLint has no errors; all 152 Node tests pass; production build succeeds (existing dependency/chunk warnings). Isolated browser preview showed all three final pages, only the chosen option on page 2, selected specifications in the BOM, and successful PDF generation. Screenshot: final-selected-panel.png.

Frontend deployed to https://crm.watersunsolar.com on 22 October 2026. No production records, storage objects or database schema were changed during testing. Real-role storage permissions and a real Loan PDF upload remain deployment smoke checks. Existing quotation RLS is retained; no roles were granted new access.

Follow-up: Save as draft is explicit in the editor; final preview has Save as draft & back. Saving an exported final resets its current status to draft while retaining issued history. Browser checked download -> save as draft -> reopen -> edit price -> save -> reopen with the edited price retained, using memory-only database and storage. Client sample PDF: output/pdf/Watersun-Final-Quotation-Sample.pdf; all three rendered A4 pages inspected. Page 2 brand header contains only the brand name.

Release preflight: last backup workflow 39689918446 succeeded (21 October UTC). Production version before release: d2624f6-mvc8aqzc. GitHub Pages source is gh-pages; use npm run deploy. Existing warranty/visit/trip/OTP REST resources resolve and reject anonymous reads; service-otp GET returns its expected 405 POST-only response. This establishes endpoint presence, not signed-in role or SMS delivery success. No Supabase migrations/settings changes are included in this release.

Deployment confirmed: source commit a36d690, build a36d690-mvjshba6, Pages commit 81833bdc37533cdbcca5375ba2875c74b0086e0c. GitHub Pages reports built without error; the production domain serves the matching build. No Supabase schema, secrets, settings, or edge-function deployment was changed. Firebase SMS delivery and signed-in role tests remain client preview checks.

## Won flow and lead documents

- The existing converted outcome is labelled Won in tabs and cards; no database status changes.
- Won opens the three priced panel choices, then the existing prefilled lead form. After the lead saves, the list selects Won and asks whether to revise the final document or skip to preview.
- Revision opens Customer and Pricing & review with only the chosen panel. The three-page document retains introduction, terms/warranty and BOM.
- Won-card preview, download and share resolve to the editable final quotation.
- Final quotation controls moved from Loan to the Lead tab, available for both Cash and Loan leads. New PDFs use lead_quotation and also appear in the card's all-documents gallery. Existing loan_quotation PDFs remain accessible in the Lead section; historical files/data are not migrated.
- Local in-memory browser check: issued quotation → Won → Tata option (600 Wp × 7, 4.2 kWp) → prefilled lead → Won prompt → revise → two editor steps → three-page preview containing only Tata → draft save/reopen. No live records written.
- ESLint, 152 automated tests and production build passed. Live signed-in upload still requires a client check.
