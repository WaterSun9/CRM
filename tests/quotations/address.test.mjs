import test from 'node:test';
import assert from 'node:assert/strict';
import { addressLine } from '../../src/quotations/model.js';

test('town, district and PIN already in the full address are not printed again', () => {
    assert.equal(addressLine({ full_address: '24 Shiv Heritage, Patan, District: Patan, State: GUJARAT, PIN Code: 384265', village: 'PATAN', taluka: 'PATAN', district: 'PATAN', pincode: '384265' }),
        '24 Shiv Heritage, Patan, District: Patan, State: GUJARAT, PIN Code: 384265');
});

test('parts missing from the full address are still added, once each', () => {
    assert.equal(addressLine({ full_address: '2-284 Prajapati Vas, Haripura', village: 'PALANPUR', taluka: 'PALANPUR', district: 'BANASKANTHA', pincode: '385001' }),
        '2-284 Prajapati Vas, Haripura, PALANPUR, BANASKANTHA, 385001');
});

test('a whole word is needed: Patana in the address does not hide the village Patan', () => {
    assert.equal(addressLine({ full_address: 'Near school, Patana', village: 'Patan', pincode: '385' }), 'Near school, Patana, Patan, 385');
});

test('empty parts and an empty address give no stray commas', () => {
    assert.equal(addressLine({ full_address: '', village: 'Ranod', taluka: '', district: ' ', pincode: '384246' }), 'Ranod, 384246');
    assert.equal(addressLine({}), '');
});
