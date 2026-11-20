import { useCallback, useEffect, useState } from 'react';
import { Check, ClipboardList, FileDown, PackageCheck, Send, Share2, Trash2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { useGlobalPopup } from '../GlobalPopup';
import { canShareFiles, downloadOemClaimPdf, isTataClaim, shareOemClaimPdf } from './oemClaimPdf';
import { OEM_NAMES } from './OemPastRecords';
import TataClaimForm from './TataClaimForm';
import { mergeTataForm, tataFormProgress } from './tataServiceReport';

// OEM replacement claims on one complaint (client meeting 2026-11-14, D-033, D-038). For Tata
// (form from Sandeep, 2026-11-19) the PDF starts with Tata's own Field Service Report, filled in;
// the steps are the same for every OEM. Steps:
//   1 Claim started (office: OEM, part, faulty serial)  2 OEM data PDF sent  3 OEM ticket no.
//   4 New part received -> the technician fixes it on the second visit.
// Office (admin, sales) does every step; the technician on the open job sees the claim and can
// type the OEM ticket no. Table public.service_oem_claims (20261116140000).
// Tata (D-045, 2026-11-20): "Fill Tata form" opens the easy fill screen (TataClaimForm.jsx) for the
// office and the technician on the job: every box of Tata's form, the 6 readings with photos,
// then the PDF. The values are saved on the claim (form_values).

const PARTS = ['Inverter', 'Panel', 'Other'];
const COLUMNS = 'id, oem, part, faulty_serial, notes, pdf_sent_at, ticket_no, ticket_at, part_received_at, form_values, created_by_name, created_at';
const when = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '');
const missing = error => ['42P01', 'PGRST205', 'PGRST202', '42883'].includes(error?.code) || /does not exist|could not find/i.test(error?.message || '');
const input = 'min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300';
const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500';

// Where the claim is, in words.
export const claimStep = claim => (claim.part_received_at ? 'Part received – fix on the next visit'
    : claim.ticket_no ? 'Waiting for the new part' : claim.pdf_sent_at ? `Waiting for the ${isTataClaim(claim) ? 'Tata complaint' : 'OEM ticket'} no.`
        : isTataClaim(claim) ? 'Send the Tata service report' : 'Send the OEM data PDF');

