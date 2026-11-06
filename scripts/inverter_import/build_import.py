"""Builds the inverter / panel serial import for residential customer cards (5 Nov 2026).

Reads the client's inverter list (xlsx), the vendor application list (csv, column AW =
PV module serials) and an export of public.admin, and writes a review report plus an
import SQL file. Nothing here touches the database.

A row is matched to a card only when the name AND the number agree:
  inverter list  -> file no      = admin.folder_no
  vendor csv     -> consumer no  = admin.consumer_no   (the csv has no file no)
Only empty fields are filled; a different existing value is listed as a conflict.

Usage (needs openpyxl):
  python3 -I scripts/inverter_import/build_import.py INVERTER.xlsx VENDOR.csv ADMIN_EXPORT.csv OUT_DIR
"""
import csv
import difflib
import glob
import os
import json
import re
import sys
from collections import Counter, defaultdict

import openpyxl
from openpyxl.styles import Font

PART_SIZE = 400  # cards per import file; keeps each file well under the SQL editor's size limit
HONORIFICS = {'MR', 'MRS', 'MS', 'SMT', 'SHRI', 'SHREE', 'KUM', 'LATE', 'DR', 'FILE', 'NO'}
# BHA and KUMA: card names are cut at 30 characters ("DHANJIBHA").
SUFFIXES = ('BHAI', 'KUMAR', 'BAHEN', 'BEN', 'JI', 'BHA', 'KUMA')
MAKES = {
    'SOLAX': 'Solax', 'SOLEX': 'Solax', 'SOLAR YAAN': 'Solaryaan', 'SOLARYAAN': 'Solaryaan',
    'GOODWE': 'Goodwe', 'SOLIS': 'Solis', 'DEYE': 'Deye', 'VELOX': 'Velox', 'UTL': 'UTL',
    'POLYCAB': 'Polycab', 'FOXES': 'FoxESS', 'VSOLE': 'VSOLE',
}


def blank(value):
    return str(value or '').strip() in ('', 'null', '[]', '""')


def tokens(name):
    words = re.sub(r'[^A-Z]+', ' ', str(name or '').upper()).split()
    words = [w for w in words if w not in HONORIFICS]
    # "SHAILESH KUMAR" is "SHAILESHKUMAR": glue a lone suffix onto the word before it.
    out = []
    for word in words:
        if out and (word in SUFFIXES or word == 'LAL'):
            out[-1] += word
        else:
            out.append(word)
    return out


def root(word):
    # Spelling noise in Gujarati names: DINESHBHAI/DINESH, CHAUDHARY/CHODHARI, double letters.
    # Stripped repeatedly, so RAVJIBHAI and RAVJI both come down to RAV.
    stripped = True
    while stripped:
        stripped = False
        for suffix in SUFFIXES:
            if word.endswith(suffix) and len(word) - len(suffix) >= 3:
                word, stripped = word[:-len(suffix)], True
                break
    word = word.replace('AU', 'O').replace('Y', 'I').replace('W', 'V')
    word = re.sub(r'(.)\1+', r'\1', word)
    return word[0] + word[1:].replace('H', '')


def consonants(word):
    return word[0] + re.sub(r'[AEIOU]', '', word[1:])


def similar(a, b):
    # RAVA/RAV and DAUDA/DAUD differ only in vowels; longer words may differ by a letter.
    if a == b or (len(consonants(a)) >= 2 and consonants(a) == consonants(b)):
        return True
    # Card names are cut at 30 characters ("JITENDRAKUMA").
    if min(len(a), len(b)) >= 5 and (a.startswith(b) or b.startswith(a)):
        return True
    return min(len(a), len(b)) >= 4 and difflib.SequenceMatcher(None, a, b).ratio() >= 0.8


def name_match(a, b):
    """'exact', 'close' or '' for two customer names."""
    ta, tb = tokens(a), tokens(b)
    if not ta or not tb:
        return ''
    if sorted(ta) == sorted(tb):
        return 'exact'
    # Every word of the shorter name must pair with a word of the longer one (spelling
    # slips and initials allowed), and at least two words must pair in full. So a missing
    # surname is fine, but a different first name or father's name is not.
    ra, rb = [root(w) for w in ta], [root(w) for w in tb]
    short, long_ = (ra, rb) if len(ra) <= len(rb) else (rb, ra)
    pool, full = list(long_), 0
    for word in short:
        hit = next((w for w in pool if w == word), None) or next((w for w in pool if similar(w, word)), None)
        if hit:
            full += len(word) > 1
        elif len(word) == 1:
            hit = next((w for w in pool if w.startswith(word)), None)
        if not hit:
            return ''
        pool.remove(hit)
    return 'close' if full >= 2 else ''


