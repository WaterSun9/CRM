// Tata Power Solar "FIELD SERVICE REPORT FOR SPV PRODUCTS" (Doc No N010652, Revision No. 04),
// filled from a complaint, its customer card and the latest visit readings (D-033; form sent
// by Sandeep 2026-11-19, blank copy in docs/client-requests-2026-11-14/tata-oem-form/).
// The values are written onto Tata's own blank PDF (src/assets/tata-field-service-report.pdf),
// so the page is Tata's layout exactly. Anything we do not store is left blank to fill by hand:
// sales order no., the battery checks (an on-grid rooftop system has no battery; whether to
// print "N/A" there is still open), array short circuit current, loads, customer's remarks and
// both signatures.
//
// Pure: no database and no browser APIs, so it runs in Node for tests and the sample PDF.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

// Same keys and names as READING_GROUPS in SiteVisitForm.jsx (volts).
const READINGS = [
    ['AC', [['ac_pn', 'P-N'], ['ac_pe', 'P-E'], ['ac_ne', 'N-E']]],
    ['DC', [['dc_pm', '+/-'], ['dc_pe', '+/E'], ['dc_me', '-/E']]],
];

// Only characters the standard PDF font can draw (WinAnsi). Gujarati and ₹ are dropped.
export const pdfSafe = value => String(value ?? '')
    .replace(/₹/g, 'Rs ').replace(/[→➔]/g, '->').replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/·/g, '-')
    .replace(/[^\x20-\x7E\xA0-\xFF\n]/g, '').replace(/[ \t]+/g, ' ').trim();

export const isTataOem = oem => /^\s*tata/i.test(String(oem || ''));

const day = iso => {
    if (!iso) return '';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T00:00:00+05:30` : iso);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
const has = value => value !== null && value !== undefined && String(value).trim() !== '';

// The words that go in each box. Blank ('') = left for hand-filling.
// issue: the complaint; claim: the OEM claim (oem, part, faulty_serial, notes, ticket_no);
// card: the customer card (admin row); visit: the latest visit with readings, or null.
export function tataReportValues({ issue = {}, claim = {}, card = null, visit = null, technicianName = '' }) {
    const c = card || {};
    const readings = visit?.readings || null;
    const readingLine = readings
        ? READINGS.map(([group, fields]) => `${group}: ${fields.map(([key, name]) => `${name} ${has(readings[key]) ? `${readings[key]} V` : '-'}`).join(', ')}`).join('; ')
            + `; Floating voltage: ${readings.floating ? 'Yes' : 'No'}`
        : '';
    const part = String(claim.part || 'Inverter');
    const panelClaim = /^panel/i.test(part);
    const product = panelClaim
        ? ['Solar module', c.module_brand].filter(has).join(' - ')
        : part === 'Inverter' ? ['Inverter', c.inverter_make].filter(has).join(' - ') : part;
    const capacity = has(c.system_capacity_kwp) ? `${c.system_capacity_kwp} kWp` : (has(issue.system_kw) ? `${issue.system_kw} kWp` : '');
    const moduleType = [c.module_brand, has(c.module_wp) && `${c.module_wp} Wp`, has(c.no_of_modules) && `x ${c.no_of_modules}`].filter(Boolean).join(' ');
    const address = [c.full_address || issue.service_address, c.villages, c.district, c.pincode].filter(has).join(', ');

    const complaint = [issue.problem_type, issue.comment].filter(has).join('. ');
    const observations = [
        readingLine && `Site readings${visit?.visit_no ? ` (visit ${visit.visit_no}` : ' ('}${day(visit?.reached_at || visit?.started_at) ? `, ${day(visit.reached_at || visit.started_at)}` : ''}): ${readingLine}.`,
        `Faulty ${part.toLowerCase()}${has(claim.faulty_serial) ? `, serial no. ${claim.faulty_serial}` : ''}.`,
        !panelClaim && has(c.inverter_serial_no) && c.inverter_serial_no !== claim.faulty_serial && `Inverter on site: ${[c.inverter_make, c.inverter_serial_no].filter(has).join(' ')}.`,
        has(claim.notes) && claim.notes,
    ].filter(Boolean).join('\n');
    const action = visit?.outcome
        ? `Visit ${visit.visit_no || ''}: ${visit.outcome === 'fixed' ? 'Fixed' : 'Revisit needed'}${has(visit.outcome_note) ? ` - ${visit.outcome_note}` : ''}`.replace(/\s+:/, ':')
        : '';

    return {
        heading: [`Watersun Electrical Solutions Pvt Ltd`, has(issue.ticket_no) && `Complaint #${issue.ticket_no}`, has(claim.ticket_no) && `Tata ticket ${claim.ticket_no}`].filter(Boolean).join('   |   '),
        dateOfVisit: day(visit?.reached_at || visit?.started_at),
        customerName: c.customer_name || issue.customer_name || '',
        customerContact: [has(c.phone_number || issue.customer_phone) && `Ph ${c.phone_number || issue.customer_phone}`, has(c.consumer_no || issue.consumer_no) && `Consumer no. ${c.consumer_no || issue.consumer_no}`].filter(Boolean).join('   '),
        customerAddress: address,
        natureOfComplaint: complaint,
        product,
        salesOrderNo: '',
        typeOfSystem: 'On-grid rooftop',
        capacity,
        dateOfInstallation: day(c.installation_date),
        operatingVoltage: readings && has(readings.dc_pm) ? String(readings.dc_pm) : '',
        moduleType,
        moduleSerialNo: panelClaim ? String(claim.faulty_serial || '') : '',
        // General checks and battery health: blank (no battery on an on-grid rooftop system).
        fieldObservations: observations,
        actionTaken: action,
        customerRemarks: '',
        technicianName: technicianName || '',
    };
}

