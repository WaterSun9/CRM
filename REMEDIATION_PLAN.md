# Watersun CRM — Remediation Status

Clean phase-by-phase status, most recent update first. Full technical
detail for every item (file names, line numbers, exact code) lives in the
working plan file the assistant maintains at
`~/.claude/plans/linked-prancing-squid.md` — this file is the readable
summary of the same thing.

**Legend:** ✅ done & verified · ⏭️ not started · 🟡 partially done / in
progress · 🔴 needs your action (not something code can fix) · ⏸️ deliberately deferred

---

## 🔴 CRITICAL — Delivery batches were never actually saving to the shared database
You reported this live. Confirmed via direct testing against the real
database — two separate bugs stacked on top of each other:

**Bug 1 (fixed in code):** batch creation was generating an id in the
wrong format — the database column expects a real UUID, but the code
was making up a plain text string. Every single batch save has been
failing at the database step since the table was created — it just
*looked* saved because the screen updates immediately before the actual
database write happens, and the failure was being silently swallowed.
The moment the page reloads (or anyone else opens it), the real
database has nothing, so the batch disappears — exactly what you saw.
Fixed and confirmed against the live database.

**Bug 2 (needs you to run SQL):** even with the id fixed, the database
still refused the write with a permissions error. This table almost
certainly has security rules turned on with no rule actually allowing
anyone to write to it — a gap I flagged back when the table was first
created but which never got filled in. Run this in the Supabase SQL
Editor:
```sql
alter table public.delivery_batches enable row level security;

create policy "Authenticated users can read delivery_batches"
on public.delivery_batches for select
to authenticated
using (true);

create policy "Authenticated users can write delivery_batches"
on public.delivery_batches for all
to authenticated
using (true)
with check (true);
```
After running that, try creating a delivery batch again and let me know
if it now shows up and stays after a refresh.

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
