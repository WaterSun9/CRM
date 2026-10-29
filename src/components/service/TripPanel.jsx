import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import { NEAR_PINCODE_KM, nearestPincode, pincodePoint } from '../../utils/tripKm';
import { formatDateTime } from './serviceLabels';
import { ROUGH_ACCURACY_M, accuracyText, isPincode, phonePosition, pincodePoints, roundAccuracy, startText, tripError } from './tripLabels';

// A trip can still get "Reached site" for 12 hours (same rule as the database).
// Only "near 385340" when the nearest post office is within NEAR_PINCODE_KM.
const TRIP_OPEN_MS = 12 * 60 * 60 * 1000;

// Technician's trip on their own job: "Start trip" saves where they start
// (phone location, or a typed pincode when location fails) and "Reached site"
// saves one more point. The office works out the km from these.
// onTripState({ loaded, failed, current }) tells the job panel about the open trip
// (work waits for Start trip; the "Reached site" reminder); a new reloadKey reads
// the trips again.
export default function TripPanel({ issue, userId, busy, run, onTripState, reloadKey = 0 }) {
    const [trips, setTrips] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [locating, setLocating] = useState('');
    const [found, setFound] = useState(null);
    const [manual, setManual] = useState(false);
    const [pin, setPin] = useState('');
    const [unknownPinOk, setUnknownPinOk] = useState('');
    const [hint, setHint] = useState('');
    const [pinWarning, setPinWarning] = useState('');
    const [startingAgain, setStartingAgain] = useState(false);
    // Set again on mount: StrictMode mounts twice in development.
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const loadTrips = useCallback(async () => {
        const { data, error } = await supabase.from('service_trips')
            .select('id, started_at, start_source, start_pincode, start_accuracy_m, reached_at, reached_accuracy_m')
            .eq('issue_id', issue.id).eq('technician_id', userId)
            .order('started_at', { ascending: false }).limit(6);
        if (!mounted.current) return;
        if (error) { setLoadError(tripError(error)); return; }
        setTrips(data || []); setLoadError('');
    }, [issue.id, userId]);
    useEffect(() => { loadTrips(); }, [loadTrips, reloadKey]);

    const latest = trips?.[0];
    const current = latest && Date.now() - Date.parse(latest.started_at) < TRIP_OPEN_MS ? latest : null;
    const choosing = !current || startingAgain;
    const loaded = trips !== null;
    const currentId = current?.id || null;
    const currentReachedAt = current?.reached_at || null;
    const failed = Boolean(loadError);
    useEffect(() => {
        onTripState?.({ loaded, failed, current: currentId ? { id: currentId, reached_at: currentReachedAt } : null });
    }, [onTripState, loaded, failed, currentId, currentReachedAt]);

    const reset = () => { setFound(null); setManual(false); setPin(''); setUnknownPinOk(''); setHint(''); setPinWarning(''); };

    const findStart = async () => {
        reset();
        setLocating('start');
        try {
            const position = await phonePosition();
            let near = null;
            try { near = nearestPincode(await pincodePoints(), position.lat, position.lng); } catch { near = null; }
            if (mounted.current) setFound({ ...position, near });
        } catch (failure) {
            if (!mounted.current) return;
            setHint(`${failure.message} Type the pincode you are starting from instead.`);
            setManual(true);
        } finally { if (mounted.current) setLocating(''); }
    };

    const saveStart = params => run(async () => {
        const { error } = await supabase.rpc('service_start_trip', { p_issue_id: issue.id, ...params });
        if (error) throw new Error(tripError(error));
        reset(); setStartingAgain(false);
        await loadTrips();
    }, 'Trip started.', 'issue');

    const confirmGps = () => {
        const near = found.near && found.near.km <= NEAR_PINCODE_KM ? found.near.pincode : null;
        saveStart({ p_lat: found.lat, p_lng: found.lng, p_accuracy: roundAccuracy(found.accuracy), p_pincode: near, p_source: 'gps' });
    };

    const startManual = async event => {
        event.preventDefault();
        if (!isPincode(pin)) { setPinWarning('Type the 6-digit pincode you are starting from.'); return; }
        // A typo gives a wrong km, so check the pincode list first. A pincode we do
        // not know can still be used on the second press (the office types the km).
        if (unknownPinOk !== pin) {
            let known = true;
            try { known = Boolean(pincodePoint(await pincodePoints(), pin)); } catch { known = true; }
            if (!known) {
                setUnknownPinOk(pin);
                setPinWarning(`Pincode ${pin} has no map point in our list. Check the number. Press Start trip again to use it anyway; the office will enter the km.`);
                return;
            }
        }
        saveStart({ p_lat: null, p_lng: null, p_accuracy: null, p_pincode: pin, p_source: 'manual' });
    };

    const markReached = async () => {
        setHint('');
        setLocating('reach');
        let position;
        try { position = await phonePosition(); }
        catch (failure) {
            if (mounted.current) { setLocating(''); setHint(`${failure.message} Reached site was not saved. That is fine: the office will use the customer's pincode.`); }
            return;
        }
        if (!mounted.current) return;
        setLocating('');
        run(async () => {
            const { data, error } = await supabase.rpc('service_mark_reached', { p_trip_id: current.id, p_lat: position.lat, p_lng: position.lng, p_accuracy: roundAccuracy(position.accuracy) });
            if (error) throw new Error(tripError(error));
            await loadTrips();
            if (!data) throw new Error('Reached site is already saved for this trip.');
        }, 'Reached site saved.', 'issue');
    };

    const disabled = busy || Boolean(locating);
    const big = 'min-h-12 w-full rounded-xl px-4 text-sm font-bold disabled:opacity-50';
    return <div className="space-y-2 rounded-xl border border-sky-200 bg-sky-50 p-3">
        <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-bold text-sky-950">Trip</h3>
            {trips === null && !loadError && <span className="text-xs text-sky-900">Loading…</span>}</div>
        <p className="text-xs text-sky-900">{current ? 'Km is worked out from this start point to the customer.'
            : 'Tap Start trip when you leave for this customer, before you begin. Photos and the OTP open after that. Going on from another house? Start the trip there.'}</p>
        {loadError && <p role="alert" className="text-xs text-red-700">Could not load your trips: {loadError}</p>}

        {current && <div className="rounded-lg bg-white p-2 text-sm">
            <p><strong>Started</strong> {formatDateTime(current.started_at)} from {startText(current)}</p>
            {current.reached_at
                ? <p className="mt-1"><strong>Reached site</strong> {formatDateTime(current.reached_at)}</p>
                : <button type="button" disabled={disabled} onClick={markReached} className={`${big} mt-2 bg-sky-700 text-white`}>{locating === 'reach' ? 'Finding your location…' : 'Reached site'}</button>}
            {!current.reached_at && <p className="mt-1 text-xs text-stone-500">Tap this when you reach the customer, so the km is correct.</p>}
        </div>}

        {current && !startingAgain && <button type="button" disabled={disabled} onClick={() => { reset(); setStartingAgain(true); }} className="min-h-11 rounded-lg border bg-white px-3 text-xs font-bold disabled:opacity-50">Start a new trip</button>}

        {hint && <p role="status" className="rounded bg-amber-50 p-2 text-xs text-amber-900">{hint}</p>}

        {choosing && trips !== null && !found && !manual && <button type="button" disabled={disabled} onClick={findStart} className={`${big} bg-sky-700 text-white`}>
            {locating === 'start' ? 'Finding your location…' : 'Start trip'}</button>}

        {choosing && found && <div className="space-y-2 rounded-lg bg-white p-2">
            <p className="text-sm">{found.near && found.near.km <= NEAR_PINCODE_KM
                ? <>Starting near <strong>{found.near.pincode}</strong> ({Number(found.near.km).toFixed(1)} km)</>
                : 'Starting from your phone location'}
                {accuracyText(found.accuracy) && <span className="block text-xs text-stone-500">Location accurate to {accuracyText(found.accuracy)}.</span>}</p>
            {found.accuracy > ROUGH_ACCURACY_M && <p className="rounded bg-amber-50 p-2 text-xs text-amber-900">The location is rough. If it looks wrong, type your pincode instead.</p>}
            <button type="button" disabled={disabled} onClick={confirmGps} className={`${big} bg-green-600 text-white`}>Confirm start</button>
            <button type="button" disabled={disabled} onClick={() => { setFound(null); setManual(true); }} className="min-h-11 w-full rounded-lg border px-3 text-xs font-bold">Type pincode instead</button>
        </div>}

        {choosing && manual && <form onSubmit={startManual} className="space-y-2 rounded-lg bg-white p-2">
            <label className="block text-xs font-semibold">Pincode you are starting from
                <input value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinWarning(''); }} inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} placeholder="385340"
                    className="mt-1 block w-full min-h-12 rounded-lg border p-2 text-lg font-bold tracking-widest" />
            </label>
            {pinWarning && <p role="alert" className="rounded bg-amber-50 p-2 text-xs text-amber-900">{pinWarning}</p>}
            <button disabled={disabled || pin.length !== 6} className={`${big} bg-green-600 text-white`}>{unknownPinOk && unknownPinOk === pin ? 'Start trip anyway' : 'Start trip'}</button>
            <button type="button" disabled={disabled} onClick={findStart} className="min-h-11 w-full rounded-lg border px-3 text-xs font-bold">Try phone location again</button>
        </form>}

        {startingAgain && <button type="button" disabled={disabled} onClick={() => { reset(); setStartingAgain(false); }} className="min-h-11 rounded-lg border bg-white px-3 text-xs font-bold">Keep the current trip</button>}
    </div>;
}
