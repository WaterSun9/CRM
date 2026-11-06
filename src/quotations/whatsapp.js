// Sending a quotation PDF to the customer on WhatsApp (edge function
// whatsapp-send-quotation). The PDF is made exactly as for Download; the function
// checks who is asking (quotations RLS) and sends it through Meta.
// Plain module (the Supabase client is passed in) so node tests can run it.

// false hides the WhatsApp button everywhere in Quotation Maker.
// Switch on when WhatsApp is live (WA_ENABLED=true).
export const WHATSAPP_QUOTATION_ENABLED = false;

const STATUS_TEXT = { sending:'Sending', sent:'Sent', delivered:'Delivered', read:'Read by customer', failed:'Not delivered' };
// Meta error codes the salesperson can act on; anything else is just "Not delivered".
const FAILED_REASON = {
    131026:'number not on WhatsApp',
    131030:'number not on the test list',
    131042:'WhatsApp payment not set up',
    131049:'Meta held it back, try again tomorrow',
    132001:'message not approved yet',
};
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NO_SERVER = 'Could not reach the server. Check the internet connection and try again.';

export const maskPhone = phone => {
    const digits = String(phone ?? '').replace(/\D/g,'');
    return digits.length >= 4 ? `******${digits.slice(-4)}` : '';
};

export function quotationFormData({ quotationId, file, updatedAt }) {
    const form = new FormData();
    form.append('quotationId', quotationId);
    // Lets the server refuse a PDF made from an older copy of the quotation.
    if (updatedAt) form.append('updatedAt', String(updatedAt));
    form.append('file', file, file.name || 'Quotation.pdf');
    return form;
}

// Business-rule answers come back as 200 { ok:false, code, error }; a non-2xx reply is
// read for its { error } text. Network trouble becomes a thrown Error with a plain message.
export async function sendQuotationOnWhatsApp(client, { quotationId, file, updatedAt }) {
    const { data, error } = await client.functions.invoke('whatsapp-send-quotation', { body:quotationFormData({ quotationId, file, updatedAt }) });
    if (!error) return data && typeof data === 'object' ? data : { ok:false, code:'send_failed', error:'The server gave an unexpected answer. Please try again.' };
    let detail = error.message || 'The WhatsApp service did not answer.';
    try {
        const payload = await error.context?.json?.();
        if (payload?.ok === false && payload.error) return payload;
        detail = payload?.error || payload?.message || detail;
    } catch {
        // Keep the original Supabase error message.
    }
    if (/failed to send a request|failed to fetch|functionsfetcherror|networkerror|load failed/i.test(detail)) detail = NO_SERVER;
    throw new Error(detail);
}

// "Sent on WhatsApp to ******3210", with a warning while Meta's test number is in use.
export function sentText(result) {
    const to = result?.maskedPhone || 'the customer';
    return result?.testMode
        ? `Test mode: sent on WhatsApp to the test number ${to}, not to the customer.`
        : `Sent on WhatsApp to ${to}`;
}

// Newest message per quotation from whatsapp_messages rows sorted newest first.
export function latestByQuotation(rows) {
    const latest = {};
    for (const row of rows || []) if (row?.quotation_id && !latest[row.quotation_id]) latest[row.quotation_id] = row;
    return latest;
}

// Last WhatsApp send for each quotation id. RLS shows admin / sales every row and others
// their own sends. Never throws: before the WhatsApp tables exist this is simply empty.
export async function loadWhatsAppStatuses(client, ids) {
    const list = [...new Set((ids || []).filter(Boolean))];
    if (!list.length) return {};
    try {
        const { data, error } = await client.from('whatsapp_messages')
            .select('quotation_id,status,created_at,status_at,error_code,to_phone,test_mode')
            .eq('kind','quotation').in('quotation_id',list)
            .order('created_at',{ ascending:false }).limit(Math.min(1000,list.length * 10));
        if (error) return {};
        return latestByQuotation(data);
    } catch {
        return {};
    }
}

// 2026-10-12T10:10:00Z -> "12 Oct, 3:40 pm" (India time, the same for every viewer).
export function shortTime(iso) {
    const ms = Date.parse(iso || '');
    if (!Number.isFinite(ms)) return '';
    const ist = new Date(ms + 330 * 60 * 1000);
    const h = ist.getUTCHours(), m = ist.getUTCMinutes();
    return `${ist.getUTCDate()} ${MONTHS[ist.getUTCMonth()]}, ${h % 12 || 12}:${String(m).padStart(2,'0')} ${h < 12 ? 'am' : 'pm'}`;
}

// One line for the card / preview, e.g. "WhatsApp: Delivered · ******3210 · 12 Oct, 3:40 pm".
export function statusLine(entry) {
    if (!entry?.status) return null;
    const failed = entry.status === 'failed';
    const reason = failed && FAILED_REASON[entry.error_code];
    const parts = [
        `WhatsApp: ${STATUS_TEXT[entry.status] || entry.status}${reason ? ` (${reason})` : ''}`,
        entry.test_mode ? 'test number' : maskPhone(entry.to_phone),
        shortTime(entry.status_at || entry.created_at),
    ].filter(Boolean);
    return { text:parts.join(' · '), failed, read:entry.status === 'read' };
}