// Where each value goes on the A4 page (points from the bottom-left), measured from the
// blank form's own label positions. maxWidth keeps a value inside its box.
const LEFT = 52.4, RIGHT_VALUE = 430, BOX_RIGHT = 542;
const SPOTS = {
    dateOfVisit: { x: 114, y: 779.3, maxWidth: 170 },
    customerName: { x: 128, y: 768.6, maxWidth: 156 },
    customerContact: { x: LEFT + 2, y: 757.8, maxWidth: 230, size: 7 },
    customerAddress: { x: LEFT + 2, y: 747.1, maxWidth: 230, size: 7, lines: 1 },
    product: { x: RIGHT_VALUE, y: 779.3, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    salesOrderNo: { x: RIGHT_VALUE, y: 757.8, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    typeOfSystem: { x: RIGHT_VALUE, y: 736.3, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    capacity: { x: RIGHT_VALUE, y: 725.6, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    dateOfInstallation: { x: RIGHT_VALUE, y: 714.6, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    operatingVoltage: { x: RIGHT_VALUE + 8, y: 704.1, maxWidth: 55 },
    moduleType: { x: RIGHT_VALUE, y: 693.4, maxWidth: BOX_RIGHT - RIGHT_VALUE },
    moduleSerialNo: { x: RIGHT_VALUE, y: 682.6, maxWidth: BOX_RIGHT - RIGHT_VALUE },
};
// Multi-line boxes: first line, line gap, number of lines, width.
const BOXES = {
    natureOfComplaint: { x: LEFT + 2, y: 714.6, gap: 10.7, lines: 4, maxWidth: 230 },
    // Each box sits under its grey band: 281.5-226.2, 209.0-153.8, 136.6-81.3.
    fieldObservations: { x: LEFT + 2, y: 272.5, gap: 8.6, lines: 6, maxWidth: 486 },
    actionTaken: { x: LEFT + 2, y: 200, gap: 8.6, lines: 6, maxWidth: 486 },
    customerRemarks: { x: LEFT + 2, y: 127.5, gap: 8.6, lines: 6, maxWidth: 486 },
};
const INK = rgb(0.05, 0.16, 0.48); // dark blue, so typed values stand out from the printed form

// Splits text into lines that fit maxWidth (words longer than a line are cut).
export function wrapLines(text, font, size, maxWidth) {
    const out = [];
    for (const paragraph of pdfSafe(text).split('\n')) {
        let line = '';
        for (const word of paragraph.split(' ').filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (font.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
            if (line) out.push(line);
            let rest = word;
            while (font.widthOfTextAtSize(rest, size) > maxWidth && rest.length > 1) {
                let cut = rest.length - 1;
                while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > maxWidth) cut -= 1;
                out.push(rest.slice(0, cut));
                rest = rest.slice(cut);
            }
            line = rest;
        }
        if (line) out.push(line);
    }
    return out;
}

// Writes the values onto the blank form. templateBytes: the blank Tata PDF.
// Returns the filled PDFDocument (one page), ready to save or to add more pages to.
export async function fillTataReport(templateBytes, values) {
    const doc = await PDFDocument.load(templateBytes);
    const page = doc.getPages()[0];
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);

    const fit = (text, { x, y, maxWidth, size = 8, useFont = bold }) => {
        let words = pdfSafe(text).replace(/\n/g, ' ');
        if (!words) return;
        let s = size;
        while (s > 5.5 && useFont.widthOfTextAtSize(words, s) > maxWidth) s -= 0.25;
        if (useFont.widthOfTextAtSize(words, s) > maxWidth) {
            while (words.length > 1 && useFont.widthOfTextAtSize(`${words}...`, s) > maxWidth) words = words.slice(0, -1);
            words = `${words.trimEnd()}...`;
        }
        page.drawText(words, { x, y, size: s, font: useFont, color: INK });
    };

    if (values.heading) page.drawText(pdfSafe(values.heading), { x: LEFT, y: 832, size: 7, font, color: rgb(0.35, 0.35, 0.35) });
    for (const [key, spot] of Object.entries(SPOTS)) {
        if (spot.lines === 1 || !spot.lines) fit(values[key], { ...spot, useFont: spot.size ? font : bold });
    }
    for (const [key, box] of Object.entries(BOXES)) {
        if (!values[key]) continue;
        let size = 8;
        let lines = wrapLines(values[key], font, size, box.maxWidth);
        while (lines.length > box.lines && size > 6) { size -= 0.5; lines = wrapLines(values[key], font, size, box.maxWidth); }
        const gap = Math.min(box.gap, size + 1.4);
        if (lines.length > box.lines) lines = [...lines.slice(0, box.lines - 1), `${lines[box.lines - 1].slice(0, -3)}...`];
        lines.forEach((line, i) => page.drawText(line, { x: box.x, y: box.y - i * gap, size, font, color: INK }));
    }
    if (values.technicianName) {
        page.drawText(pdfSafe(`Name: ${values.technicianName}`), { x: 318, y: 32, size: 7.5, font, color: INK });
    }
    doc.setTitle(pdfSafe(`Tata field service report - ${values.customerName || ''}`));
    doc.setCreator('Watersun CRM');
    return doc;
}
