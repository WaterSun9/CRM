// The OEM data PDF for one claim (D-033, all OEMs except Tata): the claim, the customer and
// site, the system and warranty, the latest site readings, the complaint, and every complaint
// photo (shrunk to JPEG), all in one file. The office downloads it, or shares it straight to
// WhatsApp / email from a phone, and sends it to the OEM.
// Text uses only characters the built-in PDF font has (no ₹ or arrows).
import { supabase } from '../../supabase';
import { warrantyInfo, formatWarrantyDate } from '../../utils/warranty';
import { READING_GROUPS } from './SiteVisitForm';
import { signedLinks } from './ComplaintPhotos';

const CARD = 'customer_name, phone_number, consumer_no, full_address, pincode, villages, district, module_brand, module_wp, no_of_modules, system_capacity_kwp, inverter_make, inverter_serial_no, panel_serial_no, installation_date, material_delivery_date, completed_at';
const READING_NAMES = Object.fromEntries(READING_GROUPS.flatMap(([group, fields]) => fields.map(([key, name]) => [key, `${group} ${name}`])));
const KIND = { before: 'Before', after: 'After', site: 'Site', reading: 'Reading' };
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '-');
// Only characters the PDF font can draw.
const safe = value => String(value ?? '').replace(/\u20B9/g, 'Rs ').replace(/\u2192/g, '->').replace(/[^\x20-\x7E\xA0-\xFF\u2013\u2014\u2018\u2019\u201C\u201D\u2022\n]/g, '');

// A photo as a JPEG data URL, at most 1200 px on the long side.
// Read through a local copy of the file, so any image type the browser shows works
// (JPEG, PNG, WebP) and the canvas is never blocked as cross-site.
async function photoData(url) {
    const blob = await (await fetch(url)).blob();
    const local = URL.createObjectURL(blob);
    try {
        const img = new Image();
        img.src = local;
        await img.decode();
        const w = img.naturalWidth || 800, h = img.naturalHeight || 600;
        const scale = Math.min(1, 1200 / Math.max(w, h));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(w * scale));
        canvas.height = Math.max(1, Math.round(h * scale));
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return { data: canvas.toDataURL('image/jpeg', 0.75), width: canvas.width, height: canvas.height };
    } finally {
        URL.revokeObjectURL(local);
    }
}

