# Operations

How to release, change the database, rebuild the backend, back up and restore, and handle emergencies. Supabase project: `cjskyhxameobcqlfiuav`. Check the project ref in the browser address bar before running any SQL.

## Release checklist

### 1. Pre-checks

1. Commit everything to a branch: `git checkout -b release-<date> && git add -A && git commit -m "Release <date>"`.
2. Run locally, all must pass: `npx eslint . --quiet`, `node --test tests/*.test.mjs tests/quotations/*.test.mjs`, `npm run build`.
3. Write down the current live commit (for rollback).
4. If the frontend calls a new RPC, column or table, the SQL must go live **before** the frontend.

### 2. Backup

GitHub, Actions, "Daily Supabase Backup", Run workflow. Wait for it to finish and check that run's `summary.csv` ends with `BACKUP COMPLETE`. At minimum confirm last night's run succeeded.

### 3. SQL (if any)

- Run files in the order given in the release notes, one file per SQL Editor run.
- Stop at the first error. Each file is one transaction, so a failed file changed nothing.
- "lock timeout" or "deadlock detected" (40P01): nothing changed. Wait a minute and run the same file again.
- Run each file's verification queries before moving to the next.

### 4. Edge functions (only if `supabase/functions/` changed)

```bash
supabase functions deploy add_user --project-ref cjskyhxameobcqlfiuav
supabase functions deploy send-lead-to-vendor --project-ref cjskyhxameobcqlfiuav
```

### 5. Frontend

```bash
npm run deploy
```

This runs `predeploy` (`npm run build`, which first runs `scripts/write_version.js`) and then `gh-pages -d dist`. Pushing to `main` does not deploy: `.github/workflows/deploy.yml` runs on push but has never published.

After deploy, open the site and confirm the "new version" banner appears in an old tab, or check `version.json` on the live site shows the new build id.

### 6. Smoke test (5 minutes, one real login per role)

- **Admin:** open a customer, view a document, save a field, move a stage, save a BOM, edit a delivery batch, raise and clear a red flag, send a chat message to a group.
- **Office (sales):** open a customer, save a field, edit a delivery batch.
- **CPO:** open a branch customer, save, flag it.
- **Channel partner / dealer:** open a customer, see the flag, toggle it, open Quotations.
- **Vendor:** open a job, upload a geo photo, check the group chat message arrived; no flag controls.
- **Stamp maker:** open "My record".

Check the browser console for errors on each.

### 7. Rollback

- Frontend: `git checkout <previous commit> && npm run deploy`.
- SQL: each release file should ship with its undo. For policy changes, the previous text is in `supabase/schema.sql` (regenerated after the last release) - re-run that block.
- Red flags only: `drop table if exists public.customer_payment_review_flags;` (the app hides the flag when the table is missing).

## Database changes

### Rules

1. The owner runs all SQL in the Supabase SQL Editor. AI tools have read-only access and only prepare files.
2. One change = one file in `supabase/migrations/<YYYYMMDDHHMMSS>_<name>.sql`.
3. One transaction per file. First line: `set lock_timeout = '8s';`
4. Split big changes into parts (helpers, then functions, then policies). On 3 Oct a combined release file deadlocked live (40P01); splitting into five parts fixed it.
5. Take a backup first. Preview any data change with a `select` showing counts and sample rows.
6. Run verification queries after. A SQL check proves objects exist; only a real login proves a role's access.
7. After it is live, regenerate `supabase/schema.sql` from live (or apply the same edit to it by hand) so it stays the single source of truth.
8. Never run `supabase/schema.sql` on live.

### Template

```sql
-- supabase/migrations/20261010120000_example_change.sql
-- What: <one line>. Why: <one line>.
-- Undo: <the statements that reverse it, or "see bottom">.
set lock_timeout = '8s';

begin;

-- the change, written to be safe to re-run:
-- create ... if not exists / create or replace function ... / drop policy if exists ...; create policy ...

commit;

-- Verification (run after commit; paste results into the release notes)
-- select to_regclass('public.<table>');
-- select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = '<table>';
-- select proname, prosecdef from pg_proc where proname = '<function>';
-- select has_function_privilege('anon', 'public.<function>(<args>)', 'execute');  -- expect false
```

For functions that bypass RLS (`security definer`): check `auth.uid()` is not null and the caller's role inside the function, set `search_path`, and `revoke execute ... from public, anon`.

