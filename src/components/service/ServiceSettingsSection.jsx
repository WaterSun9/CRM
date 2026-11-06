import { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { supabase } from '../../supabase';
import { KmSettingsPanel } from './kmSettings';
import { cleanMobile } from './serviceLabels';

const missingPhone = failure => /phone/.test(failure?.message || '') && ['PGRST204', '42703'].includes(failure?.code);

// Phone number of each channel partner (metadata.phone), shown on their customers'
// complaints so the office and the technician can call the partner.
function PartnerPhones({ busy, run }) {
    const [rows, setRows] = useState(null);
    const [failed, setFailed] = useState('');
    const [typed, setTyped] = useState({});
    const [search, setSearch] = useState('');
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let active = true;
        supabase.from('metadata').select('id, label, phone').eq('category', 'channel_partner').order('label').then(({ data, error }) => {
            if (!active) return;
            if (error) setFailed(missingPhone(error) ? 'Partner phone numbers are not set up yet. Run the 26 Oct database update first.' : error.message);
            else { setRows(data || []); setFailed(''); }
        });
        return () => { active = false; };
    }, [reload]);

    const save = row => run(async () => {
        const text = typed[row.id] ?? '';
        const phone = text.trim() ? cleanMobile(text) : null;
        if (text.trim() && !phone) throw new Error('Enter a 10-digit mobile number starting with 6, 7, 8 or 9.');
        const { data, error } = await supabase.from('metadata').update({ phone }).eq('id', row.id).select('id');
        if (error) throw new Error(missingPhone(error) ? 'Partner phone numbers are not set up yet.' : error.message);
        if (!data?.length) throw new Error('Only Admin or Office can change partner phone numbers.');
        setTyped(map => { const next = { ...map }; delete next[row.id]; return next; });
        setReload(n => n + 1);
    }, `Phone saved for ${row.label}.`);

    const shown = (rows || []).filter(row => row.label?.toLowerCase().includes(search.trim().toLowerCase()));
    return <details className="rounded-xl border bg-white p-3">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Channel partner phone numbers</summary>
        <p className="text-xs text-stone-500">Shown on every complaint of the partner's customers, with a Call link.</p>
        {failed && <p role="alert" className="mt-2 text-xs text-red-700">{failed}</p>}
        {rows && <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search partner…" className="mt-2 block w-full min-h-11 rounded-lg border p-2 text-sm" />}
        <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto">{shown.map(row => {
            const value = typed[row.id] ?? (row.phone || '');
            return <li key={row.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2 text-sm">
                <span className="min-w-0 flex-1 break-words font-semibold">{row.label}</span>
                <input type="tel" inputMode="numeric" value={value} onChange={e => setTyped(map => ({ ...map, [row.id]: e.target.value }))} placeholder="Mobile number" aria-label={`Phone of ${row.label}`} className="min-h-11 w-40 rounded-lg border p-2" />
                <button type="button" disabled={busy || typed[row.id] === undefined} onClick={() => save(row)} className="min-h-11 rounded-lg bg-stone-900 px-3 text-xs font-bold text-white disabled:opacity-40">Save</button>
            </li>;
        })}</ul>
    </details>;
}

// Operations > Complaints and travel: km rate (moved here from the Complaints page)
// and partner phone numbers.
export default function ServiceSettingsSection({ user }) {
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    const run = async (action, success) => {
        if (busy) return;
        setBusy(true); setMessage(null);
        try { const text = await action(); setMessage({ ok: true, text: text || success }); }
        catch (failure) { setMessage({ ok: false, text: failure.message || 'Could not save.' }); }
        finally { setBusy(false); }
    };
    return <div className="space-y-3">
        <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
            <Wrench className="w-4 h-4 text-stone-700" />
            <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Complaints and travel</h3>
        </div>
        {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-3 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        <div className="grid gap-3 lg:grid-cols-2">
            <KmSettingsPanel user={user} busy={busy} run={run} open />
            <PartnerPhones busy={busy} run={run} />
        </div>
    </div>;
}
