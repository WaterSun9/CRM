# CP / dealer rules page (2026-11-16, D-039)

Admin only, System › **CP / dealer rules**. Branch `feat/cp-dealer-rules` (from `main`), not deployed. No SQL needed.

Checks every live customer card against the client's CP / CPO / dealer rules (`docs/import-issues-2026-11-05/SUMMARY.md`, rules 1–11) and today's logins, using `src/utils/cpDealerRules.js` (tests: `tests/cpDealerRules.test.mjs`).

| Rule | Fix |
|---|---|
| CP written as dealer: the Dealer box holds an independent CP with a CP login | CP box = that CP, Dealer box emptied |
| Dealer filled in under an independent CP (rule 6) | Dealer box emptied |
| Dealer belongs to another CPO (rule 7) | Dealer box emptied; customer stays with its CPO |
| Name spelled differently from the login (capitals, spaces, dots only; rule 10) | Login's spelling |

- Every affected customer is listed under its rule, ticked; untick to leave one alone. "Download list" saves a CSV first.
- "Review and fix" shows the count per rule and asks once. Each card is re-read just before saving and skipped if its CP or Dealer changed since the check.
- Each change is logged on the customer (before / after, source "CP/dealer rules: <rule>"), plus one summary line in the activity log.
- Left alone: deleted and DEBOARDED customers (rule 9), inactive logins, dealer names with no login, names that only look alike (e.g. DASHRATH vs DASHRATH MALI). Those stay for the Data Review page or by hand.
- Demo: `cp-dealer-rules-demo.html` (made-up data).
