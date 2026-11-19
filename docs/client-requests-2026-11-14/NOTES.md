
## Open question (2026-11-16)
- "Photo of the filled paper form": Mahvish thinks this may mean "everything (values and photos) becomes one PDF", which the OEM PDF on each complaint now does (D-038). It may instead mean a photo of the technician's paper service form. Mahvish confirms with Sandeep on 2026-11-17 **(uncertain until then)**.

## 2026-11-19: Tata form and installation photo list received
Sandeep sent both. Saved as `installation-photos.md` (17 photos) and `tata-oem-form/` (blank form). Built on `claude/nov14-tata-install-photos-13fa44`, not deployed.

- **Installation photos:** 17 photo boxes on the customer card (Installation Status) and in the vendor portal (Installation tab), with a count and the missing names. Screenshots in `installation-photos/`. Optional for now (D-041): nothing is blocked and the stage never moves on these photos; the geo tag photo stays compulsory and separate.
- **Tata claim:** in the OEM replacement box on a complaint, a Tata claim downloads/shares Tata's Field Service Report, filled in, followed by the usual claim pages with every photo. Sample: `tata-oem-form/sample-tata-field-service-report.pdf` (form page only, fake data; remake it with `node scripts/tata-service-report-sample.mjs`). Screenshots in `tata-oem-form/`.

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

### Open questions (2026-11-19)
- Is "Plant Photo" or "System no dur thi photo" the same picture as the geo tag photo? Today: separate.
- Battery boxes on the Tata form: leave blank (today) or print "N/A" (on-grid rooftop has no battery)?
- "Type of system: On-grid rooftop" is printed for every Tata claim. Are any Watersun systems hybrid or off-grid?
- Should the Tata PDF keep the extra claim pages (readings, photos) after Tata's form, or be Tata's single page only?
- Does Tata want any other number on the form (CSN / CRN, sales order no.)? We only keep the Tata complaint/ticket no.
- Gujarati customer names can't be printed by the PDF font and are left out; English names print normally.
