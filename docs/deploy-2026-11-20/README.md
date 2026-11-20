# Release 20 Nov 2026: the 14 Nov work

Branch `release/nov20` = live `main` (4a51c06) + `claude/nov14-tata-install-photos-13fa44`.
Installation photos (D-041, D-043, D-044), geo tag confirm (D-042), reading photos, OEM past data, OEM claims, Tata form.

## Order (important)
1. Backup: check last night's "Daily Supabase Backup" run ended with `BACKUP COMPLETE`.
2. SQL Editor: run `0-precheck-read-only.sql`. Expect 0 rows, 0 rows, all null / 0. If not, stop.
3. SQL Editor: run `supabase/migrations/20261116130000_oem_past_data.sql` (new tables only; the live app is not affected).
4. SQL Editor: run `supabase/migrations/20261116140000_oem_claims.sql` (new table + 4 new history event names; the live app is not affected).
5. Deploy the frontend (`npm run deploy` from the release worktree).
6. **Straight after the deploy**, SQL Editor: run `supabase/migrations/20261116120000_reading_photos.sql`.
   Why last: once it runs, saving readings needs 6 photos. The old app has no photo boxes, so it must already be replaced. The new app works before and after this file.
7. Smoke test: technician visit (6 reading photos, then Save readings), installation photos, geo tag confirm, OEM past data page, an OEM claim.

Each file is one transaction with `set lock_timeout = '8s'`; safe to run again if it fails. "lock timeout" or "deadlock": nothing changed, wait a minute, run the same file again.

## Known, not blocking (independent SQL review, 2026-11-20)
- A visit still open with no readings saved will need the 6 photos after step 6.
- A technician can delete a reading photo after the visit is closed, and cannot add it back (old remove rule). Fix later.
- A double tap on the same reading photo can quietly keep only the first one. Fix later.
- Partners (CP/CPO/dealer) do not see OEM past visits or OEM claims; office and technicians do. The SQL comments say otherwise **(uncertain whether partners should see them)**.