def name_roots(name):
    return {root(w) for w in tokens(name) if len(w) > 1}


def digits(value):
    return re.sub(r'\D', '', str(value or '')).lstrip('0')


def file_no(value):
    text = str(value or '').strip()
    return str(int(float(text))) if re.fullmatch(r'\d+(\.0+)?', text) else text


def serial_list(raw):
    text = str(raw or '').strip()
    if blank(text):
        return []
    try:
        value = json.loads(text)
        if isinstance(value, list):
            return [str(v).strip() for v in value if str(v or '').strip()]
        text = str(value)
    except ValueError:
        pass
    return [v.strip() for v in re.split(r'[\n,;]+', text) if v.strip()]


def clean_serial(value):
    if value is None:
        return '', ''
    if isinstance(value, float):
        return '', 'Excel stored it as a rounded number, digits lost'
    text = re.sub(r'\s+', ' ', str(value)).strip().upper()
    if len(text) < 6:
        return '', 'Too short to be a serial'
    return text, ''


def load_admin(path):
    cards = [r for r in csv.DictReader(open(path, encoding='utf-8-sig')) if not r['deleted_at']]
    by_folder, by_consumer, by_name = defaultdict(list), defaultdict(list), defaultdict(list)
    for card in cards:
        if card['folder_no']:
            by_folder[file_no(card['folder_no'])].append(card)
        if digits(card['consumer_no']):
            by_consumer[digits(card['consumer_no'])].append(card)
        for word in name_roots(card['customer_name']):
            by_name[word].append(card)
    return cards, by_folder, by_consumer, by_name


def read_inverter_list(path):
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    out = []
    for sheet in wb.worksheets:
        rows = list(sheet.iter_rows(values_only=True))
        head = [str(h or '').strip().upper() for h in rows[0]]
        residential = sheet.title.strip().lower().startswith('resid')
        col = {
            'file': head.index('FILE NO'),
            'name': head.index('CUSTOMER NAME') if 'CUSTOMER NAME' in head else head.index('NAME'),
            'make': head.index('INVETER NAME'),
            'serial': head.index('INVETER SERIAL NO'),
        }
        for number, row in enumerate(rows[1:], start=2):
            if not any(v not in (None, '') for v in row):
                continue
            out.append({
                'source': f'Inverter list / {sheet.title} row {number}', 'residential': residential,
                'category': 'Residential' if residential else sheet.title.strip(),
                'key': file_no(row[col['file']]), 'name': str(row[col['name']] or '').strip(),
                'make_raw': row[col['make']], 'serial_raw': row[col['serial']],
            })
    return out


def read_vendor_csv(path):
    rows = list(csv.reader(open(path, encoding='utf-8-sig')))
    head = rows[0]
    aw = 48  # column AW
    assert head[aw].strip() == 'PV Module Serial No', head[aw]
    col = {h.strip(): i for i, h in enumerate(head)}
    out = []
    for number, row in enumerate(rows[1:], start=2):
        category = row[col['Connection Category Name (RWA/Domestic)']].strip()
        out.append({
            'source': f'Vendor csv row {number}', 'residential': category == 'Residential', 'category': category,
            'key': digits(row[col['Consumer Number']]), 'name': row[col['Consumer Name']].strip(),
            'application': row[col['Application Number']].strip(),
            'panels': list(dict.fromkeys(v.strip().upper() for v in row[aw].split(',') if v.strip())),
        })
    return out


