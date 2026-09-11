# Quotation Maker Implementation Plan

## Goal

Build a mobile-first quotation maker inside the existing Watersun CRM for Agents (`agent`) and Dealers (`agent2`). Users can create and save quotations, generate/download/share a three-page PDF, view their quotation history, and mark outcomes. Add to Leads is retained as deferred code behind a disabled feature flag.

## Confirmed Architecture

- `public.quotations` stores quotation prospects and quotation history.
- `public.admin` remains the CRM lead/customer table.
- `public.profiles` remains the user and role source.
- Lead lookup and conversion are deferred. The quotation maker does not currently read from or write to `public.admin`.
- The supplied `solar-quotation-maker` project is the visual and content reference.
- Supabase replaces the sample project's `localStorage` persistence.

## User Roles

### Agent and Dealer

- Create quotations.
- View and edit only their own quotations.
- Download and share their own PDFs.
- Mark their own quotations as lost.

### Admin and Sales

- View all quotations.
- Edit any quotation.
- Download any quotation.
- Assist with quotation outcome correction.

## Phase 1 — Backend Verification

- [ ] Confirm `public.quotations` exists.
- [ ] Confirm RLS is enabled.
- [ ] Confirm quotation number identity sequence works.
- [ ] Confirm Agent can insert a quotation owned by their own profile.
- [ ] Confirm Dealer can insert a quotation owned by their own profile.
- [ ] Confirm Agent A cannot read Agent B's quotation through the API.
- [ ] Confirm Dealer A cannot update Dealer B's quotation through the API.
- [ ] Confirm Admin and Sales can read all quotations.
- [ ] Confirm anonymous users cannot access quotations.
- [ ] Confirm foreign keys to `profiles` and `admin` are valid.

Acceptance: all role checks pass using direct Supabase queries, not only hidden UI controls.

## Phase 2 — CRM Navigation and Routing

- [ ] Add a Quotation Maker navigation item for Agent and Dealer portals.
- [ ] Add quotation access for Admin and Sales.
- [ ] Keep the feature hidden from Vendor and Stamp Maker roles.
- [ ] Add routes/views for quotation list, create, edit, and preview.
- [ ] Make browser back navigation safe on mobile.
- [ ] Warn before leaving when unsaved changes exist.

Acceptance: every permitted role can open the module and forbidden roles cannot access it directly.

## Phase 3 — Quotation Home Page

- [ ] Add a prominent `Create Quotation` button.
- [ ] Load quotations from Supabase, newest first.
- [ ] Show quotation number as `Quote-{quotation_no}`.
- [ ] Show customer name, phone, date, capacity, starting price, creator, and status.
- [ ] Add status filters: All, Draft, Issued, Converted, Lost.
- [ ] Add search by quotation number, customer name, and phone number.
- [ ] Add pagination or incremental loading.
- [ ] Add empty, loading, offline, and error states.
- [ ] Add actions: Edit, Preview, Download, Share, disabled Add to Leads placeholder, Mark Lost.
- [ ] Make list cards thumb-friendly on phone screens.

Acceptance: a user can locate and reopen any permitted quotation quickly on a phone.

## Phase 4 — Start Quotation Flow

- [ ] Present two choices: `New Customer` and `Autofill from Existing Lead`.
- [ ] For New Customer, open a clean quotation form.
- [ ] For Existing Lead, open a searchable lead picker.
- [ ] Query only leads already visible to the signed-in user under `admin` RLS.
- [ ] Prefill customer data without modifying the original lead.
- [ ] Save the selected lead ID as `source_lead_id`.
- [ ] Prevent accidental duplicate quotation creation from double taps.

Suggested lead mappings:

| Quotation field | Existing `admin` field |
| --- | --- |
| Customer name | `customer_name` |
| Phone | `phone_number` |
| Email | `email_address` |
| Address | `full_address` |
| Village | `villages` |
| Taluka | `sub_divisions` |
| District | `district` |
| Pincode | `pincode` |
| Capacity | `system_capacity_kwp` |
| Panel make | `module_brand` |
| Panel quantity | `no_of_modules` |
| Panel wattage | `module_wp` |

Acceptance: selecting a lead prefills every available mapped value, while manual fields remain editable.

## Phase 5 — Mobile-First Quotation Form

Use a stepper rather than placing the full desktop editor in one phone modal.

