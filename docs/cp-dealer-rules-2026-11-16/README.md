# CP / dealer rules page (2026-11-16, D-039)

Admin only, System › **CP / dealer rules**. Branch `feat/cp-dealer-rules` (from `main`), not deployed. No SQL needed.

Checks every live customer card against the client's CP / CPO / dealer rules (`docs/import-issues-2026-11-05/SUMMARY.md`, rules 1–11) and today's logins, using `src/utils/cpDealerRules.js` (tests: `tests/cpDealerRules.test.mjs`).

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

- One **Review and fix** with counts per rule and one confirm. **Download list** saves a CSV of every change first.
- Each card is re-read just before saving and skipped if its CP or Dealer changed since the check. Each change is logged on the customer (before / after, rule and choice), plus one summary line in the activity log.
- Left alone: deleted and DEBOARDED customers (rule 9), customers with an empty CP box, inactive logins.
- Limit: "No change" / "Different people" is not remembered, so those rows show again on the next check (fixed properly by the UUID migration, see `docs/BACKLOG.md`).
- Demo: `cp-dealer-rules-demo.html` (made-up data).