### Renaming a person (only if unavoidable)

Name changes must cascade in the same transaction, then the person must still see their records. Admin runs it:

```sql
set lock_timeout = '8s';
begin;
update public.profiles set name = 'NEW NAME' where id = '<profile-uuid>';
-- Dealer (agent2) or channel partner (agent):
update public.admin set sub_channel_partner = 'NEW NAME' where lower(trim(sub_channel_partner)) = lower(trim('OLD NAME'));
update public.admin set channel_partner = 'NEW NAME' where lower(trim(channel_partner)) = lower(trim('OLD NAME'));  -- agent / CPO branch only
-- Vendor:
-- update public.admin set vendor = 'NEW NAME' where lower(trim(vendor)) = lower(trim('OLD NAME'));
-- update public.vendors set name = 'NEW NAME' where lower(trim(name)) = lower(trim('OLD NAME'));
-- Check the row counts look right, then:
commit;
```

Never run `update profiles set name = ...` on its own.

## supabase/schema.sql

What it is: the complete backend generated read-only from live on 4 Oct 2026 (after the 4 Oct release, red flags, chat audiences, private chat and customer-file scoping and the team chat rules). Tables, constraints, indexes, 34 functions, view `v_incomplete_customers`, 11 triggers, RLS and 63 access rules (including storage), table and column grants, buckets `customer-documents` and `service-issues` (both private), realtime on `admin` and `profiles`, the nightly cleanup job at 02:00, and the auto-RLS event trigger. Built twice on an empty Postgres; every policy, constraint, function body, trigger and grant compared identical to live.

What it is not: data. No customers, logins, stored files, dropdown lists (`metadata`), vendors or drivers. Migrations written but not yet run on live are not in it either. Edge functions deploy separately.

Use it for a new, empty project only: another client, staging, or disaster recovery. It is safe to run twice. It is never needed on live.

**Keep it current:** after you run any migration on live, regenerate it (ask Claude: "regenerate schema.sql from live") so it always equals production.

### New client setup (identical CRM, empty, for another company)

