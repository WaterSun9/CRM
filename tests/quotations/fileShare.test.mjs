import test from 'node:test';
import assert from 'node:assert/strict';
import { canShareQuotationFile, shareQuotationFile } from '../../src/quotations/fileShare.js';
const file = new File(['%PDF-1.7\n'], 'quotation.pdf', { type:'application/pdf' });
test('shares the actual PDF without a competing text-only payload, immediately on the tap', async () => {
    let called = false;
    const result = shareQuotationFile(file, { canShare: data => data.files[0] === file, share: async data => {
        called = true;
        assert.deepEqual(Object.keys(data), ['files']);
        assert.equal(data.files[0], file);
        assert.equal(data.files[0].type, 'application/pdf');
    } });
    assert.equal(called, true);
    assert.equal(await result, 'shared');
});
test('missing or unsupported file sharing requires manual attachment, never text-only sharing', async () => {
    let calls = 0;
    const browser = { canShare: () => false, share: async () => { calls++; } };
    assert.equal(await shareQuotationFile(file, browser), 'download-required');
    assert.equal(canShareQuotationFile(file, {}), false);
    assert.equal(canShareQuotationFile(file, { ...browser, canShare: () => { throw new Error('unsupported'); } }), false);
    assert.equal(calls, 0);
});
test('cancel stays cancelled and a rejected share gives explicit fallback', async () => {
    const browser = name => ({ canShare: () => true, share: async () => { throw Object.assign(new Error('share'), { name }); } });
    assert.equal(await shareQuotationFile(file, browser('AbortError')), 'cancelled');
    assert.equal(await shareQuotationFile(file, browser('NotAllowedError')), 'download-required');
});
