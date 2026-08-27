# Watersun CRM — Remediation Status

Clean phase-by-phase status, most recent update first. Full technical
detail for every item (file names, line numbers, exact code) lives in the
working plan file the assistant maintains at
`~/.claude/plans/linked-prancing-squid.md` — this file is the readable
summary of the same thing.

**Legend:** ✅ done & verified · ⏭️ not started · 🟡 partially done / in
progress · 🔴 needs your action (not something code can fix) · ⏸️ deliberately deferred

---

## 📋 ORDER OF BUSINESS — full queue, next item at top

Logic: real data-correctness/security bugs first (worst failure mode
first) → quick ready-to-go fixes with zero open questions → items I'm
blocked on waiting for your input (asked in parallel, not stalling
anything) → pure hygiene → big optional rewrites last.

### Now — do these next, in this order
1. ✅ **3.1** — Fix dangling `expandedStages` reference in `AgentPortal.jsx` — DONE
2. ✅ **3.2** — Fix mismatched stamp-document alias lookups in `CustomerDetailModal.jsx` — DONE
3. ✅ **3.3** — Add missing `logActivity` calls to delivery-batch status changes — DONE (also found + fixed 2 more silent-failure bugs in the same two write sites, same pattern as 6.2)
4. ✅ **10.8** — Restrict document delete to Admin/Office only — DONE (verified via code review + build across all 9 files; live click-through not achievable — the dev "Force Login"/Quick Preview panel never creates a real Supabase Auth session by original design, so it can't load real row data for any role. Not a bug, just a hard limit of that tool.)
5. ✅ **6.3** — Agent/Vendor stage-lock messaging — DONE (`AgentPortal.jsx` and `VendorPortal.jsx` both had their own free stage-tab switchers with zero gate tying the viewed tab to the customer's real stage; both now dim the fields and show a "hasn't reached this stage yet" banner when viewing a future stage. Verified via code review + build; live click-through blocked by the same Force Login/RLS limit as 10.8.)
6. ✅ **10.9** — Data-safety sweep across remaining write paths — DONE (7 real silent-failure bugs found and fixed across 5 files — see Phase 10 below for the full list. The most serious: the Material Integration BOM save could silently fail while still letting the stage advance, with zero indication the material list was never actually saved.)

### Blocked on you — answer whenever, doesn't stall the queue above
- **10.1** — redeploy `add_user` (code fix already done, just needs `supabase functions deploy add_user`)
- **10.10** — you're already running the `delivery_batches` SQL yourself
- **10.4** — does a hard refresh fix the "corrupted" stamp doc for the client?
- **10.5** — which screen/field is "saved then disappears"?
- **10.6** — which specific field needs the red-asterisk + enforced-required fix?
- **10.7** — sub-channel-partner names ready, or seed with placeholders now?
- **6.4** — go-ahead to run the `activity_log` column/trigger cleanup SQL?
- **Phase 0** — version-check mechanism, or wait for the hosting migration you're discussing with the client?
- **8.2** — which features should actually be toggleable per client?

### After the above — hygiene, real but zero user-facing urgency
7. ✅ **3.4** — Repo root cleanup — DONE (137 throwaway files deleted, `workflows/deploy.yml` moved to `.github/workflows/` where GitHub actually recognizes it, `backup-repo/` deleted per your confirmation — only `git rm -r --cached dist` still outstanding, see below)
8. **3.5** — Actually install and configure ESLint (currently a no-op script)
9. **3.6** — Remove or properly adopt the unused `react-router-dom` dependency
10. **4.x** — Add `.range()`/`.limit()` to the remaining lower-risk unbounded queries; audit `.single()` vs `.maybeSingle()`; confirm the Rolldown build flag was deliberate

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

## Phase 3 — Medium-severity fixes — 🟡 PARTIAL (4 of 6 done)
- 3.1 ✅ Dangling `expandedStages` reference in `AgentPortal.jsx` — dead code deleted
- 3.2 ✅ Stamp-document alias-lookup mismatch in `CustomerDetailModal.jsx` — fixed
- 3.3 ✅ Missing `logActivity` calls on delivery-batch status changes — fixed, plus 2 bonus silent-failure bugs fixed
- 3.4 ✅ Repo-root cleanup — done (137 junk files removed, misplaced `deploy.yml`
  relocated so GitHub Actions can actually run it, `backup-repo/` deleted).
  Only remaining piece: `git rm -r --cached dist` to untrack the already-committed
  `dist/` files (small, separate follow-up, not done yet)
- 3.5 ⏭️ Wire up ESLint for real (currently not installed despite the lint script)
- 3.6 ⏭️ Decide fate of the unused `react-router-dom` dependency

## Phase 4 — Low-severity cleanup — ⏭️ NOT STARTED
- Add `.range()`/`.limit()` to remaining lower-risk unbounded queries
- Audit `.single()` vs `.maybeSingle()` usage across the app
- (Optional) split the 754-line `modal-tabs/shared.jsx` into per-component files
- Confirm the `ROLLDOWN_OPTIONS_VALIDATION=loose` build flag was deliberate

## Phase 5 — Full per-role verification walkthrough — 🟡 PARTIAL
Ad-hoc smoke tests happened alongside other phases (role switching, a few
portals clicked through) but a full formal pass through all 8 roles per
the checklist hasn't been done as one deliberate pass.

## Phase 6 — Your originally-reported backlog — 🟡 PARTIAL (3 of 5 done)
- 6.1 ✅ Delivery Batches sidebar now shows count of active/undelivered batches
- 6.2 ✅ "Car Rent Paid" toggle silent-save bug fixed
- 6.3 ✅ Agent/Vendor stage-lock messaging — both portals now dim the fields
  and show a "client hasn't reached this stage yet" banner when viewing a
  stage ahead of the customer's real one
- 6.4 ⏭️ `activity_log` schema cleanup — needs your SQL decision (see below)
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

## Phase 10 — New client-reported issues (your Aug 27 batch) — 🟡 PARTIAL (7 of 11 done)
- 10.1 ✅ Admin "Set Password Directly" — was completely broken (edge
  function had no handler for it at all), now fixed. **Needs
  `supabase functions deploy add_user` to go live**, same as before.
- 10.2 ✅ Channel-partner rename now also syncs the partner's own login
  profile, so their portal doesn't lose visibility of their own leads after a rename
- 10.3 ✅ "Moves to next stage but still shows old stage" display bug fixed
- 10.4 ⏭️ Stamp document "corrupted" for client — need to know if a hard
  refresh fixes it (would confirm it's the same cache issue as Phase 0)
- 10.5 ⏭️ Vague "panel disappearing" report — need to know which screen/field
- 10.6 ⏭️ Black asterisk → red + enforce required field — need to know
  which specific field is affected
- 10.7 ⏭️ Sub Channel Partner dropdown in Operations — confirmed this
  doesn't exist yet, need real names or OK to seed placeholders
- 10.8 ✅ Document delete restricted to Admin/Office only — done, verified
  via code review + clean build across all 9 files touched
- 10.9 ✅ Swept remaining write paths for the "looks saved but silently
  isn't" pattern — found and fixed 7 more real instances across 5 files
  (delivery status dropdown, 5 "Add metadata" handlers + delete-metadata
  cascade clear, stamp remark save, vendor payment status, 3 user
  activate/deactivate/delete actions, and — most importantly — the
  Material Integration BOM save, which could silently fail while still
  letting the customer's stage advance)
- 10.10 🔴 **`delivery_batches` table doesn't exist in the live database
  at all** — confirmed directly via the API. You're handling this
  yourself (SQL provided separately).
- 10.11 ✅ Managed dropdowns (Registration By, etc.) no longer lose a
  saved value that isn't in the current options list

## Phase 0 — Stale browser cache / deploy reliability — ⏭️ NOT STARTED
Root cause confirmed (GitHub Pages can't set real cache headers, so a
client's browser can serve a stale page pointing at deleted build files).
Needs a decision: build a version-check/auto-reload mechanism, or the
hosting migration you're separately discussing with your client. Either
fixes it; not started yet.

---

## What's NOT yet decided / needs you specifically
- Deploy the `add_user` edge function again (10.1)
- Run the `delivery_batches` table SQL + decide on the admin-column cleanup (10.10)
- Answer 10.4, 10.5, 10.6, 10.7 with more specifics
- Decide Phase 0's approach (version-check vs. hosting migration)
- Decide Phase 8.2 (which features should be toggleable)
- Decide on Phase 6.4 (activity_log column/trigger cleanup SQL)

## Not committed to git yet
Everything done since the original Phase 1 commit is sitting in the
working tree, not committed — you said you'd handle commits yourself.