def find_card(row, by_key, by_name, key_label):
    """(card, match_type, problem, cards on that number, cards the name belongs to). Never matches on name or number alone."""
    if not row['key']:
        return None, '', f'No {key_label} in the sheet', [], []
    candidates = by_key.get(row['key'], [])
    scored = [(c, name_match(row['name'], c['customer_name'])) for c in candidates]
    hits = [(c, m) for c, m in scored if m]
    if len(hits) == 1:
        return hits[0][0], hits[0][1], '', candidates, []
    if len(hits) > 1:
        exact = [(c, m) for c, m in hits if m == 'exact']
        if len(exact) == 1:
            return exact[0][0], 'exact', '', candidates, []
        return None, '', f'{len(hits)} cards share this {key_label} and name', candidates, []
    shared = Counter(id(c) for r in name_roots(row['name']) for c in by_name.get(r, []))
    elsewhere = [c for r in name_roots(row['name']) for c in by_name.get(r, [])
                 if shared[id(c)] >= 2 and c not in candidates and name_match(row['name'], c['customer_name'])]
    elsewhere = list({c['id']: c for c in elsewhere}.values())
    on_number = '; '.join(f"{c['customer_name']} (file {c['folder_no']})" for c in candidates)
    if elsewhere:
        names_card = '; '.join(f"file {c['folder_no']} / consumer {c['consumer_no']}" for c in elsewhere)
        detail = f'Name belongs to card {names_card}'
        detail += f'; this {key_label} belongs to {on_number}' if candidates else ''
        return None, '', 'SWAPPED? ' + detail, candidates, elsewhere
    if candidates:
        return None, '', f'Name differs: this {key_label} belongs to {on_number}', candidates, []
    return None, '', '', [], []


