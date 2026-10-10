import test from 'node:test';
import assert from 'node:assert/strict';
import { strFromU8, unzipSync } from 'fflate';
import { buildDeliveryExportRows, buildDeliveryExportWorkbook, toAmount } from '../src/utils/deliveryExport.js';

const customers = new Map([
    ['c1', { id: 'c1', folder_no: 101, customer_name: 'Sandip', phone_number: '+919800000001', full_address: 'Plot 1, Anand', system_capacity_kwp: 3.3, no_of_modules: 6, installation_date: '2026-10-05' }],
    ['c2', { id: 'c2', folder_no: 102, customer_name: 'Ravi', phone_number: '+919800000002', full_address: 'Plot 2', system_capacity_kwp: '4.4', no_of_modules: 8, installation_date: '2026-10-01' }],
    ['c3', { id: 'c3', folder_no: 103, customer_name: 'Meena', system_capacity_kwp: 5.12, no_of_modules: 9, installation_date: null }]
]);
const batches = [
    { id: 'b2', batch_no: 'B-2', dispatch_date: '2026-10-03', rent_amount: '1,500', car_rent_paid: 'No', project_ids: ['c3'] },
    // c-gone was deleted from admin, so it is skipped everywhere.
    { id: 'b1', batch_no: 'B-1', dispatch_date: '2026-10-02', rent_amount: 3000, car_rent_paid: 'Yes', car_rent_paid_at: '2026-10-02T20:00:00Z', project_ids: ['c1', 'c-gone', 'c2'] }
];

const cellValue = (sheet, ref) => sheet.match(new RegExp(`<c r="${ref}"[^>]*>(?:<v>([^<]*)</v>|<is><t>([^<]*)</t></is>)`))?.slice(1).find(Boolean);

test('rent counts once per trip, however many customers are on it', () => {
    const { trips } = buildDeliveryExportRows(batches, customers);
    assert.deepEqual(trips.map(t => [t.batch_no, t.rent, t.customerCount, t.kwp]), [['B-1', 3000, 2, 7.7], ['B-2', 1500, 1, 5.12]]);
    assert.equal(trips.reduce((s, t) => s + t.rent, 0), 4500);
    assert.equal(trips[0].rentPaid + trips[1].rentPaid, 3000);
    assert.equal(trips[0].rentPending + trips[1].rentPending, 1500);
    assert.equal(trips[0].rentPerKwp, 389.61);
});

test('customer sheet is sorted by installation date and keeps stop numbers', () => {
    const { stops } = buildDeliveryExportRows(batches, customers);
    assert.deepEqual(stops.map(s => [s.customer_name, s.stop, s.batch.batch_no]), [['Ravi', 3, 'B-1'], ['Sandip', 1, 'B-1'], ['Meena', 1, 'B-2']]);
});

test('totals agree across the two sheets', () => {
    const files = unzipSync(buildDeliveryExportWorkbook(batches, customers));
    const trips = strFromU8(files['xl/worksheets/sheet1.xml']);
    const people = strFromU8(files['xl/worksheets/sheet2.xml']);
    assert.match(strFromU8(files['xl/workbook.xml']), /name="Trips".*name="Customers"/);
    // Trips total row is row 4: rent H, paid J, pending K, customers N, kWp O.
    assert.equal(cellValue(trips, 'A4'), 'TOTAL');
    assert.equal(cellValue(trips, 'H4'), '4500');
    assert.equal(cellValue(trips, 'J4'), '3000');
    assert.equal(cellValue(trips, 'K4'), '1500');
    assert.equal(cellValue(trips, 'N4'), '3');
    assert.equal(cellValue(trips, 'O4'), '12.82');
    // Customers total row is row 5: kWp M, modules N, count X.
    assert.equal(cellValue(people, 'M5'), '12.82');
    assert.equal(cellValue(people, 'N5'), '23');
    assert.equal(cellValue(people, 'X5'), '3');
    // Phone stays text so the + survives; paid-on shows the India date (3 Oct).
    assert.match(people, /<c r="G2" t="inlineStr"><is><t>\+919800000002<\/t>/);
    assert.equal(cellValue(trips, 'M2'), String(Date.UTC(2026, 9, 3) / 86400000 + 25569));
});

test('amounts parse safely', () => {
    assert.equal(toAmount('1,500.50'), 1500.5);
    assert.equal(toAmount(null), 0);
    assert.equal(toAmount('abc'), 0);
});
