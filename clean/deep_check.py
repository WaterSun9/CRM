import csv
import re
from datetime import datetime

input_path = '/Users/mahvishsadafv2/Desktop/clean/new_data.csv'

def parse_date(d_str):
    if not d_str:
        return None, "empty"
    d_str = d_str.strip()
    if d_str in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'none', 'None']:
        return None, "placeholder"
    
    # Try different separators
    # Formats:
    # 16-01-2024 (DD-MM-YYYY)
    # 16/01/2024 (DD/MM/YYYY)
    # 2024-03-16 (YYYY-MM-DD)
    # 2024/03/16 (YYYY/MM/DD)
    # 4/17/2025  (M/DD/YYYY)
    # 16012024   (DDMMYYYY)
    # 20240116   (YYYYMMDD)
    
    # Check 8-digit continuous
    if re.match(r'^\d{8}$', d_str):
        # Could be DDMMYYYY or YYYYMMDD
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
            
    # Try with split
    parts = re.split(r'[-/.]', d_str)
    if len(parts) == 3:
        p1, p2, p3 = parts[0].strip(), parts[1].strip(), parts[2].strip()
        if len(p3) == 4 and p3.isdigit():
            y = int(p3)
            # check if p1 > 12 -> DD/MM/YYYY
            # check if p2 > 12 -> MM/DD/YYYY
            if p1.isdigit() and p2.isdigit():
                v1, v2 = int(p1), int(p2)
                if v1 > 12 and 1 <= v2 <= 12 and 1 <= v1 <= 31:
                    try:
                        dt = datetime(y, v2, v1)
                        return dt.strftime('%Y-%m-%d'), "DD-MM-YYYY (unambiguous)"
                    except Exception as e:
                        return None, f"Invalid date: {d_str} ({e})"
                elif v2 > 12 and 1 <= v1 <= 12 and 1 <= v2 <= 31:
                    try:
                        dt = datetime(y, v1, v2)
                        return dt.strftime('%Y-%m-%d'), "MM-DD-YYYY (unambiguous)"
                    except Exception as e:
                        return None, f"Invalid date: {d_str} ({e})"
                elif 1 <= v1 <= 12 and 1 <= v2 <= 12:
                    # Ambiguous! E.g. 02-03-2024
                    # In India, dominant format is DD-MM-YYYY
                    try:
                        dt = datetime(y, v2, v1)
                        return dt.strftime('%Y-%m-%d'), "DD-MM-YYYY (assumed Indian standard)"
                    except Exception as e:
                        return None, f"Invalid date: {d_str} ({e})"
        elif len(p1) == 4 and p1.isdigit():
            y = int(p1)
            if p2.isdigit() and p3.isdigit():
                v2, v3 = int(p2), int(p3)
                try:
                    dt = datetime(y, v2, v3)
                    return dt.strftime('%Y-%m-%d'), "YYYY-MM-DD"
                except Exception as e:
                    return None, f"Invalid date: {d_str} ({e})"

    return None, f"Unparseable date format: '{d_str}'"

with open(input_path, 'r', encoding='utf-8', errors='replace') as f:
    reader = csv.reader(f)
    header = next(reader)
    cleaned_header = [h.strip().replace('\n', ' ') for h in header]
    non_empty_count = max(i + 1 for i, h in enumerate(cleaned_header) if h != '')
    headers = cleaned_header[:non_empty_count]
    
    reg_date_idx = headers.index('Registration date')
    loan_date_idx = headers.index('Loan Date')
    contact_idx = headers.index('CONTACT')
    consumer_idx = headers.index('CONSUMER NUMBER')
    kw_idx = headers.index('KW')
    wp_idx = headers.index('Module (Wp)')
    name_idx = next(i for i, h in enumerate(headers) if h.startswith('NAME'))
    
    date_issues = []
    phone_issues = []
    consumer_issues = []
    kw_issues = []
    wp_issues = []
    
    for row_idx, row in enumerate(reader, start=2):
        row_data = row[:len(headers)] + [''] * (len(headers) - len(row))
        name = row_data[name_idx].strip()
        if not name or name in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            continue
        
        # Check registration date
        reg_val = row_data[reg_date_idx].strip()
        if reg_val:
            parsed, status = parse_date(reg_val)
            if not parsed and status != 'placeholder':
                date_issues.append((row_idx, 'Registration date', reg_val, status))
        
        # Check loan date
        loan_val = row_data[loan_date_idx].strip()
        if loan_val:
            parsed, status = parse_date(loan_val)
            if not parsed and status != 'placeholder':
                date_issues.append((row_idx, 'Loan Date', loan_val, status))
                
        # Check contact (phone)
        phone_val = row_data[contact_idx].strip()
        if phone_val and phone_val not in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            cleaned_digits = re.sub(r'\D', '', phone_val)
            if not re.match(r'^\+?[0-9]{1,15}$', cleaned_digits):
                phone_issues.append((row_idx, phone_val, cleaned_digits))
                
        # Check consumer no
        cons_val = row_data[consumer_idx].strip()
        if cons_val and cons_val not in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            cleaned_cons = re.sub(r'\D', '', cons_val)
            if not cleaned_cons:
                consumer_issues.append((row_idx, cons_val))
                
        # Check KW
        kw_val = row_data[kw_idx].strip()
        if kw_val and kw_val not in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            try:
                float(kw_val)
            except:
                kw_issues.append((row_idx, kw_val))
                
        # Check Wp
        wp_val = row_data[wp_idx].strip()
        if wp_val and wp_val not in ['-', '--', 'N/A', 'NA', 'nil', 'null', 'None']:
            try:
                float(wp_val)
            except:
                wp_issues.append((row_idx, wp_val))

print(f"Date issues found: {len(date_issues)}")
for issue in date_issues[:10]:
    print(f"  Row {issue[0]} | {issue[1]}: '{issue[2]}' -> {issue[3]}")

print(f"\nPhone number issues found: {len(phone_issues)}")
for issue in phone_issues[:10]:
    print(f"  Row {issue[0]}: '{issue[1]}' -> cleaned: '{issue[2]}'")

print(f"\nConsumer number issues found: {len(consumer_issues)}")
for issue in consumer_issues[:10]:
    print(f"  Row {issue[0]}: '{issue[1]}'")

print(f"\nKW issues found: {len(kw_issues)}")
for issue in kw_issues[:10]:
    print(f"  Row {issue[0]}: '{issue[1]}'")

print(f"\nModule Wp issues found: {len(wp_issues)}")
for issue in wp_issues[:10]:
    print(f"  Row {issue[0]}: '{issue[1]}'")
