import test from 'node:test';
import assert from 'node:assert/strict';
import { latestByQuotation,loadWhatsAppStatuses,maskPhone,quotationFormData,sendQuotationOnWhatsApp,sentText,shortTime,statusLine } from '../../src/quotations/whatsapp.js';

const file = new File([new TextEncoder().encode('%PDF-1.3 test')],'Ramesh Kumar Patel.pdf',{ type:'application/pdf' });
const invoking = reply => {
    const calls = [];
    return { calls, functions:{ invoke:async (name,options) => { calls.push({ name,options }); return reply(); } } };
};
const httpError = (status,body) => ({ data:null, error:{ message:`Edge Function returned a non-2xx status code`, context:new Response(JSON.stringify(body),{ status, headers:{ 'Content-Type':'application/json' } }) } });

test('the upload carries the id, the version and the PDF',async () => {
    const form = quotationFormData({ quotationId:'q-1', file, updatedAt:'2026-10-12T10:00:00.1+00:00' });
    assert.equal(form.get('quotationId'),'q-1');
    assert.equal(form.get('updatedAt'),'2026-10-12T10:00:00.1+00:00');
    const sent = form.get('file');
    assert.equal(sent.name,'Ramesh Kumar Patel.pdf');
    assert.equal(sent.type,'application/pdf');
    assert.equal(new TextDecoder().decode(await sent.arrayBuffer()),'%PDF-1.3 test');
    assert.equal(quotationFormData({ quotationId:'q-1', file }).has('updatedAt'),false);
});

test('sending: 200 answers are returned as they are',async () => {
    const client = invoking(() => ({ data:{ ok:true, maskedPhone:'******3210', testMode:false }, error:null }));
    assert.deepEqual(await sendQuotationOnWhatsApp(client,{ quotationId:'q-1', file }),{ ok:true, maskedPhone:'******3210', testMode:false });
    assert.equal(client.calls[0].name,'whatsapp-send-quotation');
    assert.ok(client.calls[0].options.body instanceof FormData);
    const refused = invoking(() => ({ data:{ ok:false, code:'limit', error:'Try again in 5 minutes' }, error:null }));
    assert.equal((await sendQuotationOnWhatsApp(refused,{ quotationId:'q-1', file })).code,'limit');
});

test('sending: non-2xx answers become plain messages',async () => {
    const notFound = invoking(() => httpError(404,{ ok:false, code:'not_found', error:'This quotation was not found, or you cannot open it. Refresh the page.' }));
    assert.equal((await sendQuotationOnWhatsApp(notFound,{ quotationId:'q-1', file })).code,'not_found');
    const tooBig = invoking(() => httpError(400,{ error:'The quotation PDF is too big to send on WhatsApp (10 MB at most).' }));
    await assert.rejects(sendQuotationOnWhatsApp(tooBig,{ quotationId:'q-1', file }),/too big/);
    const offline = invoking(() => ({ data:null, error:{ name:'FunctionsFetchError', message:'Failed to send a request to the Edge Function' } }));
    await assert.rejects(sendQuotationOnWhatsApp(offline,{ quotationId:'q-1', file }),/Could not reach the server/);
    const odd = invoking(() => ({ data:'', error:null }));
    assert.equal((await sendQuotationOnWhatsApp(odd,{ quotationId:'q-1', file })).ok,false);
});

test('success text says where it went, and warns in test mode',() => {
    assert.equal(sentText({ ok:true, maskedPhone:'******3210', testMode:false }),'Sent on WhatsApp to ******3210');
    assert.match(sentText({ ok:true, maskedPhone:'******6780', testMode:true }),/test number \*\*\*\*\*\*6780, not to the customer/);
});

test('status line: newest per quotation, masked phone, India time',async () => {
    const rows = [
        { quotation_id:'a', status:'read', created_at:'2026-10-12T10:00:00Z', status_at:'2026-10-12T10:10:00Z', to_phone:'9876543210', test_mode:false },
        { quotation_id:'a', status:'failed', created_at:'2026-10-12T09:00:00Z', to_phone:'9876543210' },
        { quotation_id:'b', status:'failed', error_code:131026, created_at:'2026-10-12T18:45:00Z', to_phone:'9123456789', test_mode:false },
    ];
    const latest = latestByQuotation(rows);
    assert.equal(latest.a.status,'read');
    assert.deepEqual(statusLine(latest.a),{ text:'WhatsApp: Read by customer · ******3210 · 12 Oct, 3:40 pm', failed:false, read:true });
    assert.deepEqual(statusLine(latest.b),{ text:'WhatsApp: Not delivered (number not on WhatsApp) · ******6789 · 13 Oct, 12:15 am', failed:true, read:false });
    assert.equal(statusLine({ status:'sent', created_at:'2026-10-12T06:30:00Z', to_phone:'9123456780', test_mode:true }).text,'WhatsApp: Sent · test number · 12 Oct, 12:00 pm');
    assert.equal(statusLine(undefined),null);
    assert.equal(shortTime('nope'),'');
    assert.equal(maskPhone('98765 43210'),'******3210');
    assert.equal(maskPhone(null),'');
});

test('loading statuses never breaks the page',async () => {
    const query = result => {
        const q = { select:() => q, eq:() => q, in:(column,ids) => { q.ids = ids; return q; }, order:() => q, limit:() => q, then:(resolve,reject) => Promise.resolve(result()).then(resolve,reject) };
        return q;
    };
    let last;
    const client = { from:table => { assert.equal(table,'whatsapp_messages'); last = query(() => ({ data:[{ quotation_id:'a', status:'sent' }], error:null })); return last; } };
    assert.deepEqual(await loadWhatsAppStatuses(client,['a','a','b',null]),{ a:{ quotation_id:'a', status:'sent' } });
    assert.deepEqual(last.ids,['a','b']);
    assert.deepEqual(await loadWhatsAppStatuses(client,[]),{});
    const missing = { from:() => query(() => ({ data:null, error:{ code:'42P01', message:'relation "whatsapp_messages" does not exist' } })) };
    assert.deepEqual(await loadWhatsAppStatuses(missing,['a']),{});
    const broken = { from:() => { throw new Error('offline'); } };
    assert.deepEqual(await loadWhatsAppStatuses(broken,['a']),{});
});
