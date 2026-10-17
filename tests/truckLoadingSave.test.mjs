import test from 'node:test';
import assert from 'node:assert/strict';
import { saveTruckLoadingTicks, describeSaveError, markBatchLoaded, truckLoadedLabel, loadingShortfall, stampBomLoadedDates } from '../src/utils/truckLoadingSave.js';
import { buildTruckLoad, parsePanelSerialList, isSolarPanelName } from '../src/utils/truckLoad.js';
const id = '11111111-1111-1111-1111-111111111111';
function fixture({ denied = false, shortWrite = false } = {}) {
    const items = [{ id, product_name: 'Solar Panel', quantity: '6', loaded: false }];
    const panels = new Map();
    return { items, panels, from(table) {
        return table === 'panel_loading' ? { upsert(rows) { return { async select() { rows.forEach(row => panels.set(row.serial_no, row.loaded)); return { data: rows }; } }; } }
            : { update(patch) { return { in(_key, ids) { return { async select() {
                if (denied) return { error: new Error('permission denied') };
                const selected = items.filter(item => ids.includes(item.id));
                selected.forEach(item => Object.assign(item, patch));
                return { data: shortWrite ? [] : selected };
            } }; } }; } };
    } };
}
const request = { row: { name: 'Solar Panel' }, targets: [{ project: { id: 'a' }, lines: [{ id }] }], value: true };
test('panels can be loaded without serial numbers and remain ticked after rebuilding the sheet', async () => {
    const db = fixture();
    await saveTruckLoadingTicks(db, request);
    const reopened = buildTruckLoad([{ customer: { id: 'a' }, bom: { id: 'bom' }, items: db.items }]);
    assert.equal(reopened.rows[0].lines.a[0].loaded, true);
    await saveTruckLoadingTicks(db, { ...request, value: false });
    assert.equal(db.items[0].loaded, false);
});
test('panel ticks and undo sync all assigned serials, deduplicating them', async () => {
    const db = fixture();
    const args = { ...request, panelSerialsByCustomer: { a: ['P1', 'P2', 'P1'] } };
    await saveTruckLoadingTicks(db, args);
    assert.deepEqual([...db.panels.values()], [true, true]);
    await saveTruckLoadingTicks(db, { ...args, value: false });
    assert.deepEqual([...db.panels.values()], [false, false]);
});
test('denied and incomplete writes are errors, not successful ticks', async () => {
    await assert.rejects(saveTruckLoadingTicks(fixture({ denied: true }), request), /permission denied/);
    await assert.rejects(saveTruckLoadingTicks(fixture({ shortWrite: true }), request), /not saved/);
    await assert.rejects(saveTruckLoadingTicks(fixture(), { ...request, targets: [{ project: { id: 'a' }, lines: [{ id: null }] }] }), /Bill of Materials/);
});
test('blank and zero lines do not leave a fully loaded truck permanently partial', () => {
    const result = buildTruckLoad([{ customer: { id: 'a' }, bom: { id: 'bom' }, items: [{ product_name: 'Panel', quantity: '6', loaded: true }, { product_name: 'Cable', quantity: '' }, { product_name: 'Spare', quantity: '0' }] }]);
    assert.deepEqual(result.progressByCustomer.a, { loaded: 1, total: 1 });
    assert.equal(result.rows.length, 1);
    assert.equal(isSolarPanelName(' Solar  Panels '), true);
    assert.deepEqual(parsePanelSerialList('["P1","P1","P2"]'), ['P1', 'P2']);
});

