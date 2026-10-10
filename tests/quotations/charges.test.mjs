import test from 'node:test';
import assert from 'node:assert/strict';
import { newForm, payload, freshTemplate, validate, documentFor, toLead } from '../../src/quotations/model.js';

const user = { id: '11111111-1111-4111-8111-111111111111', name: 'Test agent', phone: '9876543210', userType: 'admin' };
const complete = (extra = {}) => ({
    ...newForm(user), customer_name: 'Test customer', customer_phone: '9876543211', capacity_kw: 3.48,
    solar_panel_make: 'Waaree', solar_panel_qty: 6, panel_wattage: 580, inverter_brand: 'Solaryan',
    options: [189000, 198000, 205000].map((baseValue, i) => ({ brandName: `Brand ${i + 1}`, baseValue, discount: 5000, subsidy: 78000 })),
    ...extra,
});
const rowOf = form => ({ ...payload(form, freshTemplate()), id: 'quote', quotation_no: 12 });

test('GEB and GEDA say Included by default and do not change the price', () => {
    const doc = documentFor(rowOf(complete()));
    assert.equal(doc.page2.gebCharge, 'Included');
    assert.equal(doc.page2.gedaCharge, 'Included');
    assert.equal(doc.page2.brandOptions[0].netPayableAmount, 184000);
    assert.equal(rowOf(complete()).geb_geda_charge, 'Including');
});

test('an amount shows on its own line and is added to every option', () => {
    const row = rowOf(complete({ geb_charge: '2500', geda_charge: '' }));
    const doc = documentFor(row);
    assert.equal(doc.page2.gebCharge, 2500);
    assert.equal(doc.page2.gedaCharge, 'Included');
    assert.deepEqual(doc.page2.brandOptions.map(o => o.netPayableAmount), [186500, 195500, 202500]);
    assert.equal(row.starting_price, 186500);
    assert.equal(row.geb_geda_charge, 'Excluding');
    assert.equal('geb_charge' in row, false); // kept in quotation_data, not a table column
    assert.equal(row.quotation_data.form.geb_charge, '2500');
});

test('charges must be blank or a non-negative amount', () => {
    assert.deepEqual(validate(complete({ geb_charge: '1000', geda_charge: '' })), []);
    assert.ok(validate(complete({ geda_charge: '-5' })).some(e => /GEDA charge/.test(e)));
});

test('older quotations with the single Excluding choice still print it', () => {
    const row = rowOf(complete());
    row.geb_geda_charge = 'Excluding';
    row.quotation_data.form.geb_geda_charge = 'Excluding';
    delete row.quotation_data.form.geb_charge; delete row.quotation_data.form.geda_charge;
    assert.equal(documentFor(row).page2.gebCharge, 'Excluding');
});

test('Converted pre-fills the lead with the project type', () => {
    assert.equal(toLead(complete({ project_type: 'Commercial' })).property_type, 'Commercial');
});
