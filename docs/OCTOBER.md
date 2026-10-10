# October - parked work and open decisions

Written 4 Oct 2026, the day of the release. Everything here is **not** in today's deploy, or is in it but switched off. For each: what it is, why it's parked, and what has to happen next. Technical detail and file names are in [BACKLOG.md](BACKLOG.md).

## Switched off in this release (one switch each in `src/constants.js`)

### 1. Quotation Maker - `QUOTATION_FEATURE_ENABLED = false`
- **State:** built and saved. Lock after download, "Revise" (Quote-<no>-R1, R2...), counts in the sidebar, PDF named by customer, converted state that clears if the lead is deleted. Hidden from everyone; saved quotations stay in the database.
- **Before switching on:**
  - Client approves the PDF look against their reference PDFs: number font, the "Authorised Channel Partner / Empanelment Vendor" block and logo sizes, table lines on page 3.
  - GEDA charges: move them to the bottom table, after Discount, on page 2 (client asked).
  - "Add to Leads" from a quotation should open the normal Add Lead form so details can be checked before saving.
  - Test conversion end to end with a real channel partner and dealer login.
- **To turn on:** set the switch to `true`, then deploy. No SQL needed.

### 2. Technician / field service - `TECHNICIAN_FEATURE_ENABLED = false`
- **Plan:** October week 2, together with WhatsApp.
- **Before switching on:**
  1. Run `supabase/migrations/20261004120000_allow_technician_role.sql`. The live role list doesn't include "technician", so technician accounts can't be created yet.
  2. Create one real technician account.
  3. Test: raise an issue from a completed customer, upload photos, technician claims it and gives it up, office enters a visit.
- **WhatsApp:** decide which messages are sent and when, customer consent, the provider (see earlier SMS/WhatsApp notes), delivery log, what happens when sending fails. Test with a small group first.

### 3. Personal (one-to-one) chats - `DIRECT_MESSAGES_ENABLED = false`
- **State:** the database already supports CPO ↔ their staff and dealers, dealer ↔ their CPO, and Admin/Office reading and replying in those chats. Only the screen is switched off.
- **Today:** "Office team" group chat plus announcements.
- **To turn on:** set the switch to `true`, then deploy. No SQL needed.

## Needs a decision with the client

### 4. Channel partners can't save most of their customers (diagnose first, change nothing yet)
- **What happens:** a channel partner sees customers where *Channel Partner* = their name, but can only save customers where *Dealer* = their name. That's true only for leads they typed in themselves.
- **Size:** about 1,070 customers are visible but locked; 12 are in active stages. In the history, channel partners have made 1 customer save, ever.
- **What they see:** "No customer row was updated" when saving a field or moving a stage in the agent portal. Dealers are not affected.
- **Ask the client:** should a channel partner edit (a) everything they can see, (b) their own and office-entered leads but not dealer leads, or (c) nothing, view only?
- **Fix after the answer:** one change to the save rule. It never changes who sees what.

### 5. Returned documents - agents can't replace them
- When the office presses "Send back" on a document, the channel partner or dealer is asked to upload a replacement.
- The app first tries to delete the old document. Agents aren't allowed to delete, so they get "Replacement failed" and end up with both files.
- This was already broken in the 10 Sep version.
- **Options:** (a) let agents delete only documents marked "[RETURNED]", or (b) don't delete; mark the old one "replaced" and keep both.

### 6. Duplicate file numbers
- 53 file numbers are now shared by two or more customers (48 on 3 Oct).
- New customers left blank get the next free number automatically. The new duplicates come from numbers typed in by hand.
- **Checked 4 Oct:** the automatic +1 works (highest number is 5096, so each new lead got 5097). But on 4 Oct office staff overwrote 5097 with their own series (97, 98, 99, 100, 101 for Bhagvan Thakor leads; earlier 36, 65, 00). Every one of those numbers was already used by another customer, so each typed number made a new duplicate. 15 customers have file number 0.
- Looks like some branches keep their own file-number series. **Ask the client** whether that is intended (then the number should be per branch) or a habit to stop (then the field should be read-only or warn).
- **Decide:**
  - Should the app warn when a typed file number is already in use?
  - Should the existing duplicates be renumbered?

### 7. Checks that were written but never switched on
Removed as dead code on 4 Oct. Decide whether any should become real rules (each changes behaviour):
- Material Order: roof/shed, DC/AC cable length, leg heights and invoice value required before saving.
- Vendor can't move to Geo Tag unless Installation = Yes.
- Vendor: "unsaved changes" warning on delivery details.
- Vendor: delete a geo-tag photo (the flow existed, with no button).

## Features to design

### 8. "Loaded" tick for panels - built 4 Oct (needs SQL)
- Each panel serial number has its own tick, saved to a new `panel_loading` table, with the date and who ticked it. Run `20261004150000_panel_loading_per_serial.sql` first; until then the panel ticks are locked with a note.
- A **Loading** on/off switch sits next to "Loading progress". Ticks (plain tick boxes, not switches) only appear while it is on. Turning it off saves and sets the loading date.
- The "Solar Panel" BOM line counts as loaded when every serial is ticked.