// A small in-memory Supabase for the tables the truck sheet writes.
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function fakeDb({ batchColumns = true, denyBatch = false, failBom = [] } = {}) {
    const tables = {
        bom_items: [], panel_loading: [], bom: [],
        delivery_batches: [{ id: 'batch-1', batch_no: 'B-12', loaded_at: null, loaded_by: null, loaded_by_name: null }]
    };
    const missing = { message: "Could not find the 'loaded_at' column of 'delivery_batches' in the schema cache", code: 'PGRST204' };
    const query = (table, run) => {
        const filters = [];
        const builder = {
            eq(key, value) { filters.push(row => row[key] === value); return builder; },
            in(key, values) { filters.push(row => values.includes(row[key])); return builder; },
            is(key, value) { filters.push(row => (row[key] ?? null) === value); return builder; },
            select() { return builder; },
            maybeSingle() { return Promise.resolve(run(tables[table].filter(row => filters.every(test => test(row))))).then(result => ({ ...result, data: result.data?.[0] || null })); },
            then(resolve, reject) { return Promise.resolve(run(tables[table].filter(row => filters.every(test => test(row))))).then(resolve, reject); }
        };
        return builder;
    };
    return { tables, from(table) {
        return {
            select: () => query(table, rows => table === 'delivery_batches' && !batchColumns ? { error: missing } : { data: rows }),
            update: patch => query(table, rows => {
                if (table === 'delivery_batches' && !batchColumns) return { error: missing };
                if (table === 'delivery_batches' && denyBatch) return { data: [] };
                if (table === 'bom' && rows.some(row => failBom.includes(row.id))) return { error: new Error('permission denied for table bom') };
                rows.forEach(row => Object.assign(row, patch, table === 'delivery_batches' ? { loaded_at: '2026-10-17T09:35:00Z', loaded_by_name: 'Asha (from profile)' } : {}));
                return { data: rows };
            }),
            upsert: rows => ({ select: async () => {
                rows.forEach(next => {
                    const found = tables[table].find(row => row.customer_id === next.customer_id && row.serial_no === next.serial_no);
                    if (found) Object.assign(found, next); else tables[table].push({ ...next });
                });
                return { data: rows };
            } })
        };
    } };
}
// Reopening the sheet: the same reads openTruckSheet makes, from the fake DB.
const reopen = (db, customer, serials = []) => {
    const loaded = db.tables.panel_loading.filter(row => row.customer_id === customer.id && row.loaded).map(row => row.serial_no);
    const items = db.tables.bom_items.map(item => isSolarPanelName(item.product_name) && serials.length
        ? { ...item, loaded: serials.every(serial => loaded.includes(serial)) } : item);
    return { sheet: buildTruckLoad([{ customer, bom: { id: 'bom-a' }, items }]), panelsLoaded: loaded };
};

test('ticks are saved to the database and are still ticked after a reload', async () => {
    const db = fakeDb();
    db.tables.bom_items.push({ id: uuid(1), product_name: 'Inverter', quantity: '1', loaded: false }, { id: uuid(2), product_name: 'Dc Cable', quantity: '40', loaded: false });
    const customer = { id: 'a', customer_name: 'Ramesh' };
    await saveTruckLoadingTicks(db, { row: { name: 'Inverter' }, targets: [{ project: customer, lines: [{ id: uuid(1) }] }], value: true });
    const { sheet } = reopen(db, customer);
    assert.equal(sheet.rows.find(row => row.name === 'Inverter').lines.a[0].loaded, true);
    assert.equal(sheet.rows.find(row => row.name === 'Dc Cable').lines.a[0].loaded, false);
    assert.deepEqual(sheet.progressByCustomer.a, { loaded: 1, total: 2 });
});

test('partly delivered: undo on the next truck keeps panels ticked on the first truck', async () => {
    const db = fakeDb();
    const serials = ['P1', 'P2', 'P3', 'P4'];
    db.tables.bom_items.push({ id: uuid(1), product_name: 'Solar Panel', quantity: '4', loaded: false });
    // First truck: two panels ticked one by one on the customer card.
    db.tables.panel_loading.push({ customer_id: 'a', serial_no: 'P1', loaded: true }, { customer_id: 'a', serial_no: 'P2', loaded: true });
    const customer = { id: 'a', customer_name: 'Ramesh' };
    const before = reopen(db, customer, serials);
    assert.equal(before.sheet.rows[0].lines.a[0].loaded, false);
    assert.deepEqual(before.panelsLoaded, ['P1', 'P2']);

    // Second truck: the sheet ticks the panel line, then undoes it.
    const args = { row: { name: 'Solar Panel' }, targets: [{ project: customer, lines: [{ id: uuid(1) }] }], panelSerialsByCustomer: { a: serials } };
    await saveTruckLoadingTicks(db, { ...args, value: true });
    assert.equal(reopen(db, customer, serials).sheet.rows[0].lines.a[0].loaded, true);
    await saveTruckLoadingTicks(db, { ...args, value: false, keepPanelsLoaded: { a: before.panelsLoaded } });
    const after = reopen(db, customer, serials);
    assert.deepEqual(after.panelsLoaded, ['P1', 'P2']);
    assert.equal(after.sheet.rows[0].lines.a[0].loaded, false);
    assert.equal(db.tables.bom_items[0].loaded, false);
});

