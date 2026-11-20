
## Open question (2026-11-16)
- "Photo of the filled paper form": Mahvish thinks this may mean "everything (values and photos) becomes one PDF", which the OEM PDF on each complaint now does (D-038). It may instead mean a photo of the technician's paper service form. Mahvish confirms with Sandeep on 2026-11-17 **(uncertain until then)**.

## 2026-11-19: Tata form and installation photo list received
Sandeep sent both. Saved as `installation-photos.md` (17 photos) and `tata-oem-form/` (blank form). Built on `claude/nov14-tata-install-photos-13fa44`, not deployed.

- **Installation photos:** 17 photo boxes on the customer card (Installation Status) and in the vendor portal (Installation tab), with a count and the missing names. Screenshots in `installation-photos/`. Optional for now (D-041), except #17 "Inverter serial number photo", which is required to move from Installation Status to Geo Tag Photo (D-043). The stage never moves on these photos; the geo tag photo stays compulsory and separate.
- **Tata claim:** in the OEM replacement box on a complaint, a Tata claim downloads/shares Tata's Field Service Report, filled in, followed by the usual claim pages with every photo. *Changed 2026-11-20 (D-045), see below.* Sample: `tata-oem-form/sample-tata-field-service-report.pdf` (form page only, fake data; remake it with `node scripts/tata-service-report-sample.mjs`). Screenshots in `tata-oem-form/`.

What goes in each box of the Tata form:
| Box | Filled from |
|---|---|
| Date of visit | Latest visit with readings (reached time) |
| Customer's name | Customer card; phone, consumer no. and address on the two lines under it |
| Nature of complaint | Complaint problem + comment |
| Product | Faulty part + maker (e.g. "Inverter - Tata Power") |
| Type of system | "On-grid rooftop" **(uncertain: printed for every customer)** |
| Capacity, date of installation, module type | Customer card |
| Operating voltage (VDC) | DC Plus–Minus reading |
| Module Sl. No. | Faulty serial, only for a panel claim |
| Field observations | All six readings + float, faulty part and serial, the inverter on site, "What is wrong" |
| Action taken by CSPT representative | Latest visit result (Fixed / Revisit needed + note) |
| Technician signature box | "Name: <technician>" only |
| Top line | Watersun, complaint no., Tata ticket no. (once entered) |
| Left blank (by hand) | Sales order no., all battery checks and the battery health table, no./type of loads, array open-circuit voltage, array short-circuit current, total load, customer's remarks, both signatures |

### SQL for the 14 Nov work: run in this order (none run yet, AI tools never run SQL)
1. `supabase/migrations/20261116120000_reading_photos.sql`
2. `supabase/migrations/20261116130000_oem_past_data.sql`
3. `supabase/migrations/20261116140000_oem_claims.sql`

The 2026-11-19 work adds **no SQL**: installation photos are customer documents (`documents.doc_type` is free text), and the Tata report uses the `service_oem_claims` table from file 3.
The 2026-11-20 change (D-045) adds to file 3 itself: the column `service_oem_claims.form_values` and the function `service_oem_form`. Run order unchanged; still none run.

## 2026-11-20: Tata claim easy fill screen (D-045)
Mahvish wants technicians to fill the Tata form easily, add the readings table with photos as for the other OEMs, complete anything missing, then send the PDF. Built on `claude/nov14-tata-install-photos-13fa44`, not deployed.
- **Where:** on a Tata claim, the button "Fill Tata form" (office, and the technician on the open job). After saving, it reads "Tata form · 22 of 22 filled".
- **Screen (phone first):** 22 boxes in Tata's order (Customer and system, General checks, Report), started from the complaint, customer card and latest visit, all editable. Empty boxes say "Missing, fill in" and are listed at the top. CRM values show "From CRM" until saved.
- **Readings with photos:** the 6 readings with their meter photos from the latest visit, plus floating voltage. A missing reading is typed in; a missing photo is added by the technician on the job (camera or gallery). The office cannot add complaint photos (existing rule).
- **Save:** values are kept on the claim (`form_values`), and the office and the technician see the same values.
- **Last step, PDF:** Download, or Share on phones. Page 1 is Tata's form from the saved values; page 2 is the readings table with the 6 photos; then the other photos. Battery boxes and both signatures stay blank.
- Screenshots in `tata-oem-form/easy-fill/` (1-7 technician, 8-9 office). Sample `tata-oem-form/sample-tata-easy-fill-report.pdf` (3 pages, fake data, demo meter pictures).
- Demo: `complaints-demo.html?view=technician&page=jobs&job=i-8` (complaint #1008, 4 of 6 reading photos).

### Open questions (2026-11-19)
- Battery boxes on the Tata form: leave blank (today) or print "N/A" (on-grid rooftop has no battery)?
- "Type of system: On-grid rooftop" is printed for every Tata claim. Are any Watersun systems hybrid or off-grid?
- Should the Tata PDF keep the extra pages (now: the readings table with photos, then the other photos) after Tata's form, or be Tata's single page only? (D-045 dropped the claim / customer text pages.)
- Photos added on the Tata screen count toward the 10 site photos per complaint. Is that enough room? **(uncertain)**
- Does Tata want any other number on the form (CSN / CRN, sales order no.)? We only keep the Tata complaint/ticket no.
- Gujarati customer names can't be printed by the PDF font and are left out; English names print normally.
