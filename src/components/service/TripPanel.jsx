import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';
import { NEAR_PINCODE_KM, nearestPincode, pincodePoint } from '../../utils/tripKm';
import { ticketLabel, visitLabel } from './serviceLabels';
import SiteVisitForm from './SiteVisitForm';
import { nextLegStart, tripChainTrips, tripSummary } from '../../utils/tripChain';
import { useKmSettings } from './kmSettings';
import { ROUGH_ACCURACY_M, accuracyText, isPincode, phonePosition, pincodeInText, pincodePoints, roundAccuracy, tripError } from './tripLabels';

// A trip can still get "Reached site" for 12 hours (same rule as the database).
// Only "near 385340" when the nearest post office is within NEAR_PINCODE_KM.
const TRIP_OPEN_MS = 12 * 60 * 60 * 1000;

// Technician's trip on their own job: "Start trip" saves where they start
// (phone location, or a typed pincode when location fails) and "Reached site"
// saves one more point. The office works out the km from these.
// onTripState({ loaded, failed, current }) tells the job panel about the open trip
// (work waits for Start trip; the "Reached site" reminder); a new reloadKey reads
// the trips again.
// One trip, several houses: after Reached site the technician picks the next of their
// jobs (otherJobs), whose trip then starts from this house, and onGoNext opens it; or
// ends the trip. The office links the houses from these start points.
// Visit columns come with 20261105120000_technician_visits.sql; before it runs the
// trips are read without them (no readings step then).
const TRIP_COLUMNS = 'id, started_at, start_source, start_pincode, start_accuracy_m, reached_at, reached_lat, reached_lng, reached_accuracy_m';
const VISIT_COLUMNS = `${TRIP_COLUMNS}, visit_no, readings, outcome, outcome_note`;
const missingColumn = failure => failure?.code === '42703' || /column .* does not exist/i.test(failure?.message || '');
const endedKey = tripId => `trip-ended:${tripId}`;
const wasEnded = tripId => { try { return localStorage.getItem(endedKey(tripId)) === '1'; } catch { return false; } };

