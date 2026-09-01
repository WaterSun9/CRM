# 📊 Supabase Data Migration & Error Audit Report

**Date & Time:** 2026-09-01 17:23:03  
**Source Dataset:** `new_data.csv`  
**Target Output File:** `clean_admin_data.csv`  
**Target Database Table:** `public.admin`  

---

## 📈 Executive Summary

| Metric | Count | Status |
| :--- | :---: | :--- |
| **Total Rows Processed from Raw CSV** | **4882** | 📥 Analyzed |
| **Valid Rows Cleaned & Ready for Supabase** | **4804** | 🚀 Ready to Upload |
| **Skipped Rows (Missing Customer Name)** | **78** | ⚠️ Skipped as per rule |
| **Valid Registration Dates Standardized** | **4308** | ✅ Formatted `YYYY-MM-DD` |
| **Valid Loan Dates Standardized** | **450** | ✅ Formatted `YYYY-MM-DD` |
| **Text Notes Extracted from Date Fields** | **106** | 📝 Saved into `internal_remarks` |

---

## 🧹 Hyphens & Placeholders Converted to NULL

Standalone hyphens (`-`, `--`) and placeholders were safely converted to empty (`NULL`) without dropping rows:

| Raw Column Header | Standalone Hyphens / Placeholders Cleaned |
| :--- | :---: |
| `Loan Tags` | **4223** |
| `LOAN /CASH` | **3894** |
| `Instalation Tag` | **761** |
| `Module (Wp)` | **708** |
| `Subsidy Tag` | **697** |
| `MODULE BRAND` | **652** |

---

## 📅 Text Notes Extracted from Date Fields

Operational comments entered into date columns were converted to `NULL` for the SQL date column and preserved inside `internal_remarks`:

| Line in CSV | Customer Name | Extracted Note (Saved to `internal_remarks`) |
| :---: | :--- | :--- |
| 2480 | RAJPUT MANISHBHAI JOGABHAI | `Text in date field: 'HOLD'` |
| 2518 | HARIJAN RAMABHAI KARSHANBHAI | `Text in date field: 'Name change'` |
| 2554 | PATEL KARMANBHAI RAMSUNGHBHAI | `Text in date field: 'DATA NOT FOUND'` |
| 2559 | THAKOR RAMJIBHAI DALABHAI | `Text in date field: 'Name change'` |
| 2561 | PATEL RAMESHBHAI MADEVABHAI | `Text in date field: 'DATA NOT FOUND'` |
| 2626 | THAKOR BHARATBHAI MASHARUBHAI RUPABHAI | `Text in date field: 'cancel'` |
| 2660 | SHANKARBHAI HARDASBHAI DESAI | `Text in date field: 'cancel'` |
| 2662 | SUTHAR JAYNTIBHAI NAVABHAI | `Text in date field: 'Another vender'` |
| 2669 | JOSHI JAGDISHBHAI RAVJIBHAI | `Text in date field: 'Another vender'` |
| 2703 | CHAUDHARI NAVABHAI RUPABHAI | `Text in date field: 'Another vender'` |
| 2710 | PARMAR HIRA GANA | `Text in date field: 'Mobile number'` |
| 2711 | MAHESHBHAI AMBABHAI SHEKHLIYA | `Text in date field: 'NO LIGHT BIL'` |
| 2712 | SUTHAR JAYNTIBHAI NAVABHAI | `Text in date field: 'OUT OF SERVICE'` |
| 2713 | SEKHALIYA DASRATHBHAI OMBABHAI | `Text in date field: 'NO LIGHT BIL'` |
| 2718 | JOSHI BHAYRAMBHAI VALABHAI | `Text in date field: 'A2 bill'` |
| 2759 | HARIJAN MAGANBHAI RAGABHAI | `Text in date field: 'Not confirm yet'` |
| 2787 | PAWAR IBRAHIM KARIMBAX | `Text in date field: 'Name change'` |
| 2813 | GHANCHI SAFIKBHAI MAHMADBHAI | `Text in date field: 'Name change'` |
| 2816 | RAJPUT SURESHBHAI PIRAJI | `Text in date field: 'Not confirm yet'` |
| 2847 | RAJPUT HATHAJI PIRAJI | `Text in date field: 'Name change'` |
| 2858 | SADHU CHAMANDAS HEMDAS | `Text in date field: 'Different documents'` |
| 2867 | VYAS SONALBEN DHAVALKUMAR | `Text in date field: 'change passbook'` |
| 2885 | RANA MAFATLAL BABABHAI | `Text in date field: 'Another vender'` |
| 2895 | RABARI RAMILABEN KARSHANBHAI | `Text in date field: 'LIGHTBILL'` |
| 2898 | PAVRA NARANBHAI CHELABHAI | `Text in date field: 'FILE CANCLE'` |
| ... | *and 81 more rows* | ... |

