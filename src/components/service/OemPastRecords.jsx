import { useEffect, useState } from 'react';
import { FileClock } from 'lucide-react';
import { supabase } from '../../supabase';
import { READING_GROUPS } from './SiteVisitForm';

// One past visit from the paper files (public.oem_past_records): a date if the paper has one,
// the site readings, a replacement if there was one (default None) and comments.
// part = the replacement: None, Inverter, Panel or Other (another part).
export const REPLACEMENTS = ['None', 'Inverter', 'Panel', 'Other'];
export const REPLACEMENT_TEXT = { None: 'None', Inverter: 'Inverter', Panel: 'Panel', Other: 'Other part' };
export const isReplacement = part => Boolean(part) && part !== 'None';
// Title of a saved entry: "Past visit", or "Past visit · Inverter replaced".
export const entryTitle = row => (isReplacement(row.part) ? `Past visit · ${REPLACEMENT_TEXT[row.part] || row.part} replaced` : 'Past visit');
export const serialLabels = part => (part === 'Inverter' ? ['Old inverter no.', 'New inverter no.']
    : part === 'Panel' ? ['Old panel no.', 'New panel no.'] : ['Old part no.', 'New part no.']);
export const OEM_NAMES = ['Tata Power', 'Adani', 'Waaree', 'Growatt', 'Sungrow', 'Goodwe', 'Solis', 'Havells'];
export const READING_KEYS = READING_GROUPS.flatMap(([, fields]) => fields.map(([key]) => key));

export const oemDay = value => (value ? new Date(`${value}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : 'No date');
export const hasReadings = readings => Boolean(readings) && (READING_KEYS.some(key => String(readings[key] ?? '').trim() !== '') || typeof readings.floating === 'boolean');

// Readings as short lines: AC Pos–Neg 231 · Pos–Earth 233 · Neg–Earth 2 V. Blank ones are left out.
export function PastReadings({ readings }) {
    if (!hasReadings(readings)) return null;
    const value = key => String(readings[key] ?? '').trim();
    return <span className="block text-stone-700 break-words">
        {READING_GROUPS.map(([group, fields]) => {
            const shown = fields.filter(([key]) => value(key));
            return shown.length ? <span key={group} className="block"><b className="text-stone-400">{group}</b> {shown.map(([key, name]) => `${name} ${value(key)}`).join(' · ')} V</span> : null;
        })}
        {typeof readings.floating === 'boolean' && <span className="block"><b className="text-stone-400">Float</b> {readings.floating ? 'Yes' : 'No'}</span>}
    </span>;
}

// One past visit: title, date (+ OEM, ticket), readings, replacement old → new, comments.
export function OemPastLine({ row }) {
    const [oldLabel, newLabel] = serialLabels(row.part);
    const replaced = isReplacement(row.part);
    return <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block font-semibold text-stone-800 break-words">{entryTitle(row)}</span>
        <span className="block text-stone-500 break-words">{[oemDay(row.claim_date), replaced && row.oem, replaced && row.ticket_no && `Ticket ${row.ticket_no}`].filter(Boolean).join(' · ')}</span>
        <PastReadings readings={row.readings} />
        {replaced && (row.old_serial || row.new_serial) && <span className="block text-stone-700 break-words">
            <span className="mr-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">Replaced</span>
            {oldLabel} <b>{row.old_serial || '—'}</b> → {newLabel} <b>{row.new_serial || '—'}</b></span>}
        {row.notes && <span className="block text-stone-500 whitespace-pre-line break-words">{row.notes}</span>}
    </span>;
}

// Past visits typed in from the paper files, read-only.
// issueId: through the complaint (anyone who can see it); customerId: office only.
// Shows nothing when there are none or they cannot be read.
export default function OemPastRecords({ issueId = null, customerId = null, className = '' }) {
    const [rows, setRows] = useState(null);
    useEffect(() => {
        if (!issueId && !customerId) { setRows([]); return undefined; }
        let active = true;
        const read = issueId
            ? supabase.rpc('service_customer_oem_past', { p_issue_id: issueId })
            : supabase.from('oem_past_records').select('id, oem, part, claim_date, ticket_no, old_serial, new_serial, readings, notes')
                .eq('customer_id', customerId).order('claim_date', { ascending: false, nullsFirst: false }).limit(50);
        read.then(({ data, error }) => { if (active) setRows(error ? [] : data || []); });
        return () => { active = false; };
    }, [issueId, customerId]);
    if (!rows?.length) return null;
    return <section className={`space-y-2 ${className}`}>
        <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-stone-500">
            <FileClock size={13} aria-hidden="true" /> Past visits (paper file) · {rows.length}</h3>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">{rows.map(row => <li key={row.id} className="flex gap-3 p-2.5 text-xs">
            <OemPastLine row={row} />
        </li>)}</ul>
    </section>;
}