### Step 1: Customer

- [ ] Customer name.
- [ ] Phone number.
- [ ] Email address.
- [ ] Full address.
- [ ] Village.
- [ ] Taluka/subdivision.
- [ ] District.
- [ ] Pincode.
- [ ] Quotation date.
- [ ] Valid-until date.
- [ ] Salesperson name and phone, prefilled from the signed-in profile.

### Step 2: System

- [ ] Capacity in kW.
- [ ] Project type: Residential or Commercial.
- [ ] Solar-panel make.
- [ ] Solar-panel quantity.
- [ ] Inverter option.
- [ ] Inverter brand.
- [ ] GEB/GEDA charge: Including or Excluding.
- [ ] Project size, normally synchronized with capacity.

### Step 3: Pricing

- [ ] Exactly three brand/company options.
- [ ] Base value for each option.
- [ ] Discount for each option.
- [ ] Net payable calculated automatically.
- [ ] Subsidy for each option.
- [ ] Net price after subsidy calculated automatically.
- [ ] Optional apply-discount-to-all action.
- [ ] Optional apply-subsidy-to-all action.
- [ ] Store `starting_price` from the lowest valid net payable price.

Calculation rules:

```text
Net payable amount = Base value - Discount
Net price after subsidy = Net payable amount - Subsidy
```

Never trust a manually supplied calculated total; recalculate it before saving and before PDF generation.

### Step 4: Notes and Review

- [ ] Show standard notes from the supplied quotation sample.
- [ ] Allow additional custom notes.
- [ ] Allow custom notes to be removed before issue.
- [ ] Keep standard company, bank, terms, warranty, and BOM content centrally controlled.
- [ ] Show a complete summary before PDF preview.

Acceptance: the complete form is usable without horizontal scrolling on a typical phone.

## Phase 6 — Draft Persistence

- [ ] Create the Supabase row after the minimum customer name and phone fields are entered.
- [ ] Save form data into both searchable columns and versioned `quotation_data` JSON.
- [ ] Debounce autosaves to avoid a request on every keystroke.
- [ ] Show Saving, Saved, Offline, and Save Failed states.
- [ ] Keep a local recovery copy when the network is temporarily unavailable.
- [ ] Reconcile the local recovery copy after Supabase saves successfully.
- [ ] Use `schema_version: 1` for the initial stored document shape.
- [ ] Preserve old issued quotation snapshots when templates change later.

Acceptance: closing and reopening the browser restores the same draft from Supabase.

## Phase 7 — Validation

Before issuing or generating the final PDF, validate:

- [ ] Customer name is present.
- [ ] Phone number is valid.
- [ ] Quotation date is present.
- [ ] Capacity is greater than zero.
- [ ] Panel make is present.
- [ ] Panel quantity is greater than zero.
- [ ] Inverter selection is present.
- [ ] Project type is selected.
- [ ] GEB/GEDA selection is present.
- [ ] Three price options are complete.
- [ ] Every base value is greater than zero.
- [ ] Discounts and subsidies are non-negative.
- [ ] Calculated totals match the source amounts.
- [ ] Salesperson name and phone are present.

If validation fails, show one popup listing every missing value and the step containing it.

Acceptance: an incomplete quotation cannot be marked Issued or exported as a final PDF.

## Phase 8 — Three-Page Preview

- [ ] Port the sample's Page 1 customer/company introduction layout.
- [ ] Port Page 2 specifications and three-option price comparison.
- [ ] Port Page 3 terms, warranties, BOM, other charges, and bank details.
- [ ] Reuse Watersun branding assets from the main CRM where possible.
- [ ] Keep edit highlights in preview mode only.
- [ ] Remove highlights from downloaded PDFs.
- [ ] Maintain A4 dimensions and predictable page breaks.
- [ ] Add mobile zoom and full-screen preview.
- [ ] Verify long names, addresses, notes, and large currency values do not overflow.

Acceptance: all three pages visually match the approved sample at desktop and phone-generated PDF sizes.

## Phase 9 — PDF Download and Sharing

