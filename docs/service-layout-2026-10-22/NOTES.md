# Complaint workspace layout update

- Removed the floating wrench/Complaints button. Office roles open Complaints from normal dashboard navigation next to Warranty. Complaint links open the relevant request in that workspace. The customer editor stays mounted behind it, preserving unsaved edits.
- Partner roles use a normal header button with a bounded dialog over their portal.
- Compact list rows stop repeating warranty, consumer number, assignment date and problem details. When there is only one selected request, its duplicate list card is hidden.
- Laptop: customer/actions and visit/payment panels use two columns when space permits. Multiple requests have a compact navigation column. Global travel defaults are collapsed under Travel payment settings.
- Phone: the selected complaint hides the list and overview tools; All complaints returns to them. Payment fields and trip choices have room to fit without horizontal scrolling.
- Existing warranty cover, distance rules, permissions, OTP and backend behavior are unchanged.

Validation: lint passes; all 152 Node tests pass; production build passes with existing dependency/chunk warnings. Isolated read/write-in-memory fixture checked at 1440x900 and 390x844, with single/multiple requests and back/select behavior. No production customer data was used in the fixture. Laptop/phone screenshots remain local beside this note.

No database migrations, secrets or edge-function deployment are part of this update. Prior live build: a36d690-mvjshba6.
