import test from 'node:test';
import assert from 'node:assert/strict';
import { missingDetailsForMove, stageRank } from '../src/utils/stageRequirements.js';

const complete = {
    inverter_make: 'UTL', inverter_serial_no: 'GX1', panel_serial_no: 'WS1\nWS2',
    vendor: 'BHARAT THAKOR', invoice_no: 'WESPL/1', material_delivery_date: '2026-09-27',
    driver_name: 'Raju', driver_phone_number: 9913649832,
};

test('leaving Material Integration needs inverter and panels (Morvadia)', () => {
    assert.deepEqual(
        missingDetailsForMove('MATERIAL INTEGRATION', 'DISCOM SUBMISSION', { panel_serial_no: 'GS1' }),
        ['Inverter make', 'Inverter serial number', 'Vendor', 'Invoice number', 'Delivery date', 'Driver name', 'Driver phone']
    );
});

test('leaving Material Delivery needs vendor and delivery details only', () => {
    assert.deepEqual(
        missingDetailsForMove('MATERIAL DELIVERY', 'INSTALLATION STATUS', { ...complete, vendor: null, driver_phone_number: null }),
        ['Vendor', 'Driver phone']
    );
});

test('a complete customer, backward moves, Lost Project and later stages are not checked', () => {
    assert.deepEqual(missingDetailsForMove('MATERIAL INTEGRATION', 'MATERIAL DELIVERY', complete), []);
    assert.deepEqual(missingDetailsForMove('MATERIAL DELIVERY', 'MATERIAL ORDER', {}), []);
    assert.deepEqual(missingDetailsForMove('MATERIAL INTEGRATION', 'LOST PROJECT', {}), []);
    assert.deepEqual(missingDetailsForMove('INSTALLATION STATUS', 'GEO TAG PHOTO', {}), []);
    assert.deepEqual(missingDetailsForMove('MATERIAL ORDER', 'MATERIAL INTEGRATION', {}), []);
});

test('Leads to Discom Submission (multi-stage skip) lists everything missing', () => {
    assert.equal(missingDetailsForMove('LEADS', 'DISCOM SUBMISSION', {}).length, 8);
    assert.equal(stageRank('cash'), stageRank('LOAN'));
    assert.equal(stageRank('LOST PROJECT'), null);
});
