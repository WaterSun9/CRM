# Parked truck printing — 17 October 2026

Preserved at the owner’s request for future reuse. Printing is disabled in the active full-screen truck loading checklist.

- `TruckLoadingSheet.jsx.disabled`: exact original component before the full-screen redesign, including the print button, paper layout, pagination, headers, quantity checks and signatures.
- `truck-sheet-print.css.disabled`: original truck-specific print styles from DeliveryBatchesView.jsx.

These files are intentionally outside the application source and have disabled extensions. They are not imported or bundled.

To restore printing later, extract the paper document from the archived component into a separate print component under src/components so its ../utils/truckLoad import resolves. The shared groupNotesByCustomer and planTruckSheetPages helpers remain in src/utils/truckLoad.js. Restore the archived styles inside DeliveryBatchesView’s existing print media block, and connect an explicit print action to window.print(). Restore A4 landscape and the root-hiding print conditions for the truck document; they currently apply only to the gate pass. The archived component originally received onPrint={() => window.print()} alongside the sheet and loading callbacks.

Keep the current checklist’s corrected loading/save behavior. The archive is a reference for printing, not a replacement for the current interactive component. Verify pagination and layout before enabling printing again.
