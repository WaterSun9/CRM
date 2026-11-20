# Client email missing on the quote (2026-11-20)

Sandeep: the quote form has an "Email address" box, but the email never shows on the quote.

**True.** The email was saved, but page 1 of the quote did not print it.

**Was it visible before?** Yes, until the 4 Oct 2026 release (0b3baca). In that release the customer phone row on page 1 was redesigned (to fix the phone icon in the PDF). The old contact block was commented out, and the email line was inside that block, so it went with it. Since 4 Oct no quote has printed the client email. Phone and address were moved out of the old block; the email was missed.

**Fix.** `src/quotations/template/components/pages/Page1.tsx`: the email prints under the address in the "To," block when one was entered. No email = no line. The downloaded PDF uses the same page. No SQL.

Proof: `after-page1-email.jpg` (local demo `quotation-preview.html`, fake data). Lint and build pass; tests 193/195 (the 2 that fail also fail on `main`).