export default function TripPanel({ issue, userId, busy, run, onTripState, reloadKey = 0, otherJobs = [], onGoNext, jobs = [] }) {
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
    const [endedId, setEndedId] = useState(null);
    // Jobs already on a trip in the last 12 hours (visited or on the way): not offered as Next.
    // This technician's trips of the last day: the houses of this journey and its summary.
    const [recentTrips, setRecentTrips] = useState([]);
    const [points, setPoints] = useState(null);
    const { status: kmStatus, settings } = useKmSettings();
    // Set again on mount: StrictMode mounts twice in development.
    const mounted = useRef(true);
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

    const loadTrips = useCallback(async () => {
        const read = columns => supabase.from('service_trips').select(columns)
            .eq('issue_id', issue.id).eq('technician_id', userId)
            .order('started_at', { ascending: false }).limit(6);
        let { data, error } = await read(VISIT_COLUMNS);
        if (missingColumn(error)) ({ data, error } = await read(TRIP_COLUMNS));
        if (!mounted.current) return;
        if (error) { setLoadError(tripError(error)); return; }
        setTrips(data || []); setLoadError('');
        const since = new Date(Date.now() - 2 * TRIP_OPEN_MS).toISOString();
        const { data: recent } = await supabase.from('service_trips')
            .select('id, issue_id, started_at, start_source, start_lat, start_lng, start_pincode, reached_at, reached_lat, reached_lng')
            .eq('technician_id', userId).gte('started_at', since).order('started_at', { ascending: false }).limit(100);
        if (mounted.current) setRecentTrips(recent || []);
    }, [issue.id, userId]);
    useEffect(() => { loadTrips(); }, [loadTrips, reloadKey]);

    const latest = trips?.[0];
    const current = latest && Date.now() - Date.parse(latest.started_at) < TRIP_OPEN_MS ? latest : null;
    const choosing = !current || startingAgain;
    const loaded = trips !== null;
    const currentId = current?.id || null;
    const currentReachedAt = current?.reached_at || null;
    // No visit columns (SQL not run yet): no readings step, the work is never held back.
    const visitsReady = Boolean(current && 'outcome' in current);
    const currentOutcome = visitsReady ? current.outcome || null : 'fixed';
    const currentReadings = visitsReady ? Boolean(current.readings) : true;
    const failed = Boolean(loadError);
    useEffect(() => {
        onTripState?.({ loaded, failed, current: currentId ? { id: currentId, reached_at: currentReachedAt, readings: currentReadings, outcome: currentOutcome } : null });
    }, [onTripState, loaded, failed, currentId, currentReachedAt, currentReadings, currentOutcome]);
    const visitName = `Visit ${visitLabel(issue, current?.visit_no)}`;

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
            // Reached site is compulsory (owner, 5 Nov 2026): no going on without a location.
            if (mounted.current) { setLocating(''); setHint(`${failure.message} Reached site is needed before the readings. Turn on location and tap Reached site again. Still failing? Call the office.`); }
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

    // Next house: its trip starts here (this house's Reached site point, else its pincode).
    const goNext = job => run(async () => {
        const start = nextLegStart(current, pincodeInText(issue.service_address));
        if (!start) throw new Error('This house has no pincode. Open the next job and tap Start trip there.');
        const { error } = await supabase.rpc('service_start_trip', { p_issue_id: job.id, ...start });
        if (error) throw new Error(tripError(error));
        onGoNext?.(job.id);
    }, `Trip to ${ticketLabel(job)} ${job.customer_name || ''} started from this house.`, 'issue');
    const endTrip = () => { try { localStorage.setItem(endedKey(current.id), '1'); } catch { /* private window */ } setEndedId(current.id); };
    const ended = current && (endedId === current.id || wasEnded(current.id));
    const onTripIds = recentTrips.filter(t => Date.now() - Date.parse(t.started_at) < TRIP_OPEN_MS).map(t => t.issue_id);
    const nextJobs = otherJobs.filter(job => !onTripIds.includes(job.id));
    // The journey is over here: ended, or no other job to go on to.
    const arrived = Boolean(current?.reached_at);
    // Done at this house once the visit has its outcome (Fixed / Revisit needed).
    const atHouse = arrived && Boolean(currentOutcome);
    const showSummary = atHouse && !startingAgain && (ended || nextJobs.length === 0);
    useEffect(() => {
        if (!showSummary || points) return undefined;
        let active = true;
        pincodePoints().then(data => { if (active) setPoints(data); }, () => {});
        return () => { active = false; };
    }, [showSummary, points]);
    const pinOf = id => pincodeInText((id === issue.id ? issue : jobs.find(job => job.id === id))?.service_address);
    const journey = showSummary ? tripChainTrips(recentTrips, issue.id, pinOf) : [];
    let summary = null;
    try { summary = showSummary && points ? tripSummary({ chain: journey, pincodeOf: pinOf, points, settings }) : null; } catch { summary = null; }

    const disabled = busy || Boolean(locating);
    const primary = 'min-h-12 w-full rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50';
    const quiet = 'min-h-11 rounded-lg px-1 text-xs font-bold text-stone-500 underline-offset-2 hover:underline disabled:opacity-50';
    const time = value => new Date(value).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
    return <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">{current?.visit_no ? visitName : 'Trip'}</h3>
            {trips === null && !loadError && <span className="text-xs text-stone-400">Loading…</span>}
        </div>
        {loadError && <p role="alert" className="text-xs text-red-700">Could not load your trips: {loadError}</p>}

        {current && <ol className="space-y-1.5 text-sm">
            <li className="flex items-center gap-2"><span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
                <span className="text-stone-500">Started</span><strong className="whitespace-nowrap">{time(current.started_at)}</strong>
                <span className="min-w-0 truncate text-xs text-stone-400">{current.start_pincode || (current.start_source === 'gps' ? 'GPS' : '')}</span></li>
            <li className="flex items-center gap-2"><span className={`h-2 w-2 shrink-0 rounded-full ${current.reached_at ? 'bg-emerald-500' : 'bg-stone-300'}`} aria-hidden="true" />
                <span className="text-stone-500">Reached site</span>{current.reached_at && <strong className="whitespace-nowrap">{time(current.reached_at)}</strong>}</li>
        </ol>}
        {current && !current.reached_at && <button type="button" disabled={disabled} onClick={markReached} className={primary}>{locating === 'reach' ? 'Finding your location…' : 'Reached site'}</button>}

        {arrived && visitsReady && !startingAgain && <SiteVisitForm key={current.id} trip={current} busy={busy} run={run} onSaved={loadTrips} />}

        {atHouse && !startingAgain && !ended && nextJobs.length > 0 && <div className="space-y-2 border-t border-stone-100 pt-3">
            <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Next house</p>
            {nextJobs.map(job => <button key={job.id} type="button" disabled={disabled} onClick={() => goNext(job)}
                className="flex min-h-12 w-full items-center justify-between gap-2 rounded-xl border border-stone-200 px-3 text-left text-sm hover:border-amber-400 disabled:opacity-50">
                <span className="min-w-0 break-words"><span className="text-stone-400">{ticketLabel(job)}</span> <strong>{job.customer_name}</strong></span>
                <span className="shrink-0 text-xs text-stone-400">{pincodeInText(job.service_address) || ''} ›</span>
            </button>)}
            <button type="button" disabled={disabled} onClick={endTrip} className="min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm font-bold text-stone-700 disabled:opacity-50">End trip</button>
        </div>}
        {showSummary && <TripSummary summary={summary} houses={journey.length} loading={!points} rateKnown={kmStatus === 'ready'} />}

        {hint && <p role="status" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-900">{hint}</p>}

        {choosing && trips !== null && !found && !manual && <button type="button" disabled={disabled} onClick={findStart} className={primary}>
            {locating === 'start' ? 'Finding your location…' : 'Start trip'}</button>}

        {choosing && found && <div className="space-y-2">
            <p className="text-sm">{found.near && found.near.km <= NEAR_PINCODE_KM
                ? <>From near <strong>{found.near.pincode}</strong></> : 'From your phone location'}
                {accuracyText(found.accuracy) && <span className="text-xs text-stone-400"> · {accuracyText(found.accuracy)}</span>}</p>
            {found.accuracy > ROUGH_ACCURACY_M && <p className="text-xs text-amber-800">Location is rough. Type the pincode if it looks wrong.</p>}
            <button type="button" disabled={disabled} onClick={confirmGps} className={primary}>Confirm start</button>
            <button type="button" disabled={disabled} onClick={() => { setFound(null); setManual(true); }} className={quiet}>Type pincode instead</button>
        </div>}

        {choosing && manual && <form onSubmit={startManual} className="space-y-2">
            <label className="block text-xs font-semibold text-stone-500">Starting pincode
                <input value={pin} onChange={e => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setPinWarning(''); }} inputMode="numeric" autoComplete="postal-code" pattern="[1-9][0-9]{5}" maxLength={6} placeholder="385340"
                    className="mt-1 block w-full min-h-12 rounded-xl border border-stone-200 p-2 text-lg font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-300" />
            </label>
            {pinWarning && <p role="alert" className="text-xs text-amber-800">{pinWarning}</p>}
            <button disabled={disabled || pin.length !== 6} className={primary}>{unknownPinOk && unknownPinOk === pin ? 'Start trip anyway' : 'Start trip'}</button>
            <button type="button" disabled={disabled} onClick={findStart} className={quiet}>Use phone location</button>
        </form>}

        {current && !startingAgain && (current.outcome === 'revisit'
            ? <button type="button" disabled={disabled} onClick={() => { reset(); setStartingAgain(true); }} className={primary}>Start next visit</button>
            : <button type="button" disabled={disabled} onClick={() => { reset(); setStartingAgain(true); }} className={quiet}>Restart trip</button>)}
        {startingAgain && <button type="button" disabled={disabled} onClick={() => { reset(); setStartingAgain(false); }} className={quiet}>Keep the current trip</button>}
    </section>;
}

