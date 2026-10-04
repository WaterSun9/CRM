import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { buildVendorPaymentsWorkbook } from '../src/utils/vendorPaymentsWorkbook.js';
import { filterVendorPayments } from '../src/utils/vendorPaymentFilters.js';

test('this month uses installation date and keeps paid and pending records', () => {
    const rows = [
        { id: 'paid', installation_date: '2026-10-02', vendor_paid_date: '2026-11-01', vendor_payment_status: 'Paid' },
        { id: 'pending', installation_date: '2026-10-04', vendor_paid_date: null, vendor_payment_status: 'Pending' },
        { id: 'older', installation_date: '2026-09-30', vendor_paid_date: '2026-10-03', vendor_payment_status: 'Paid' }
    ];
    assert.deepEqual(filterVendorPayments(rows, 'month', '2026-10').map(row => row.id), ['paid', 'pending']);
    assert.equal(filterVendorPayments(rows, 'all', '2026-10').length, 3);
});

test('vendor payment export is an Excel workbook with typed dates and amounts', () => {
    const bytes = buildVendorPaymentsWorkbook([{
        id: 'project-1', customer_name: 'A & B Solar', consumer_no: '00123',
        system_capacity_kwp: 3.48, vendor_quote: 1250.5,
        vendor_payment_status: 'Paid', vendor_paid_date: '2026-10-02',
        installation_date: '2026-10-01', vendor: 'Vendor <One>'
    }]);
    const contents = unzipSync(bytes);
    assert.ok(contents['[Content_Types].xml']);
    assert.ok(contents['xl/workbook.xml']);
    const sheet = strFromU8(contents['xl/worksheets/sheet1.xml']);
    assert.match(sheet, /A &amp; B Solar/);
    assert.match(sheet, /Vendor &lt;One&gt;/);
    assert.match(sheet, /r="B2" t="inlineStr"/); // Consumer number keeps leading zeroes.
    assert.match(sheet, /r="D2" s="2"><v>1250\.5<\/v>/);
    assert.match(sheet, /r="F2" s="1"><v>\d+<\/v>/);
    assert.match(sheet, /r="G2" s="1"><v>\d+<\/v>/);
});

test('a chosen month key filters by that month', () => {
    const rows = [{ id: 'a', installation_date: '2026-08-15' }, { id: 'b', installation_date: '2026-09-01' }];
    assert.deepEqual(filterVendorPayments(rows, '2026-08', '2026-10').map(row => row.id), ['a']);
});

test('ledger export has a total row and a named sheet', async () => {
    const { buildPayoutLedgerWorkbook } = await import('../src/utils/vendorPaymentsWorkbook.js');
    const contents = unzipSync(buildPayoutLedgerWorkbook([
        { id: '1', customer_name: 'A', phone_number: '0987', vendor: 'V', vendor_quote: 1000, payoutMonthLabel: 'October 2026' },
        { id: '2', customer_name: 'B', vendor: 'V', vendor_quote: '2500.5', vendor_payment_status: 'Paid', vendor_paid_date: '2026-10-01' }
    ]));
    const sheet = strFromU8(contents['xl/worksheets/sheet1.xml']);
    assert.match(sheet, /r="A4" s="3" t="inlineStr"><is><t>Total/);
    assert.match(sheet, /r="F4" s="4"><v>3500\.5<\/v>/);
    assert.match(sheet, /r="B2" t="inlineStr"><is><t>0987/);
    assert.match(strFromU8(contents['xl/workbook.xml']), /name="Vendor Commission"/);
});