- [ ] Generate the PDF from the stored quotation snapshot.
- [ ] Use filename `Quotation_{quotation_no}_{customer_name}.pdf`.
- [ ] Download on phone and desktop.
- [ ] After download, show `Download complete`.
- [ ] Offer `Share file` through the native mobile share sheet.
- [ ] Allow WhatsApp selection when installed.
- [ ] Provide a normal downloaded-file fallback on unsupported browsers.
- [ ] Set `status = 'issued'` and `issued_at` after the first successful final generation.
- [ ] Do not change an already Converted or Lost quotation merely because its PDF is downloaded again.

Acceptance: Android and iPhone users can generate, download, and share the same valid PDF.

## Phase 10 — Add to Leads (Deferred)

- [x] Keep an “Add to Leads” button visible but disabled.
- [x] Do not open the Add Lead modal or write quotation data to `public.admin`.
- [x] Retain the mapping, modal wiring, repository helpers, and tests behind `LEAD_INTEGRATION_ENABLED = false` for later use.
- [ ] Later, decide the lead-storage and linking design before activating the button.

Acceptance for the current phase: quotation creation, editing, preview, download, sharing, and outcomes work independently of lead integration.

## Phase 11 — Lost Outcome

- [ ] Add a Mark Lost action.
- [ ] Require a reason.
- [ ] Allow an optional remark.
- [ ] Set status to `lost` and populate `lost_at`.
- [ ] Add a Reopen action where permitted.
- [ ] When reopened, return the quotation to `issued` or `draft` according to whether it was previously issued.

Acceptance: the home page clearly distinguishes pending, converted, and lost opportunities.

## Phase 12 — Template Governance

For the first release, keep standard template content in version-controlled constants rather than editable per-agent fields:

- [ ] Company name, GST, CIN, email.
- [ ] Company introduction.
- [ ] Standard notes.
- [ ] Terms and conditions.
- [ ] Warranties.
- [ ] BOM defaults.
- [ ] Bank details.
- [ ] Footer addresses.
- [ ] Logos and banners.

Each quotation must save a snapshot of these values in `quotation_data` when issued. A later phase may add an Admin-only quotation-template manager.

## Phase 13 — Audit and Activity

- [ ] Record quotation creation.
- [ ] Record first issue.
- [ ] Record major edits after issue.
- [ ] Record PDF download where useful.
- [ ] Record conversion and linked lead ID.
- [ ] Record lost and reopened outcomes.
- [ ] Store timestamps and actor IDs for outcome changes.

## Phase 14 — Testing Matrix

### Permissions

- [ ] Agent sees only their quotations.
- [ ] Dealer sees only their quotations.
- [ ] Admin and Sales see all quotations.
- [ ] Vendor and Stamp cannot access the module.
- [ ] API-level cross-owner reads and writes fail.

### Form

- [ ] Blank quotation.
- [ ] Existing-lead autofill.
- [ ] Autosave and reopen.
- [ ] Offline interruption and recovery.
- [ ] Validation popup lists all missing fields.
- [ ] Currency calculations are correct.

### PDF

- [ ] Android Chrome.
- [ ] iPhone Safari.
- [ ] Desktop Chrome/Edge.
- [ ] Three A4 pages with no clipping.
- [ ] Long customer name and address.
- [ ] Custom notes.
- [ ] Three price options.
- [ ] Download and native share.

### Outcomes

- [ ] Draft to Issued.
- [ ] Issued to Converted.
- [ ] Issued to Lost.
- [ ] Lost to Reopened.
- [ ] Existing lead does not duplicate during conversion.
- [ ] When activation is approved, repeated Add to Leads taps must not create multiple leads.

## Recommended Build Sequence

1. Backend verification and role tests.
2. CRM navigation and quotation list.
3. Create/edit form with Supabase draft saving.
4. Existing-lead search and autofill.
5. Three-page preview adaptation.
6. PDF generation, download, and native sharing.
7. Conversion to the existing Add Lead workflow.
8. Lost/reopen outcomes.
9. Permission, mobile, PDF, and regression testing.

## Definition of Done

- Agent and Dealer can independently create a quotation on a phone.
- Drafts persist in Supabase and appear on the quotation home page.
- Existing accessible leads can autofill a quotation.
- The generated PDF matches the supplied three-page design.
- PDF downloads and opens the phone's native share sheet.
- Quotation outcomes show Draft, Issued, Converted, or Lost.
- Conversion creates or links one record in `public.admin`.
- RLS prevents users from accessing another owner's quotations.
- Admin and Sales can oversee all quotations.
- Existing CRM stages and customer workflows continue working.
