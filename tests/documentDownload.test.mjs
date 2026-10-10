import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchDocumentBlob, saveDocumentDownload, validateDocumentBlob } from '../src/utils/documentDownload.js';

const jpeg = () => new Blob(['image bytes'], {type:'image/jpeg'});
let decoded = true;
globalThis.Image = class {
    naturalWidth = 10;
    naturalHeight = 10;
    set src(value) { queueMicrotask(() => decoded ? this.onload() : this.onerror()); }
};
function setup() {
    decoded = true;
    const events = [], order = [];
    globalThis.CustomEvent = class { constructor(type, init) { this.type=type; this.detail=init.detail; } };
    const stream = {write:async () => order.push('write'),close:async () => order.push('close'),abort:async () => order.push('abort')};
    globalThis.window = {
        showSaveFilePicker:async () => {order.push('picker'); return {createWritable:async () => {order.push('stream');return stream;}};},
        dispatchEvent:event => events.push(event),
    };
    globalThis.fetch = async () => {order.push('fetch');return {ok:true,blob:async () => jpeg()};};
    return {events,order,stream};
}
test('rejects empty files before decoding', async () => {
    await assert.rejects(validateDocumentBlob(new Blob([]),'bill.jpg'), /empty/);
});
test('rejects damaged images and releases preview URL', async () => {
    setup(); decoded=false;
    await assert.rejects(validateDocumentBlob(jpeg(),'bill.jpg'), /damaged/);
});
test('opens picker before fetch; reports success only after close', async () => {
    const {events,order}=setup();
    await saveDocumentDownload('url','bill.jpg');
    assert.deepEqual(order,['picker','fetch','stream','write','close']);
    assert.equal(events.length,1);
    assert.equal(events[0].detail.file.size,jpeg().size);
});
test('cancel leaves network and destination untouched', async () => {
    const {events,order}=setup();
    window.showSaveFilePicker=async () => {throw Object.assign(new Error(),{name:'AbortError'});};
    assert.deepEqual(await saveDocumentDownload('url','bill.jpg'),{cancelled:true});
    assert.deepEqual(order,[]); assert.equal(events.length,0);
});
test('empty response does not create writable stream or announce success', async () => {
    const {events,order}=setup();
    globalThis.fetch=async () => ({ok:true,blob:async () => new Blob([])});
    await assert.rejects(saveDocumentDownload('url','bill.jpg'),/empty/);
    assert.deepEqual(order,['picker']); assert.equal(events.length,0);
});
test('write failure aborts and never announces success or starts fallback', async () => {
    const {events,order,stream}=setup();
    stream.write=async () => {throw new Error('Disk full');};
    await assert.rejects(saveDocumentDownload('url','bill.jpg'),/Disk full/);
    assert.deepEqual(order,['picker','fetch','stream','abort']); assert.equal(events.length,0);
});
test('retries temporary network errors', async () => {
    setup(); let calls=0;
    globalThis.fetch=async () => {if (++calls===1) throw new TypeError('network');return {ok:true,blob:async () => jpeg()};};
    assert.equal((await fetchDocumentBlob('url','bill.jpg')).size,jpeg().size); assert.equal(calls,2);
});
test('does not retry authorization errors or download their response body', async () => {
    setup(); let calls=0;
    globalThis.fetch=async () => {calls++;return {ok:false,status:403,blob:async () => {throw new Error('Must not read');}};};
    await assert.rejects(fetchDocumentBlob('url','bill.jpg'),/HTTP 403/);assert.equal(calls,1);
});
test('browser fallback uses validated bytes and reports started, not saved', async () => {
    const {events}=setup(); delete window.showSaveFilePicker;
    let clicked=false, removed=false;
    globalThis.document={body:{appendChild(){}},createElement:()=>({click(){clicked=true;},remove(){removed=true;}})};
    const originalTimer=globalThis.setTimeout;
    globalThis.setTimeout=(fn,ms)=>{const timer=originalTimer(fn,ms);timer.unref();return timer;};
    try {await saveDocumentDownload('url','bill.jpg');} finally {globalThis.setTimeout=originalTimer;}
    assert.equal(clicked,true);assert.equal(removed,true);assert.equal(events[0].detail.saved,false);
});