def build(inverter_path, vendor_path, admin_path, out_dir):
    cards, by_folder, by_consumer, by_name = load_admin(admin_path)
    matched, conflicts, not_found, skipped = [], [], [], []
    writes = {}  # card id -> {field: value}
    claims = defaultdict(list)  # (card id, field) -> source rows wanting to write it
    review = []  # name / number disagree: staff decide on the Inverter page, "File no mismatch" tab

    def to_review(row, problem, candidates, name_cards, **values):
        residential = [c for c in candidates if (c.get('property_type') or 'Residential') == 'Residential']
        if problem.startswith('Name differs'):
            pairs = [(card, None, 'name_differs') for card in residential]
        elif problem.startswith('SWAPPED'):
            # The name wins: the name's card is offered first, the card on the sheet's number second.
            other = residential[0] if residential else None
            pairs = [(card, other, 'swapped') for card in name_cards if (card.get('property_type') or 'Residential') == 'Residential']
        else:
            return
        for card, other, kind in pairs:
            review.append({'source': row['source'], 'kind': kind, 'admin_id': card['id'], 'alt_admin_id': other['id'] if other else '',
                           'sheet_name': row['name'], 'sheet_number': row['key'], 'card_name': card['customer_name'], **values})

    def conflict(row, reason, card=None, field='', existing='', new=''):
        conflicts.append({'source': row['source'], 'sheet name': row['name'], 'sheet number': row['key'],
                          'card name': card['customer_name'] if card else '', 'card file no': card['folder_no'] if card else '',
                          'field': field, 'existing value': existing, 'sheet value': new, 'reason': reason})

    def take(row, card, how, field, value, existing, same):
        if blank(existing):
            claims[(card['id'], field)].append((row, card, how, value))
        elif same:
            pass  # already holds the same value
        else:
            conflict(row, 'Card already has a different value', card, field, existing, value if isinstance(value, str) else ', '.join(value))

    inverter_rows = read_inverter_list(inverter_path)
    # The same serial under two different file numbers is suspicious; the same customer listed twice is not.
    serial_files = defaultdict(set)
    for r in inverter_rows:
        if r['residential']:
            serial_files[clean_serial(r['serial_raw'])[0]].add(r['key'])
    for row in inverter_rows:
        if not row['residential']:
            skipped.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'category': row['category']})
            continue
        serial, bad = clean_serial(row['serial_raw'])
        make_raw = re.sub(r'\s+', ' ', str(row['make_raw'] or '')).strip().upper()
        make = MAKES.get(make_raw, make_raw.title())
        if not serial and not make:
            not_found.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'reason': 'Sheet has no inverter make or serial'})
            continue
        card, how, problem, candidates, name_cards = find_card(row, by_folder, by_name, 'file no')
        to_review(row, problem, candidates, name_cards, inverter_make=make, inverter_serial_no=serial, panel_serial_no='')
        if not card:
            (conflicts if problem else not_found).append(
                {'source': row['source'], 'sheet name': row['name'], 'sheet number': row['key'], 'card name': '', 'card file no': '',
                 'field': '', 'existing value': '', 'sheet value': serial, 'reason': problem} if problem else
                {'source': row['source'], 'name': row['name'], 'number': row['key'], 'reason': 'No card with this file no'})
            continue
        if (card.get('property_type') or 'Residential') != 'Residential':
            skipped.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'category': f"Card is {card['property_type']}"})
            continue
        if bad:
            conflict(row, bad, card, 'inverter_serial_no', card['inverter_serial_no'], str(row['serial_raw']))
        elif serial and len(serial_files[serial]) > 1:
            conflict(row, 'Same inverter serial is listed under another file no: ' + ', '.join(sorted(serial_files[serial] - {row['key']})), card, 'inverter_serial_no', card['inverter_serial_no'], serial)
        elif serial:
            take(row, card, how, 'inverter_serial_no', serial, card['inverter_serial_no'],
                 card['inverter_serial_no'].strip().upper() == serial)
        if make:
            take(row, card, how, 'inverter_make', make, card['inverter_make'],
                 re.sub(r'\W', '', card['inverter_make'].lower()) == re.sub(r'\W', '', make.lower()))

    for row in read_vendor_csv(vendor_path):
        if not row['residential']:
            skipped.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'category': row['category']})
            continue
        if not row['panels']:
            continue  # nothing in column AW for this application
        card, how, problem, candidates, name_cards = find_card(row, by_consumer, by_name, 'consumer no')
        to_review(row, problem, candidates, name_cards, inverter_make='', inverter_serial_no='', panel_serial_no='\n'.join(row['panels']))
        if not card:
            if problem:
                conflict(row, problem, None, 'panel_serial_no', '', ', '.join(row['panels']))
            else:
                not_found.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'reason': 'No card with this consumer no'})
            continue
        if (card.get('property_type') or 'Residential') != 'Residential':
            skipped.append({'source': row['source'], 'name': row['name'], 'number': row['key'], 'category': f"Card is {card['property_type']}"})
            continue
        existing = serial_list(card['panel_serial_no'])
        take(row, card, how, 'panel_serial_no', row['panels'], card['panel_serial_no'].strip() if existing else '',
             {s.upper() for s in existing} == set(row['panels']))

    # A field claimed by two sheet rows with different values is not written.
    for (card_id, field), wants in claims.items():
        values = {json.dumps(v) for _, _, _, v in wants}
        if len(values) > 1:
            for row, card, _, value in wants:
                conflict(row, 'Two sheet rows give this card different values', card, field, '', value if isinstance(value, str) else ', '.join(value))
            continue
        row, card, how, value = wants[0]
        writes.setdefault(card_id, {'card': card, 'how': set(), 'sources': set(), 'names': set(), 'fields': {}})
        entry = writes[card_id]
        entry['fields'][field] = value
        entry['how'].add(how)
        entry['sources'].update(r['source'] for r, *_ in wants)
        entry['names'].update(r['name'] for r, *_ in wants)

    for card_id, entry in writes.items():
        card, fields = entry['card'], entry['fields']
        matched.append({
            'card id': card_id, 'file no': card['folder_no'], 'consumer no': card['consumer_no'], 'card name': card['customer_name'],
            'name match': 'close' if 'close' in entry['how'] else 'exact',
            'inverter_make': fields.get('inverter_make', ''), 'inverter_serial_no': fields.get('inverter_serial_no', ''),
            'panel serials': len(fields.get('panel_serial_no', [])), 'panel_serial_no': ', '.join(fields.get('panel_serial_no', [])),
            'from': '; '.join(sorted(entry['sources'])),
        })
    matched.sort(key=lambda m: (int(m['file no']) if m['file no'].isdigit() else 10**9, m['card name']))

    write_report(out_dir, matched, conflicts, not_found, skipped, len(cards))
    write_sql(out_dir, writes)
    write_review_sql(out_dir, review)
    return matched, conflicts, not_found, skipped


