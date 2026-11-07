import test from 'node:test';
import assert from 'node:assert/strict';
import { newForm, payload, freshTemplate, validate, documentFor, toLead, withCharge, legacyExcluding, fromRow } from '../../src/quotations/model.js';

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

test('Another salesperson name prints on the quotation only; the saved salesperson stays', () => {
    assert.equal(documentFor(rowOf(complete())).page1.yoursTrulyName, 'Test agent');
    const row = rowOf(complete({ print_owner_name: 'Ramesh Patel' }));
    assert.equal(documentFor(row).page1.yoursTrulyName, 'Ramesh Patel');
    assert.equal(row.owner_name_snapshot, 'Test agent');
    assert.equal('print_owner_name' in row, false);
});

test('entering GEB and GEDA amounts in the form flows into Net Payable and after-subsidy price', () => {
    let form = complete();
    form = withCharge(form, 'geb_charge', '3000');
    form = withCharge(form, 'geda_charge', '1500.5');
    assert.equal(form.geb_geda_charge, 'Excluding');
    const doc = documentFor(rowOf(form));
    assert.equal(doc.page2.gebCharge, 3000);
    assert.equal(doc.page2.gedaCharge, 1500.5);
    // 189000 - 5000 + 3000 + 1500.5 = 188500.5; minus 78000 subsidy = 110500.5
    assert.equal(doc.page2.brandOptions[0].netPayableAmount, 188500.5);
    assert.equal(doc.page2.brandOptions[0].netPriceAfterSubsidy, 110500.5);
    // Edit reopens with the same amounts.
    const reopened = fromRow(rowOf(form));
    assert.equal(reopened.geb_charge, '3000');
    assert.equal(reopened.geda_charge, '1500.5');
});

test('setting a charge back to Included removes it from the price', () => {
    let form = withCharge(complete(), 'geb_charge', '3000');
    form = withCharge(form, 'geb_charge', '');
    assert.equal(form.geb_geda_charge, 'Including');
    const doc = documentFor(rowOf(form));
    assert.equal(doc.page2.gebCharge, 'Included');
    assert.equal(doc.page2.brandOptions[0].netPayableAmount, 184000);
});

test('an older Excluding quote is recognised, and choosing Included or an amount replaces it', () => {
    const old = complete({ geb_geda_charge: 'Excluding' });
    assert.equal(legacyExcluding(old), true);
    assert.equal(legacyExcluding(withCharge(old, 'geda_charge', '800')), false);
    const included = withCharge(old, 'geb_charge', '');
    assert.equal(legacyExcluding(included), false);
    assert.equal(documentFor(rowOf(included)).page2.gebCharge, 'Included');
    assert.throws(() => withCharge(old, 'subsidy', '1'));
});