function StartForm({ issue, busy, onSave, onCancel }) {
    const [form, setForm] = useState({ oem: '', part: 'Inverter', faulty_serial: '', notes: '' });
    const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
    // Start from the inverter on the customer card.
    useEffect(() => {
        if (!issue.customer_id) return undefined;
        let active = true;
        supabase.from('admin').select('inverter_make, inverter_serial_no').eq('id', issue.customer_id).maybeSingle().then(({ data }) => {
            if (active && data) setForm(current => ({ ...current, oem: current.oem || data.inverter_make || '', faulty_serial: current.faulty_serial || data.inverter_serial_no || '' }));
        });
        return () => { active = false; };
    }, [issue.customer_id]);
    return <form onSubmit={event => { event.preventDefault(); if (form.oem.trim()) onSave(form); }} className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/40 p-3">
        <div className="grid gap-3">
            <label><span className={label}>OEM (maker) *</span>
                <input required list="oem-claim-names" maxLength={80} value={form.oem} onChange={e => set('oem', e.target.value)} placeholder="e.g. Adani, Growatt" className={input} />
                <datalist id="oem-claim-names">{OEM_NAMES.map(name => <option key={name} value={name} />)}</datalist></label>
            <div><span className={label}>Faulty part *</span>
                <div className="grid grid-cols-3 rounded-xl bg-stone-100 p-1" role="group" aria-label="Faulty part">
                    {PARTS.map(part => <button key={part} type="button" aria-pressed={form.part === part} onClick={() => set('part', part)}
                        className={`min-h-9 rounded-lg text-sm font-bold ${form.part === part ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{part}</button>)}
                </div></div>
            <label><span className={label}>Faulty serial no.</span>
                <input maxLength={120} value={form.faulty_serial} onChange={e => set('faulty_serial', e.target.value)} className={input} /></label>
        </div>
        <label className="block"><span className={label}>What is wrong (goes in the PDF)</span>
            <textarea rows={2} maxLength={500} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="e.g. Inverter shows error 117, no output"
                className="w-full rounded-xl border border-stone-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" /></label>
        {isTataClaim(form) && <p className="rounded-lg bg-amber-100 p-2 text-xs font-semibold text-amber-900">Tata: after starting, press "Fill Tata form". Every box of Tata's Field Service Report is filled from this complaint, the customer card and the latest visit; check them, type the missing ones (sales order no., loads, array readings, customer's remarks) and the 6 readings with photos, then make the PDF. Battery boxes and both signatures stay blank.</p>}
        <div className="flex gap-2">
            <button disabled={busy || !form.oem.trim()} className="min-h-11 flex-1 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Start OEM claim</button>
            <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600">Cancel</button>
        </div>
    </form>;
}

function TicketForm({ claim, busy, onSave }) {
    const [ticket, setTicket] = useState('');
    return <form onSubmit={event => { event.preventDefault(); if (ticket.trim()) onSave(claim, ticket.trim()); }} className="flex gap-2">
        <input maxLength={80} value={ticket} onChange={e => setTicket(e.target.value)} placeholder={isTataClaim(claim) ? 'Tata complaint no.' : 'OEM ticket no.'} aria-label={`OEM ticket no. for the ${claim.oem} claim`}
            className={`${input} min-w-0 flex-1`} />
        <button disabled={busy || !ticket.trim()} className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Save</button>
    </form>;
}

function Steps({ claim }) {
    const steps = [['Claim started', claim.created_at], ['PDF sent to OEM', claim.pdf_sent_at], [claim.ticket_no ? `Ticket ${claim.ticket_no}` : 'OEM ticket no.', claim.ticket_at || (claim.ticket_no ? claim.created_at : null)], ['New part received', claim.part_received_at]];
    return <ol className="grid grid-cols-4 gap-1.5" aria-label="Claim steps">{steps.map(([name, at]) => <li key={name}>
        <span className={`block h-1 rounded-full ${at ? 'bg-emerald-500' : 'bg-stone-200'}`} />
        <span className={`mt-1 block text-[10px] font-bold leading-tight break-words ${at ? 'text-stone-800' : 'text-stone-400'}`}>{name}</span>
        {at && <span className="block text-[10px] text-stone-400">{when(at)}</span>}
    </li>)}</ol>;
}

// "14 of 22 filled" for a saved Tata form, from the saved values only (no database read).
const savedProgress = (issue, claim) => {
    if (!claim.form_values) return '';
    const { filled, total } = tataFormProgress(mergeTataForm({ issue, claim, saved: claim.form_values }));
    return `${filled} of ${total} filled`;
};

export default function OemClaims({ issue, office = false, technicianOnJob = false, technicianName = '', userId = null, userName = '', busy, run }) {
    const { showConfirm } = useGlobalPopup();
    const [claims, setClaims] = useState(null);
    const [ready, setReady] = useState(true);
    const [starting, setStarting] = useState(false);
    const [making, setMaking] = useState('');
    const [filling, setFilling] = useState(null); // the Tata claim whose form is open

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('service_oem_claims').select(COLUMNS).eq('issue_id', issue.id).order('created_at');
        if (error) { setReady(!missing(error)); setClaims([]); return; }
        setReady(true); setClaims(data || []);
    }, [issue.id]);
    // The complaint object changes on every 15-second refresh: reload with it.
    useEffect(() => { load(); }, [load, issue]);

    const active = ['open', 'assigned', 'completion_pending'].includes(issue.status);
    if (!ready || claims === null) return null;
    if (!claims.length && !(office && active)) return null;

    const step = (work, message) => run(async () => { await work(); await load(); }, message, 'issue');
    const start = form => step(async () => {
        const { error } = await supabase.from('service_oem_claims').insert({ issue_id: issue.id, oem: form.oem.trim(), part: form.part, faulty_serial: form.faulty_serial, notes: form.notes });
        if (error) throw error;
        setStarting(false);
    }, 'OEM claim started. Download the PDF and send it to the OEM.');
    const change = (claim, values, message) => step(async () => {
        const { error } = await supabase.from('service_oem_claims').update(values).eq('id', claim.id);
        if (error) throw error;
    }, message);
    const saveTicket = (claim, ticket) => office
        ? change(claim, { ticket_no: ticket }, 'OEM ticket no. saved.')
        : step(async () => {
            const { error } = await supabase.rpc('service_oem_ticket', { p_claim_id: claim.id, p_ticket: ticket });
            if (error) throw error;
        }, 'OEM ticket no. saved.');
    const remove = async claim => {
        if (!await showConfirm(`Delete the ${claim.oem} ${claim.part.toLowerCase()} claim? Its steps stay in the complaint history.`, { title: 'Delete OEM claim?', confirmLabel: 'Delete', cancelLabel: 'Keep', type: 'warning' })) return;
        step(async () => {
            const { error } = await supabase.from('service_oem_claims').delete().eq('id', claim.id);
            if (error) throw error;
        }, 'OEM claim deleted.');
    };
    // One PDF with every value and every photo: download it, or share it (phone share sheet).
    const pdf = async (claim, how) => {
        setMaking(`${how}:${claim.id}`);
        try {
            await run(async () => {
                const tata = isTataClaim(claim);
                const what = tata ? 'Tata field service report' : 'OEM data PDF';
                const fill = tata ? ' Fill the blank boxes and the signatures by hand.' : '';
                if (how === 'share') { if (!await shareOemClaimPdf({ issue, claim, technicianName })) return ''; return `${what} shared.${fill} When ${tata ? 'Tata has' : 'the OEM has'} it, press "PDF sent".`; }
                await downloadOemClaimPdf({ issue, claim, technicianName });
                return `${what} downloaded.${fill} Send it to ${tata ? 'Tata' : 'the OEM'}, then press "PDF sent".`;
            }, '', 'issue');
        } finally { setMaking(''); }
    };
    const sharing = canShareFiles();

    const small = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 disabled:opacity-50';
    return <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4" aria-label="OEM replacement">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">OEM replacement {claims.length ? `· ${claims.length}` : ''}</h3>
            {office && active && !starting && <button type="button" disabled={busy} onClick={() => setStarting(true)} className={small}>Part faulty? Start OEM claim</button>}
        </div>
        {!claims.length && !starting && <p className="text-xs text-stone-500">If the technician finds a part faulty (e.g. the inverter), start an OEM claim. The app makes the PDF for the OEM.</p>}
        {starting && <StartForm issue={issue} busy={busy} onSave={start} onCancel={() => setStarting(false)} />}
        {claims.map(claim => <article key={claim.id} className="space-y-3 rounded-xl border border-stone-200 p-3">
            <div className="space-y-1">
                <p className="text-sm font-bold text-stone-900 break-words">{claim.part} · {claim.oem}</p>
                <p className="text-xs text-stone-500 break-words">{[claim.faulty_serial && `Faulty ${claim.faulty_serial}`, office && claim.created_by_name && `started by ${claim.created_by_name}`].filter(Boolean).join(' · ')}</p>
                <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${claim.part_received_at ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'}`}>{claimStep(claim)}</span>
            </div>
            <Steps claim={claim} />
            {claim.notes && <p className="text-xs text-stone-600 whitespace-pre-line break-words">{claim.notes}</p>}
            {isTataClaim(claim) && (office || technicianOnJob) && <button type="button" disabled={busy} onClick={() => setFilling(claim)}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-white disabled:opacity-50">
                <ClipboardList size={16} aria-hidden="true" /> {claim.form_values ? `Tata form · ${savedProgress(issue, claim)}` : 'Fill Tata form'}
            </button>}
            {(office || technicianOnJob) && active && !claim.ticket_no && <TicketForm claim={claim} busy={busy} onSave={saveTicket} />}
            {office && <div className="flex flex-wrap gap-2">
                {sharing && <button type="button" disabled={busy || Boolean(making)} onClick={() => pdf(claim, 'share')} className={small}><Share2 size={14} /> {making === `share:${claim.id}` ? 'Making PDF…' : isTataClaim(claim) ? 'Share Tata report' : 'Share OEM PDF'}</button>}
                <button type="button" disabled={busy || Boolean(making)} onClick={() => pdf(claim, 'download')} className={small}><FileDown size={14} /> {making === `download:${claim.id}` ? 'Making PDF…' : isTataClaim(claim) ? 'Download Tata report' : 'Download OEM PDF'}</button>
                {active && !claim.pdf_sent_at && <button type="button" disabled={busy} onClick={() => change(claim, { pdf_sent_at: new Date().toISOString() }, 'Marked as sent to the OEM.')} className={small}><Send size={14} /> PDF sent</button>}
                {active && claim.ticket_no && !claim.part_received_at && <button type="button" disabled={busy} onClick={() => change(claim, { part_received_at: new Date().toISOString() }, 'New part received. The technician can fix it on the next visit.')} className={small}><PackageCheck size={14} /> New part received</button>}
                {claim.part_received_at && <span className="inline-flex min-h-10 items-center gap-1 px-1 text-xs font-bold text-emerald-700"><Check size={14} /> Ready for the technician</span>}
                <button type="button" disabled={busy} onClick={() => remove(claim)} aria-label={`Delete the ${claim.oem} claim`} className="ml-auto inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-bold text-stone-400 hover:text-red-700 disabled:opacity-50"><Trash2 size={14} /> Delete</button>
            </div>}
            {technicianOnJob && !office && claim.part_received_at && <p className="rounded-lg bg-emerald-50 p-2 text-xs font-semibold text-emerald-800">The new {claim.part.toLowerCase()} has arrived. Fit it on this visit; if it is the inverter, add the new number under Inverter.</p>}
        </article>)}
        {filling && <TataClaimForm issue={issue} claim={claims.find(claim => claim.id === filling.id) || filling}
            canEdit={(office || technicianOnJob) && active} canAddPhotos={technicianOnJob && active && Boolean(userId)} office={office}
            userId={userId} userName={userName} technicianName={technicianName} onClose={() => setFilling(null)} onSaved={load} />}
    </section>;
}
