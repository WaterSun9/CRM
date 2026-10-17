import test from 'node:test';
import assert from 'node:assert/strict';
import { chosenOptions, leadBrand, toLead, newForm, payload, freshTemplate, documentFor, validate } from '../../src/quotations/model.js';

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

test('the selected package reaches the lead with the pre-subsidy price and inverter', () => {
    const form = { ...newForm({name:'Office'}), customer_name:'Test Customer', customer_phone:'9876543210',
        capacity_kw:3.48, solar_panel_qty:6, panel_wattage:580, solar_panel_make:'Old different brand',
        inverter_brand:'Growatt', geb_charge:1000, geda_charge:500,
        options:[{brandName:'Waaree Solar',baseValue:180000,discount:0,subsidy:78000},
            {brandName:'Tata Power Solar',baseValue:200000,discount:5000,subsidy:78000},
            {brandName:'Adani Solar',baseValue:190000,discount:0,subsidy:78000}] };
    const choice = chosenOptions(form)[1];
    const lead = toLead(form, choice, ['WAAREE','TATA','ADANI']);
    assert.equal(lead.module_brand, 'TATA');
    assert.equal(lead.invoice_value, 196500);
    assert.notEqual(lead.invoice_value, choice.netPriceAfterSubsidy);
    assert.equal(lead.inverter_make, 'Growatt');
    assert.equal(lead.module_wp, 580);
    assert.equal(lead.no_of_modules, 6);
    const doc = documentFor({...payload(form, freshTemplate()), quotation_no:1});
    assert.equal(doc.page2.panelWattage, 580);
    assert.equal(doc.page2.solarPanelQty, 6);
    assert.equal(doc.page2.inverterBrand, 'Growatt');
    assert.equal(doc.page3.bomItems[0].qty, '6');
    assert.equal(doc.page3.bomItems[0].size, '580 Wp');
});

test('priced option brands are sufficient without a duplicate top-level panel make', () => {
    const form = {...newForm({name:'Office'}),customer_name:'Test Customer',customer_phone:'9876543210',
        capacity_kw:3.48,solar_panel_qty:6,panel_wattage:580,inverter_brand:'Growatt',
        options:['WAAREE','TATA','ADANI'].map(brandName=>({brandName,baseValue:200000,discount:0,subsidy:78000}))};
    assert.deepEqual(validate(form),[]);
    assert.equal(payload(form,freshTemplate()).solar_panel_make,'WAAREE');
});