1. **Supabase:** create a new project (Pro if they need daily backups). Note its URL and anon key (Settings, API).
2. **Database:** SQL Editor, New query, paste all of `supabase/schema.sql`, Run. Expect "Success" plus a few notices. If it says pg_cron could not be enabled: Database, Extensions, enable `pg_cron`, then run the one `cron.schedule` line it prints.
3. **First admin:** Authentication, Users, Add user (email + password, Auto confirm). Then run the commented block in section 10 at the bottom of `schema.sql` with that email and name.
4. **Edge functions:** `supabase link --project-ref <new ref>`, then `supabase functions deploy add_user` and `supabase functions deploy send-lead-to-vendor`, and set their secrets for the new project (see Settings and secrets; use the new client's sender email).
5. **Auth settings:** Authentication, URL configuration: set Site URL and redirect URLs to the new client's site (password-reset links use it). Turn on leaked-password protection.
6. **Frontend:** a separate copy or branch of the app per client. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` to the new project, change branding (logo in `src/assets`, `public/CNAME`, company name, quotation header/footer images if Quotation Maker is used, `homepage` in `package.json`), then build and deploy to their hosting.
7. **Setup data:** sign in as the admin; add dropdown values (payment types, module brands, channel partners, etc.), vendors and users from the app. Use each person's exact name, because access matches by name.
8. **Smoke test:** one login per role (see Release checklist, step 6).

### New project or disaster recovery

1. Create a new Supabase project. Never restore over production.
2. SQL Editor of the new project: paste and run `supabase/schema.sql`.
3. Deploy both edge functions to the new project ref and set their secrets (see Settings and secrets).
4. Create the first admin: Authentication, Add user (email + password). Then in the SQL Editor:
   `insert into public.profiles (id, name, email, user_type, role, status) values ('<auth user id>', 'ADMIN NAME', '<email>', 'admin', 'Admin', 'active');`
   (The SQL Editor has no `auth.uid()`, so the profile guard allows it.)
5. Restore data (see Restore below). If the backup has a full dump (`db/`), use that instead of steps 2 and 4.
6. If logins were not restored, sign in as admin and create users in User Management (calls `add_user`). Use the **exact same names** as before, or name-based access will not match. Technician accounts fail until the role constraint is fixed (BACKLOG P1).
7. Copy stored files back into the `customer-documents` and `service-issues` buckets from the off-site copy.
8. Point the app at the new project: update `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (and GitHub secrets), then `npm run deploy`.
9. Run the smoke test for every role.

## Backups and restore

The daily workflow `.github/workflows/daily-backup.yml` ("Daily Supabase Backup") runs at 01:30 IST, uses `scripts/backup/export_tables.py`, and writes to the private backup repo.

| What | Where in the backup repo | Needs |
|---|---|---|
| Every table, all rows, as CSV (paged, not capped at 1,000) | `<table>.csv` or `<table>_part01.csv`, `_part02`... | existing secrets |
| Login accounts (no passwords) | `auth_users.csv` | existing secrets |
| Rows saved vs rows on the server; last line `BACKUP COMPLETE` | `summary.csv` | existing secrets |
| Full database dump: structure + data + auth | `db/schema.sql`, `db/data.sql`, `db/auth.sql` | `SUPABASE_DB_URL` |
| Uploaded files | off-site bucket (not git) | storage + off-site secrets |

- One folder per run: `YYYY/MM/DD/HH-MM/` in India time. A manual run gets its own folder; nothing is overwritten.
- The run fails loudly on any error or short table; nothing partial is committed.
- Big tables are split into parts under 500 KB (GitHub shows CSVs as tables up to 512 KB). Each part has the header row. To merge: `head -1 admin_part01.csv > admin.csv && tail -q -n +2 admin_part*.csv >> admin.csv` (only safe when no value has a line break; otherwise use Python's `csv` module or `db/data.sql`).
- JSON columns (e.g. `panel_serial_no`) are stored as JSON text in the cell.
- A missing optional secret skips its step with a warning; the table export still runs.
- The backup repo holds all customer personal data. Keep it private and limit access.
- Check the storage job copies **every** bucket in use (`customer-documents` and `service-issues`). See BACKLOG.
- On the Pro plan Supabase also keeps 7-day managed backups (dashboard, Database, Backups). Point-in-time recovery is a paid add-on.

### Restore one table or one customer (most common)

1. Open the run folder for the right date and time; open `summary.csv` to find the file.
2. Open the CSV part on GitHub, find the row by `id`, copy the values.
3. Write the `update` in the SQL Editor inside `begin; ... commit;` (with `set lock_timeout = '8s';`), and log what you did in `activity_log`.
4. `admin_history` (admin-only, written by trigger) also shows old values for every customer change since 2 Oct.

### Restore the whole database (from a dump)

```bash
# Into a NEW, empty Supabase project. Never over production.
psql "$NEW_DB_URL" -f db/schema.sql
psql "$NEW_DB_URL" -f db/data.sql
psql "$NEW_DB_URL" -f db/auth.sql
```

Without a dump: run `supabase/schema.sql`, recreate users (step 6 above), then import the CSVs table by table (parents first: `profiles` rows need matching auth users, then `admin`, then `documents`, `bom`, `bom_items`, `delivery_batches`, and the rest). Columns that point at old user ids (`quotations.owner_id`, `activity_log.user_id`, chat sender ids) will not match new logins.

### Monthly restore test (15 minutes)

1. Create a scratch Supabase project.
2. Run the three `psql` commands (or `supabase/schema.sql` + CSV import).
3. Compare row counts with that folder's `summary.csv`.
4. Delete the scratch project.

## Settings and secrets

Names only. Never write values in the repo, docs, chat or tickets.

| Where | Names | Used for |
|---|---|---|
| Local `.env` (not committed) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Build and dev. The anon key ships in the JS bundle by design; RLS protects data. |
| Build env (optional) | `VITE_BUILD_ID` (or `GITHUB_SHA`) | `scripts/write_version.js` build id; falls back to the git commit |
| GitHub Actions secrets | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `BACKUP_PAT`, `BACKUP_REPO` | Daily backup (CSV export, push to backup repo) |
| GitHub Actions secrets (optional) | `SUPABASE_DB_URL` (Session pooler string, port 5432) | Full dump in the backup |
| GitHub Actions secrets (optional) | `ALERT_WEBHOOK_URL` | Slack/Discord message when a backup fails |
| GitHub Actions secrets (optional) | `STORAGE_S3_ENDPOINT`, `STORAGE_S3_REGION`, `STORAGE_S3_KEY_ID`, `STORAGE_S3_SECRET` | Read Supabase Storage for the file backup |
| GitHub Actions secrets (optional) | `OFFSITE_S3_ENDPOINT`, `OFFSITE_S3_KEY_ID`, `OFFSITE_S3_SECRET`, `OFFSITE_S3_BUCKET` | Off-site copy of files (Cloudflare R2 or Backblaze B2) |
| Supabase Edge Function secrets | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (provided by Supabase) | Both functions |
| Supabase Edge Function secrets | `BREVO_API_KEY`, `SENDER_EMAIL` | Emails from `add_user` and `send-lead-to-vendor` |

- `BACKUP_PAT`: fine-grained token, access to the backup repo only (Contents read/write), with a calendar reminder before expiry. An expired token stops every backup.
- Supabase Auth: turn on leaked-password protection (currently off).
- If any key leaks: rotate it in the Supabase dashboard (API keys / JWT), then update `.env`, GitHub secrets and edge function secrets, then `npm run deploy`.

## Maintenance

### Weekly

- [ ] Last 7 backup runs green; latest `summary.csv` ends with `BACKUP COMPLETE`.
- [ ] Supabase dashboard: Advisors (security and performance). Investigate anything new.
- [ ] Orphaned logins (auth user without profile; they are locked out at login):
      `select u.id, u.email from auth.users u left join public.profiles p on p.id = u.id where p.id is null;`
- [ ] `select count(*) from public.v_incomplete_customers;` and pass the list to the team.
- [ ] Activity log: search for `SAVE CHECK FAILED` entries and follow up.
- [ ] Edge function logs for errors.

### Monthly

- [ ] Restore test (above).
- [ ] `BACKUP_PAT` expiry date.
- [ ] Users: deactivate people who left; check no two active profiles share a name:
      `select lower(trim(name)), count(*) from public.profiles group by 1 having count(*) > 1;`
- [ ] `npm audit --omit=dev`.
- [ ] Duplicate file numbers: `select folder_no, count(*) from public.admin where deleted_at is null group by 1 having count(*) > 1;`
- [ ] Confirm `supabase/schema.sql` still matches live after any change that month.

### Before a big change

- [ ] Announce the window; ask users to save and sign out.
- [ ] Fresh backup, and know the rollback steps before starting.
- [ ] Preview every data change with `select` counts first; never mass-replace blanks without approval.
- [ ] Use clearly named fake customers (e.g. `ZZ SYSTEM TEST`) for testing and delete only those afterwards. Never delete real activity history.
- [ ] Test SELECT and UPDATE separately for each role with real logins; an RLS-refused save must show an error, not "Saved".

## Emergency procedures

### A user should lose access now

1. User Management, Deactivate (sets `profiles.status = 'inactive'`; the app signs them out on the next check).
2. Supabase dashboard, Authentication: also remove the user's sessions or ban the user. RLS checks `user_type`, not `status`, so a still-valid token keeps database access until this is done.

### A role sees or changes data it should not

Replace only the faulty policy, in one transaction, as on 3 Sep 2026 (a SELECT-only change to `admin_select`, verified by counting each test user's rows before and after). Save the current text first:

```sql
select policyname, cmd, qual, with_check from pg_policies where schemaname = 'public' and tablename = 'admin';
```

### Freeze customer edits (everyone except Admin read-only)

```sql
set lock_timeout = '8s';
begin;
alter policy admin_update on public.admin
  using (get_my_user_type() = 'admin') with check (get_my_user_type() = 'admin');
alter policy admin_insert on public.admin
  with check (get_my_user_type() = 'admin');
commit;
```

Reads still work for every role. Undo: re-run the `admin_update` and `admin_insert` blocks from `supabase/schema.sql` section 7. Other tables (documents, BOM, delivery) are not frozen by this.

### Data was overwritten or lost

1. Do not "fix" by hand first. Find the old value in `admin_history` (admin-only) or the latest backup CSV.
2. Before restoring, copy the current rows into a backup table (as done with `restore_backup_2026_10_01` on 1 Oct).
3. Restore with a single `update` in a transaction and log it.

### Site broken after a deploy

`git checkout <previous commit> && npm run deploy`. Users get the "new version" banner and reload.
