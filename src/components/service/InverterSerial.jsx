import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { inverterSerialMissing } from './serviceLabels';

const SAVED_EVENT = 'service-inverter-saved';
const missingFunction = failure => failure?.code === 'PGRST202' || failure?.code === '42883' || /could not find the function/i.test(failure?.message || '');

// Tells every inverter box of this job (Work and Customer tabs) to read the card again.
export const announceInverterSaved = issueId => window.dispatchEvent(new CustomEvent(SAVED_EVENT, { detail: issueId }));
export function useInverterSaved(issueId, onSaved) {
    useEffect(() => {
        const heard = event => { if (event.detail === issueId) onSaved(); };
        window.addEventListener(SAVED_EVENT, heard);
        return () => window.removeEventListener(SAVED_EVENT, heard);
        // onSaved is a fresh arrow each render; the issue id is what matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueId]);
}

// The inverter make and serial of the job's customer card, for the technician's Work tab.
// state: { loaded, failed, linked, make, serial }. A failed read holds nothing back here
// (the server checks again before the OTP).
export function useJobInverter(issue) {
    const [state, setState] = useState({ loaded: false, failed: false, linked: Boolean(issue.customer_id), make: '', serial: '' });
    const [reload, setReload] = useState(0);
    useInverterSaved(issue.id, () => setReload(n => n + 1));
    const issueKey = `${issue.id}:${issue.updated_at || ''}:${issue.customer_id || ''}`;
    useEffect(() => {
        let active = true;
        if (!issue.customer_id) { setState({ loaded: true, failed: false, linked: false, make: '', serial: '' }); return undefined; }
        supabase.rpc('service_job_customer', { p_issue_id: issue.id }).then(({ data, error }) => {
            if (!active) return;
            if (error) { setState(s => ({ ...s, loaded: true, failed: true })); return; }
            const row = data?.[0] || {};
            setState({ loaded: true, failed: false, linked: true, make: row.inverter_make || '', serial: row.inverter_serial_no || '' });
        }, () => { if (active) setState(s => ({ ...s, loaded: true, failed: true })); });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueKey, reload]);
    return { ...state, reload: () => setReload(n => n + 1), missing: state.loaded && !state.failed && inverterSerialMissing(state.serial) };
}

// Inverter make and serial on the customer card, with "Add serial number" when the card has
// none and "Inverter replaced?" when it has one (the old number stays in the history).
// canEdit: the technician's own open job.
export default function InverterSerial({ issue, make, serial, linked = true, canEdit = false, busy = false, run = null, compact = false }) {
    const [mode, setMode] = useState(null); // null | 'add' | 'replace'
    const [newSerial, setNewSerial] = useState('');
    const [newMake, setNewMake] = useState('');
    const missing = inverterSerialMissing(serial);
    const shown = [make, missing ? '' : serial].filter(Boolean).join(' · ');
    const editable = canEdit && linked && run;

    const open = next => { setMode(next); setNewSerial(''); setNewMake(next === 'replace' ? make || '' : ''); };
    const save = event => {
        event.preventDefault();
        const typed = newSerial.trim();
        if (!typed || inverterSerialMissing(typed)) return;
        const replacing = mode === 'replace';
        run(async () => {
            const { data, error } = await supabase.rpc(replacing ? 'service_replace_inverter' : 'service_add_inverter',
                { p_issue_id: issue.id, p_serial: typed, p_make: newMake.trim() || null });
            if (error) throw new Error(missingFunction(error) ? 'Saving the inverter number is not set up yet. Tell the office.' : error.message);
            setMode(null);
            announceInverterSaved(issue.id);
            if (replacing) return 'New inverter number saved. The old one is kept in the history.';
            return data ? 'Inverter number saved on the customer card.' : 'The customer card already has an inverter number.';
        }, '', 'issue');
    };

    const input = 'block w-full min-h-11 rounded-xl border border-stone-200 px-3 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-amber-300';
    const form = mode && <form onSubmit={save} className="mt-2 space-y-2">
        {mode === 'replace' && <p className="text-xs text-stone-500">Old number {serial} stays in the history.</p>}
        <input required autoFocus maxLength={60} value={newSerial} onChange={e => setNewSerial(e.target.value.toUpperCase())} autoCapitalize="characters"
            placeholder={mode === 'replace' ? 'New serial number' : 'Serial number'} aria-label={mode === 'replace' ? 'New inverter serial number' : 'Inverter serial number'} className={`${input} font-mono`} />
        {(mode === 'replace' || !make) && <input maxLength={60} value={newMake} onChange={e => setNewMake(e.target.value)} placeholder="Make (optional)" aria-label="Inverter make" className={input} />}
        <div className="flex gap-2">
            <button disabled={busy || !newSerial.trim() || inverterSerialMissing(newSerial)} className="min-h-11 flex-1 rounded-xl bg-stone-900 px-3 text-sm font-bold text-white disabled:opacity-40">Save</button>
            <button type="button" onClick={() => setMode(null)} className="min-h-11 rounded-xl px-3 text-sm font-bold text-stone-500">Cancel</button>
        </div>
    </form>;

    const value = <>
        {missing
            ? <span className={compact ? '' : 'font-semibold text-amber-800'}>{make ? `${make} · ` : ''}No serial number</span>
            : <span className="font-mono">{shown}</span>}
        {editable && !mode && <button type="button" disabled={busy} onClick={() => open(missing ? 'add' : 'replace')}
            className="ml-2 min-h-11 text-sm font-bold text-amber-600 hover:text-amber-700 disabled:opacity-50">{missing ? '+ Add serial number' : 'Inverter replaced?'}</button>}
        {form}
    </>;
    if (compact) return <div>{value}</div>;
    return <section aria-label="Inverter" className={`rounded-2xl border p-3 text-sm ${missing ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'}`}>
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Inverter</h3>
        {linked ? <div className="mt-1">{value}</div>
            : <p className="mt-1 text-amber-900">This complaint has no customer card, so the inverter number cannot be saved. Ask the office to close this job.</p>}
    </section>;
}