---

## 🚫 Skipped Rows Log (Missing Customer Name)

As required by the schema constraint (`customer_name text NOT NULL`), rows with missing/blank names were skipped:

| Raw CSV Line | Folder Number | Channel Partner | Stage | Reason |
| :---: | :---: | :--- | :--- | :--- |
| 50 | 49 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 151 | 150 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 173 | 172 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 178 | 177 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 212 | 211 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 220 | 219 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 227 | 226 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 228 | 227 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 237 | 236 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 239 | 238 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 240 | 239 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 244 | 243 | BHAGVAN THAKOR | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 246 | 245 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 273 | 272 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 280 | 279 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 281 | 280 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 377 | 376 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 378 | 377 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 403 | 402 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 414 | 413 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 424 | 423 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 692 | 691 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 1033 | 1032 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 1129 | 1128 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| 1226 | 1225 | Deborded | Lost Project | Missing Customer Name (NOT NULL constraint) |
| ... | ... | ... | ... | *and 53 more placeholder rows* |

---

## ✅ Column Alignment & Target Types Verification

| Target Column in Supabase | Type in Postgres | Verification Status |
| :--- | :--- | :--- |
| `customer_name` | `text NOT NULL` | 100% Populated & Trimmed |
| `folder_no` | `numeric` | Clean sequential integer |
| `phone_number` | `text` | Clean digits matching `^\+?[0-9]{1,15}$` |
| `consumer_no` | `text` | Clean numeric digits |
| `system_capacity_kwp` | `numeric` | Clean decimal (e.g. `3.24`) |
| `module_brand` | `text` | Standardized uppercase brands |
| `module_wp` | `numeric` | Clean integer wattage |
| `registration_date` | `date` | Standardized `YYYY-MM-DD` |
| `loan_registration_date` | `date` | Standardized `YYYY-MM-DD` |
| `payment_type` | `text` | `CASH` / `LOAN` / `NULL` |
| `loan_tag` | `text` | Standardized loan dropdown enums |
| `subsidy_tag` | `text` | Standardized subsidy dropdown enums |
| `stage` | `text` | Standardized stage uppercase enums |
| `installation_status` | `text` | Standardized installation enums |
| `channel_partner` | `text` | Clean trimmed text |
| `sub_channel_partner` | `text` | Clean trimmed text |
| `villages` | `text` | Clean trimmed text |
| `sub_divisions` | `text` | Clean trimmed text |
| `bank_name` | `text` | Clean trimmed text |
| `bank_branch` | `text` | Clean trimmed text |
| `registration_by` | `text` | Clean trimmed text |
| `invoice_no` | `text` | Clean text identifier |
| `stamp` | `boolean` | `TRUE` / `FALSE` |
| `insurance_status` | `boolean` | `TRUE` / `FALSE` |
| `sfdc_photo_text` | `text` | Text status / photo notes |
| `warranty_card_text` | `text` | Text status / warranty notes |
| `file_status` | `text` | Clean file status |
| `internal_remarks` | `text` | Original remarks + preserved notes |

---
*Generated by Antigravity Automation Pipeline*