// End of the journey: km and pay worked out with the office's settings (Operations).
// An estimate: the office saves the visit payment and may change it.
function TripSummary({ summary, houses, loading, rateKnown }) {
    const row = (label, value) => <div className="flex justify-between gap-3 py-1"><dt className="text-stone-600">{label}</dt><dd className="text-right font-semibold">{value}</dd></div>;
    return <div className="border-t border-stone-100 pt-3 text-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-stone-500">Trip ended{houses > 1 ? ` · ${houses} houses` : ''}</p>
        {loading ? <p className="text-xs text-stone-500">Working out the km…</p>
            : !summary ? <p className="text-xs text-stone-600">The km could not be worked out here (a start or house pincode is missing). The office will enter it.</p>
                : <>
                    <p className="mt-1 text-xs text-stone-500">{summary.explanation.split(':')[0]}</p>
                    <dl className="mt-2 divide-y text-sm">
                        {row('Travelled', `${(summary.straightKm * summary.roadFactor).toFixed(1)} km`)}
                        {row('Trip', summary.roundTrip ? 'Round trip (there and back)' : 'One way')}
                        {summary.graceKm > 0 && row('Grace', `+ ${summary.graceKm} km`)}
                        {row('Total', `${summary.km} km`)}
                        {rateKnown && row('Rate', `₹${summary.rate} per km`)}
                        {rateKnown && <div className="flex justify-between gap-3 py-1 text-base"><dt className="font-bold">Amount</dt><dd className="font-bold text-green-800">₹{summary.amount.toLocaleString('en-IN')}</dd></div>}
                    </dl>
                    <p className="mt-2 text-xs text-stone-500">{rateKnown ? 'Grace, round trip and the rate are set by the office. The office checks this and saves the payment.'
                        : 'The office will add the rate and the amount.'}</p>
                </>}
    </div>;
}
