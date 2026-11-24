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

Writes CSV only, one or more files per table:
  <table>.csv                     when the table fits in one file, or
  <table>_part01.csv, _part02 ... when it does not. Each part is kept under
                                  500 KB so GitHub still shows it as a table
                                  (GitHub only renders CSV files up to 512 KB).
                                  Every part has the header row.
  auth_users.csv                  login accounts (no passwords)
  summary.csv                     one row per table: rows, server total, files
  failures.txt                    only when something went wrong
"""
import csv
import io
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
# (their SQL may not have been run yet).
OPTIONAL_TABLES = [
    'crm_chat_messages', 'crm_availability', 'admin_history',
    'service_issues', 'service_visits', 'service_issue_files',
    'customer_payment_review_flags',
    'serial_number_review', 'serial_number_import',
    # Added 2026-11-24 (Mahvish: back up every table we made). Also found by discover_tables().
    'admin_field_guard_log', 'admin_field_guard_settings', 'admin_field_rules', 'customer_sites',
    'oem_past_finish', 'oem_past_records', 'panel_loading', 'phone_otp_requests',
    'service_completion_otps', 'service_day_trip_points', 'service_day_trips', 'service_issue_comments',
    'service_issue_events', 'service_issue_plans', 'service_km_settings', 'service_oem_claims',
    'service_plan_stops', 'service_trips', 'trip_distance_cache', 'trip_distance_lookups',
    'whatsapp_contacts', 'whatsapp_inbound', 'whatsapp_messages',
]


def discover_tables(base_url, key):
    """Every table the API can see, with its primary key columns: {table: [pk, ...]}.
    Read from the API's own description (OpenAPI), so a table made later is backed up without
    editing this file (2026-11-24). Views (read-only, no insert/delete) are left out: their rows
    are in their tables already."""
    status, _headers, body = request(f'{base_url}/rest/v1/', key, {'Accept': 'application/openapi+json'})
    if status != 200:
        raise RuntimeError(f'table list: HTTP {status}: {body[:200]!r}')
    spec = json.loads(body)
    found = {}
    for path, operations in (spec.get('paths') or {}).items():
        name = path.strip('/')
        if not name or name.startswith('rpc/') or '/' in name:
            continue
        if not ({'post', 'delete', 'patch'} & set(operations)):
            continue
        props = ((spec.get('definitions') or {}).get(name) or {}).get('properties') or {}
        found[name] = [col for col, prop in props.items() if '<pk/>' in str(prop.get('description', ''))]
    return found


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


def export_table(base_url, key, table, order_by='id.asc'):
    """Returns (rows, server_total). Raises on any failure. order_by keeps pages stable
    (the primary key when known)."""
    rows = []
    server_total = None
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


MAX_PART_BYTES = 500 * 1024   # GitHub renders CSV as a table only up to 512 KB


def _csv_line(values):
    buffer = io.StringIO()
    csv.writer(buffer).writerow(values)
    return buffer.getvalue()


def _cell(value):
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False)   # json columns stay readable and restorable
    return '' if value is None else value


def write_csv_parts(out_dir, name, rows, columns=None):
    """Writes <name>.csv, or <name>_partNN.csv files each under MAX_PART_BYTES.
    Returns the list of file names written."""
    if columns is None:
        columns = []
        for row in rows:
            for column in row.keys():
                if column not in columns:
                    columns.append(column)
    header = _csv_line(columns)
    parts, current, size = [], [], len(header.encode('utf-8'))
    for row in rows:
        line = _csv_line([_cell(row.get(column)) for column in columns])
        line_bytes = len(line.encode('utf-8'))
        if current and size + line_bytes > MAX_PART_BYTES:
            parts.append(current)
            current, size = [], len(header.encode('utf-8'))
        current.append(line)
        size += line_bytes
    parts.append(current)   # always at least one file, even for an empty table

    names = [f'{name}.csv'] if len(parts) == 1 else [f'{name}_part{i:02d}.csv' for i in range(1, len(parts) + 1)]
    for file_name, lines in zip(names, parts):
        with open(os.path.join(out_dir, file_name), 'w', newline='', encoding='utf-8') as handle:
            handle.write(header)
            handle.writelines(lines)
    return names


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
    columns = ['id', 'email', 'phone', 'role', 'created_at', 'last_sign_in_at',
               'email_confirmed_at', 'banned_until', 'user_metadata', 'app_metadata']
    return len(users), write_csv_parts(out_dir, 'auth_users', users, columns)


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

    try:
        discovered = discover_tables(base_url, key)
        print(f'table list: {len(discovered)} tables found on the server')
    except (RuntimeError, ValueError) as err:
        discovered = {}
        note = f'could not read the table list ({err}); backing up the named tables only'
        manifest['warnings'].append(note)
        print(f'::warning::{note}')
    named = REQUIRED_TABLES + OPTIONAL_TABLES
    tables = named + sorted(t for t in discovered if t not in named)

    for table in tables:
        optional = table not in REQUIRED_TABLES
        pk = discovered.get(table) or []
        order_by = ','.join(f'{col}.asc' for col in pk) if pk else 'id.asc'
        try:
            rows, server_total = export_table(base_url, key, table, order_by)
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

        files = write_csv_parts(out_dir, table, rows)
        manifest['tables'][table] = {'rows': len(rows), 'server_total': server_total, 'files': files}
        print(f'{table}: {len(rows)} rows (server total {server_total}) in {len(files)} file(s)')

    if not skip_auth:
        try:
            manifest['auth_users'], manifest['auth_files'] = export_auth_users(base_url, key, out_dir)
            print(f"auth users: {manifest['auth_users']}")
        except RuntimeError as err:
            failures.append(str(err))
            print(f'::error::{err}')

    # Sanity floor: the customer table must never come back near-empty.
    customers = manifest['tables'].get('admin', {}).get('rows', 0)
    if customers < 100:
        failures.append(f'admin: only {customers} rows exported - refusing to treat this as a good backup')

    ok = not failures
    with open(os.path.join(out_dir, 'summary.csv'), 'w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle)
        writer.writerow(['table', 'rows_saved', 'rows_on_server', 'matches', 'files'])
        for table, info in manifest['tables'].items():
            total = info['server_total']
            writer.writerow([table, info['rows'], '' if total is None else total,
                             'yes' if total is None or total == info['rows'] else 'NO',
                             ' '.join(info['files'])])
        if 'auth_users' in manifest:
            writer.writerow(['auth_users', manifest['auth_users'], '', 'yes', ' '.join(manifest['auth_files'])])
        for note in manifest['warnings']:
            writer.writerow([note, '', '', '', ''])
        writer.writerow(['BACKUP COMPLETE' if ok else 'BACKUP INCOMPLETE', '', '', 'yes' if ok else 'NO', ''])
    if failures:
        with open(os.path.join(out_dir, 'failures.txt'), 'w', encoding='utf-8') as handle:
            handle.write('\n'.join(failures) + '\n')

    if failures:
        print('BACKUP INCOMPLETE:\n  ' + '\n  '.join(failures))
        sys.exit(1)
    print('All tables exported and verified.')


if __name__ == '__main__':
    main()
