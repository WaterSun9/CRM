import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTruckLoad, paginateTruckRows, planTruckSheetPages } from '../src/utils/truckLoad.js';

test('combines saved BOM quantities while excluding missing BOMs and unknown amounts', () => {
    const result = buildTruckLoad([
        { customer: { id: 'a', customer_name: 'Nikhil' }, bom: { id: 'bom-a' }, items: [
            { product_name: 'Solar Panel', quantity: '12', uom: 'Nos' },
            { product_name: 'Red/Black Sleeve', quantity: '5+2', uom: 'No.' },
            { product_name: 'Cable', quantity: 'as required', uom: 'MTR' }
        ] },
        { customer: { id: 'b', customer_name: 'Priya' }, bom: { id: 'bom-b' }, items: [
            { product_name: 'solar  panel', quantity: '8', uom: 'Nos' },
            { product_name: 'Red/Black Sleeve', quantity: '3+1', uom: 'No.' }
        ] },
        { customer: { id: 'c', customer_name: 'No BOM' }, bom: null, items: [{ product_name: 'Solar Panel', quantity: '999', uom: 'Nos' }] }
    ]);
    assert.equal(result.rows.find(row => row.name === 'Solar Panel').total, 20);
    assert.deepEqual(result.rows.find(row => row.name === 'Solar Panel').quantitiesByCustomer, { a: 12, b: 8 });
    assert.equal(result.rows.find(row => row.name === 'Red/Black Sleeve').total, 11);
    assert.deepEqual(result.missing, ['No BOM (no BOM)']);
    assert.deepEqual(result.uncertain.map(row => row.customer), ['Nikhil']);
});

test('fits ordinary delivery rows on one landscape page and fills page one of larger sheets', () => {
    const rows = Array.from({ length: 48 }, (_, index) => ({ name: `Material ${index + 1}` }));
    assert.deepEqual(paginateTruckRows(rows.slice(0, 26), 0, 2).map(page => page.length), [26]);
    const pages = paginateTruckRows(rows, 0, 2);
    assert.deepEqual(pages.map(page => page.length), [27, 21]);
    assert.deepEqual(pages.flat(), rows);
    const fourCustomerRows = Array.from({ length: 54 }, (_, index) => index);
    const fourCustomerPages = paginateTruckRows(fourCustomerRows, 0, 4);
    assert.equal(fourCustomerPages[0].length, 27);
    assert.deepEqual(fourCustomerPages.flat(), fourCustomerRows);
});

test('fills middle material pages and uses the last page for quantity checks when they fit', () => {
    const rows = Array.from({ length: 60 }, (_, index) => index);
    const materialPages = paginateTruckRows(rows, 0, 5, false);
    const combinedPages = paginateTruckRows(rows, 14, 5);
    assert.deepEqual(materialPages.map(page => page.length), [23, 28, 9]);
    assert.deepEqual(combinedPages.map(page => page.length), [23, 28, 9]);
    assert.deepEqual(combinedPages.flat(), rows);
});

test('keeps space for verification notes without losing material rows', () => {
    const rows = Array.from({ length: 44 }, (_, index) => index);
    const pages = paginateTruckRows(rows, 6, 2);
    assert.deepEqual(pages.flat(), rows);
    assert.ok(pages.at(-1).length <= 22);
});

test('reserves the footer area on a one-customer sheet with quantity checks', () => {
    const rows = Array.from({ length: 42 }, (_, index) => index);
    const pages = paginateTruckRows(rows, 4, 1);
    assert.deepEqual(pages.map(page => page.length), [27, 15]);
    assert.deepEqual(pages.flat(), rows);
});

test('splits four customer check tables before the footer instead of clipping them', () => {
    const rows = Array.from({ length: 41 }, (_, index) => index);
    const notes = Array.from({ length: 16 }, (_, index) => ({ customer: `Customer ${Math.floor(index / 4) + 1}`, name: `Part ${index}`, quantity: '12*4', uom: 'Feet' }));
    const pages = planTruckSheetPages(rows, notes, 4);
    assert.deepEqual(pages.map(page => [page.kind, page.rows.length, page.notes.length]), [
        ['materials', 27, 0],
        ['materials', 14, 8],
        ['notes', 0, 8]
    ]);
    assert.deepEqual(pages.flatMap(page => page.rows), rows);
    assert.deepEqual(pages.flatMap(page => page.notes), notes);
});
