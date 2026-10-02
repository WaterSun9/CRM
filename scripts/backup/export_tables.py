#!/usr/bin/env python3
"""
Daily table export for the Watersun CRM backup (used by .github/workflows/daily-backup.yml).

Why this exists: the old workflow asked for each table in ONE request. The API
returns at most 1,000 rows per request, so every backup silently held only the
first 1,000 customers and 1,000 activity-log entries. This script pages through
every table, checks the row count against the server's own total, and exits
with an error if anything is short or fails - so a broken backup turns the
workflow red instead of committing a partial file.

Read-only: it only sends GET requests.

Usage:
  SUPABASE_URL=... SUPABASE_KEY=<service role key> python3 export_tables.py <out_dir>

Writes, per table:  <table>.json  (exact values, for restoring)
                    <table>.csv   (same rows, for opening in Excel)
and a manifest.json with row counts.
"""
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PAGE_SIZE = 1000          # the API's per-request cap
RETRIES = 3

# Required tables: the backup FAILS if any of these cannot be read.
REQUIRED_TABLES = [
    'admin', 'profiles', 'activity_log', 'metadata', 'documents',
    'bom', 'bom_items', 'delivery_batches', 'drivers', 'vendors', 'quotations',
]
# Optional tables: backed up when they exist, skipped with a warning when not
# (the chat / availability / audit-history SQL may not have been run yet).
OPTIONAL_TABLES = ['crm_chat_messages', 'crm_availability', 'admin_history']


def request(url, key, extra_headers=None):
    headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Accept': 'application/json'}
    headers.update(extra_headers or {})
    last_error = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=120) as resp:
                return resp.status, dict(resp.headers), resp.read()
        except urllib.error.HTTPError as err:
            body = err.read().decode('utf-8', 'replace')[:500]
            # 4xx (bad table/column, bad key) will not fix itself - stop now.
            if 400 <= err.code < 500:
                return err.code, dict(err.headers), body.encode()
            last_error = f'HTTP {err.code}: {body}'
        except Exception as err:  # network errors, timeouts
            last_error = str(err)
        time.sleep(5 * attempt)
    raise RuntimeError(f'Request failed after {RETRIES} attempts: {url} :: {last_error}')


def total_from_content_range(headers):
    value = headers.get('Content-Range') or headers.get('content-range') or ''
    # "0-999/5031" or "*/0"
    if '/' in value:
        tail = value.split('/')[-1]
        if tail.isdigit():
            return int(tail)
    return None


def export_table(base_url, key, table):
    """Returns (rows, server_total). Raises on any failure."""
    rows = []
    server_total = None
    order_by = 'id.asc'
    offset = 0
    while True:
        params = {'select': '*'}
        if order_by:
            params['order'] = order_by
        url = f'{base_url}/rest/v1/{table}?{urllib.parse.urlencode(params)}'
        status, headers, body = request(url, key, {
            'Range-Unit': 'items',
            'Range': f'{offset}-{offset + PAGE_SIZE - 1}',
            'Prefer': 'count=exact',
        })
        if status == 400 and order_by and offset == 0:
            # Table has no "id" column - page without an explicit order.
            order_by = None
            continue
        if status not in (200, 206):
            raise RuntimeError(f'{table}: HTTP {status}: {body[:300]!r}')
        page = json.loads(body)
        if not isinstance(page, list):
            raise RuntimeError(f'{table}: unexpected response: {str(page)[:300]}')
        if server_total is None:
            server_total = total_from_content_range(headers)
        rows.extend(page)
        if len(page) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows, server_total


def write_json_lines(path, rows):
    """A JSON array with one row per line and keys in a fixed order.
    Git stores only the rows that changed since yesterday, which keeps the
    backup repo small even though the whole table is written every day."""
    with open(path, 'w', encoding='utf-8') as handle:
        handle.write('[\n')
        for index, row in enumerate(rows):
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True))
            handle.write(',\n' if index < len(rows) - 1 else '\n')
        handle.write(']\n')


def write_csv(path, rows):
    columns = []
    for row in rows:
        for column in row.keys():
            if column not in columns:
                columns.append(column)
    with open(path, 'w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(columns)
        for row in rows:
            out = []
            for column in columns:
                value = row.get(column)
                if isinstance(value, (dict, list)):
                    value = json.dumps(value, ensure_ascii=False)
                out.append('' if value is None else value)
            writer.writerow(out)


def export_auth_users(base_url, key, out_dir):
    """Login accounts (no passwords - the admin API never returns them)."""
    users = []
    page = 1
    while True:
        url = f'{base_url}/auth/v1/admin/users?page={page}&per_page=1000'
        status, _, body = request(url, key)
        if status != 200:
            raise RuntimeError(f'auth users: HTTP {status}: {body[:300]!r}')
        data = json.loads(body)
        batch = data.get('users', data if isinstance(data, list) else [])
        users.extend(batch)
        if len(batch) < 1000:
            break
        page += 1
    write_json_lines(os.path.join(out_dir, 'auth_users.json'), users)
    return len(users)


def main():
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(2)
    out_dir = sys.argv[1]
    base_url = os.environ['SUPABASE_URL'].rstrip('/')
    key = os.environ['SUPABASE_KEY']
    skip_auth = os.environ.get('SKIP_AUTH_USERS') == '1'
    os.makedirs(out_dir, exist_ok=True)

    manifest = {'tables': {}, 'warnings': []}
    failures = []

    for table in REQUIRED_TABLES + OPTIONAL_TABLES:
        optional = table in OPTIONAL_TABLES
        try:
            rows, server_total = export_table(base_url, key, table)
        except RuntimeError as err:
            if optional and ('404' in str(err) or 'PGRST205' in str(err)):
                note = f'{table}: table does not exist yet - skipped'
                manifest['warnings'].append(note)
                print(f'::warning::{note}')
                continue
            failures.append(str(err))
            print(f'::error::{err}')
            continue

        if server_total is not None and len(rows) != server_total:
            message = f'{table}: exported {len(rows)} rows but the server reports {server_total}'
            failures.append(message)
            print(f'::error::{message}')

        write_json_lines(os.path.join(out_dir, f'{table}.json'), rows)
        write_csv(os.path.join(out_dir, f'{table}.csv'), rows)
        manifest['tables'][table] = {'rows': len(rows), 'server_total': server_total}
        print(f'{table}: {len(rows)} rows (server total {server_total})')

    if not skip_auth:
        try:
            manifest['auth_users'] = export_auth_users(base_url, key, out_dir)
            print(f"auth users: {manifest['auth_users']}")
        except RuntimeError as err:
            failures.append(str(err))
            print(f'::error::{err}')

    # Sanity floor: the customer table must never come back near-empty.
    customers = manifest['tables'].get('admin', {}).get('rows', 0)
    if customers < 100:
        failures.append(f'admin: only {customers} rows exported - refusing to treat this as a good backup')

    manifest['ok'] = not failures
    manifest['failures'] = failures
    with open(os.path.join(out_dir, 'manifest.json'), 'w', encoding='utf-8') as handle:
        json.dump(manifest, handle, indent=1)

    if failures:
        print('BACKUP INCOMPLETE:\n  ' + '\n  '.join(failures))
        sys.exit(1)
    print('All tables exported and verified.')


if __name__ == '__main__':
    main()
