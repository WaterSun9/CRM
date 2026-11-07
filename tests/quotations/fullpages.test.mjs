import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { newForm, payload, freshTemplate, documentFor, quotationPageCount, QUOTATION_PAGES } from '../../src/quotations/model.js';
const user = { id:'11111111-1111-4111-8111-111111111111', name:'Office' };
const src = path => readFile(new URL(`../../src/quotations/${path}`, import.meta.url), 'utf8');
function quote(extra = {}) {
    const form = { ...newForm(user), customer_name:'Test Customer', customer_phone:'9876543210', inverter_brand:'Growatt',
        options:[{ brandName:'Waaree', panel_wattage:545, solar_panel_qty:4, capacity_kw:2.18, baseValue:150000, discount:0, subsidy:78000 }] };
    const row = { ...payload(form, freshTemplate()), quotation_no:48, ...extra };
    row.quotation_data.client_id = 'c1'; row.quotation_data.client_no = 48; row.quotation_data.client_seq = 1;
    return row;
}

test('a quote is the full three-page quotation again, an old 1-page copy stays one page', () => {
    assert.equal(quotationPageCount(quote()), 3);
    assert.equal(QUOTATION_PAGES.length, 3);
    const old = quote(); old.quotation_data.kind = 'final';
    assert.equal(quotationPageCount(old), 1);
});

test('the document of a one-brand quote carries every section of the full quotation', () => {
    const doc = documentFor(quote());
    // Page 1: cover letter.
    assert.equal(doc.page1.customerName, 'Test Customer');
    assert.equal(doc.page1.quotationNo, 'Quote-48-1');
    assert.equal(doc.page1.capacityKw, '2.18 kWp');
    // Page 2: proposal with one brand.
    assert.deepEqual(doc.page2.brandOptions.map(o => o.brandName), ['Waaree']);
    assert.ok(doc.page2.notes.length > 0);
    // Page 3: all terms (not only the key ones), warranty, BOM, other charges, bank.
    assert.equal(doc.page3.termsAndConditions.length, 11);
    assert.equal(doc.page3.warranties.length, 3);
    assert.equal(doc.page3.bomItems.length, 10);
    assert.equal(doc.page3.bomItems[0].make, 'Waaree');
    assert.equal(doc.page3.bomItems[0].qty, '4');
    assert.equal(doc.page3.bomItems[0].size, '545 Wp');
    assert.equal(doc.page3.bomItems[2].make, 'Growatt');
    assert.ok(doc.page3.otherChargesText.includes('Advance'));
    assert.equal(doc.page3.bankDetails.ifscCode, 'HDFC0002794');
});

test('View, Download and Share render the cover letter, proposal and terms pages', async () => {
    const pages = await src('DocumentPages.jsx');
    for (const page of ['Page1', 'Page2', 'Page3']) assert.match(pages, new RegExp(`<${page} data=\\{data\\}`));
    // Download and Share both go through generateQuotationPdf, which checks the page count.
    const pdf = await src('pdf.jsx');
    assert.match(pdf, /quotationPageCount\(row\)/);
    const page1 = await src('template/components/pages/Page1.tsx');
    for (const text of ['Authorized And Empanelment Vendor', 'introParagraph1', 'Yours Truly']) assert.ok(page1.includes(text), text);
    const page3 = await src('template/components/pages/Page3.tsx');
    for (const text of ['Terms &amp; Conditions', 'Warranty', 'BOM', 'Estimated Other Charges', 'Company Bank Details']) assert.ok(page3.includes(text), text);
});
