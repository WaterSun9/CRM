# Fix Plan — audit findings, 2026-08-30

Two independent agents audited the codebase (data integrity, and roles/access).
~30 findings. They are not 30 separate mistakes — they are **8 root causes**,
each repeated across many files. Fixing the cause is cheaper and safer than
patching each site.

Status keys: ✅ fixed · 🔨 in progress · ⏭️ queued · ⏸️ deferred

---

## The 8 root causes

### C1. `supabase-js` never throws
It resolves with `{ data, error }`. So every `try/catch` around a query is
decorative, and three distinct mistakes follow from it:
- **error never inspected** — mostly cleaned up already
- **return value never inspected** — `onUpdate` returns `false`; ~20 callers
  ignore it and then write an activity-log entry for a change that never happened
- **zero rows matched is not an error** — an RLS-filtered UPDATE returns
  `error: null` with 0 rows changed. Only `AgentPortal:326` checks. Everywhere
  else the user sees "Saved" and the data is gone.

### C2. Empty string vs typed columns
`''` sent to a `numeric` or `date` column makes Postgres reject the **whole**
update, losing every other field in that save.
✅ numeric list (`ADMIN_NUMERIC_COLUMNS`) · ✅ date guard in Dashboard ·
✅ the `isNaN` guard that never fired (`parseIndianNumber` returns `''`, not `NaN`)

### C3. Read-then-merge without checking the read
`const { data } = await select(...)` then `{ ...(data?.json || {}), ...changes }`.
If the read fails, the spread produces **only the changes** and overwrites the
entire JSON column.
✅ `StampPortal` ×2 · ⏭️ audit for any remaining

### C4. Delete-then-write with no rollback
The delete succeeds, the write fails, the data is gone. No transaction.
✅ `bom_items` (snapshot + restore) · ⏭️ document replace ×3

### C5. Optimistic UI not reconciled with the result
Local state updates first; on failure only *some* paths roll back. The tab keeps
the value, the DB does not, and the activity log records it as done.

### C6. Client-side-only permission gating
The UI offers a write that RLS will silently refuse (see C1). Or the gate exists
only in the browser and the same write can be made directly.

### C7. Duplicated logic that drifts
The same fix applied to one copy and not the other — the `StampPortal` merge, the
`isNaN` guard, the date guard, the commission field. Every instance below is a
place the same code exists twice.

### C8. Stale caches and fabricated ids
localStorage written before the DB, never rolled back, then read back as truth.
✅ fabricated `bom-<uuid>` id · ⏭️ `delivery_batches` cache

---

## P0 — destroys or loses data. ✅ ALL FIVE FIXED 2026-08-30.

| # | Cause | Where | Symptom |
|---|---|---|---|
| ✅1 | C4/C1 | `bom.js` + `MaterialIntegrationTab` + `CustomerDetailModal:1110` | A failed BOM read shows a blank template; `handleSave` calls `saveBomRef` unconditionally, which then deletes the real `bom_items` and inserts template defaults. Reports success. |
| ✅2 | C4 | `ChannelPartnerManagementView:638` | Deleting a dropdown entry runs `admin.update({ channel_partner: null })` across every matching customer. Unrecoverable, and it breaks partner-scoped RLS for those rows. |
| ✅3 | C1 | `CustomerDetailModal:1017` `handleAdvanceStage` | Writes all ~89 columns (no narrowing), skips the concurrency check, and ignores the result — the modal advances the stage in the UI regardless. |
| ✅4 | C4 | `CustomerDetailModal:494`, `StampPortal:161`, `VendorPortal:437` | Old document deleted **before** the new upload. Upload fails → original gone from storage and DB. |
| ✅5 | C1 | ~15 write sites | Zero-rows-matched treated as success. |

## P1 — wrong data, or data shown to the wrong person. (6-9 ✅ fixed 2026-08-30)

| # | Cause | Where | Symptom |
|---|---|---|---|
| ✅6 | C6 | `Dashboard:295` realtime | No branch scoping; another branch's record can appear in a CPO's grid. `isAuthorized`/`matchesChannelPartnerFilter` are defined and **never called**. |
| ✅7 | C6 | `LeadsTab:76` | CPO gets a free-text Channel Partner field and can move a record out of its own branch. |
| ✅8 | C6 | `Dashboard:374` global search | No `deleted_at` filter — trashed records open fully editable. |
| ✅9 | C6 | `VendorPortal:227` | Vendor ownership matcher uses substrings both ways plus a catch-all: any identifier containing "vendor" matches every record with a vendor. |
| 🟡10 | C5 | ~20 tab handlers | `onUpdate` returns `false`; ignored, then an activity-log entry is written anyway. **Re-rated on inspection:** `handleSectionUpdate` already returns before merging the patch, so local state is NOT corrupted, and `Dashboard.handleUpdateCustomer` already alerts the user and rolls back. Residue is a misleading activity-log entry only. 20 of the 21 call sites have no `try`, so making the boundary throw would convert silent failures into unhandled rejections - it needs a per-site sweep, not a boundary change. |
| ✅11 | C7 | `ChannelPartnerManagementView:504` | Renaming a vendor doesn't cascade to `admin.vendor`, so notifications then fail with "No email address is saved for vendor X". |
| ✅12 | C8 | `DeliveryBatchesView` | localStorage written before the DB and not rolled back; a batch that never saved reappears as real. |

## P2 — needs a decision or server-side work.

