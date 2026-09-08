**Source visual truth**

- `/var/folders/qz/xvbmvfkj36b1dw4zvrsnqqqm0000gn/T/TemporaryItems/NSIRD_screencaptureui_VGPyW8/Screenshot 2026-09-08 at 10.50.17 PM.png`
- Source pixels: 894 x 1604.

**Implementation evidence**

- `/Users/mahvishsadafv2/Desktop/watersun final/implementation-stage-search-qa.png`
- Browser viewport: 894 x 1598 CSS px, device density 1.
- Captured pixels: 894 x 1200 (browser capture height limit); width is normalized 1:1 with the source.
- State: Channel Partner preview, Leads work queue, empty-data state.
- Primary interaction tested: open the work queue and locate the stage search.
- Console errors: 0.

**Comparison**

- The source showed the phone-style stage screen at 894 px wide with no search control below the header.
- The implementation now shows `Search customers...` immediately below the header at that same width.
- The reference contains live Loan customers while the safe preview contains no customer data, so customer-card fidelity was not evaluated. The scoped responsive-control comparison is conclusive.
- Focused region: header and the area immediately beneath it. No additional focused crop was necessary because the missing/present search control is clearly legible in the full-width captures.
- Typography, spacing, colors, icons, and copy use the existing Agent Portal components and tokens; the only intentional change is making the existing search row visible at every portal width.
- No image assets were introduced or changed.

**Findings**

- No remaining P0, P1, or P2 issue for the reported stage-search visibility bug.

**Comparison history**

- Before: the `sm:hidden` breakpoint removed the search at the reported 894 px viewport.
- Fix: removed the breakpoint-only visibility restriction while preserving the existing search component and stage-scoped filtering.
- After: the search is visible beneath the stage header at 894 px; no console errors.

**Implementation Checklist**

- [x] Search visible in laptop-hosted phone-style view.
- [x] Search remains scoped to the selected stage.
- [x] Production build passes.
- [x] Browser render and console verified.

final result: passed
