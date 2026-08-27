/**
 * Watersun CRM - Universal Bulk CSV Cleaner (Standalone)
 * Works in ANY folder without needing package.json or npm install.
 */

import fs from 'fs';
import path from 'path';

const inputFile = process.argv[2] || 'raw_data.csv';
const outputFile = process.argv[3] || 'clean_data.csv';

// Numeric fields
const NUMERIC_FIELDS = new Set([
    'module_wp',
    'system_capacity_kwp',
    'no_of_modules',
    'subsidy_amount',
    'total_amount',
    'received_amount',
    'balance_amount'
]);

// Date fields
const DATE_FIELDS = new Set([
    'registration_date',
    'installation_date',
    'meter_installation_date',
    'discom_inspection_date',
    'created_at',
    'updated_at'
]);

// Boolean fields
const BOOLEAN_FIELDS = new Set([
    'stamp',
    'file_status',
    'filestatus',
    'file_status_doc',
    'adhaar_card_front',
    'adhaar_card_back',
    'pan_card',
    'index_2',
    'light_bill',
    'bank_details',
    'geo_tag_image',
    'house_geo_tag_photo',
    'extra_docs',
    'digital_certificate',
    'feasibilty_document',
    'subsidy_token_photo',
    'meter_installation_photo',
    'dcr_certificate',
    'signature_pic',
    'pm_surya_ghar_stamp'
]);

function isBooleanField(headerName) {
    const h = String(headerName || '').toLowerCase().replace(/[\s\-_]/g, '');
    if (h.includes('stamp') || h.includes('filestatus') || h.includes('statusdoc')) {
        return true;
    }
    return BOOLEAN_FIELDS.has(headerName);
}

function cleanPhone(val) {
    if (!val) return '';
    const digits = String(val).replace(/\D/g, '');
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return digits || String(val).trim();
}

function cleanNumber(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (['n/a', 'na', '-', '--', 'none', 'nil', 'null', 'pending', 'tbd', 'no', 'done', 'yes', 'false', 'true'].includes(s.toLowerCase())) {
        return '';
    }
    const match = s.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
    return match ? match[0] : '';
}

function cleanDate(val) {
    if (!val) return '';
    const s = String(val).trim();
    if (['n/a', 'na', '-', '--', 'none', 'nil', 'null', 'pending', 'tbd', 'done', 'no', 'not yet', 'yes', 'false', 'true'].includes(s.toLowerCase())) {
        return '';
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

    const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (dmy) {
        const day = dmy[1].padStart(2, '0');
        const month = dmy[2].padStart(2, '0');
        const year = dmy[3];
        return `${year}-${month}-${day}`;
    }

    const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);
    if (mdy) {
        const day = mdy[1].padStart(2, '0');
        const month = mdy[2].padStart(2, '0');
        const year = '20' + mdy[3];
        return `${year}-${month}-${day}`;
    }

    if (/^\d{5}$/.test(s)) {
        const date = new Date((Number(s) - 25569) * 86400 * 1000);
        if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
        }
    }

    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
    }

    return '';
}

// Strict Boolean Cleaner: converts "true", "yes", "1", "done" to "true", EVERYTHING ELSE to "false"
function cleanBoolean(val) {
    if (val === null || val === undefined) return 'false';
    const s = String(val).trim().toLowerCase();
    if (['true', 't', '1', 'yes', 'y', 'done', 'completed', 'ok', 'stamp done', 'stamped', 'uploaded', 'success'].includes(s)) {
        return 'true';
    }
    return 'false';
}

function cleanText(val) {
    if (val === null || val === undefined) return '';
    let s = String(val).trim();
    if (['n/a', 'na', 'none', 'nil', 'null'].includes(s.toLowerCase())) {
        return '';
    }
    return s;
}

function cleanStage(val) {
    const s = cleanText(val).toUpperCase();
    if (!s) return 'LEADS';
    if (s.includes('LEAD')) return 'LEADS';
    if (s.includes('REG')) return 'REGISTRATION';
    if (s.includes('LOAN')) return 'LOAN';
    if (s.includes('CASH')) return 'CASH';
    if (s.includes('ORDER')) return 'MATERIAL ORDER';
    if (s.includes('INT') || s.includes('BOM')) return 'MATERIAL INTEGRATION';
    if (s.includes('HOLD')) return 'HOLD PROCUREMENT';
    if (s.includes('DELIV')) return 'MATERIAL DELIVERY';
    if (s.includes('INSTAL')) return 'INSTALLATION STATUS';
    if (s.includes('GEO')) return 'GEO TAG PHOTO';
    if (s.includes('DISCOM SUB') || s.includes('SUBMISSION')) return 'DISCOM SUBMISSION';
    if (s.includes('METER')) return 'METER INSTALLATION';
    if (s.includes('INSPECT')) return 'DISCOM INSPECTION';
    if (s.includes('SUBSID')) return 'SUBSIDY STATUS';
    return s;
}

function cleanLoanTag(val) {
    if (!val) return '';
    const s = String(val).trim().toLowerCase();
    if (['n/a', 'na', '-', '--', 'nil', 'null', 'none', 'no'].includes(s)) return '';
    if (s === 'in progress' || s === 'in_progress' || s === 'inprogress' || s === 'pending') return 'In Progress';
    if (s === 'processed' || s.includes('process')) return 'Processed';
    if (s.includes('1st') || s.includes('first')) return '1st Payment';
    if (s.includes('2nd') || s.includes('second')) return '2nd Payment';
    if (s.includes('sanc') || s.includes('approved')) return 'Sanctioned';
    if (s.includes('return')) return 'Returned';
    if (s.includes('reject') || s.includes('decline')) return 'Rejected';
    return cleanText(val);
}