| # | Where | Note |
|---|---|---|
| 13 | `UserManagementView:646` | Role change is a bare client write. Needs the `profiles` RLS verified, and ideally an edge-function `update_role` action. |
| 14 | `LoginScreen` / `App.jsx` | Deactivation does not revoke a live session. RLS keys off `user_type`, not `status`. |
| 15 | `StampPortal:423` | Every stamp maker downloads every other maker's full customer rows; narrowing is client-side only. |
| 16 | RLS | The `stamp` SELECT clause is the only one missing `deleted_at is null`. |
| 17 | Several | Dead role strings: `'dealer'`, `'office'`, `'channel_partner_office_manager'` are tested but are not real `user_type` values. |

## ❌ Cancelled
**UUID identity migration** — client says not needed. `MIGRATION_PLAN_uuid_identity.md`
is kept for reference only; do not action it.

Consequence: people stay matched by NAME, so the constraints that made the plan
worth doing remain permanent facts of the system —
- Renaming a Dealer or Vendor must cascade to `admin.sub_channel_partner` /
  `admin.vendor`, or that person stops seeing their own records.
- `ALLOW_NAME_EDIT = false` in `UserManagementView.jsx` therefore stays OFF.
  Renames are done in SQL, as one transaction (recipe in the migration plan).
- Two people cannot share a name: name-based RLS would show them each other's records.

## ⏸️ Deferred deliberately
- Remote-update banner stays off (`SHOW_REMOTE_UPDATE_ALERT = false`) until the
  three concurrency fixes are proven in production.
- Offline handling (remediation 10.12) — paused by the client.
- "One name, entered once" (remediation 7) — paused by the client.

## ⏭️ Added to the list
**Template readiness — a reusable base for future clients** (remediation Phase 8,
still 🟡 partial). What it needs, concretely:
- Branding is now isolated in `BrandMark.jsx` + `src/assets/` — swapping a logo is
  one component and two files. Good starting point.
- Still hardcoded to this client: company name in the agreement pages
  (`components/agreement/*` - "WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED",
  the Radhanpur address), `index.html` title/meta, the 404 copy, and the
  PM Surya Ghar / DISCOM stage names, which are India-solar-specific.
- Stage pipeline (`PRIMARY_STAGES`) and the tag sets are constants, so they are
  configurable in principle - but 14 stages are referenced by id across the app.
- Decide first whether "template" means a fork per client or one deployment with
  a tenant column. That choice drives everything else and has not been made.

---

## Order of work
1. ~~**P0 1–5** — anything that destroys data~~ ✅ done 2026-08-30
2. ~~**P1 6–9** — access and exposure~~ ✅ done 2026-08-30
3. **P1 11–12** ✅ done 2026-08-30 · **10** re-rated to low, needs a 21-site sweep
4. **P2** — after the load test, since some need RLS changes

Rule for each fix: change the **cause**, not the symptom, and check for a second
copy of the same code (C7) before moving on.

---

## Branding — done, and what's left

**Done 2026-08-31**
- `BrandMark.jsx` — one component for the logo lock-up, replacing five hand-rolled
  copies of an amber square + a generic `Sun` icon + the word "Watersun" typed beside it.
- Real artwork wired in (`src/assets/`, imported so Vite hashes and resolves them —
  the files in `public/` have spaces in their names and are not referenced directly).
  **blue** on light surfaces, **white** on dark ones.
- Applied to: Login screen, Dashboard sidebar, Vendor / Dealer / Stamp portal headers,
  the Dealer mobile sidebar, and the dark hero-banner watermarks.
- Favicon and browser title moved to brand navy `#123a8f` + orange `#f7a01d`
  ("Watersun CRM", was "Solar CRM"). Same favicon on the 404 page.
- Every `<Sun />` brand mark and its now-unused import removed.

**↩️ Reverted 2026-08-31 — the palette**
A full palette pass was tried and rolled back at the client's call: brand orange
retuned into Tailwind's `amber` scale, a `brand` navy applied to 128 dark
surfaces, and `stone` recoloured from warm grey to a navy-tinted cool grey.

Individually each was defensible - `amber-500` became the exact sun from the
logo, contrast improved at every grey stop - but together the app read as less
coherent, not more. Reverted in full: `tailwind.config.js` is byte-identical to
HEAD and all 89 changed colour lines are back to their originals.

**Worth knowing if this is revisited:**
- The app's amber (`#f59e0b`) is already within a hair of the logo's sun
  (`#f7a01d`). Retuning the `amber` scale in the theme recolours all 773 usages
  with zero component edits - and is a one-line revert.
- Do NOT swap amber for blue. Amber carries meaning here (pending / attention /
  unpaid); blue does not, and the loss of that signal costs more than the
  branding gains.
- Tailwind `stone` is a WARM grey. It fights a cool navy. Any future navy work
  has to address the greys at the same time, or it will look subtly wrong.
- Suspected real culprit, untested: 73 `bg-stone-900` elements became navy,
  including small buttons. Navy on everything flattens the visual hierarchy.
  A narrower application - sidebar, hero banners and modal headers only - is the
  next thing to try.
- Pre-existing, unrelated to any of this: white text on `amber-500` is 2.10:1
  and fails WCAG AA across ~28 sites.

**Kept:** the logo work - `BrandMark.jsx`, the real artwork in `src/assets/`,
brand favicon and title. Only the colour scheme was reverted.

**⏭️ Not done — the rest of the re-skin**
The UI accent colour is **amber** everywhere (`amber-500/600` on buttons, badges,
focus rings, active tabs, hero taglines) - hundreds of occurrences across every
component. The brand palette is navy `#123a8f`, cyan `#29b6f6`, orange `#f7a01d`.

Doing it properly means introducing semantic Tailwind theme tokens
(`brand`, `accent`) in `tailwind.config.js` and migrating the classes, rather
than a find-and-replace — a blind swap would wreck contrast on the dark
surfaces and the amber-on-white badges. Worth doing as its own pass with visual
checks per portal; not worth risking mid-launch.
