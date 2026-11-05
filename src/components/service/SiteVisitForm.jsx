import { useState } from 'react';
import { supabase } from '../../supabase';
import { tripError } from './tripLabels';

// The readings the technician takes at the site, every visit (volts).
export const READING_GROUPS = [
    ['AC', [['ac_pn', 'P–N'], ['ac_pe', 'P–E'], ['ac_ne', 'N–E']]],
    ['DC', [['dc_pm', '+ / −'], ['dc_pe', '+ / E'], ['dc_me', '− / E']]],
];
export const readingsText = readings => (readings
    ? `AC ${readings.ac_pn} · ${readings.ac_pe} · ${readings.ac_ne} V   DC ${readings.dc_pm} · ${readings.dc_pe} · ${readings.dc_me} V   Floating ${readings.floating ? 'yes' : 'no'}`
    : '');

const missing = failure => ['PGRST202', '42883'].includes(failure?.code) || /could not find the function/i.test(failure?.message || '');
const plain = failure => (missing(failure) ? 'Site readings are not set up yet. Tell the office.' : tripError(failure));
const label = 'text-xs font-bold uppercase tracking-wider text-stone-500';

// Saved readings, small.
export function ReadingsLine({ readings }) {
    if (!readings) return null;
    return <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
        {READING_GROUPS.map(([group, fields]) => <div key={group} className="contents"><dt className="font-bold text-stone-400">{group}</dt>
            <dd className="text-stone-700">{fields.map(([key, name]) => <span key={key} className="mr-3"><span className="text-stone-400">{name}</span> {readings[key]}</span>)}</dd></div>)}
        <dt className="font-bold text-stone-400">Float</dt><dd className="text-stone-700">{readings.floating ? 'Yes' : 'No'}</dd>
    </dl>;
}

// One visit at the site: readings first, then Fixed or Revisit needed.
// trip: the open trip ({ id, visit_no, readings, outcome, outcome_note }).
export default function SiteVisitForm({ trip, busy, run, onSaved }) {
    const [values, setValues] = useState({});
    const [floating, setFloating] = useState(null);
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState('');

    const keys = READING_GROUPS.flatMap(([, fields]) => fields.map(([key]) => key));
    const complete = keys.every(key => String(values[key] ?? '').trim() !== '') && floating !== null;

    const saveReadings = event => {
        event.preventDefault();
        if (!complete) return;
        run(async () => {
            const { error } = await supabase.rpc('service_save_readings', { p_trip_id: trip.id, p_readings: { ...values, floating } });
            if (error) throw new Error(plain(error));
            onSaved();
        }, 'Readings saved.', 'issue');
    };
    const mark = (outcome, why = null) => run(async () => {
        const { error } = await supabase.rpc('service_visit_outcome', { p_trip_id: trip.id, p_outcome: outcome, p_note: why });
        if (error) throw new Error(plain(error));
        setAsking(false); setNote('');
        onSaved();
    }, outcome === 'fixed' ? 'Marked fixed.' : 'Marked for a revisit.', 'issue');

    if (trip.outcome) {
        return <div className="space-y-2 border-t border-stone-100 pt-3">
            <p className="flex items-center gap-2 text-sm font-bold">
                <span className={`h-2 w-2 rounded-full ${trip.outcome === 'fixed' ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden="true" />
                {trip.outcome === 'fixed' ? 'Fixed' : 'Revisit needed'}
                {trip.outcome_note && <span className="font-normal text-stone-500">· {trip.outcome_note}</span>}
            </p>
            <ReadingsLine readings={trip.readings} />
        </div>;
    }

    if (!trip.readings) {
        return <form onSubmit={saveReadings} className="space-y-3 border-t border-stone-100 pt-3">
            <p className={label}>Readings · volts</p>
            {READING_GROUPS.map(([group, fields]) => <div key={group} className="grid grid-cols-[2rem_1fr_1fr_1fr] items-center gap-2">
                <span className="text-xs font-bold text-stone-400">{group}</span>
                {fields.map(([key, name]) => <label key={key} className="relative block">
                    <span className="pointer-events-none absolute left-2 top-1 text-[10px] font-bold text-stone-400">{name}</span>
                    <input value={values[key] ?? ''} aria-label={`${group} ${name}`} onChange={e => setValues(current => ({ ...current, [key]: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) }))}
                        inputMode="decimal" className="block w-full min-h-12 rounded-xl border border-stone-200 px-2 pb-1 pt-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </label>)}
            </div>)}
            <div className="grid grid-cols-[2rem_1fr] items-center gap-2">
                <span className="text-[10px] font-bold leading-tight text-stone-400">Float</span>
                <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1" role="group" aria-label="Floating voltage">
                    {[[true, 'Yes'], [false, 'No']].map(([value, text]) => <button key={text} type="button" onClick={() => setFloating(value)} aria-pressed={floating === value}
                        className={`min-h-10 rounded-lg text-sm font-bold ${floating === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{text}</button>)}
                </div>
            </div>
            <button disabled={busy || !complete} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Save readings</button>
        </form>;
    }

    return <div className="space-y-3 border-t border-stone-100 pt-3">
        <ReadingsLine readings={trip.readings} />
        <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={busy} onClick={() => mark('fixed')} className="min-h-12 rounded-xl bg-stone-900 px-3 text-sm font-bold text-white disabled:opacity-50">Fixed</button>
            <button type="button" disabled={busy} onClick={() => setAsking(!asking)} aria-pressed={asking}
                className={`min-h-12 rounded-xl border px-3 text-sm font-bold disabled:opacity-50 ${asking ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-stone-200 text-stone-700'}`}>Revisit</button>
        </div>
        {asking && <form onSubmit={event => { event.preventDefault(); if (note.trim()) mark('revisit', note.trim()); }} className="flex gap-2">
            <input required maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason, e.g. part to order" aria-label="Why is another visit needed?"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
            <button disabled={busy || !note.trim()} className="min-h-11 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Save</button>
        </form>}
    </div>;
}