// Reads everything and builds "OEM claim <ticket>-<OEM>.pdf": { pdf, blob, name }.
async function buildOemClaimPdf({ issue, claim }) {
    const [{ jsPDF }, card, trips, files] = await Promise.all([
        import('jspdf'),
        issue.customer_id ? supabase.from('admin').select(CARD).eq('id', issue.customer_id).maybeSingle().then(r => r.data || null) : null,
        supabase.from('service_trips').select('id, visit_no, readings, reached_at, started_at').eq('issue_id', issue.id).order('started_at', { ascending: false }).limit(20).then(r => r.data || []),
        supabase.from('service_issue_files').select('kind, label, trip_id, storage_path, mime_type, created_at').eq('issue_id', issue.id).order('created_at').then(r => r.data || []),
    ]);
    const photos = files.filter(f => /^image\//.test(f.mime_type || 'image/'));
    const urls = photos.length ? await signedLinks(photos.map(f => f.storage_path)).catch(() => ({})) : {};
    const latest = trips.find(t => t.readings);
    const warranty = card ? warrantyInfo(card) : null;

    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const W = 210, M = 14, bottom = 285;
    let y = M;
    const room = need => { if (y + need > bottom) { pdf.addPage(); y = M; } };
    const heading = text => { room(12); y += 3; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(30); pdf.text(safe(text), M, y); y += 2; pdf.setDrawColor(220); pdf.line(M, y, W - M, y); y += 5; };
    const row = (name, value) => {
        const lines = pdf.splitTextToSize(safe(value || '-'), W - M * 2 - 45);
        room(lines.length * 5 + 1);
        pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110); pdf.text(safe(name), M, y);
        pdf.setTextColor(20); pdf.text(lines, M + 45, y);
        y += lines.length * 4.6 + 1;
    };

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(20);
    pdf.text('Watersun Electrical Solutions Pvt Ltd', M, y + 4); y += 11;
    pdf.setFontSize(12); pdf.text(safe(`OEM warranty claim - ${claim.oem}`), M, y); y += 6;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(110);
    pdf.text(safe(`Complaint #${issue.ticket_no ?? ''} · prepared ${day(new Date().toISOString())}`), M, y); y += 4;

    heading('Claim');
    row('OEM', claim.oem);
    row('Faulty part', claim.part);
    row('Faulty serial no.', claim.faulty_serial);
    if (claim.ticket_no) row('OEM ticket no.', claim.ticket_no);
    row('Notes', claim.notes);

    heading('Customer and site');
    row('Customer', card?.customer_name || issue.customer_name);
    row('Phone', card?.phone_number || issue.customer_phone);
    row('Consumer no.', card?.consumer_no || issue.consumer_no);
    row('Address', [card?.full_address || issue.service_address, card?.villages, card?.district, card?.pincode].filter(Boolean).join(', '));

    heading('System');
    row('Panels', [[card?.module_brand, card?.module_wp && `${card.module_wp} Wp`, card?.no_of_modules && `x ${card.no_of_modules}`].filter(Boolean).join(' '), card?.system_capacity_kwp && `${card.system_capacity_kwp} kW system`].filter(Boolean).join(', '));
    row('Inverter', [card?.inverter_make, card?.inverter_serial_no].filter(Boolean).join(' · '));
    row('Installed', card?.installation_date ? day(card.installation_date) : '-');
    if (warranty) row('Warranty', warranty.end ? `${warranty.status === 'in_warranty' ? 'In warranty' : warranty.status === 'out_of_warranty' ? 'Out of warranty' : 'Unknown'} (until ${formatWarrantyDate(warranty.end)})` : 'Unknown');

    heading('Complaint');
    row('Problem', issue.problem_type);
    row('Raised', day(issue.created_at));
    if (issue.comment) row('Comment', issue.comment);

    heading(latest ? `Site readings (visit ${latest.visit_no || ''}, ${day(latest.reached_at || latest.started_at)})` : 'Site readings');
    if (latest) {
        for (const [group, fields] of READING_GROUPS) row(`${group} (volts)`, fields.map(([key, name]) => `${name}: ${latest.readings[key] ?? '-'}`).join('    '));
        row('Floating voltage', latest.readings.floating ? 'Yes' : 'No');
    } else row('Readings', 'Not taken yet');

    if (photos.length) {
        heading(`Photos (${photos.length})`);
        const colW = (W - M * 2 - 6) / 2;
        let col = 0, rowH = 0;
        for (const file of photos) {
            const url = urls[file.storage_path];
            let image = null;
            try { image = url ? await photoData(url) : null; } catch { image = null; }
            // A reading photo says what the meter should show: "AC Pos–Neg 230 V".
            const tripReadings = file.kind === 'reading' ? trips.find(t => t.id === file.trip_id)?.readings : null;
            const value = tripReadings?.[file.label] != null ? ` ${tripReadings[file.label]} V` : '';
            const caption = safe([KIND[file.kind] || file.kind, file.kind === 'reading' ? `${READING_NAMES[file.label] || file.label}${value}` : file.label, day(file.created_at)].filter(Boolean).join(' · '));
            const h = image ? Math.min(75, colW * image.height / image.width) : 10;
            if (col === 0) room(h + 8);
            const x = M + col * (colW + 6);
            if (image) pdf.addImage(image.data, 'JPEG', x, y, colW * Math.min(1, (h / (colW * image.height / image.width))), h, undefined, 'FAST');
            else { pdf.setFontSize(8); pdf.setTextColor(150); pdf.text('Photo could not be loaded', x, y + 5); }
            pdf.setFontSize(8); pdf.setTextColor(90); pdf.text(caption, x, y + h + 4);
            rowH = Math.max(rowH, h + 8);
            col += 1;
            if (col === 2) { col = 0; y += rowH; rowH = 0; }
        }
        if (col) y += rowH;
    }

    const name = `${safe(`OEM claim ${issue.ticket_no ?? ''}-${claim.oem}`).replace(/[^\w .-]+/g, '').trim() || 'OEM claim'}.pdf`;
    return { pdf, blob: pdf.output('blob'), name };
}

// Saves the PDF on this device.
export async function downloadOemClaimPdf({ issue, claim }) {
    const { pdf, name } = await buildOemClaimPdf({ issue, claim });
    pdf.save(name);
}

// Phones (and some computers) can hand a file to WhatsApp, email and so on.
export const canShareFiles = () => typeof navigator !== 'undefined' && typeof navigator.canShare === 'function'
    && navigator.canShare({ files: [new File(['x'], 'x.pdf', { type: 'application/pdf' })] });

// Opens the phone's share sheet with the one PDF; where that is not possible, downloads it.
// Returns false when the person closed the share sheet.
export async function shareOemClaimPdf({ issue, claim }) {
    const { pdf, blob, name } = await buildOemClaimPdf({ issue, claim });
    const file = new File([blob], name, { type: 'application/pdf' });
    if (!canShareFiles() || !navigator.canShare({ files: [file] })) { pdf.save(name); return true; }
    try {
        await navigator.share({ files: [file], title: name.replace(/\.pdf$/, ''), text: `OEM warranty claim: ${claim.part}, ${claim.oem}${claim.faulty_serial ? `, faulty serial ${claim.faulty_serial}` : ''}` });
        return true;
    } catch (failure) {
        if (failure?.name === 'AbortError') return false;
        throw failure;
    }
}
