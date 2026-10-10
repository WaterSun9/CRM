import { strToU8, zipSync } from 'fflate';

const escapeXml = value => [...String(value ?? '')].filter(character => {
    const code = character.codePointAt(0);
    return code === 9 || code === 10 || code === 13 || code >= 32;
}).join('')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const excelDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}/.test(String(value || ''))) return null;
    const time = Date.parse(String(value).slice(0, 10) + 'T00:00:00Z');
    return Number.isFinite(time) ? time / 86400000 + 25569 : null;
};
const cell = (reference, value, kind = 'text') => {
    if (value === null || value === undefined || value === '') return `<c r="${reference}"/>`;
    if (kind === 'date') {
        const serial = excelDate(value);
        return serial === null ? `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>` : `<c r="${reference}" s="1"><v>${serial}</v></c>`;
    }
    if (kind === 'number' || kind === 'currency') {
        const number = Number(value);
        if (Number.isFinite(number)) return `<c r="${reference}" s="${kind === 'currency' ? 2 : 0}"><v>${number}</v></c>`;
    }
    return `<c r="${reference}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
};

const columnLetter = index => {
    let letters = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
    return letters;
};

// One worksheet's XML. columns: [{ header, type: text|number|currency|date, width, value(record) }].
// totalLabel/totalColumns add a bold total row under the data.
function buildSheet({ columns, records, totalLabel = null, totalColumns = [] }) {
    const last = columnLetter(columns.length - 1);
    const rows = [
        `<row r="1">${columns.map((column, index) => `<c r="${columnLetter(index)}1" s="3" t="inlineStr"><is><t>${escapeXml(column.header)}</t></is></c>`).join('')}</row>`,
        ...records.map((record, index) => {
            const row = index + 2;
            return `<row r="${row}">${columns.map((column, col) => cell(`${columnLetter(col)}${row}`, column.value(record), column.type)).join('')}</row>`;
        })
    ];
    let lastRow = records.length + 1;
    if (totalLabel) {
        lastRow += 1;
        const totals = columns.map((column, col) => {
            const reference = `${columnLetter(col)}${lastRow}`;
            if (col === 0) return `<c r="${reference}" s="3" t="inlineStr"><is><t>${escapeXml(totalLabel)}</t></is></c>`;
            if (!totalColumns.includes(col)) return `<c r="${reference}"/>`;
            const sum = records.reduce((total, record) => total + (Number(column.value(record)) || 0), 0);
            // Bold rupees for money, bold plain number for counts and kWp.
            return `<c r="${reference}" s="${column.type === 'currency' ? 4 : 5}"><v>${Math.round(sum * 100) / 100}</v></c>`;
        });
        rows.push(`<row r="${lastRow}">${totals.join('')}</row>`);
    }
    const cols = columns.map((column, index) => `<col min="${index + 1}" max="${index + 1}" width="${column.width || 18}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${lastRow}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${cols}</cols><sheetData>${rows.join('')}</sheetData><autoFilter ref="A1:${last}${records.length + 1}"/></worksheet>`;
}

// One-sheet .xlsx (see buildSheet for the options).
export function buildWorkbook({ sheetName = 'Sheet1', ...sheet }) {
    return packWorkbook([{ name: sheetName, xml: buildSheet(sheet) }]);
}

// Several sheets in one .xlsx: [{ sheetName, columns, records, totalLabel, totalColumns }].
export function buildMultiSheetWorkbook(sheets) {
    return packWorkbook(sheets.map(({ sheetName, ...sheet }) => ({ name: sheetName, xml: buildSheet(sheet) })));
}

export function buildVendorPaymentsWorkbook(records) {
    return buildWorkbook({
        sheetName: 'Payments',
        records,
        columns: [
            { header: 'Customer', type: 'text', width: 28, value: r => r.customer_name },
            { header: 'Consumer No', type: 'text', width: 19, value: r => r.consumer_no },
            { header: 'Capacity (kWp)', type: 'number', width: 19, value: r => r.system_capacity_kwp },
            { header: 'Vendor Amount (INR)', type: 'currency', width: 19, value: r => r.vendor_quote },
            { header: 'Payment Status', type: 'text', width: 19, value: r => r.vendor_payment_status || 'Pending' },
            { header: 'Paid Date', type: 'date', width: 18, value: r => r.vendor_paid_date },
            { header: 'Installation Date', type: 'date', width: 18, value: r => r.installation_date },
            { header: 'Vendor', type: 'text', width: 26, value: r => r.vendor },
            { header: 'Project ID', type: 'text', width: 38, value: r => r.id }
        ]
    });
}

// Admin Installation Payout Ledger export (vendor commissions).
export function buildPayoutLedgerWorkbook(records) {
    return buildWorkbook({
        sheetName: 'Vendor Commission',
        records,
        totalLabel: 'Total',
        totalColumns: [5],
        columns: [
            { header: 'Customer', type: 'text', width: 30, value: r => r.customer_name },
            { header: 'Phone', type: 'text', width: 15, value: r => r.phone_number },
            { header: 'Consumer No', type: 'text', width: 17, value: r => r.consumer_no },
            { header: 'Capacity (kWp)', type: 'number', width: 15, value: r => r.system_capacity_kwp },
            { header: 'Vendor', type: 'text', width: 26, value: r => r.vendor },
            { header: 'Commission (INR)', type: 'currency', width: 18, value: r => r.vendor_quote },
            { header: 'Payment Status', type: 'text', width: 15, value: r => r.vendor_payment_status || 'Pending' },
            { header: 'Paid Date', type: 'date', width: 14, value: r => r.vendor_paid_date },
            { header: 'Paid By', type: 'text', width: 18, value: r => r.vendor_paid_by },
            { header: 'Payout Month', type: 'text', width: 16, value: r => r.payoutMonthLabel },
            { header: 'Material Delivery Date', type: 'date', width: 20, value: r => r.material_delivery_date },
            { header: 'Installation Date', type: 'date', width: 16, value: r => r.installation_date }
        ]
    });
}

function packWorkbook(sheets) {
    const files = {
        '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
        '_rels/.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
        'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet, i) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
        'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
        'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="2"><numFmt numFmtId="164" formatCode="dd mmm yyyy"/><numFmt numFmtId="165" formatCode="₹#,##0.00"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="6"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="165" fontId="1" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
        ...Object.fromEntries(sheets.map((sheet, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet.xml]))
    };
    return zipSync(Object.fromEntries(Object.entries(files).map(([path, xml]) => [path, strToU8(xml)])));
}
