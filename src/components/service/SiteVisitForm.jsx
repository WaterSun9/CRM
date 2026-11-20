import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { supabase } from '../../supabase';
import { tripError } from './tripLabels';
import { PhotoViewer, saveReadingPhoto, signedLinks } from './ComplaintPhotos';
import { missingTable, photoError } from './serviceLabels';

// The readings the technician takes at the site, every visit (volts).
export const READING_GROUPS = [
    // The client's form: AC positive-negative, positive-earth, negative-earth;
    // DC plus-minus, plus-earth, minus-earth.
    ['AC', [['ac_pn', 'Pos–Neg'], ['ac_pe', 'Pos–Earth'], ['ac_ne', 'Neg–Earth']]],
    ['DC', [['dc_pm', 'Plus–Minus'], ['dc_pe', 'Plus–Earth'], ['dc_me', 'Minus–Earth']]],
];
export const readingsText = readings => (readings
    ? `AC ${readings.ac_pn} · ${readings.ac_pe} · ${readings.ac_ne} V   DC ${readings.dc_pm} · ${readings.dc_pe} · ${readings.dc_me} V   Floating ${readings.floating ? 'yes' : 'no'}`
    : '');

const missing = failure => ['PGRST202', '42883'].includes(failure?.code) || /could not find the function/i.test(failure?.message || '');
const plain = failure => (missing(failure) ? 'Site readings are not set up yet. Tell the office.' : tripError(failure));
const label = 'text-xs font-bold uppercase tracking-wider text-stone-500';

const READING_KEYS = READING_GROUPS.flatMap(([, fields]) => fields.map(([key]) => key));
const READING_NAMES = Object.fromEntries(READING_GROUPS.flatMap(([group, fields]) => fields.map(([key, name]) => [key, `${group} ${name}`])));
const noColumn = failure => missingTable(failure) || failure?.code === '42703' || /trip_id/i.test(failure?.message || '');

// The reading photos of some visits: byTrip = { [tripId]: { [key]: { id, storage_path, url } } }.
// ready: true when loaded, false when the database has no reading photos yet (SQL not
// run; photos are then not asked for), null while loading or after a failed read.
export function useReadingPhotos({ issueId, tripIds, reloadKey = 0 }) {
    const [state, setState] = useState({ ready: null, byTrip: {} });
    const [again, setAgain] = useState(0);
    const idsKey = (tripIds || []).filter(Boolean).join(',');
    useEffect(() => {
        let active = true;
        const ids = idsKey ? idsKey.split(',') : [];
        if (!issueId || !ids.length) { setState({ ready: true, byTrip: {} }); return undefined; }
        (async () => {
            const { data, error } = await supabase.from('service_issue_files')
                .select('id, trip_id, label, storage_path, uploaded_by, created_at')
                .eq('issue_id', issueId).eq('kind', 'reading').in('trip_id', ids);
            if (!active) return;
            if (error) { setState({ ready: noColumn(error) ? false : null, byTrip: {} }); return; }
            const urls = await signedLinks((data || []).map(file => file.storage_path)).catch(() => ({}));
            if (!active) return;
            const byTrip = {};
            for (const file of data || []) (byTrip[file.trip_id] ||= {})[file.label] = { ...file, url: urls[file.storage_path] || '' };
            setState({ ready: true, byTrip });
        })();
        return () => { active = false; };
    }, [issueId, idsKey, reloadKey, again]);
    const reload = useCallback(() => setAgain(n => n + 1), []);
    return { ...state, reload };
}

