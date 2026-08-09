# Watersun Electrical Solutions Pvt Ltd — CRM Technical Specification
> This document is the single source of truth for the CRM deployment.

---

## Client Information

| Field | Value |
|---|---|
| Company Name | Watersun Electrical Solutions Pvt Ltd |
| Client Name | Sandip Jayantilal |
| Phone | 76989 54588 |
| Email | — |
| CRN Prefix | CRN-2026- |
| CRN Scope | both |

---

## Database Schema — Table: `admin`

| Column | Type | Label | Section |
|---|---|---|---|
| `id` | UUID (PK) | Auto-generated ID | Identity |
| `created_at` | TIMESTAMPTZ | Record creation timestamp | Identity |
| `updated_at` | TIMESTAMPTZ | Last update timestamp | Identity |
| `deleted_at` | TIMESTAMPTZ | Soft-delete timestamp | Identity |
| `customer_name` | TEXT | Customer Name | Customer Details |
| `phone_number` | NUMERIC | Phone Number | Customer Details |
| `email_address` | TEXT | Email Address | Customer Details |
| `payment_type` | TEXT | PAYMENT TYPE | Customer Details |
| `villages` | TEXT | Villages | Customer Details |
| `folder_no` | NUMERIC | Folder No | Customer Details |
| `system_capacity_kwp` | NUMERIC | System Capacity (kWp) | Project / Technical |
| `module_brand` | TEXT | MODULE BRAND | Project / Technical |
| `module_wp` | NUMERIC | Module Wp | Project / Technical |
| `registration_date` | DATE | Registration date | Project / Technical |
| `panel_serial_no` | TEXT | PANEL SERIAL NO. | Project / Technical |
| `inverter_serial_no` | TEXT | INVERTER SERIAL NO. | Project / Technical |
| `invoice_no` | TEXT | INVOICE NO | Project / Technical |
| `adhaar_card` | BOOLEAN DEFAULT false | Adhaar card | Project / Technical |
| `pan_card` | BOOLEAN DEFAULT false | Pan card | Project / Technical |
| `index_2` | BOOLEAN DEFAULT false | Index 2 | Project / Technical |
| `light_bill` | BOOLEAN DEFAULT false | Light Bill | Project / Technical |
| `bank_details` | BOOLEAN DEFAULT false | Bank details | Project / Technical |
| `bank_passbook` | BOOLEAN DEFAULT false | Bank Passbook | Project / Technical |
| `application_done_by` | TEXT | Application processor | Company Tracking |
| `consumer_no` | NUMERIC | CONSUMER NO | Company Tracking |
| `channel_partner` | TEXT | CHANNEL PARTNER | Company Tracking |
| `sub_channel_partner` | TEXT | SUB CHANNEL PARTNER | Company Tracking |
| `sub_divisions` | TEXT | Sub Divisions | Company Tracking |
| `stage` | TEXT | Pipeline stage | Stage |
| `subsidy_history` | JSONB | Subsidy status timeline | History |
| `bank_name` | TEXT | Bank Name | Bank Info |
| `follow_ups` | JSONB | Follow-up reminders | Internal |
| `internal_remarks` | TEXT | Admin-only notes | Internal |
| `loan_registration_date` | DATE | Loan Registration Date | Project / Technical |
| `branch_name` | TEXT | Branch Name | Company Tracking |
| `registration_by` | TEXT | Registration Processor | Company Tracking |
| `panel` | TEXT | Panel Info | Project / Technical |
| `stamp` | BOOLEAN | Stamp Checked | Checklist |
| `file_status` | BOOLEAN | File Status Checked | Checklist |
| `geb_inspection` | BOOLEAN | GEB Inspection Checked | Checklist |
| `subsidy_redeem` | BOOLEAN | Subsidy Redeem Checked | Checklist |
| `sfdc_photo` | BOOLEAN | SFDC Photo Checked | Checklist |
| `warranty_card` | BOOLEAN | Warranty Card Checked | Checklist |
| `insurance_status` | BOOLEAN | Insurance Status Checked | Checklist |
| `stages_remarks` | JSON | Stage Remarks Map | Internal |
| `subsidy_tag` | TEXT | Subsidy Tag | Stage |

---

## Supporting Tables

### `profiles`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK, FK → auth.users) | Linked to Supabase Auth |
| `name` | TEXT NOT NULL | Display name |
| `email` | TEXT NOT NULL | Login email |
| `user_type` | TEXT | admin (Admin) / sales (Office) / agent (Channel Partners) |
| `code` | TEXT | Agent referral code |
| `branch` | TEXT | Assigned branch |
| `role` | TEXT | Job title |
| `status` | TEXT | active / inactive |

### `activity_log`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `user_id` | UUID (FK → profiles) | Who performed the action (sets null on delete) |
| `action` | TEXT NOT NULL | Action type (edit, create, delete) |
| `message` | TEXT NOT NULL | Human-readable description |
| `new_value` | TEXT | Changed value |
| `created_at` | TIMESTAMPTZ | When it happened |
| `customer_id` | UUID (FK → admin) | Associated customer ID (cascades on delete) |
| `customer_name` | TEXT | Associated customer name (auto-populated by trigger) |
| `stage` | TEXT | Associated customer stage (auto-populated by trigger) |