def write_report(out_dir, matched, conflicts, not_found, skipped, card_count):
    wb = openpyxl.Workbook()
    summary = wb.active
    summary.title = 'Summary'
    count = lambda field: sum(1 for m in matched if m[field])
    lines = [
        ('Customer cards checked (admin export)', card_count),
        ('Cards to update', len(matched)),
        ('  inverter serial to fill', count('inverter_serial_no')),
        ('  inverter make to fill', count('inverter_make')),
        ('  panel serials to fill', count('panel_serial_no')),
        ('  of which name matched only closely (spelling)', sum(1 for m in matched if m['name match'] == 'close')),
        ('Conflicts (not imported)', len(conflicts)),
        ('  name/number point to different cards (swapped?)', sum(1 for c in conflicts if c['reason'].startswith('SWAPPED'))),
        ('  name differs on that number', sum(1 for c in conflicts if c['reason'].startswith('Name differs'))),
        ('  card already has a different value', sum(1 for c in conflicts if c['reason'].startswith('Card already'))),
        ('  other', sum(1 for c in conflicts if not re.match(r'SWAPPED|Name differs|Card already', c['reason']))),
        ('Not found', len(not_found)),
        ('Skipped, not residential', len(skipped)),
        ('', ''),
        ('Rule', 'Inverter list matched on file no + name; vendor csv (column AW, panel serials) on consumer no + name. Only empty fields are filled.'),
    ]
    for line in lines:
        summary.append(line)
    summary.column_dimensions['A'].width = 52
    for title, rows in (('Matched', matched), ('Conflicts', conflicts), ('Not found', not_found), ('Skipped non-residential', skipped)):
        sheet = wb.create_sheet(title)
        if not rows:
            sheet.append(['(none)'])
            continue
        sheet.append(list(rows[0].keys()))
        for cell in sheet[1]:
            cell.font = Font(bold=True)
        for row in rows:
            sheet.append([row[k] for k in rows[0].keys()])
        sheet.freeze_panes = 'A2'
        for column in sheet.columns:
            sheet.column_dimensions[column[0].column_letter].width = min(48, max(10, *(len(str(c.value or '')) for c in column[:200])))
    wb.save(f'{out_dir}/inverter-import-review.xlsx')


def sql_text(value):
    return "'" + str(value).replace("'", "''") + "'"


def write_sql(out_dir, writes):
    rows = []
    for card_id, entry in sorted(writes.items(), key=lambda kv: kv[1]['card']['customer_name']):
        card, fields = entry['card'], entry['fields']
        panels = fields.get('panel_serial_no')
        rows.append('    (' + ', '.join([
            sql_text(card_id) + '::uuid', sql_text(card['customer_name']),
            sql_text(card['folder_no']) if card['folder_no'] else 'null',
            sql_text(fields['inverter_serial_no']) if 'inverter_serial_no' in fields else 'null',
            sql_text(fields['inverter_make']) if 'inverter_make' in fields else 'null',
            sql_text(json.dumps('\n'.join(panels))) + '::json' if panels else 'null::json',
            sql_text('; '.join(sorted(entry['sources']))), sql_text(' / '.join(sorted(entry['names']))),
        ]) + ')')
    # The Supabase SQL editor refuses large queries, so the import is cut into parts.
    for old in glob.glob(f'{out_dir}/import*.sql'):
        os.remove(old)
    chunks = [rows[i:i + PART_SIZE] for i in range(0, len(rows), PART_SIZE)]
    for part, chunk in enumerate(chunks, start=1):
        values = ',\n'.join(chunk)
        with open(f'{out_dir}/import-part-{part:02d}-of-{len(chunks):02d}.sql', 'w') as f:
            f.write(f"""-- Inverter make / serial and panel serials for residential customer cards (5 Nov 2026).
-- Part {part} of {len(chunks)} ({len(chunk)} cards). Run every part, in any order; each one is complete on its own.
-- Generated by scripts/inverter_import/build_import.py; review inverter-import-review.xlsx first.
--
-- Safe to run more than once: a field is written only while it is still empty, and a card
-- is touched only if it is not deleted, still Residential, and its name and file no are
-- the same as when the report was made (so a card renamed or renumbered since is left alone).
-- Each card filled gets a line in the Activity Log (the card's History tab). What was
-- written is also kept in public.serial_number_import for the Inverter page's
-- "Uploaded from sheet" tab, so run supabase/migrations/20261105130000_serial_number_review.sql first.
-- Run the whole file in the Supabase SQL editor. The last select shows what changed.

begin;

create temp table inverter_import (id uuid primary key, customer_name text, folder_no text, inverter_serial_no text, inverter_make text, panel_serial_no json, source text, sheet_name text) on commit drop;

insert into inverter_import values
{values};

-- All parts of one statement see the cards as they were before the update, so "before"
-- says which fields were empty and are being filled now.
with before as (
    select a.id,
           coalesce(btrim(a.inverter_serial_no), '') = '' as serial_empty,
           coalesce(btrim(a.inverter_make), '') = '' as make_empty,
           coalesce(btrim(a.panel_serial_no #>> '{{}}'), '') in ('', '[]', 'null') as panels_empty
    from public.admin a join inverter_import i on i.id = a.id
), updated as (
    update public.admin a set
        inverter_serial_no = case when coalesce(btrim(a.inverter_serial_no), '') = '' and i.inverter_serial_no is not null then i.inverter_serial_no else a.inverter_serial_no end,
        inverter_make      = case when coalesce(btrim(a.inverter_make), '') = '' and i.inverter_make is not null then i.inverter_make else a.inverter_make end,
        panel_serial_no    = case when coalesce(btrim(a.panel_serial_no #>> '{{}}'), '') in ('', '[]', 'null') and i.panel_serial_no is not null then i.panel_serial_no else a.panel_serial_no end
    from inverter_import i
    where a.id = i.id
      and a.deleted_at is null
      and coalesce(a.property_type, 'Residential') = 'Residential'
      and a.customer_name = i.customer_name
      and a.folder_no is not distinct from i.folder_no::numeric
      and (   (coalesce(btrim(a.inverter_serial_no), '') = '' and i.inverter_serial_no is not null)
           or (coalesce(btrim(a.inverter_make), '') = '' and i.inverter_make is not null)
           or (coalesce(btrim(a.panel_serial_no #>> '{{}}'), '') in ('', '[]', 'null') and i.panel_serial_no is not null))
    returning a.id
), logged as (
    insert into public.serial_number_import (admin_id, source, sheet_name, inverter_make, inverter_serial_no, panel_serial_no)
    select i.id, i.source, i.sheet_name,
           case when b.make_empty then i.inverter_make end,
           case when b.serial_empty then i.inverter_serial_no end,
           case when b.panels_empty then i.panel_serial_no #>> '{{}}' end
    from updated u join inverter_import i on i.id = u.id join before b on b.id = u.id
    on conflict (admin_id) do nothing
    returning 1
), history as (
    -- One line per card in the Activity Log, which is also the History tab on the customer card.
    insert into public.activity_log (user_id, customer_id, action, message)
    select null, i.id, 'update', i.customer_name || ': ' || array_to_string(array_remove(array[
               case when b.make_empty and i.inverter_make is not null then 'inverter make ' || i.inverter_make end,
               case when b.serial_empty and i.inverter_serial_no is not null then 'inverter serial ' || i.inverter_serial_no end,
               case when b.panels_empty and i.panel_serial_no is not null then 'panel serials' end], null), ', ')
           || ' filled from the client''s sheet (5 Nov import)'
    from updated u join inverter_import i on i.id = u.id join before b on b.id = u.id
    returning 1
)
select (select count(*) from updated) as cards_updated, (select count(*) from logged) as rows_logged, (select count(*) from history) as history_lines;

commit;
""")