function cleanSubsidyTag(val) {
    if (!val) return '';
    const s = String(val).trim().toLowerCase();
    if (['n/a', 'na', '-', '--', 'nil', 'null', 'none', 'no'].includes(s)) return '';
    if (s === 'received' || s.includes('receiv') || s.includes('claim') || s.includes('credit')) return 'Received';
    if (s === 'in process' || s === 'in_process' || s === 'inprocess' || s.includes('process')) return 'In Process';
    if (s === 'redeemed' || s.includes('redeem')) return 'Redeemed';
    if (s === 'return' || s === 'returned' || s.includes('return')) return 'Returned';
    if (s === 'approved' || s.includes('approv')) return 'Approved';
    if (s === 'rejected' || s.includes('reject')) return 'Rejected';
    return cleanText(val);
}

function cleanInstallationStatus(val) {
    if (!val) return '';
    const s = String(val).trim().toLowerCase();
    if (['n/a', 'na', '-', '--', 'nil', 'null', 'none'].includes(s)) return '';
    if (s === 'give up' || s === 'giveup' || s === 'given up' || s === 'cancelled') return 'Give Up';
    if (s === 'yes' || s === 'completed' || s === 'done' || s === 'installed') return 'Yes';
    if (s === 'proceed' || s === 'process' || s === 'processing' || s === 'in progress' || s === 'wip') return 'Process';
    if (s === 'pending' || s === 'no' || s === 'waiting' || s === 'not started') return 'Pending';
    return cleanText(val);
}

function parseLine(line, delimiter) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') {
            if (inQuotes && line[i + 1] === '"') {
                cur += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === delimiter && !inQuotes) {
            result.push(cur);
            cur = '';
        } else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}

function formatCSVLine(cells) {
    return cells.map(cell => {
        const str = cell === null || cell === undefined ? '' : String(cell);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }).join(',');
}

function main() {
    const resolvedInput = path.resolve(process.cwd(), inputFile);
    if (!fs.existsSync(resolvedInput)) {
        console.error(`\n❌ File not found: ${inputFile}`);
        console.log(`\n👉 Usage:\n  node clean_csv.js <name_of_your_file.csv> [output_name.csv]\n`);
        return;
    }

    console.log(`\n📂 Reading: ${inputFile}...`);
    const rawContent = fs.readFileSync(resolvedInput, 'utf8');
    const rawLines = rawContent.split(/\r?\n/).filter(l => l.trim().length > 0);

    if (rawLines.length === 0) {
        console.error('❌ File is empty.');
        return;
    }

    const firstLine = rawLines[0];
    const delimiter = firstLine.includes('\t') ? '\t' : ',';
    console.log(`Detected format: ${delimiter === '\t' ? 'Tab-Separated (Excel Copy-Paste)' : 'Comma-Separated (CSV)'}`);

    const headers = parseLine(firstLine, delimiter).map(h => 
        h.trim().toLowerCase().replace(/[\s-]/g, '_')
    ).filter(h => h.length > 0);

    const folderIdx = headers.findIndex(h => h.includes('folder'));
    const outputRows = [headers.join(',')];
    let count = 0;

    for (let i = 1; i < rawLines.length; i++) {
        const rawCells = parseLine(rawLines[i], delimiter);
        if (rawCells.length === 1 && !rawCells[0].trim()) continue;

        // Check if we passed folder 4848
        if (folderIdx !== -1) {
            const rawFolder = (rawCells[folderIdx] || '').trim();
            const folderNum = parseInt(rawFolder.replace(/\D/g, ''), 10);
            if (!isNaN(folderNum) && folderNum > 4848) {
                console.log(`🛑 Stopping at Folder ${rawFolder} (capped at 4848).`);
                break;
            }
        }

        const cleanedRow = headers.map((header, colIdx) => {
            const raw = rawCells[colIdx] !== undefined ? rawCells[colIdx].trim() : '';

            if (isBooleanField(header)) {
                return cleanBoolean(raw);
            } else if (NUMERIC_FIELDS.has(header)) {
                return cleanNumber(raw);
            } else if (DATE_FIELDS.has(header)) {
                return cleanDate(raw);
            } else if (header === 'phone_number') {
                return cleanPhone(raw);
            } else if (header === 'stage') {
                return cleanStage(raw);
            } else if (header === 'loan_tag') {
                return cleanLoanTag(raw);
            } else if (header === 'subsidy_tag') {
                return cleanSubsidyTag(raw);
            } else if (header === 'installation_status') {
                return cleanInstallationStatus(raw);
            } else {
                return cleanText(raw);
            }
        });

        outputRows.push(formatCSVLine(cleanedRow));
        count++;

        // If this was folder 4848, stop here
        if (folderIdx !== -1) {
            const rawFolder = (rawCells[folderIdx] || '').trim();
            const folderNum = parseInt(rawFolder.replace(/\D/g, ''), 10);
            if (folderNum === 4848 || rawFolder === '4848') {
                console.log(`🎯 Included Folder 4848. Capping output here.`);
                break;
            }
        }
    }

    fs.writeFileSync(outputFile, outputRows.join('\n'), 'utf8');
    console.log(`\n🎉 SUCCESS! Cleaned ${count} rows.`);
    console.log(`📁 Clean output saved to: ${outputFile}`);
    console.log(`\n👉 NEXT STEP:\n1. Open Supabase -> Table Editor -> "admin" table.`);
    console.log(`2. Click "Insert" -> "Import data from CSV".`);
    console.log(`3. Select "${outputFile}" and click Import.\n`);
}

main();
