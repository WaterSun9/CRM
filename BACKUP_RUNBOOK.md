# Backup runbook

The daily backup (`.github/workflows/daily-backup.yml`) runs at 1:30 AM IST and writes to the private backup repo.

## What is backed up

| What | Where in the backup repo | Needs |
|---|---|---|
| Every table, all rows (customers, activity log, documents list, BOM, delivery batches, drivers, vendors, quotations, profiles, metadata), as JSON and CSV | `snapshot/*.json`, `snapshot/*.csv` | existing secrets |
| Login accounts (no passwords) | `snapshot/auth_users.json` | existing secrets |
| Row counts, plus whether every table matched the server | `snapshot/manifest.json` | existing secrets |
| Full database: structure (tables, RLS rules, functions, triggers) and data, restorable in one command | `snapshot/db/schema.sql`, `data.sql`, `auth.sql` | `SUPABASE_DB_URL` |
| Uploaded files (PDFs, photos) | off-site bucket, not the git repo | storage secrets |

Every past day is in git history: `git log -- snapshot/` lists the days, and `git checkout <commit> -- snapshot/` restores that day's files.

## Secrets to add (GitHub repo, Settings, Secrets and variables, Actions)

1. **`SUPABASE_DB_URL`** (recommended). Supabase dashboard, Connect, **Session pooler** connection string (port 5432, not 6543), with the database password filled in.
2. **`ALERT_WEBHOOK_URL`** (recommended). A Slack or Discord incoming-webhook URL. A failed backup then posts a message. Without it, only the GitHub account that last edited the workflow gets an email.
3. **Storage files** (needed to back up uploaded documents):
   - `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_KEY_ID`, `STORAGE_S3_SECRET`: Supabase dashboard, Storage, S3 Connection (create an access key).
   - `OFFSITE_S3_ENDPOINT`, `OFFSITE_S3_KEY_ID`, `OFFSITE_S3_SECRET`, `OFFSITE_S3_BUCKET`: a bucket at Cloudflare R2 or Backblaze B2 (both S3-compatible; R2's free tier is 10 GB).

Until a secret is added, its step is skipped with a warning; the table export still runs.

## Token hygiene

- `BACKUP_PAT`: use a **fine-grained** token with access only to the backup repo (Contents: read and write), and set a calendar reminder before it expires. An expired token stops every backup.
- The backup repo contains all customer personal data. Keep it private, and give access only to people who need it.

## Restore

**One table or one customer** (most common):
1. Open `snapshot/<table>.json` in the backup repo, at the day you need.
2. Find the row by `id` and copy the values.
3. Write an `update` in the Supabase SQL Editor, inside `begin; … commit;`, and log it in `activity_log`.

**Whole database** (disaster recovery), from `snapshot/db/`:
```bash
# Into a NEW, empty Supabase project first - never straight over production.
psql "$NEW_DB_URL" -f schema.sql
psql "$NEW_DB_URL" -f data.sql
psql "$NEW_DB_URL" -f auth.sql
```
Then point the app's `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` at the new project.

## Monthly restore test (15 minutes)

1. Create a scratch Supabase project.
2. Run the three `psql` commands above against it.
3. Compare row counts with `snapshot/manifest.json`.
4. Delete the scratch project.

A backup that has never been restored is only a hope.

## Supabase plan

The keep-alive workflow means the project is on the Free plan. That plan has no managed daily backups and no point-in-time recovery, and keeps API logs for only 1 day. The Pro plan adds 7-day managed backups and 7-day logs, and stops pausing; point-in-time recovery is an add-on. On Pro, the keep-alive workflow can be removed.