### 9. Log in as a user (admin), so you don't need passwords
- An admin-only "Log in as this user" button in User Management.
- It makes a one-time login link through an edge function. Every use is logged, and it's admin only.
- **Quicker option:** test accounts for each role (TEST Vendor, TEST Dealer...) with dummy customers.

### 9a. Chat notifications (asked 5 Oct)
Today: a red unread count on the chat button and in the browser tab title, updated live, but only while the CRM is open.

| Option | What people get | Effort | Cost | Catch |
|---|---|---|---|---|
| **A. Chime** | A short sound when a new message arrives while the CRM is open in any tab | Small (hours) | Free | Nothing if the CRM is closed. Browsers only play sound after the person has clicked on the page once. Needs a mute toggle. |
| **B. Browser push** | A phone/desktop notification even when the CRM tab is closed | Medium (1-2 days) | Free | Each person taps "Allow" once. Android and desktop Chrome/Edge work. **iPhone only if the CRM is added to the Home Screen** (iOS 16.4+). Needs a service worker, keys and an edge function that sends on each new message. |
| **C. Email** | An email for chats left unread | Medium (1 day) | Free on Brevo up to ~300 emails/day | Per-message emails get ignored or marked spam. Better: one email only if a message is still unread after ~10-15 minutes, or a daily summary. Needs a scheduled edge function and an email per user. |
| D. WhatsApp | A WhatsApp message | Larger | Paid per message, Meta approval | Same provider question as the technician/OTP work; not worth it for internal chat. |

- **Suggested:** A now (cheap, solves "didn't notice"), then B for people who keep the CRM closed. C only as a "you have unread messages" reminder, never per message.
- **Ask the client:** who must be reached when the CRM is closed (admin only, or vendors/CPs too), and whether staff use iPhones.

### 9b. Phone OTP - parked 5 Oct
- Edge function `phone-otp` and table `phone_otp_requests` are live but unused (no screen calls them). Tested end to end with Message Central: send and verify work.
- **Parked because:** Message Central's real minimum is a Rs 2,999 + GST pack that expires in 30 days; the SMS text ("valid for 10 mins") can't be changed and real validity is 60 s (max 300 s after top-up).
- **Next:** pick a provider with non-expiring credit (2Factor.in looked best: ~Rs 0.165/OTP, lifetime credit; check smallest pack and whether OTP works without DLT). Only the provider calls in the function change.
- Also decide what OTP is for (technician login vs on-site confirmation) before building the screen.

## Fix soon (technical, low risk)

| # | Item | Effect today |
|---|---|---|
| 10 | Orphaned stored files | 465 files, 97 MB, none newer than 29 Sep. 456 of them (79 folders) belong to customers that were permanently deleted; 9 come from document deletes. Fix for the 9: `20261004160000_storage_staff_read_for_delete.sql`. Cleanup: list with `scripts/list_orphan_storage_files.sql`, delete in Dashboard > Storage (SQL can't). |
| 11 | Vendor and stamp photo replace keeps the old photo | Duplicate photos build up; the failed delete isn't reported. |
| 12 | "Uploaded by" line on documents never shows | Run `20261004000200_record_document_uploader_role.sql`; the date on document cards also reads a column that doesn't exist (`created_at` should be `uploaded_at`). |
| 13 | Editing a delivery batch clears the batch's vendor field | Only the batch row; customers keep their vendor. |
| 14 | Reordering stops in a batch with a deleted customer can swap the wrong stops | No live batch affected now. Each reorder also adds noisy history rows. |
| 15 | Installation Payments red-flag list stops at 1,000 | Only matters once there are more than 1,000 flags. |
| 16 | Stage changes aren't limited to admin on the server | Every role with save access writes the stage directly; only the card override uses the admin-only function. |
| 17 | Vendor BOM print used a column that doesn't exist | Removed 4 Oct: vendors no longer see the BOM at all. |
| 18 | Any signed-in user can read and change every BOM | `bom` and `bom_items` policies are "allow all for authenticated users". Vendors, dealers and agents could edit any customer's BOM through the API. SQL ready 4 Oct: `20261004170000_scope_bom_access.sql` (read = anyone who can see the customer; change = admin, Office, CPO, office2). |

## Housekeeping

- Deploy the two updated edge functions (`add_user` no longer logs passwords; `send-lead-to-vendor` looks the vendor up itself).
- Turn on leaked-password protection (Supabase, Authentication).
- Revoke the GitHub token stored in `.git/config`; fix or delete `.github/workflows/deploy.yml`.
- Drop the table `restore_backup_2026_10_01` once you're sure it's not needed.
- Split the biggest files (AgentPortal 2,800 lines, CustomerDetailModal 2,400, VendorPortal 2,000), with tests first.
- 22 lint warnings left (13 hook-dependency warnings worth reviewing one by one).
