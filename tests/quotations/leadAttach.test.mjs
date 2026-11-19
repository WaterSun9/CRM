// 19 Nov 2026: a quote added to leads shows as attached at once, on the form and the card, and is stored once.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sameQuotePdf, quotePdfCopies, mergeDocuments, announceLeadDocuments, onLeadDocuments, LEAD_DOCUMENTS_EVENT } from '../../src/quotations/leadAttach.js';

const pdf = { id:'d1', doc_type:'lead_quotation', file_name:'Test Customer A (Quote-3255-1).pdf' };

test('the same quote PDF under a lead is found, so it is not stored twice', () => {
    assert.equal(sameQuotePdf(pdf, 'Test Customer A (Quote-3255-1).pdf'), true);
    assert.equal(sameQuotePdf(pdf, ' test customer a (quote-3255-1).PDF '), true);
    assert.equal(sameQuotePdf(pdf, 'Test Customer A (Quote-3255-2).pdf'), false, 'another quote of the same client is a different PDF');
    assert.equal(sameQuotePdf({ ...pdf, doc_type:'light_bill' }, pdf.file_name), false, 'only Quotation documents count');
    assert.equal(sameQuotePdf({ ...pdf, file_name:'' }, ''), false, 'a blank name never matches');
    assert.deepEqual(quotePdfCopies([pdf, { ...pdf, id:'d2' }, { id:'x', doc_type:'pan_card', file_name:pdf.file_name }], pdf.file_name).map(d => d.id), ['d1','d2']);
    assert.deepEqual(quotePdfCopies(null, pdf.file_name), []);
});

test('the card adds a saved document once and drops a replaced one', () => {
    const light = { id:'l1', doc_type:'light_bill', file_name:'bill.pdf' };
    const once = mergeDocuments([light], [pdf]);
    assert.deepEqual(once.map(d => d.id), ['l1','d1']);
    assert.equal(mergeDocuments(once, [pdf]), once, 'a second notice for the same document changes nothing');
    assert.deepEqual(mergeDocuments(once, [{ ...pdf, id:'d9' }], ['d1']).map(d => d.id), ['l1','d9']);
    assert.deepEqual(mergeDocuments(undefined, [pdf]).map(d => d.id), ['d1']);
    assert.deepEqual(mergeDocuments([light], [null, { file_name:'no id' }]), [light]);
});

test('only the open card of that lead hears about its new document', () => {
    const target = new EventTarget();
    const heard = [];
    const stop = onLeadDocuments('lead-1', detail => heard.push(detail), target);
    announceLeadDocuments('lead-2', { added:[pdf] }, target);
    announceLeadDocuments('lead-1', { added:[pdf] }, target);
    assert.equal(heard.length, 1);
    assert.deepEqual(heard[0], { customerId:'lead-1', added:[pdf], removedIds:[] });
    stop();
    announceLeadDocuments('lead-1', { added:[pdf] }, target);
    assert.equal(heard.length, 1, 'a closed card stops listening');
    assert.equal(typeof onLeadDocuments(null, () => {}, target), 'function', 'no customer: nothing to listen to');
    assert.equal(LEAD_DOCUMENTS_EVENT, 'lead-documents-changed');
});
