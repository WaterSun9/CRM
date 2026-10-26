import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { TRIP_ROAD_FACTOR } from '../../constants';
import { estimateRouteKm } from '../../utils/tripKm';
import { TripTypeChoice, kmAmount, useKmSettings } from './kmSettings';
import { combinedVisitRows, ticketLabel, todayLocal } from './serviceLabels';
import { isPincode, pincodeInText, pincodePoints } from './tripLabels';

const RECENT_DAYS = 30;

// Office form for one trip to several houses: the technician of this complaint went on
// to other complaints of theirs in the same trip. Km = start -> each house in order
// (-> back), with the grace km once. Saved as one visit per complaint with the same
// trip_group; the first carries the whole km and amount, the others 0.
export default function CombinedVisitForm({ issue, issues, user, busy, run, onSaved }) {
    const [open, setOpen] = useState(false);
    const [chosen, setChosen] = useState([]);
    const [startPin, setStartPin] = useState('');
    const [points, setPoints] = useState(null);
    const [date, setDate] = useState(todayLocal);
    const [roundTripChoice, setRoundTripChoice] = useState(null);
    const [typedKm, setTypedKm] = useState(null);
    const [kmNote, setKmNote] = useState('');
    const [typedRate, setTypedRate] = useState(null);
    const [typedAmount, setTypedAmount] = useState(null);
    const [note, setNote] = useState('');
    const { status: kmStatus, settings } = useKmSettings();
    const roundTrip = roundTripChoice ?? settings.round_trip;
    const rate = typedRate ?? String(settings.rate_per_km || '');

    const since = Date.now() - RECENT_DAYS * 86400000;
    const others = issues.filter(row => row.id !== issue.id && row.assigned_to === issue.assigned_to
        && (['assigned', 'completion_pending'].includes(row.status) || (row.status === 'completed' && Date.parse(row.completed_at || '') >= since)));

    useEffect(() => {
        if (!open) return undefined;
        let active = true;
        pincodePoints().then(data => { if (active) setPoints(data); }, () => {});
        // The start of the technician's latest trip on this complaint, as a pincode.
        supabase.from('service_trips').select('start_pincode').eq('issue_id', issue.id).eq('technician_id', issue.assigned_to)
            .order('started_at', { ascending: false }).limit(1)
            .then(({ data }) => { if (active && isPincode(data?.[0]?.start_pincode)) setStartPin(pin => pin || data[0].start_pincode); });
        return () => { active = false; };
    }, [open, issue.id, issue.assigned_to]);

    if (!others.length) return null;
    if (!open) return <button type="button" onClick={() => setOpen(true)} className="min-h-11 w-full rounded-lg border border-dashed px-3 text-xs font-bold">Combine with other houses on the same trip</button>;

    const route = [issue, ...chosen.map(id => issues.find(row => row.id === id)).filter(Boolean)];
    const stops = route.map(row => ({ pincode: pincodeInText(row.service_address), label: `${ticketLabel(row)} ${pincodeInText(row.service_address) || '(no pincode)'}` }));
    const missing = route.filter((row, i) => !stops[i].pincode);
    let estimate = null;
    try { estimate = points && isPincode(startPin) && chosen.length && !missing.length ? estimateRouteKm({ start: { pincode: startPin }, stops, points, roundTrip, graceKm: settings.grace_km }) : null; } catch { estimate = null; }
    const shownKm = typedKm ?? (estimate ? String(estimate.km) : '');
    const kmChanged = Boolean(estimate) && shownKm !== '' && Number(shownKm) !== estimate.km;
    const autoAmount = kmAmount(shownKm, rate);
    const shownAmount = typedAmount ?? (autoAmount ? String(autoAmount) : '');
    const toggle = id => { setChosen(list => (list.includes(id) ? list.filter(x => x !== id) : [...list, id])); setTypedKm(null); setKmNote(''); };

    const save = event => {
        event.preventDefault();
        run(async () => {
            if (!chosen.length) throw new Error('Tick at least one other complaint on this trip.');
            const km = Number(shownKm);
            if (shownKm === '' || !Number.isFinite(km) || km < 0) throw new Error('Enter the km of the whole trip.');
            if (kmChanged && !kmNote.trim()) throw new Error('Write why the km is different from the estimate.');
            const rateValue = rate === '' ? 0 : Number(rate);
            if (!Number.isFinite(rateValue) || rateValue < 0 || rateValue > 1000) throw new Error('Rate per km must be between ₹0 and ₹1000.');
            const amount = Number(shownAmount);
            if (shownAmount === '' || !Number.isFinite(amount) || amount < 0) throw new Error('Enter the amount.');
            const group = crypto.randomUUID();
            const tickets = route.map(ticketLabel).filter(Boolean).join(', ');
            const text = [note.trim(), `Combined trip: ${tickets}`].filter(Boolean).join(' · ').slice(0, 1000);
            const rows = combinedVisitRows(route.map(row => row.id), { km, amount }).map((row, i) => ({
                ...row, technician_id: issue.assigned_to, entered_by: user.id, visit_date: date, note: text, trip_group: group,
                ...(i === 0 && estimate ? { km_estimate: estimate.km } : {}),
                ...(i === 0 && kmChanged ? { km_note: kmNote.trim().slice(0, 300) } : {}),
                ...(kmStatus === 'ready' ? { round_trip: roundTrip, grace_km: settings.grace_km, rate_per_km: rateValue } : {}),
            }));
            const { error } = await supabase.from('service_visits').insert(rows);
            if (error) {
                if (/trip_group/.test(error.message || '')) throw new Error('Combined visits are not set up yet. Run the 26 Oct database update first.');
                if (/row-level security/i.test(error.message || '')) throw new Error('One of these complaints is no longer with this technician. Refresh and try again.');
                throw new Error(error.message || 'Could not save the visit.');
            }
            setOpen(false); setChosen([]); setTypedKm(null); setKmNote(''); setTypedAmount(null); setTypedRate(null); setNote('');
            await onSaved?.();
        }, 'Combined trip saved on every complaint.', 'issue');
    };

    const input = 'mt-1 block w-full min-h-11 rounded-lg border p-2';
    return <form onSubmit={save} className="grid gap-2 border-t pt-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold">One trip, several houses</h3>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg border px-3 text-xs font-bold">Hide</button>
        </div>
        <fieldset className="sm:col-span-2 space-y-1 text-xs">
            <legend className="font-semibold">Other complaints of this technician on the same trip (in the order visited)</legend>
            {others.map(row => <label key={row.id} className="flex min-h-11 items-center gap-2 rounded-lg border px-2">
                <input type="checkbox" checked={chosen.includes(row.id)} onChange={() => toggle(row.id)} className="h-5 w-5" />
                <span className="min-w-0 flex-1 break-words">{chosen.includes(row.id) && <strong>{chosen.indexOf(row.id) + 2}. </strong>}{ticketLabel(row)} {row.customer_name} · {pincodeInText(row.service_address) || 'no pincode'}</span>
            </label>)}
        </fieldset>
        <label className="text-xs">Start pincode<input inputMode="numeric" maxLength={6} placeholder="385340" value={startPin} onChange={e => { setStartPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setTypedKm(null); }} className={input} /></label>
        <label className="text-xs">Date<input required type="date" value={date} onChange={e => setDate(e.target.value)} className={input} /></label>
        <TripTypeChoice value={roundTrip} onChange={value => { setRoundTripChoice(value); setTypedKm(null); }} className="sm:col-span-2" />
        <div className="sm:col-span-2 rounded-lg bg-sky-50 p-2 text-xs text-sky-950">
            {estimate ? <p className="font-semibold">{estimate.explanation}</p>
                : missing.length ? <p className="font-semibold text-amber-900">No pincode in the address of {missing.map(ticketLabel).join(', ')}. Type the km by hand.</p>
                    : !chosen.length ? <p>Tick the other complaints to work out the km.</p>
                        : !isPincode(startPin) ? <p>Type the start pincode to work out the km, or type the km.</p>
                            : <p>Working out the km…</p>}
            <p className="mt-1 text-stone-500">Km = straight line x {TRIP_ROAD_FACTOR} road between each stop{roundTrip ? ', and back to the start' : ''}{settings.grace_km ? ` + ${settings.grace_km} km grace once` : ''}.</p>
        </div>
        <label className="text-xs">Km of the whole trip<input required min="0" step="0.01" type="number" inputMode="decimal" value={shownKm} onChange={e => setTypedKm(e.target.value)} className={input} /></label>
        <label className="text-xs">Rate per km (₹)<input min="0" max="1000" step="0.01" type="number" inputMode="decimal" value={rate} onChange={e => { setTypedRate(e.target.value); setTypedAmount(null); }} placeholder="0" className={input} /></label>
        <label className="text-xs sm:col-span-2">Amount for the whole trip (₹){autoAmount > 0 && typedAmount === null && <span className="text-stone-500"> = {shownKm} km x ₹{rate}</span>}<input required min="0" step="0.01" type="number" inputMode="decimal" value={shownAmount} onChange={e => setTypedAmount(e.target.value)} className={input} /></label>
        {kmChanged && <label className="sm:col-span-2 text-xs font-semibold">Why is the km different from the estimate ({estimate.km} km)? *
            <input required maxLength={300} value={kmNote} onChange={e => setKmNote(e.target.value)} className={`${input} text-sm font-normal`} /></label>}
        <input maxLength={600} value={note} onChange={e => setNote(e.target.value)} placeholder="Trip note (optional)" className="sm:col-span-2 min-h-11 rounded-lg border p-2 text-sm" />
        <button disabled={busy || !chosen.length || (kmChanged && !kmNote.trim())} className="sm:col-span-2 min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50">Save combined trip ({route.length} houses)</button>
    </form>;
}
