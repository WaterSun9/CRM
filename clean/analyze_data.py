import csv
import re
from collections import Counter

input_path = '/Users/mahvishsadafv2/Desktop/clean/new_data.csv'

with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.reader(f)
    header = next(reader)
    # clean header names
    cleaned_header = [h.strip().replace('\n', ' ') for h in header]
    # filter out empty trailing headers
    non_empty_header_count = 0
    for i, h in enumerate(cleaned_header):
        if h != '':
            non_empty_header_count = i + 1
    
    headers = cleaned_header[:non_empty_header_count]
    print(f"Headers ({len(headers)}): {headers}")
    
    rows = []
    skipped_empty_name = []
    column_values = {h: Counter() for h in headers}
    
    for row_idx, row in enumerate(reader, start=2):
        row_data = row[:len(headers)]
        # pad if shorter
        if len(row_data) < len(headers):
            row_data += [''] * (len(headers) - len(row_data))
        
        # Check name
        name_idx = None
        for idx, h in enumerate(headers):
            if h.upper().startswith('NAME'):
                name_idx = idx
                break
        
        name_val = row_data[name_idx].strip() if name_idx is not None else ''
        if not name_val or name_val in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            skipped_empty_name.append((row_idx, row_data))
            continue
        
        rows.append((row_idx, row_data))
        for h, val in zip(headers, row_data):
            column_values[h][val.strip()] += 1

print(f"\nTotal rows in CSV: {len(rows) + len(skipped_empty_name)}")
print(f"Valid rows (with name): {len(rows)}")
print(f"Skipped rows (missing name): {len(skipped_empty_name)}")
if skipped_empty_name:
    print("Sample skipped rows:")
    for r_idx, r in skipped_empty_name[:10]:
        print(f"  Line {r_idx}: {r[:6]}")

print("\n--- Column Value Distributions & Edge Cases ---")
for h in headers:
    counts = column_values[h]
    print(f"\nHeader: '{h}' | Unique count: {len(counts)}")
    if len(counts) <= 30:
        for val, count in counts.most_common():
            print(f"   '{val}': {count}")
    else:
        print(f"   Top 5: {counts.most_common(5)}")
        placeholders = {k: v for k, v in counts.items() if k in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'none', 'None', 'PEDING', 'pending']}
        if placeholders:
            print(f"   Placeholders found: {placeholders}")
