import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { formatDateTime } from './serviceLabels';

const KIND_LABELS = {
    completion_code: 'Completion code',
    completion_notice: 'Job done message',
    vendor_lead: 'Lead to vendor',
    quotation: 'Quotation'
};
const STATUS_LABELS = { sending: 'Sending', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed' };
const STATUS_PILL = {
    sending: 'bg-stone-100 text-stone-700',
    sent: 'bg-sky-100 text-sky-800',
    delivered: 'bg-green-100 text-green-800',
    read: 'bg-green-600 text-white',
    failed: 'bg-red-100 text-red-800'
};
const masked = phone => (phone ? `******${String(phone).slice(-4)}` : '—');
// The log tables come with the WhatsApp SQL; until it is run, show nothing.
const missingTable = error => ['PGRST205', '42P01'].includes(error?.code) || /could not find the table/i.test(error?.message || '');

// Office view of WhatsApp messages sent for one complaint (code, job done
// message) and what the customer replied. Refreshed every 30 s for delivery ticks.
export default function WhatsAppLog({ issueId }) {
    const [sent, setSent] = useState(null);
    const [replies, setReplies] = useState([]);
    const [error, setError] = useState('');
    const [missing, setMissing] = useState(false);

    useEffect(() => {
        let active = true;
        const load = async () => {
            const [messages, inbound] = await Promise.all([
                supabase.from('whatsapp_messages').select('id, kind, to_phone, test_mode, status, error_code, error_text, status_at, created_at')
                    .eq('issue_id', issueId).order('created_at', { ascending: false }).limit(20),
                supabase.from('whatsapp_inbound').select('id, message_type, body, button_text, received_at')
                    .eq('issue_id', issueId).order('received_at', { ascending: false }).limit(20)
            ]);
            if (!active) return;
            if (missingTable(messages.error)) { setMissing(true); return; }
            setMissing(false);
            const failure = messages.error || inbound.error;
            setError(failure ? failure.message || 'Could not load WhatsApp messages.' : '');
            if (!messages.error) setSent(messages.data || []);
            if (!inbound.error) setReplies(inbound.data || []);
        };
        load();
        const timer = setInterval(load, 30000);
        return () => { active = false; clearInterval(timer); };
    }, [issueId]);

    if (missing) return null;
    return <div className="border-t pt-3 space-y-2">
        <h3 className="text-sm font-bold">WhatsApp</h3>
        {error && <p role="alert" className="text-xs text-red-700">Could not load WhatsApp messages: {error}</p>}
        {sent !== null && sent.length === 0 && replies.length === 0 && !error && <p className="text-xs text-stone-500">No WhatsApp messages for this complaint yet.</p>}
        {(sent || []).map(row => <div key={row.id} className="rounded-lg bg-stone-50 p-2 text-xs">
            <p className="flex flex-wrap items-center gap-1.5"><strong>{KIND_LABELS[row.kind] || row.kind}</strong>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_PILL[row.status] || STATUS_PILL.sending}`}>{STATUS_LABELS[row.status] || row.status}</span>
                <span>to {masked(row.to_phone)}{row.test_mode ? ' (test number)' : ''}</span></p>
            <p className="text-stone-500">{formatDateTime(row.status_at || row.created_at)}</p>
            {row.status === 'failed' && <p className="text-red-700">{row.error_text || 'Not delivered.'}{row.error_code ? ` (code ${row.error_code})` : ''}</p>}
        </div>)}
        {replies.map(row => {
            const text = row.button_text || row.body || `(${row.message_type})`;
            const notSolved = /not\s*solved/i.test(row.button_text || '');
            return <div key={row.id} className={`rounded-lg p-2 text-xs ${notSolved ? 'bg-amber-100 text-amber-950' : 'bg-green-50 text-green-950'}`}>
                <p><strong>Customer replied:</strong> <span className="whitespace-pre-wrap break-words">{text}</span></p>
                <p className="text-stone-500">{formatDateTime(row.received_at)}</p>
            </div>;
        })}
    </div>;
}