test('quantities like "as required" can be ticked and count towards progress', () => {
    const result = buildTruckLoad([{ customer: { id: 'a', customer_name: 'Ramesh' }, bom: { id: 'bom-a', material_loaded_date: '2026-10-10' }, items: [
        { id: uuid(1), product_name: 'Earthing Kit', quantity: 'as required', loaded: true },
        { id: uuid(2), product_name: 'Inverter', quantity: '1', loaded: false }
    ] }]);
    assert.deepEqual(result.uncertain, [{ name: 'Earthing Kit', quantity: 'as required', uom: 'No.', customer: 'Ramesh', customerId: 'a', id: uuid(1), loaded: true }]);
    assert.deepEqual(result.progressByCustomer.a, { loaded: 1, total: 2 });
    assert.equal(result.bomLoadedDateByCustomer.a, '2026-10-10');
});

test('a dropped connection is reported plainly, other errors keep their message', () => {
    assert.match(describeSaveError(new TypeError('Failed to fetch')), /No internet connection, so this was NOT saved/);
    assert.match(describeSaveError({ message: 'TypeError: Load failed' }), /NOT saved/);
    assert.equal(describeSaveError(new Error('permission denied for table bom_items')), 'permission denied for table bom_items');
    assert.equal(describeSaveError(null, 'The tick was not saved.'), 'The tick was not saved.');
});

test('truck loaded: stamped once, kept on a second attempt, shown as "Loaded by"', async () => {
    const db = fakeDb();
    const first = await markBatchLoaded(db, { batchId: 'batch-1', user: { id: uuid(9), name: 'Asha' } });
    assert.equal(first.alreadyLoaded, false);
    assert.equal(first.stamp.loaded_by, uuid(9));
    assert.match(truckLoadedLabel(first.stamp), /^Loaded by Asha \(from profile\) on 17 Oct 2026, 3:05\s?pm$/i);
    const second = await markBatchLoaded(db, { batchId: 'batch-1', user: { id: uuid(8), name: 'Vikram' } });
    assert.equal(second.alreadyLoaded, true);
    assert.equal(second.stamp.loaded_by, uuid(9));
    assert.equal(truckLoadedLabel({}), '');
    // A test login without a real user id still records the name.
    const db2 = fakeDb();
    assert.equal((await markBatchLoaded(db2, { batchId: 'batch-1', user: { id: 'admin', name: 'Asha' } })).stamp.loaded_by, null);
});

test('truck loaded: a missing migration or a refused write is an error, not a silent success', async () => {
    await assert.rejects(markBatchLoaded(fakeDb({ batchColumns: false }), { batchId: 'batch-1', user: {} }), /20261017120000_truck_loaded_stamp\.sql.*ticks themselves are saved/);
    await assert.rejects(markBatchLoaded(fakeDb({ denyBatch: true }), { batchId: 'batch-1', user: {} }), /not marked loaded/);
});

test('loading shortfall lists customers with unticked items', () => {
    const projects = [{ id: 'a', customer_name: 'Ramesh' }, { id: 'b', customer_name: 'Priya' }, { id: 'c' }];
    assert.deepEqual(loadingShortfall({ projects, progressByCustomer: { a: { loaded: 3, total: 5 }, b: { loaded: 4, total: 4 } } }),
        [{ id: 'a', name: 'Ramesh', loaded: 3, total: 5 }]);
});

test('BOM loading date: set when ticked on this sheet or still blank, never moved back otherwise', async () => {
    const db = fakeDb({ failBom: ['bom-d'] });
    db.tables.bom.push({ id: 'bom-a', material_loaded_date: '2026-10-01' }, { id: 'bom-b', material_loaded_date: '2026-10-01' }, { id: 'bom-c', material_loaded_date: null }, { id: 'bom-d', material_loaded_date: null }, { id: 'bom-e', material_loaded_date: null });
    const sheet = {
        projects: ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, customer_name: id.toUpperCase() })),
        bomIdByCustomer: { a: 'bom-a', b: 'bom-b', c: 'bom-c', d: 'bom-d', e: 'bom-e' },
        bomLoadedDateByCustomer: { a: '2026-10-01', b: '2026-10-01', c: null, d: null, e: null },
        progressByCustomer: { a: { loaded: 2, total: 3 }, b: { loaded: 1, total: 3 }, c: { loaded: 1, total: 1 }, d: { loaded: 1, total: 1 }, e: { loaded: 0, total: 2 } }
    };
    const failed = await stampBomLoadedDates(db, { sheet, date: '2026-10-17', tickedIds: new Set(['a']) });
    assert.deepEqual(db.tables.bom.map(row => row.material_loaded_date), ['2026-10-17', '2026-10-01', '2026-10-17', null, null]);
    assert.deepEqual(failed, ['D']);
});
