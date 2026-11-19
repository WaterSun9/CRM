import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { fillTataReport, isTataOem, pdfSafe, tataReportValues, wrapLines } from '../src/components/service/tataServiceReport.js';

const card = {
    customer_name: 'Test Customer', phone_number: '90000 00000', consumer_no: 'PGVCL-1', full_address: 'Road 1', pincode: '385340',
    system_capacity_kwp: 3.27, module_brand: 'TATA POWER', module_wp: 545, no_of_modules: 6, inverter_make: 'Tata Power', inverter_serial_no: 'INV-1', installation_date: '2025-02-14',
};
const visit = { visit_no: 2, reached_at: '2026-11-18T06:30:00Z', readings: { ac_pn: 232, ac_pe: 231, ac_ne: 2, dc_pm: 380, dc_pe: 190, dc_me: 189, floating: true }, outcome: 'fixed', outcome_note: 'Card changed' };

test('Tata is spotted by name', () => {
    assert.ok(isTataOem('Tata Power'));
    assert.ok(isTataOem(' tata power solar'));
    assert.ok(!isTataOem('Adani'));
});

test('values come from the complaint, card and latest visit', () => {
    const v = tataReportValues({ issue: { ticket_no: 12, problem_type: 'No output', comment: 'Since Monday' }, claim: { oem: 'Tata Power', part: 'Inverter', faulty_serial: 'INV-1', ticket_no: 'CRN9' }, card, visit, technicianName: 'Tech' });
    assert.equal(v.customerName, 'Test Customer');
    assert.equal(v.dateOfVisit, '18/11/2026');
    assert.equal(v.dateOfInstallation, '14/02/2025');
    assert.equal(v.capacity, '3.27 kWp');
    assert.equal(v.operatingVoltage, '380');
    assert.equal(v.moduleType, 'TATA POWER 545 Wp x 6');
    assert.equal(v.product, 'Inverter - Tata Power');
    assert.equal(v.natureOfComplaint, 'No output. Since Monday');
    assert.match(v.fieldObservations, /DC: \+\/- 380 V/);
    assert.match(v.fieldObservations, /Floating voltage: Yes/);
    assert.match(v.fieldObservations, /serial no\. INV-1/);
    assert.equal(v.actionTaken, 'Visit 2: Fixed - Card changed');
    assert.match(v.heading, /Complaint #12/);
    assert.match(v.heading, /Tata ticket CRN9/);
    // Not stored: left blank for hand-filling.
    assert.equal(v.salesOrderNo, '');
    assert.equal(v.customerRemarks, '');
    assert.equal(v.moduleSerialNo, '');
});

test('a panel claim puts the faulty serial in Module Sl. No.', () => {
    const v = tataReportValues({ claim: { oem: 'Tata Power', part: 'Panel', faulty_serial: 'PNL-7' }, card });
    assert.equal(v.moduleSerialNo, 'PNL-7');
    assert.equal(v.product, 'Solar module - TATA POWER');
});

test('no visit yet: date, readings and action stay blank', () => {
    const v = tataReportValues({ issue: { customer_name: 'Only Issue' }, claim: { oem: 'Tata', part: 'Inverter' } });
    assert.equal(v.customerName, 'Only Issue');
    assert.equal(v.dateOfVisit, '');
    assert.equal(v.operatingVoltage, '');
    assert.equal(v.actionTaken, '');
});

test('text the PDF font cannot draw is removed', () => {
    assert.equal(pdfSafe('Rs ₹ 5 – ok ટાઈટ'), 'Rs Rs 5 - ok');
});

test('long text wraps inside the box', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const lines = wrapLines('word '.repeat(80) + 'AVERYLONGSERIALNUMBERWITHOUTSPACES'.repeat(4), font, 8, 200);
    assert.ok(lines.length > 3);
    assert.ok(lines.every(line => font.widthOfTextAtSize(line, 8) <= 200));
});

test('fills the real blank Tata form: one A4 page that saves', async () => {
    const template = readFileSync(new URL('../src/assets/tata-field-service-report.pdf', import.meta.url));
    const v = tataReportValues({ issue: { ticket_no: 1, problem_type: 'x'.repeat(400) }, claim: { oem: 'Tata Power', part: 'Inverter', notes: 'n '.repeat(500) }, card, visit });
    const doc = await fillTataReport(template, v);
    assert.equal(doc.getPageCount(), 1);
    const { width, height } = doc.getPages()[0].getSize();
    assert.deepEqual([width, height], [595, 842]);
    const bytes = await doc.save();
    assert.ok(bytes.length > 5000);
});