def write_review_sql(out_dir, review):
    columns = ('source', 'kind', 'admin_id', 'alt_admin_id', 'sheet_name', 'sheet_number', 'card_name', 'inverter_make', 'inverter_serial_no', 'panel_serial_no')
    rows = ',\n'.join('    (' + ', '.join(sql_text(r[c]) if r[c] else 'null' for c in columns) + ')' for r in review)
    with open(f'{out_dir}/review_rows.sql', 'w') as f:
        f.write(f"""-- Sheet rows whose name and file / consumer no disagree (5 Nov 2026). They show on the Inverter
-- page, "File no mismatch" tab, for admin and staff to fill a card from or dismiss.
--   name_differs: the card on that number has another name.
--   swapped:      the name belongs to a card on another number (admin_id); the card on the
--                 sheet's number is alt_admin_id.
-- Run AFTER supabase/migrations/20261105130000_serial_number_review.sql. Safe to run more than once.

insert into public.serial_number_review ({', '.join(columns)})
select v.source, v.kind, v.admin_id::uuid, v.alt_admin_id::uuid, v.sheet_name, v.sheet_number, v.card_name, v.inverter_make, v.inverter_serial_no, v.panel_serial_no
from (values
{rows}
) as v({', '.join(columns)})
where exists (select 1 from public.admin a where a.id = v.admin_id::uuid)
  and (v.alt_admin_id is null or exists (select 1 from public.admin a where a.id = v.alt_admin_id::uuid))
on conflict (source, admin_id) do nothing;

-- Check (expect {len(review)} rows):
select count(*) from public.serial_number_review;
""")


if __name__ == '__main__':
    if len(sys.argv) != 5:
        sys.exit(__doc__)
    m, c, n, s = build(*sys.argv[1:])
    print(f'matched {len(m)}  conflicts {len(c)}  not found {len(n)}  skipped {len(s)}')
