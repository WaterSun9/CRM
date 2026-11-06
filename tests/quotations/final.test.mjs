import test from 'node:test';
import assert from 'node:assert/strict';
import { newForm, payload, freshTemplate, fromRow, chosenOptions, toLead, oneOption, documentFor, validate } from '../../src/quotations/model.js';
const user = { id:'11111111-1111-4111-8111-111111111111', name:'Office' };
function form() {
    return { ...newForm(user), customer_name:'Test Customer', customer_phone:'9876543210', inverter_brand:'Growatt',
        options:[
            {brandName:'Waaree',panel_wattage:580,solar_panel_qty:6,capacity_kw:3.48,baseValue:180000,discount:0,subsidy:78000},
            {brandName:'Tata',panel_wattage:600,solar_panel_qty:7,capacity_kw:4.2,baseValue:210000,discount:5000,subsidy:78000},
            {brandName:'Adani',panel_wattage:550,solar_panel_qty:8,capacity_kw:4.4,baseValue:220000,discount:0,subsidy:78000},
        ] };
}
test('different specifications survive saving, comparison rendering and selected lead conversion', () => {
    const row = {...payload(form(),freshTemplate()),quotation_no:12};
    const saved = fromRow(row);
    assert.deepEqual(validate(saved),[]);
    assert.deepEqual(documentFor(row).page2.brandOptions.map(option => option.capacity_kw),[3.48,4.2,4.4]);
    const lead = toLead(saved,chosenOptions(saved)[1],['TATA']);
    assert.equal(lead.module_brand,'TATA');
    assert.equal(lead.module_wp,600);
    assert.equal(lead.no_of_modules,7);
    assert.equal(lead.system_capacity_kwp,4.2);
    assert.equal(lead.invoice_value,205000);
});
test('every option validates its own specifications', () => {
    const invalid = form(); invalid.options[1].solar_panel_qty = 0;
    assert.ok(validate(invalid).some(error => /Option 2 panel quantity/.test(error)));
    const final = oneOption(form(),2);
    assert.equal(final.options.length,1);
    assert.deepEqual(validate(final),[]);
});
test('a kept option contains that panel only and retains intro, terms, warranty and BOM data', () => {
    const original = form();
    const final = oneOption(original,2);
    const row = {...payload(final,freshTemplate()),quotation_no:13};
    const doc = documentFor(row);
    assert.equal(doc.page1.customerName,'Test Customer');
    assert.equal(doc.page1.capacityKw,'4.2 kWp');
    assert.deepEqual(doc.page2.brandOptions.map(option => option.brandName),['Tata']);
    assert.equal(doc.page3.bomItems[0].make,'Tata');
    assert.equal(doc.page3.bomItems[0].qty,'7');
    assert.equal(doc.page3.bomItems[0].size,'600 Wp');
    assert.ok(doc.page3.termsAndConditions.length);
    assert.ok(doc.page3.warranties.length);
    assert.equal(original.options.length,3);
});
test('legacy shared specifications remain available separately on each old option', () => {
    const old = form(); old.panel_wattage=580;old.solar_panel_qty=6;old.capacity_kw=3.48;
    old.options = old.options.map(({brandName,baseValue,discount,subsidy}) => ({brandName,baseValue,discount,subsidy}));
    const restored = fromRow({...payload(old,freshTemplate()),quotation_no:1});
    assert.deepEqual(restored.options.map(option => option.panel_wattage),[580,580,580]);
});

