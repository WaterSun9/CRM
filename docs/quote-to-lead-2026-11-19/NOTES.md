# Quote → lead: attached at once (client bug, 2026-11-19)

Branch `claude/quote-to-lead-9c0ccb`, from `main` 5cde914. Not deployed. No SQL.

## What went wrong (plain words)
1. **Pop-up said "Not Attached".** The quote PDF was only made *after* the lead was saved. The pop-up's Quotation row only knew about files picked by hand, so it showed "Not Attached". Staff attached the PDF again by hand. That gave two copies, or they left the form to fetch the PDF and the lead was gone.
2. **Card empty until refresh.** The customer card loads its documents once, when it opens. The quote PDF was saved a few seconds later in the background, and nothing told the open card. So it looked empty until a refresh.
3. **Duplicates.** Every save added a new copy: the hand-attached file, the automatic one, each retry after a weak-signal timeout, and every "Download" of a linked quote in Quotations.
4. **Going back lost the lead.** Closing the pop-up said "Discard Lead" and threw away everything typed.

## What changed
1. **Add to leads makes the PDF first** (the button says "Preparing quote PDF…"). The pop-up shows it as **Attached** with its name and View, at the top and in the documents list. There is no Attach button for it, so it can't be added twice.
2. **The card updates itself.** When the PDF is saved, the open customer card (office card and partner portal) adds it straight away.
3. **One copy per quote.** Before saving, it checks the lead's documents for the same quote PDF. On Add to leads it keeps the copy that's already there. "Download" in Quotations replaces the old copy instead of adding another.
4. **Going back keeps the typing.** The message now says "Leave without adding the lead? What you typed is kept". Tapping Add to leads again brings it back, until the page is reloaded.

## Files
- `src/quotations/QuotationModule.jsx`: makes the PDF before the pop-up opens, keeps drafts, and reuses the PDF after saving.
- `src/components/AddLeadModal.jsx`: the attached quote row and the draft. The leave message is new.
- `src/quotations/leadPdf.js`: stops duplicates and tells the card.
- `src/quotations/leadAttach.js` (new): small helpers. Tests are in `tests/quotations/leadAttach.test.mjs`.
- `src/components/CustomerDetailModal.jsx` and `src/components/AgentPortal.jsx`: the card listens and adds the PDF.
- `src/dev/quotationPreview.jsx`: demo switches `?card` (opens the real customer card), `?slow=20000` (slow phone upload) and `?fresh` (start clean).

## Screenshots (local demo, fake data, no login)
- before-1: pop-up shows Quotation "Not Attached". after-1, after-2: attached at the top and in the documents list.
- before-2: going back says "Discard Lead", and the typing is gone. after-3: "Leave for now", and the typing is kept.
- before-3: card open while the PDF saves, still empty after it is saved. after-4, after-5: the same card fills in by itself.

## Checks
- `npx eslint . --quiet`: passes.
- `npm run build`: passes.
- Node tests: 196 of 198 pass. The 2 that fail (`lifecycle`, `repository`) already fail on `main`, because `repository.js` imports `../utils/filterValue` without `.js`. Not touched here.
- Not tested on the live database (uncertain until a real Add to leads after deploy). Check the lead's documents show the quote PDF only once.
