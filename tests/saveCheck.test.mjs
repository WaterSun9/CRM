import test from 'node:test';
import assert from 'node:assert/strict';
import { findUnsavedFields, stableStringify } from '../src/utils/saveCheck.js';

test('flags a value that was sent but not stored (the lost-inverter case)', () => {
    const sent = { inverter_make: 'Goodwe', inverter_serial_no: '53000N3A263L8503' };
    const stored = { inverter_make: null, inverter_serial_no: null };
    assert.deepEqual(findUnsavedFields(sent, stored), ['inverter_make', 'inverter_serial_no']);
});

test('does not flag values the database stores in a different format', () => {
    const sent = {
        invoice_value: '1,71,000',         // Indian commas -> numeric column
        no_of_modules: '6',                 // string -> number
        system_capacity_kwp: '3.54',
        driver_phone_number: '9913649832',  // text -> bigint
        material_delivery_date: '',         // cleared date -> null
        email_address: '',                  // empty text vs null
        panel_serial_no: 'WS1\nWS2',        // stored in a json column as a string
        vendor: ' GURUDEV SOLAR TEAM ',     // surrounding spaces
        light_bill: false,
    };
    const stored = {
        invoice_value: 171000,
        no_of_modules: 6,
        system_capacity_kwp: 3.54,
        driver_phone_number: 9913649832,
        material_delivery_date: null,
        email_address: null,
        panel_serial_no: 'WS1\nWS2',
        vendor: 'GURUDEV SOLAR TEAM',
        light_bill: null,
    };
    assert.deepEqual(findUnsavedFields(sent, stored), []);
});

test('objects compare by content, not key order (jsonb re-orders keys)', () => {
    const sent = { loan_history: [{ status: '1st Payment', date: '2026-09-19', amount: '1,18,300' }] };
    const stored = { loan_history: [{ amount: '1,18,300', date: '2026-09-19', status: '1st Payment' }] };
    assert.deepEqual(findUnsavedFields(sent, stored), []);
    assert.equal(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] }), stableStringify({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test('flags a changed object and a ticked checkbox that did not stick', () => {
    const sent = { loan_history: [{ status: '2nd Payment' }], discom_agreement: true };
    const stored = { loan_history: [{ status: '1st Payment' }], discom_agreement: false };
    assert.deepEqual(findUnsavedFields(sent, stored), ['loan_history', 'discom_agreement']);
});

test('ignores keys that are not database columns and bookkeeping columns', () => {
    const sent = { some_ui_only_key: 'x', updated_at: '2026-10-01', id: 'abc', stage: 'MATERIAL DELIVERY' };
    const stored = { stage: 'MATERIAL DELIVERY' };
    assert.deepEqual(findUnsavedFields(sent, stored), []);
});

test('flags a number that really differs', () => {
    assert.deepEqual(findUnsavedFields({ no_of_modules: '7' }, { no_of_modules: 6 }), ['no_of_modules']);
    assert.deepEqual(findUnsavedFields({ no_of_modules: '6' }, { no_of_modules: null }), ['no_of_modules']);
});

test('valuesMatch: numbers only match loosely against a real number', async () => {
    const { valuesMatch } = await import('../src/utils/saveCheck.js');
    assert.equal(valuesMatch('1,71,000', 171000), true);   // formatted form value vs numeric column
    assert.equal(valuesMatch('6', 6), true);
    assert.equal(valuesMatch('0123', '123'), false);       // text column: leading zero matters
    assert.equal(valuesMatch('3.54', '3.540'), false);     // two strings: exact text
    assert.equal(valuesMatch('', null), true);
    assert.equal(valuesMatch(undefined, false), true);
    assert.equal(valuesMatch(true, false), false);
    assert.equal(valuesMatch({ a: 1, b: 2 }, { b: 2, a: 1 }), true);
});

test('merge: opening from the slim list row, then the full record arrives (Morvadia)', async () => {
    const { mergeServerRecord } = await import('../src/utils/saveCheck.js');
    const slimCard = { id: 'm', customer_name: 'Morvadia', stage: 'DISCOM SUBMISSION', vendor_quote: null };
    const fullRow = { ...slimCard, panel_serial_no: 'GS1\nGS2', inverter_make: null };
    const { next, unsavedKeys } = mergeServerRecord({ ...slimCard }, { ...slimCard }, fullRow);
    assert.equal(next.panel_serial_no, 'GS1\nGS2');   // saved serials now visible
    assert.deepEqual(unsavedKeys, []);
});

test('merge: a value typed before the full record loaded is kept, not overwritten', async () => {
    const { mergeServerRecord } = await import('../src/utils/saveCheck.js');
    const slimCard = { id: 'g', stage: 'MATERIAL INTEGRATION' };
    const form = { ...slimCard, inverter_serial_no: '53000N3A263L8503' };   // typed, field not in slim card
    const fullRow = { ...slimCard, inverter_serial_no: null, panel_serial_no: 'T1' };
    const { next, unsavedKeys } = mergeServerRecord(form, slimCard, fullRow);
    assert.equal(next.inverter_serial_no, '53000N3A263L8503');
    assert.equal(next.panel_serial_no, 'T1');
    assert.deepEqual(unsavedKeys, ['inverter_serial_no']);
});

test('merge: a colleague change to another field comes in; my unsaved edit stays', async () => {
    const { mergeServerRecord } = await import('../src/utils/saveCheck.js');
    const baseline = { id: 'x', vendor: null, invoice_value: 171000, module_brand: 'GOLDI' };
    const form = { ...baseline, vendor: 'BHARAT THAKOR', invoice_value: '1,71,000' };  // formatted, not a change
    const server = { ...baseline, module_brand: 'TATA' };                             // colleague edit
    const { next, unsavedKeys } = mergeServerRecord(form, baseline, server);
    assert.equal(next.vendor, 'BHARAT THAKOR');
    assert.equal(next.module_brand, 'TATA');
    assert.equal(next.invoice_value, 171000);
    assert.deepEqual(unsavedKeys, ['vendor']);
});
