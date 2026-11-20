# Release 20 Nov 2026: installation photos, geo tag check, reading photos

Branch `release/nov20` = live `main` + the 14 Nov work. **Switched off** for now (`src/featureFlags.js`):
OEM past data (moving into the warranty page history) and OEM claims / Tata form (their SQL is not run).

In this release: 17 named installation photos (#17 inverter serial required to leave Installation;
D-041, D-043, D-044), geo tag photo shown big and confirmed before it saves and moves the stage
(D-042), a photo for each of the 6 readings on a technician visit, and the activity-log lines.

## Order (important)
1. Backup: GitHub, Actions, "Daily Supabase Backup": last night's run finished with `BACKUP COMPLETE`.
2. SQL Editor (read-only, changes nothing): `0-precheck-read-only.sql`, first query only. Expect 0 rows.
3. Deploy the frontend (`npm run deploy` from `.claude/worktrees/deploy-main` after `main` = `release/nov20`).
4. **Straight after the deploy**, SQL Editor: run `supabase/migrations/20261116120000_reading_photos.sql`.
   Why after: once it runs, Save readings needs 6 photos, and only the new app has the photo boxes.
   The new app works before and after this file.
5. Quick check: a technician visit shows a photo box per reading.

Not in this release (do not run yet): `20261116130000_oem_past_data.sql`, `20261116140000_oem_claims.sql`.

## Known, not blocking (independent SQL review, 2026-11-20)
- A visit still open with no readings saved will need the 6 photos after step 4.
- A technician can delete a reading photo after the visit is closed, and cannot add it back. Fix later.
- A double tap on the same reading photo can quietly keep only the first one. Fix later.