### `metadata`
| Column | Type | Notes |
|---|---|---|
| `id` | UUID (PK) | Auto-generated |
| `category` | TEXT NOT NULL | Dropdown group key |
| `label` | TEXT NOT NULL | Display option value |
| Constraint | UNIQUE(category, label) | No duplicate options |

---

## Pipeline Stages (in order)

1. LEADS
2. REGISTRATION
3. LOAN
4. MATERIAL PROCUREMENT
5. HOLD PROCUREMENT
6. MATERIAL DELIVERY
7. INSTALLATION STATUS
8. GEO TAG PHOTO
9. DISCOM SUBMISSION
10. METER INSTALLATION
11. DISCOM INSPECTION
12. SUBSIDY STATUS
13. FINAL REVIEW
14. COMPLETED

---

## Security — User Types & Access Levels

| User Type | Access Level |
|---|---|
| `admin` (Admin) | Full access: all modules, all records, user management, logs, trash |
| `sales` (Office) | Operations: customer records, projects, stages, checklists |
| `agent` (Channel Partners) | Agent portal: submit leads via autocomplete agent form only |

---

## Row-Level Security (RLS) Policies

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `admin` | ✅ All auth users | ✅ All auth users | ✅ All auth users | ❌ Blocked |
| `profiles` | ✅ All auth users | — (via edge function) | ✅ Own profile only | ❌ Blocked |
| `activity_log` | ✅ All auth users | ✅ All auth users | ❌ Immutable | ❌ Immutable |
| `metadata` | ✅ All auth users | ✅ All auth users | ✅ All auth users | ❌ Blocked |

---

## Dropdown Fields → Metadata Categories

| Field | Category Key | Default Options |
|---|---|---|
| PAYMENT TYPE | `payment_type` | LOAN, CASH |
| MODULE BRAND | `module_brand` | TATA, ADANI, GOLDI, WAAREE, AATMANIRBHAR, APS, SUNORA |
| Payment Method Modes | `payment_method_modes` | Online Transfer, Cash, Check, Bank Solar Loan, Personal Loan |
| Subsidy Approval Status | `subsidy_approval_status` | Pending, Approved, Rejected, Returned |
| Branch Name | `branch_name` | (Configurable by admin) |
| Registration By | `registration_by` | (Configurable by admin) |

---


## Checklist / Toggle Fields

| Field | Type | DB Column(s) |
|---|---|---|
| Adhaar card | Boolean | `adhaar_card` |
| Pan card | Boolean | `pan_card` |
| Index 2 | Boolean | `index_2` |
| Light Bill | Boolean | `light_bill` |
| Bank details | Boolean | `bank_details` |
| Bank Passbook | Boolean | `bank_passbook` |

---

## Agent Portal Lead Form Fields (New Lead Model)

| Field | Form Field Key | Type | Category/Source | Required |
|---|---|---|---|---|
| Customer Name | `customer_name` | Text | User input | Yes |
| Customer Phone Number | `phone_number` | Number | User input | Yes |
| Email Address | `email_address` | Text | User input | No |
| Sub Channel Partner Name | `sub_channel_partner` | Text | User input | No |
| Channel Partner Name | `channel_partner` | Text (Autocomplete) | `metadata` category `channel_partner` | Yes |
| Consumer No | `consumer_no` | Number | User input | No |
| System Capacity (kWp) | `system_capacity_kwp` | Number | User input | Yes |
| System Brand | `module_brand` | Select | `metadata` category `module_brand` | No |
| Module Wp | `module_wp` | Number | User input | No |
| Village | `villages` | Text | User input | No |
| Sub Division | `sub_divisions` | Text | User input | No |
| File No | `folder_no` | Text | User input | No |
| Payment Type | `payment_type` | Select | `metadata` category `payment_type` | No |

---


## Backend Configuration

| Setting | Value |
|---|---|
| Database | Supabase (PostgreSQL) |
| Main Table | `admin` |
| Auth | Supabase Auth (email/password) |
| Edge Function | `smooth-worker` (user create/deactivate) |
| Frontend | React (Vite) → Static build → GitHub Pages |
| Hosting | GitHub Pages (free, custom domain via CNAME) |
| Keep-Alive | GitHub Action: pings Supabase every 4 days |
| Daily Backup | GitHub Action: CSV export to private repo |

## GitHub Secrets Required

| Secret | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (build-time) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous key (build-time) |
| `SUPABASE_URL` | Supabase project URL (workflows) |
| `SUPABASE_ANON_KEY` | Supabase anonymous key (workflows) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (backup, edge functions) |
| `BACKUP_PAT` | GitHub PAT for backup repo access |
| `BACKUP_REPO` | Backup repo path (e.g. `user/backups`) |


