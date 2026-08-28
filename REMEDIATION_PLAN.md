# Watersun CRM — Remediation Status

Clean phase-by-phase status, most recent update first. Full technical
detail for every item (file names, line numbers, exact code) lives in the
working plan file the assistant maintains at
`~/.claude/plans/linked-prancing-squid.md` — this file is the readable
summary of the same thing.

**Legend:** ✅ done & verified · ⏭️ not started · 🟡 partially done / in
progress · 🔴 needs your action (not something code can fix) · ⏸️ deliberately deferred

---

## ⏭️ One name, entered once, identical everywhere (agreed approach — not yet built)
Every portal decides what a user can see by **matching name strings**, not ids:
`admin.channel_partner` vs `profiles.channel_partner`, and
`admin.sub_channel_partner` vs `profiles.name`. Matching is case-insensitive
but **whitespace-sensitive**, so `RAJU BHAI` ≠ `RAJUBHAI`. A single stray
space or a differently-cased entry means that person logs in to an empty
portal — no error, just nothing.

**Root cause: two doors with two different rules.**
- *Add CPO* normalizes: `branch.trim().toUpperCase()`
  (`ChannelPartnerManagementView.jsx:150`)
- *User Management* uppercases the person's **name** but stores the **branch
  exactly as typed** (`UserManagementView.jsx:229`)

That is how `Radhe Solar` came to exist beside leads filed under `RADHE`.

**Agreed design — type a branch name in exactly one place:**
1. **Single point of entry.** A branch name is typed only when a *CPO* is
   created. Done: Managers/Agent 2/Agents now pick from a dropdown built from
   registered CPO branches, and the branch is required on create.
2. **Normalize on write, everywhere.** Apply the same `.trim().toUpperCase()`
   to branch and person names at *every* write path, so the two doors agree:
   - `UserManagementView` → `channel_partner` (currently unnormalized)
   - `ChannelPartnerManagementView` → already correct, keep as reference
   - `AddLeadModal` / `AgentPortal.handleSubmitLead` → inherit from the profile,
     never free text
   - The inline Branch/Partner editor in the user table
3. **Never type a name that already exists.** The remaining free-text field is
   `ChannelPartnerAutocomplete` on admin lead creation — it accepts arbitrary
   text and can mint a new branch by typo.

**Also keep person names unique.** `MANOJ` currently exists twice (once
`agent2`, once `channel_partner_office`); duplicate names make name-based
matching ambiguous in both directions.

**Not doing:** database-side normalization (citext / trigger / generated
column). Data is being replaced and will be aligned by hand.

---

## ✅ Login with no profile row grants Office access (fail-open) — FIXED
A session whose `auth.users` row exists but has **no matching
`public.profiles` row** is not rejected. `src/App.jsx` falls back to
`userType: 'sales'`, which routes to `<Dashboard>` — the Office view with
the full customer pipeline. A missing profile therefore *grants* access
instead of denying it.

Found while debugging "Forbidden: Access denied" on user creation: seven
orphaned auth users existed, three with real-looking addresses
(`rr644165@gimail.com` — note the typo'd domain, `gelotsanjay5@gmail.com`,
`joshipankaj940@gmail.com`). Orphans are created by deleting a profile row
directly in the Supabase table editor; the auth user survives, since the
FK cascades `profiles → auth.users`, not the reverse. The `add_user` edge
function itself is clean — it already rolls back the auth user when the
profile insert fails.

**Fixed in `src/App.jsx`.** There were *two* fail-open paths, not one:
- **No profile row** → now logs the auth id, calls `signOut()` and clears the
  user, exactly like the `status === 'inactive'` branch above it.
- **Profile lookup threw** → previously also granted `sales`. Now clears the
  user without signing out, so the role is never assumed while a transient
  network error is left recoverable on retry.

Neither path can reach the Office Dashboard any more.

**Watch for:** any orphaned auth user is now locked out at login (intended).
If someone reports being unable to log in, check they have a profile row:
```sql
select u.id, u.email, u.created_at
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null;
```

---

