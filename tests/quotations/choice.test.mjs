import test from 'node:test';
import assert from 'node:assert/strict';
import { chosenOptions, leadBrand } from '../../src/quotations/model.js';

test('won choices number the priced options and include GEB/GEDA charges', () => {
    const form = { geb_charge: '1000', geda_charge: '', options: [
        { brandName: 'Waaree Solar', baseValue: 200000, discount: 10000, subsidy: 78000 },
        { brandName: 'Tata Power Solar', baseValue: '', discount: 0, subsidy: 0 },
        { brandName: 'Adani Solar', baseValue: 190000, discount: 0, subsidy: 78000 }
    ] };
    const choices = chosenOptions(form);
    assert.deepEqual(choices.map(c => [c.number, c.brandName, c.netPayableAmount, c.netPriceAfterSubsidy]),
        [[1, 'Waaree Solar', 191000, 113000], [3, 'Adani Solar', 191000, 113000]]);
});

test('option brand maps to the CRM brand list', () => {
    assert.equal(leadBrand('Tata Power Solar', ['WAAREE', 'TATA', 'ADANI']), 'TATA');
    assert.equal(leadBrand('Waaree Solar', ['WAAREE']), 'WAAREE');
    assert.equal(leadBrand('Goldi Green', []), 'GOLDI');
});
