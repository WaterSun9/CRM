# CP / dealer rules page (2026-11-16, D-039)

Admin only, System › **CP / dealer rules**. Branch `feat/cp-dealer-rules` (from `main`), not deployed. No SQL needed.

Checks every live customer card against the client's CP / CPO / dealer rules (`docs/import-issues-2026-11-05/SUMMARY.md`, rules 1–11) and today's logins, using `src/utils/cpDealerRules.js` (tests: `tests/cpDealerRules.test.mjs`).

Layout: a header, then one **tab per topic** (8 tabs, each showing how many it found), **Miscellaneous** last.

Each finding is a row with a **choice** (default shown in bold); "No change" is always there. **Set all to…** changes every row of a rule.

| Rule | Choices |
|---|---|
| CP written as dealer (Dealer box holds an independent CP with a CP login) | **Move to that CP, empty dealer** · No change |
| Dealer filled in under an independent CP (rule 6) | **Empty dealer** · No change |
| Dealer belongs to another CPO (rule 7) | **Stay with own CPO, empty dealer** · Move to the dealer's CPO, keep dealer · No change |
| Name spelled differently from the login (capitals, spaces, dots only; rule 10) | **Same person: login's spelling** · Different people: no change |
| CP / CPO with no login (grouped by name) | **No change** · Move to DEBOARDED, keep the old name as dealer · Change to an existing CP/CPO login |
| Dealer with no login (grouped by name and CPO) | **No change** · Empty dealer · Move to DEBOARDED, keep the name as dealer · Change to one of the CPO's dealers |
| Logins with no customers (active CP, CPO, dealer) | **Keep** · Deactivate (same as User Management; can be switched on again) |
| Miscellaneous: empty CP box, office staff name as dealer, a CPO's name as dealer | **No change** · Set CP to a login (empty CP) · Empty dealer |

- One **Review and fix** with counts per rule and one confirm. **Download list** saves a CSV of every change first.
- Each card is re-read just before saving and skipped if its CP or Dealer changed since the check. Each change is logged on the customer (before / after, rule and choice), plus one summary line in the activity log.
- Left alone: deleted and DEBOARDED customers (rule 9), inactive logins. DEBOARDED stays a filing name, not a branch with a login (Mahvish agreed to keep it simple on 2026-11-16).
- Limit: "No change" / "Different people" is not remembered, so those rows show again on the next check (fixed properly by the UUID migration, see `docs/BACKLOG.md`).
- Demo: `cp-dealer-rules-demo.html` (made-up data).

## Take 1 (2026-11-16): only the first 4 topics
Shown and fixed now: **CP as dealer**, **Dealer under a CP**, **Dealer of another CPO**, **Spelling**.
The rest is built but hidden (`SHOWN` and `SHOW_UNUSED_LOGINS` at the top of `src/components/CpDealerRulesView.jsx`).

## Task 2 (later, not started)
1. **Test on live data**: open the page logged in as admin, look at each tab and download the list, without pressing fix; check the numbers with Mahvish; then fix.
2. Switch on the hidden topics, one by one, after a look at live data: CP / CPO with no login, Dealer with no login, Logins with no customers, Miscellaneous (empty CP, office staff as dealer, CPO name as dealer).
3. Remember "No change" / "Different people" so those rows don't come back (best done with the UUID identity migration, `docs/BACKLOG.md`).

## Exceptions: left alone on purpose (2026-11-20)
These are not listed and not fixed, by Mahvish's choice:
1. **Dealer under an independent CP** (13 cards): the CP may keep that name for their own records (D-046). Tab hidden.
2. **A CP also written as their own dealer** (72 cards, e.g. CP BHARAT UNJA, Dealer BHARAT UNJA): same name, no harm (D-048).
3. **Capitals only** (e.g. Ganeshbhai / GANESHBHAI, 6 cards): partners match names ignoring capitals, so they still see these customers (D-048). Spaces that differ from the login are still listed, because those hide customers.

4. **Spelling tab removed** (D-049, 2026-11-20): space differences are fixed automatically when a card is saved (D-047), and capitals do not matter.

The page shows the same list under the tabs. Still hidden for later (Task 2): CP / CPO with no login, dealer with no login, logins with no customers, Miscellaneous.