// Small square photo of one saved reading; tap to open.
function ReadingThumb({ photo, name, onView }) {
    if (!photo) return null;
    return <button type="button" onClick={() => onView({ url: photo.url, label: name })} aria-label={`Open ${name} photo`}
        className="mt-1 block h-10 w-10 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
        {photo.url && <img src={photo.url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />}
    </button>;
}

// Saved readings, small; with their photos when given ({ [key]: { url } }).
export function ReadingsLine({ readings, photos = null }) {
    const [viewing, setViewing] = useState(null);
    if (!readings) return null;
    return <div className="space-y-1.5 text-xs">
        {READING_GROUPS.map(([group, fields]) => <div key={group} className={`grid grid-cols-[2rem_1fr_1fr_1fr] gap-2 ${photos ? 'items-start' : 'items-end'}`}>
            <span className={`font-bold text-stone-400 ${photos ? 'pt-[15px]' : ''}`}>{group}</span>
            {fields.map(([key, name]) => <span key={key}><span className="block text-[10px] text-stone-400">{name}</span><span className="font-semibold text-stone-800">{readings[key]} V</span>
                {photos && <ReadingThumb photo={photos[key]} name={`${READING_NAMES[key]} · ${readings[key]} V`} onView={setViewing} />}</span>)}
        </div>)}
        {viewing && <PhotoViewer url={viewing.url} label={viewing.label} onClose={() => setViewing(null)} />}
        <div className="grid grid-cols-[2rem_1fr] gap-2"><span className="font-bold text-stone-400">Float</span><span className="font-semibold text-stone-800">{readings.floating ? 'Yes' : 'No'}</span></div>
    </div>;
}

// One visit at the site: readings first, then Fixed or Revisit needed.
// trip: the open trip ({ id, visit_no, readings, outcome, outcome_note }).
export default function SiteVisitForm({ issue, userId, trip, busy, run, onSaved }) {
    const [values, setValues] = useState({});
    const [floating, setFloating] = useState(null);
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState('');
    const [adding, setAdding] = useState('');
    const addingRef = useRef(false);
    const [photoProblem, setPhotoProblem] = useState('');
    const photos = useReadingPhotos({ issueId: issue?.id, tripIds: [trip.id] });
    const mine = photos.byTrip[trip.id] || {};
    // A photo of the meter for each reading (14 Nov 2026), once the database has them.
    const needPhotos = photos.ready !== false;
    const photoCount = READING_KEYS.filter(key => mine[key]).length;
    const photosDone = !needPhotos || photoCount === READING_KEYS.length;

    const complete = READING_KEYS.every(key => String(values[key] ?? '').trim() !== '') && floating !== null && photosDone;

    // A ref, not only state: a quick double tap fires twice before the state updates.
    const takePhoto = async (key, input) => {
        const file = input.files?.[0];
        input.value = '';
        if (!file || adding || addingRef.current) return;
        addingRef.current = true;
        setAdding(key); setPhotoProblem('');
        try {
            await saveReadingPhoto({ issueId: issue.id, userId, tripId: trip.id, key, file, old: mine[key] });
        } catch (failure) {
            setPhotoProblem(`${READING_NAMES[key]}: ${photoError(failure)}`);
        } finally {
            addingRef.current = false;
            setAdding('');
            photos.reload();
        }
    };

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
            <ReadingsLine readings={trip.readings} photos={needPhotos ? mine : null} />
        </div>;
    }

    if (!trip.readings) {
        return <form onSubmit={saveReadings} className="space-y-3 border-t border-stone-100 pt-3">
            <p className={label}>Readings · volts</p>
            {READING_GROUPS.map(([group, fields]) => <div key={group} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-2">
                <span className="pt-4 text-xs font-bold text-stone-400">{group}</span>
                {fields.map(([key, name]) => <div key={key} className="space-y-1">
                <label className="relative block">
                        <span className="pointer-events-none absolute left-2 top-1 text-[10px] font-bold text-stone-400">{name}</span>
                        <input value={values[key] ?? ''} aria-label={`${group} ${name}`} onChange={e => setValues(current => ({ ...current, [key]: e.target.value.replace(/[^\d.]/g, '').slice(0, 7) }))}
                            inputMode="decimal" className="block w-full min-h-12 rounded-xl border border-stone-200 px-2 pb-1 pt-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
                    </label>
                {needPhotos && <label aria-disabled={Boolean(adding) || undefined}
                    className={`flex min-h-11 w-full cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-lg border px-1 text-[11px] font-bold ${mine[key] ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-stone-900 bg-stone-900 text-white'} ${adding ? 'pointer-events-none opacity-50' : ''}`}>
                    {adding === key ? 'Adding…' : mine[key]
                        ? <>{mine[key].url ? <img src={mine[key].url} alt="" className="h-7 w-7 shrink-0 rounded object-cover" /> : <Camera size={14} aria-hidden="true" />}Retake</>
                        : <><Camera size={14} aria-hidden="true" />Photo</>}
                    <input type="file" accept="image/*" capture="environment" disabled={Boolean(adding)} aria-label={`${mine[key] ? 'Retake photo' : 'Photo'} of ${group} ${name}`}
                        onChange={event => takePhoto(key, event.target)} className="sr-only" />
                </label>}
            </div>)}
            </div>)}
            <div className="grid grid-cols-[2rem_1fr] items-center gap-2">
                <span className="text-[10px] font-bold leading-tight text-stone-400">Float</span>
                <div className="grid grid-cols-2 rounded-xl bg-stone-100 p-1" role="group" aria-label="Floating voltage">
                    {[[true, 'Yes'], [false, 'No']].map(([value, text]) => <button key={text} type="button" onClick={() => setFloating(value)} aria-pressed={floating === value}
                        className={`min-h-10 rounded-lg text-sm font-bold ${floating === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{text}</button>)}
                </div>
            </div>
            {needPhotos && <p className={`text-xs font-semibold ${photoCount === READING_KEYS.length ? 'text-emerald-700' : 'text-stone-500'}`}>
                Photos {photoCount}/{READING_KEYS.length} · one photo of the meter for each reading</p>}
            {photoProblem && <p role="alert" className="text-xs font-semibold text-red-700">{photoProblem}</p>}
            <button disabled={busy || !complete || Boolean(adding)} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">Save readings</button>
        </form>;
    }

    return <div className="space-y-3 border-t border-stone-100 pt-3">
        <ReadingsLine readings={trip.readings} photos={needPhotos ? mine : null} />
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
