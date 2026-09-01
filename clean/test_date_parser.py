import csv
import re
from datetime import datetime
from collections import Counter

input_path = '/Users/mahvishsadafv2/Desktop/clean/new_data.csv'

def parse_date_enhanced(d_str):
    if not d_str:
        return None, "empty"
    d_str = d_str.strip()
    if d_str.lower() in ['-', '--', 'n/a', 'na', 'nil', 'null', 'none', '']:
        return None, "placeholder"
    
    # Text notes in date field
    if re.search(r'[a-zA-Z]', d_str):
        # Unless it's Month name like Jan, Feb, etc.
        # Check for month names
        months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
        has_month_name = any(m in d_str.lower() for m in months)
        if not has_month_name:
            return None, f"Text note in date field: '{d_str}'"
    
    # 8-digit continuous
    if re.match(r'^\d{8}$', d_str):
        if int(d_str[:4]) > 1900: # YYYYMMDD
            try:
                dt = datetime.strptime(d_str, '%Y%m%d')
                return dt.strftime('%Y-%m-%d'), "YYYYMMDD"
            except:
                pass
        else: # DDMMYYYY
            try:
                dt = datetime.strptime(d_str, '%d%m%Y')
                return dt.strftime('%Y-%m-%d'), "DDMMYYYY"
            except:
                pass
                
    # Try ISO
    for fmt in ['%Y-%m-%d', '%Y/%m/%d']:
        try:
            dt = datetime.strptime(d_str, fmt)
            return dt.strftime('%Y-%m-%d'), "ISO"
        except:
            pass
            
    # Split by separator
    parts = re.split(r'[-/.]', d_str)
    if len(parts) == 3:
        p1, p2, p3 = parts[0].strip(), parts[1].strip(), parts[2].strip()
        # Case 1: 4-digit year at end: DD-MM-YYYY or MM-DD-YYYY or M-D-YYYY
        if len(p3) == 4 and p3.isdigit() and p1.isdigit() and p2.isdigit():
            y, v1, v2 = int(p3), int(p1), int(p2)
            if v1 > 12 and 1 <= v2 <= 12 and 1 <= v1 <= 31:
                try:
                    return datetime(y, v2, v1).strftime('%Y-%m-%d'), "DD-MM-YYYY"
                except Exception as e:
                    return None, f"Invalid day/month: {d_str}"
            elif v2 > 12 and 1 <= v1 <= 12 and 1 <= v2 <= 31:
                try:
                    return datetime(y, v1, v2).strftime('%Y-%m-%d'), "MM-DD-YYYY"
                except Exception as e:
                    return None, f"Invalid day/month: {d_str}"
            elif 1 <= v1 <= 12 and 1 <= v2 <= 12:
                # Ambiguous: in Indian dataset, check if single digit month or day
                # Usually DD-MM-YYYY
                try:
                    return datetime(y, v2, v1).strftime('%Y-%m-%d'), "DD-MM-YYYY (standard)"
                except Exception as e:
                    return None, f"Invalid date: {d_str}"
                    
        # Case 2: 2-digit year at end: DD-MM-YY or M-D-YY
        elif len(p3) == 2 and p3.isdigit() and p1.isdigit() and p2.isdigit():
            y = 2000 + int(p3)
            v1, v2 = int(p1), int(p2)
            if v1 > 12 and 1 <= v2 <= 12 and 1 <= v1 <= 31:
                try:
                    return datetime(y, v2, v1).strftime('%Y-%m-%d'), "DD-MM-YY"
                except Exception as e:
                    return None, f"Invalid date: {d_str}"
            elif v2 > 12 and 1 <= v1 <= 12 and 1 <= v2 <= 31:
                try:
                    return datetime(y, v1, v2).strftime('%Y-%m-%d'), "MM-DD-YY"
                except Exception as e:
                    return None, f"Invalid date: {d_str}"
            elif 1 <= v1 <= 12 and 1 <= v2 <= 12:
                try:
                    return datetime(y, v2, v1).strftime('%Y-%m-%d'), "DD-MM-YY (standard)"
                except Exception as e:
                    return None, f"Invalid date: {d_str}"

    return None, f"Unparseable date: '{d_str}'"

# Test on all dates
with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.reader(f)
    header = next(reader)
    cleaned_header = [h.strip().replace('\n', ' ') for h in header]
    non_empty_count = max(i + 1 for i, h in enumerate(cleaned_header) if h != '')
    headers = cleaned_header[:non_empty_count]
    
    reg_idx = headers.index('Registration date')
    loan_idx = headers.index('Loan Date')
    name_idx = next(i for i, h in enumerate(headers) if h.startswith('NAME'))
    
    unparsed_reg = Counter()
    unparsed_loan = Counter()
    parsed_count = 0
    empty_count = 0
    
    for row_idx, row in enumerate(reader, start=2):
        row_data = row[:len(headers)] + [''] * (len(headers) - len(row))
        if not row_data[name_idx].strip() or row_data[name_idx].strip() in ['-', '--', 'N/A', 'NA', 'nil', 'null']:
            continue
        
        reg_val = row_data[reg_idx].strip()
        parsed, reason = parse_date_enhanced(reg_val)
        if parsed:
            parsed_count += 1
        elif reason in ['empty', 'placeholder']:
            empty_count += 1
        else:
            unparsed_reg[(reg_val, reason)] += 1
            
        loan_val = row_data[loan_idx].strip()
        parsed_l, reason_l = parse_date_enhanced(loan_val)
        if not parsed_l and reason_l not in ['empty', 'placeholder']:
            unparsed_loan[(loan_val, reason_l)] += 1

print(f"Successfully parsed registration dates: {parsed_count}")
print(f"Empty/Placeholder registration dates: {empty_count}")
print(f"Unparsed registration date values ({len(unparsed_reg)} distinct):")
for (val, reason), cnt in unparsed_reg.most_common():
    print(f"  '{val}' (x{cnt}) -> {reason}")

print(f"\nUnparsed loan date values ({len(unparsed_loan)} distinct):")
for (val, reason), cnt in unparsed_loan.most_common():
    print(f"  '{val}' (x{cnt}) -> {reason}")