## ✅ Agent Portal: BOM/Discom now use the EXACT SAME components as Admin
You asked directly whether true, pixel-for-pixel parity was even
possible and wanted honesty if not — it was possible, my first pass had
just built simplified stand-ins instead of reusing Admin's real pieces.
Reworked properly:
- Fixed the real bug behind "BOM print doesn't look like admin's": a
  broken database query silently returned zero BOM line items every
  time (fixed — same query Admin's version uses). Also fixed the print
  showing "General Type" instead of "Roof/Shed Type."
- Discom Submission: reverted my first, custom-built version and
  replaced it with a "Preview PM Surya Ghar Agreement" button that opens
  the literal same reusable document-preview component Admin uses (not
  a copy — the exact same one), so zoom, print, and layout are identical.
- BOM print: replaced Agent's print mechanism (which used a different
  technique than Admin's) with Admin's exact print method, copied
  directly.
Per your call: view-only for Agent — no editing or stamp-approval
powers, those stay Admin/Office-only; this is purely about the document
view/print matching exactly.

## ✅ User Management: "Failed to create user" — real cause found, one more SQL step
The error message was hiding the real problem. Fixed the code so real
errors show up now (already found and fixed 2 things this surfaced):
you were testing on the wrong port (switched, no action needed), and a
security-rule check on the roles table doesn't currently allow every
role the app actually has. Run this in the Supabase SQL Editor:
```sql
alter table public.profiles drop constraint if exists profiles_user_type_check;
alter table public.profiles add constraint profiles_user_type_check
  check (user_type in ('admin', 'sales', 'channel_partner_office', 'office2', 'agent2', 'agent', 'vendor', 'stamp', 'channel_partner_office_manager', 'dealer'));
```
Try creating a user again after that and let me know what happens.

## 🔴 CRITICAL — Delivery batches: 4 stacked bugs found, 3 fixed in code, 1 needs SQL

Confirmed every one of these by testing directly against your live
database, not guessing.

**Bug 1 (fixed) — wrong id format.** Batch creation was generating a
plain text id, but the database column expects a real UUID. Every save
failed at the database step since the table was created — it looked
saved because the screen updates before the write happens, and the
failure was silently swallowed. Fixed, confirmed against the live DB.

**Bug 2 (fixed — you ran this SQL already) — no write permission.** The
table had security rules with no rule allowing writes. You already ran
the fix for this.

**Bug 3 (fixed — you ran this SQL already) — missing column.** The code
was writing an `updated_at` field the table didn't have. You already
added it.

**Bug 4 (fixed, just found) — this is the one that caused what you saw:
"no batches" on the list, but "no available customers" in the picker.**
Even when the batch save failed, the code was *still* going ahead and
marking every selected customer as "already in a batch" — because that
marking happens in a totally separate write to the customer table,
disconnected from whether the batch itself actually saved. So every
failed test attempt (during all this debugging) quietly used up your
available Material Delivery customers without ever creating a real
batch. Fixed: the customer-marking step now only runs if the batch
itself genuinely saved.

**Cleanup needed — run this SQL** to release the customers that got
incorrectly marked "batched" during those failed attempts (this only
touches records pointing at a batch that doesn't actually exist, so any
genuinely real assignment is left alone):
```sql
update public.admin
set delivery_batch_id = null
where delivery_batch_id is not null
  and not exists (
    select 1 from public.delivery_batches db where db.batch_no = admin.delivery_batch_id
  );
```

**Bonus fix, you also asked for this:** there was no way to remove a
customer from an existing batch. Turns out the Edit Batch screen already
lets you uncheck a customer — it just never actually released them
afterward. Fixed — unchecking someone and saving now properly frees them
up again.

**Bug 5 (just found and fixed) — "operator does not exist: uuid = text."**
The save was sending your ENTIRE batch list to the database every time,
not just the one you were creating — and since real saves have been
failing since the table was created, your browser had quietly built up
old fake batches (from before Bug 1 was fixed) mixed in with the real
one. The database choked comparing those old, wrong-format ids against
the new correct one. Fixed properly: only the one batch actually being
saved gets sent now. While in there, also found that **deleting a batch
never actually deleted it from the database** — it had the same
whole-list-upsert problem. Fixed that too, and made your browser
automatically clean out any old fake batches next time you load the page
— nothing for you to manually clear.

**Bug 6 (found, SQL given) — the real, final root cause of "uuid = text."**
Same error kept happening even with Bug 5 fixed. Traced it precisely:
you shared the actual column info and confirmed `project_ids` on the
live table is `text[]`, not `uuid[]` — it diverged from what it should
be at some point. That mismatch is what a trigger I gave you earlier
(the driver-info auto-sync one, 10.14) was tripping on every time. SQL:
```sql
drop trigger if exists trigger_sync_driver_info on public.delivery_batches;

alter table public.delivery_batches
  alter column project_ids type uuid[] using project_ids::uuid[];

create trigger trigger_sync_driver_info
after insert or update of driver_name, driver_phone, project_ids on public.delivery_batches
for each row
execute function public.sync_driver_info_to_admin();
```

**Run in this order:** the cleanup SQL from Bug 4 (if not done yet),
then the Bug 6 SQL above, then try creating a batch again and let me
know if it shows up and stays after a refresh.

## ✅ Latest: two dev-only tools were still live on the deployed site — FIXED
You caught this on production. Both fixed and verified they're actually
gone from the shipped code (not just hidden — checked the built JS
directly):
- **"Backdoor Terminal & Roles" button** — the panel behind it was
  already dev-only from way back (Phase 1.1), but the *button itself*
  wasn't fully gated — the prop that controls it was always truthy in
  production. Fixed at two levels this time and confirmed via
  `grep -r "Backdoor Terminal" dist/` — genuinely nothing in the build now.
- **"⚡ Auto-Fill & Move Next" bypass button** — appears when someone
  tries to advance a stage without meeting its required fields; it skips
  that enforcement entirely. You said this should be dev-only too — done,
  confirmed gone from the build the same way.

## 📋 ORDER OF BUSINESS — full queue, next item at top

Logic: real data-correctness/security bugs first (worst failure mode
first) → quick ready-to-go fixes with zero open questions → items I'm
blocked on waiting for your input (asked in parallel, not stalling
anything) → pure hygiene → big optional rewrites last.

### ✅ Latest round
- **6.1** — Delivery Batches sidebar count question — resolved as
  working-as-intended. The badge only shows when count > 0 (same rule
  every sidebar item follows), and you confirmed the number should be
  "batches in transit, not delivered" — which is exactly what it already
  computes. It was hidden because there are currently 0 in-transit
  batches, not broken. No code change.
- **Export CSV rebuilt** — the old export had a ~66-column list written
  against an outdated schema; columns like Application Number, Meter
  Category, Sanctioned Load, Bank Name no longer exist on the live table
  at all and always exported blank. Rebuilt from scratch against the
  real current schema (cross-referenced `models.jsx`'s live field list
  against every field actually used across the app) — 71 columns now,
  organized by customer lifecycle stage. Confirmed with you: Export stays
  Admin-only, no visibility change.

### Now — do these next, in this order
1. ✅ **3.1** — Fix dangling `expandedStages` reference in `AgentPortal.jsx` — DONE
2. ✅ **3.2** — Fix mismatched stamp-document alias lookups in `CustomerDetailModal.jsx` — DONE
3. ✅ **3.3** — Add missing `logActivity` calls to delivery-batch status changes — DONE (also found + fixed 2 more silent-failure bugs in the same two write sites, same pattern as 6.2)
4. ✅ **10.8** — Restrict document delete to Admin/Office only — DONE (verified via code review + build across all 9 files; live click-through not achievable — the dev "Force Login"/Quick Preview panel never creates a real Supabase Auth session by original design, so it can't load real row data for any role. Not a bug, just a hard limit of that tool.)
5. ✅ **6.3** — Agent/Vendor stage-lock messaging — DONE, reworked per your
   feedback. Original version fully locked (dimmed + disabled) future-stage
   tabs. You clarified: fields should stay editable and saveable — only
   the actual "advance to next stage" action should be blocked, since a
   full lock also stops legitimate early data entry. Now: all fields stay
   editable everywhere, and only the specific buttons that write a new
   `stage` value to the database get disabled when viewing a stage ahead
   of the customer's real one (3 buttons in Agent Portal, 2 in Vendor
   Portal — confirmed via code search these are the only stage-advancing
   actions in either file). Verified via diff review + build + lint.
6. ✅ **10.9** — Data-safety sweep across remaining write paths — DONE (7 real silent-failure bugs found and fixed across 5 files — see Phase 10 below for the full list. The most serious: the Material Integration BOM save could silently fail while still letting the stage advance, with zero indication the material list was never actually saved.)

7. ✅ **10.4** — Stamp document "corrupted" — DONE, real bug found and
   fixed. `CustomerDetailModal.jsx`'s agreement generator computed the
   real uploaded stamp's URL but then threw it away and hardcoded a
   placeholder image path every time — so agreements always showed the
   wrong stamp, or a broken image if the placeholder itself 404'd. Fixed
   both spots to use the real stamp when one exists.
8. ✅ **10.5** — "Saved then disappeared" — real cause found in the main
   customer modal: the ✕ close button discarded unsaved edits with zero
   warning if you clicked it instead of Save. Now shows a confirm dialog
   first. Still added to the list to ask the client directly since it
   hasn't reproduced on your end.
9. ✅ **Phase 0** — stale-cache/version-check mechanism — built. A small
   banner now appears telling users to refresh when a new deploy has
   gone out, instead of their tab silently breaking.

### ✅ Also resolved this round
- **10.13** — missing `admin.jansamarth_application_no` column — done, you ran the SQL
- **10.14** — new feature (yours): auto-sync delivery batch driver
  name/phone into linked customers via a database trigger — done, you
  ran the SQL. Reminder: Vendor Portal's own manual driver-name/phone
  fields are now a second way to set the same data and could get
  overwritten by the next batch save — worth a follow-up chat on
  whether that should go read-only.
- **6.4** — `activity_log` cleanup — done, you ran the SQL
- **10.1** — `add_user` redeployed, live

### ✅ 10.6 — DONE
Black asterisk on "Application Acknowledgment," "Vendor Feasibility," and
"Site Feasibility" — all three share one component that skipped the
app's existing red-asterisk helper. Fixed with one shared fix. Also
found and fixed a real enforcement gap while in there: the Loan stage
had **zero** required-field checks of any kind before this — "Vendor
Feasibility"/"Site Feasibility" looked required but nothing ever
enforced it. Now all three are properly required before the customer can
advance past their stage, same as every other required field in the app.

### ✅ 10.7 — DONE
Sub Channel Partner is now a real dropdown, scoped correctly. Turned out
this needed more care than a plain managed name list (like Channel
Partner has): `sub_channel_partner` has to match a real Agent 2
(Sub-Agent) user account's name to actually work — so the dropdown pulls
live from real Agent 2 accounts in User Management, scoped to the
relevant branch (a CPO/Manager only sees their own branch's sub-agents,
matching how the rest of the app keeps each branch separate). Works in
both the "Add Lead" form and when editing an existing lead's details.

### ✅ 10.12 — small version DONE
Added a "You're offline" banner (top of screen, red, appears automatically
when the connection drops and disappears when it returns) so people at
least know why saves are failing instead of it looking like the app
broke. Verified live in the browser (both states). The fuller fix —
local draft autosave so a dropped connection + reload doesn't lose
unsaved work — is still available whenever you want it; needs its own
scoping conversation first (which forms, how the draft gets surfaced).

### Still open
- **8.2** — feature flags, deprioritized — you said work on other things
  first, this is last on the list

### After the above — hygiene, real but zero user-facing urgency
7. ✅ **3.4** — Repo root cleanup — DONE (137 throwaway files deleted, `workflows/deploy.yml` moved to `.github/workflows/` where GitHub actually recognizes it, `backup-repo/` deleted per your confirmation — only `git rm -r --cached dist` still outstanding, see below)
8. ✅ **3.5** — Wire up ESLint for real — DONE, and it caught **3 real bugs**, one of them live in production (see below)
9. ✅ **3.6** — Removed the unused `react-router-dom` dependency — DONE (confirmed zero references anywhere, removed cleanly, build + lint still pass)
10. ✅ **4.x** — DONE. Found and fixed one more genuinely serious bug in
    the process: `StampPortal.jsx` was fetching the whole `admin` table
    unpaginated (3,700+ rows, capped at 1,000 by the database) — meaning
    any pending stamp job on a customer older than the newest 1,000
    created records was invisible to the Stamp Maker with zero warning.
    Also paginated `TrashView.jsx`, `AgentPortal.jsx`, `VendorPortal.jsx`
    defensively. Audited every `.single()` call site (10 of them) — all
    correct as-is, no changes needed. Confirmed the Rolldown build flag
    is a deliberate, working setup (Vite 8 genuinely uses Rolldown now),
    not a leftover — nothing to fix there.

### Big/optional — lowest priority, not blocking anything
11. **Phase 7 (more)** — further splitting `CustomerDetailModal.jsx` (diminishing returns past what's already done)
12. **8.3** — data-driven field editability (depends on 8.2 landing first)
13. **Phase 5** — one formal, deliberate per-role verification pass (vs. the ad-hoc checks done so far)

---

## Phase 1 — Critical security fixes — ✅ ALL DONE
- 1.1 ✅ Unauthenticated impersonation panel gated to dev-only builds
- 1.2 ✅ Edge function fail-open Admin bug fixed (you deployed it)
- 1.3 ✅ Quick Preview (no-login) role switcher added for local dev

## Phase 2 — High-severity data & correctness fixes — ✅ ALL DONE
- 2.1 ✅ Dead file `AgentPortal_original.jsx` deleted
- 2.2 ✅ Channel-partner stats undercount fixed
- 2.3 ✅ Delivery-batch customer picker truncation fixed
- 2.4 ✅ VendorPortal realtime/initial-load stage mismatch fixed
- 2.5 ✅ Leftover debug query removed
- 2.6 ✅ ~25 fragile role-string checks consolidated across 10 files

## Phase 3 — Medium-severity fixes — ✅ ALL DONE (6 of 6)
- 3.1 ✅ Dangling `expandedStages` reference in `AgentPortal.jsx` — dead code deleted
- 3.2 ✅ Stamp-document alias-lookup mismatch in `CustomerDetailModal.jsx` — fixed
- 3.3 ✅ Missing `logActivity` calls on delivery-batch status changes — fixed, plus 2 bonus silent-failure bugs fixed
- 3.4 ✅ Repo-root cleanup — done (137 junk files removed, misplaced `deploy.yml`
  relocated so GitHub Actions can actually run it, `backup-repo/` deleted).
  Only remaining piece: `git rm -r --cached dist` to untrack the already-committed
  `dist/` files (small, separate follow-up, not done yet)
- 3.5 ✅ Wire up ESLint for real — done, and it found 3 real bugs:
  1. **Live crash on every stage-remark save** — `CustomerDetailModal.jsx`
     called a state setter (`setIsSaved`) that never existed, right after
     the save succeeded. This silently broke the activity-log entry for
     every single stage remark saved (the remark itself was fine, but
     nothing ever logged it). Fixed.
  2. **145 lines of dead code with 2 more broken references inside** —
     8 leftover handler functions in `CustomerDetailModal.jsx`, never
     called from anywhere, left over from before the tab-extraction work.
     Deleted.
  3. **A document-preview crash risk used app-wide** — `FilePreviewModal`
     (used in every portal for viewing uploaded documents) and
     `DashboardView` both called a React hook *after* an early return,
     which is undefined behavior in React and can crash the component.
     Very plausibly connected to the vague "panel disappears" report
     (10.5). Fixed both.
  Also fixed a duplicate `onFocus` prop on the Dashboard search box that
  was silently breaking an autofill workaround.
- 3.6 ✅ Removed the unused `react-router-dom` dependency (zero references
  anywhere in the app — Phase 1.3's role switcher was built with plain
  React state, no routing needed)

## Phase 4 — Low-severity cleanup — ✅ ALL DONE (optional split skipped, not needed)
- ✅ Paginated remaining unbounded queries — including a real live bug in
  `StampPortal.jsx` (see Phase 10 area above for detail)
- ✅ Audited `.single()` vs `.maybeSingle()` usage — all correct as-is
- ⏸️ (Optional, skipped) splitting the 754-line `modal-tabs/shared.jsx`
- ✅ Confirmed the `ROLLDOWN_OPTIONS_VALIDATION=loose` build flag is
  deliberate and correct for this Vite 8 setup

## Phase 5 — Full per-role verification pass — ✅ DONE (code-level)
Live click-through per role isn't possible through my tools (confirmed
during 10.8: neither Force Login nor Quick Preview creates a real
Supabase session, so the database blocks all real data regardless of
role) — so this was a deliberate code-level audit instead: checked the
role-routing logic against the 8 real roles, grepped every role-string
comparison in the app for typos/drift (found none), re-verified the
document-delete permission (10.8) and stage-lock (6.3) logic are
consistent everywhere they were touched this session, and confirmed the
admin-only nav sections are still correctly gated. No new issues found —
build and lint both re-run clean at the end. Full detail in the working
plan file.

## Phase 6 — Your originally-reported backlog — 🟡 PARTIAL (4 of 5 done)
- 6.1 ✅ Delivery Batches sidebar now shows count of active/undelivered batches
- 6.2 ✅ "Car Rent Paid" toggle silent-save bug fixed
- 6.3 ✅ Agent/Vendor stage-lock messaging — reworked per your feedback:
  fields stay editable/saveable in a future stage tab, only the specific
  "advance to next stage" buttons get blocked
- 6.4 ✅ `activity_log` schema cleanup — done, you ran the SQL
- 6.5 ⏸️ Role naming — deliberately deferred, waiting on your client conversation

## Phase 7 — Shrink `CustomerDetailModal.jsx` — 🟡 PARTIAL (core value delivered)
- ✅ Two real bugs found and fixed while deduping shared helper functions
- ✅ DOCUMENTS tab extracted into its own component (~130 lines out)
- File down from 1,944 → 1,795 lines. More sections could still be
  extracted but it's diminishing returns from here — not queued unless
  you want it.

## Phase 8 — Template readiness (reusable base for future clients) — 🟡 PARTIAL
- 8.1 ✅ All hardcoded stage-name strings now route through one `STAGE_IDS` constant (5 files)
- 8.2 ⏭️ Feature flags (turn modules on/off per client) — needs a design decision on which features should be toggleable
- 8.3 ⏭️ Data-driven field editability — larger effort, queued after 8.2

## Phase 9 — Demo mode & test-data removal — ✅ FULLY DONE
All mock/demo data and fake-login infrastructure removed across 15 files
plus deletion of `src/mock/demoData.js` (746 lines). Kept exactly as
requested: real email-based impersonation and the Quick Preview switcher.
Found and fixed 3 real bugs along the way (fake data silently written to
real customer records / fake "success" on failed user creation / fake
test-data buttons live in production).

## Phase 10 — New client-reported issues (your Aug 27 batch) — 🟡 PARTIAL (13 of 14 done — only 10.12 left, paused per your call)
- 10.1 ✅ Admin "Set Password Directly" — was completely broken (edge
  function had no handler for it at all), now fixed and redeployed — live.
- 10.2 ✅ Channel-partner rename now also syncs the partner's own login
  profile, so their portal doesn't lose visibility of their own leads after a rename
- 10.3 ✅ "Moves to next stage but still shows old stage" display bug fixed
- 10.4 ✅ Stamp document "corrupted" — real bug found and fixed (see
  above, ORDER OF BUSINESS section)
- 10.5 ✅ "Panel disappeared" — real bug found and fixed in the main
  customer modal's close button (see above)
- 10.6 ✅ Black asterisk → red + enforce required field — done. Also
  found the Loan stage had zero required-field enforcement at all before
  this fix; now "Vendor Feasibility"/"Site Feasibility" are properly
  required there, and "Application Acknowledgment" is properly required
  in Registration
- 10.7 ✅ Sub Channel Partner dropdown — done, scoped to real Agent 2
  accounts per branch (see "Also resolved this round" above for detail)
- 10.8 ✅ Document delete restricted to Admin/Office only — done, verified
  via code review + clean build across all 9 files touched
- 10.9 ✅ Swept remaining write paths for the "looks saved but silently
  isn't" pattern — found and fixed 7 more real instances across 5 files
  (delivery status dropdown, 5 "Add metadata" handlers + delete-metadata
  cascade clear, stamp remark save, vendor payment status, 3 user
  activate/deactivate/delete actions, and — most importantly — the
  Material Integration BOM save, which could silently fail while still
  letting the customer's stage advance)
- 10.10 ✅ `delivery_batches` table — you ran the SQL, resolved
- 10.11 ✅ Managed dropdowns (Registration By, etc.) no longer lose a
  saved value that isn't in the current options list
- 10.12 ⏸️ No offline handling anywhere — flagged for later per your call
- 10.13 ✅ Missing `admin.jansamarth_application_no` column — done, you ran the SQL
- 10.14 ✅ Auto-sync delivery batch driver info to admin — done, you ran the SQL

## Phase 0 — Stale browser cache / deploy reliability — ✅ DONE
Built the version-check mechanism: every build now writes a fresh
`public/version.json`, and a small banner tells users to refresh when a
new deploy has gone out instead of their tab silently breaking. Runs
automatically as part of `npm run build` / `npm run deploy` — no extra
step needed on your end going forward.

---

## What's NOT yet decided / needs you specifically
- Decide Phase 8.2 (which features should be toggleable) — discuss later

## Not committed to git yet
Everything done since the original Phase 1 commit is sitting in the
working tree, not committed — you said you'd handle commits yourself.
