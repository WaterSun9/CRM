import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { TRIP_DISTANCE_MODE, TRIP_GRACE_KM, TRIP_ROAD_FACTOR, TRIP_ROUND_TRIP, TRIP_TRAVEL_MODE } from '../../constants';
import { NEAR_PINCODE_KM, estimateTripKm, haversineKm, nearestPincode, pincodePoint } from '../../utils/tripKm';
import { siteSourceText, useCustomerSite } from './customerSite';
import { fetchRoadDistance, latLngOrNull, roadRequestFromKey, roadRequestKey, roadTripKm } from './roadKm';
import { formatDateTime, todayLocal } from './serviceLabels';
import { ROUGH_ACCURACY_M, accuracyText, isPincode, pincodeInText, pincodePoints, startText, tripError } from './tripLabels';

// 'pro' asks Google for the road km (edge function trip-distance); 'simple' never does.
const PRO = TRIP_DISTANCE_MODE === 'pro';
const MODE_TEXT = { TWO_WHEELER: 'two-wheeler', DRIVE: 'car' };
// Reached point (or saved location) this far from the customer's pincode is worth a second look.
const FAR_FROM_CUSTOMER_KM = 15;
const emptyVisit = () => ({ visit_date: todayLocal(), amount_inr: '', note: '' });

// km_source / route_km come with 20261013120000_customer_sites.sql and are sent only
// in 'pro' (which needs that SQL), so a 'simple' visit saves exactly as before and
// leaves them empty. If 'pro' meets a database without them, the visit is saved
// again without them, and this page load stops sending them.
let sendKmSource = PRO;
const kmSourceMissing = failure => {
    const message = failure?.message || '';
    return /km_source|route_km/.test(message) && (failure?.code === 'PGRST204' || failure?.code === '42703' || /column/i.test(message));
};

function visitError(failure) {
    const message = failure?.message || '';
    if (/service_visits_one_per_trip/.test(message) || failure?.code === '23505') return 'A visit is already saved for this trip. Refresh and choose another trip.';
    if (/km_changed_note/.test(message)) return 'Write why the km is different from the estimate.';
    if (/km_note_check/.test(message)) return 'The reason for changing the km can be at most 300 characters.';
    if (/row-level security/i.test(message)) return 'This job is no longer with this technician. Refresh the list.';
    return message || 'Could not save the visit.';
}

// Nearest pincode to a point, only when it is close (as the trip labels do).
function nearPincode(points, point) {
    try {
        const near = nearestPincode(points, point.lat, point.lng);
        return near && near.km <= NEAR_PINCODE_KM ? near.pincode : null;
    } catch { return null; }
}

// { lat, lng } of a trip end ({ lat, lng } or { pincode }), or null.
function pointOf(points, end) {
    if (!end) return null;
    if (end.pincode) {
        const p = points ? pincodePoint(points, end.pincode) : null;
        return p ? { lat: p[0], lng: p[1] } : null;
    }
    return latLngOrNull(end.lat, end.lng);
}

// Office form for one visit payment. Km is pre-filled from the technician's
// trip (start point to the customer); amount is typed. Changing the km needs a note.
// The customer end is the customer's saved location, else the trip's "Reached
// site" point, else the customer's pincode. In 'pro' mode the km is the Google
// road km (there and back + grace), falling back to the estimate.
export default function VisitForm({ issue, user, busy, run, visits, onSaved }) {
    const [trips, setTrips] = useState(null);
    const [tripsError, setTripsError] = useState('');
    const [customerPin, setCustomerPin] = useState(null);
    const [points, setPoints] = useState(null);
    const [pointsFailed, setPointsFailed] = useState(false);
    const [tripChoice, setTripChoice] = useState(null);
    const [typedPin, setTypedPin] = useState('');
    const [typedKm, setTypedKm] = useState(null);
    const [kmNote, setKmNote] = useState('');
    const [visit, setVisit] = useState(emptyVisit);
    const [road, setRoad] = useState(null);
    // Read again with the visits (every poll), so a location saved by the
    // technician's "Reached site" shows up. No table yet -> site stays null.
    const { status: siteStatus, site } = useCustomerSite(issue.customer_id, visits);

    // Reloaded with the visits (every poll), so a trip started meanwhile shows up.
    useEffect(() => {
        let active = true;
        supabase.from('service_trips')
            .select('id, started_at, start_source, start_lat, start_lng, start_accuracy_m, start_pincode, reached_at, reached_lat, reached_lng, reached_accuracy_m')
            .eq('issue_id', issue.id).eq('technician_id', issue.assigned_to)
            .order('started_at', { ascending: false }).limit(50)
            .then(({ data, error }) => { if (!active) return; if (error) setTripsError(tripError(error, 'office')); else { setTrips(data || []); setTripsError(''); } });
        return () => { active = false; };
    }, [issue.id, issue.assigned_to, visits]);

    // Customer pincode: the customer card, else a pincode written in an address.
    useEffect(() => {
        let active = true;
        const fromComplaint = pincodeInText(issue.service_address);
        if (!issue.customer_id) { setCustomerPin({ pin: fromComplaint, from: 'the complaint address' }); return undefined; }
        supabase.from('admin').select('pincode, full_address').eq('id', issue.customer_id).maybeSingle()
            .then(({ data }) => {
                if (!active) return;
                const card = String(data?.pincode ?? '').replace(/\D/g, '');
                if (isPincode(card)) setCustomerPin({ pin: card, from: 'the customer card' });
                else if (pincodeInText(data?.full_address)) setCustomerPin({ pin: pincodeInText(data.full_address), from: "the customer's address" });
                else setCustomerPin({ pin: fromComplaint, from: 'the complaint address' });
            });
        return () => { active = false; };
    }, [issue.customer_id, issue.service_address]);

    useEffect(() => {
        let active = true;
        pincodePoints().then(data => { if (active) setPoints(data); }, () => { if (active) setPointsFailed(true); });
        return () => { active = false; };
    }, []);

    const usedTrips = new Set(visits.map(row => row.trip_id).filter(Boolean));
    const openTrips = (trips || []).filter(trip => !usedTrips.has(trip.id));
    const trip = tripChoice === '' ? null : openTrips.find(row => row.id === tripChoice) || openTrips[0] || null;

    const endPin = customerPin?.pin || (isPincode(typedPin) ? typedPin : '');
    const start = trip && (trip.start_source === 'gps' ? { lat: trip.start_lat, lng: trip.start_lng } : { pincode: trip.start_pincode });
    const siteNear = site && points ? nearPincode(points, site) : null;
    const end = site ? { lat: site.lat, lng: site.lng, label: siteNear ? `${siteNear} (saved location)` : 'saved location' }
        : trip?.reached_at ? { lat: trip.reached_lat, lng: trip.reached_lng }
            : endPin ? { pincode: endPin } : null;
    let estimate = null;
    try { estimate = points && start && end ? estimateTripKm({ start, end, points }) : null; } catch { estimate = null; }

    // Pro: Google road km between the same two points (exact or pincode points).
    const origin = PRO && points ? pointOf(points, start) : null;
    const destination = PRO && points ? pointOf(points, end) : null;
    const roadKey = origin && destination ? roadRequestKey(origin, destination, TRIP_TRAVEL_MODE) : '';
    useEffect(() => {
        const request = roadRequestFromKey(roadKey);
        if (!request) return undefined;
        let active = true;
        fetchRoadDistance(supabase, request).then(answer => { if (active) setRoad({ key: roadKey, answer }); });
        return () => { active = false; };
    }, [roadKey]);
    const roadAnswer = roadKey && road?.key === roadKey ? road.answer : null;
    const roadLoading = Boolean(roadKey) && !roadAnswer;
    const roadKm = roadAnswer?.ok ? roadTripKm(roadAnswer) : null;
    const roadFailed = Boolean(roadAnswer) && !roadKm;

    // The km the form starts from, and where it came from (saved as km_source).
    const chosen = roadLoading ? null
        : roadKm ? { km: roadKm.km, explanation: roadKm.explanation, source: 'google' }
            : estimate ? { km: estimate.km, explanation: `Estimated ${estimate.km} km: ${estimate.explanation}`, source: 'estimate' } : null;

    let reason = '';
    let reasonAction = 'Type the km by hand.';
    if (tripChoice === '') reason = 'No trip chosen.';
    else if (!trip) reason = trips === null ? (tripsError ? `Could not load trips: ${tripsError}` : '') : 'No start point: the technician did not tap Start trip for this visit.';
    else if (pointsFailed) reason = 'Could not load the pincode list.';
    else if (!points) reason = '';
    else if (trip.start_source === 'manual' && !pincodePoint(points, trip.start_pincode)) reason = `Start pincode ${trip.start_pincode} has no map point in our list.`;
    else if (!end) reason = 'Customer pincode missing.';
    else if (!site && !trip.reached_at && !pincodePoint(points, endPin)) {
        reason = `Customer pincode ${endPin} has no map point in our list.`;
        reasonAction = `Type the km, or ask the technician to tap Reached site next time.${siteStatus === 'ready' && issue.customer_id ? ' You can also set the customer location above.' : ''}`;
    }
    else if (!estimate) reason = 'Km could not be worked out.';

    // Warnings for the office: rough GPS, or a point far from the customer's pincode.
    const warnings = [];
    if (trip?.start_source === 'gps' && Number(trip.start_accuracy_m) > ROUGH_ACCURACY_M) warnings.push(`Start location was rough (${accuracyText(trip.start_accuracy_m)}).`);
    if (trip?.reached_at && Number(trip.reached_accuracy_m) > ROUGH_ACCURACY_M) warnings.push(`Reached-site location was rough (${accuracyText(trip.reached_accuracy_m)}).`);
    const customerPoint = points && customerPin?.pin ? pincodePoint(points, customerPin.pin) : null;
    if (trip?.reached_at && customerPoint) {
        // Straight line only: no road factor, one way, no grace.
        const away = haversineKm([trip.reached_lat, trip.reached_lng], customerPoint);
        if (Number.isFinite(away) && away > FAR_FROM_CUSTOMER_KM) warnings.push(`"Reached site" was ${Math.round(away)} km from the customer's pincode ${customerPin.pin}. Check before paying.`);
    }
    if (trip && site && customerPoint) {
        const away = haversineKm(site, customerPoint);
        if (Number.isFinite(away) && away > FAR_FROM_CUSTOMER_KM) warnings.push(`The saved customer location is ${Math.round(away)} km from the customer's pincode ${customerPin.pin}. Check it before paying.`);
    }

    const shownKm = typedKm ?? (chosen ? String(chosen.km) : '');
    const kmChanged = Boolean(chosen) && shownKm !== '' && Number(shownKm) !== chosen.km;
    const chooseTrip = value => { setTripChoice(value); setTypedKm(null); setKmNote(''); };

    const save = event => {
        event.preventDefault();
        run(async () => {
            const km = Number(shownKm);
            if (shownKm === '' || !Number.isFinite(km) || km < 0) throw new Error('Enter the km travelled.');
            if (kmChanged && !kmNote.trim()) throw new Error('Write why the km is different from the estimate.');
            const row = {
                issue_id: issue.id, technician_id: issue.assigned_to, entered_by: user.id,
                visit_date: visit.visit_date, kilometers: km, amount_inr: Number(visit.amount_inr), note: visit.note.trim()
            };
            // The trip columns are sent only when filled, so a typed-km visit still
            // saves on a database where the trips SQL has not been run yet.
            if (trip) row.trip_id = trip.id;
            if (chosen) row.km_estimate = chosen.km;
            if (kmChanged) row.km_note = kmNote.trim().slice(0, 300);
            // 'pro' only: where the km came from (Google, the estimate, or typed by the office).
            const source = { km_source: chosen && !kmChanged ? chosen.source : 'manual' };
            if (roadKm) source.route_km = roadKm.routeKm;
            let { error } = await supabase.from('service_visits').insert(sendKmSource ? { ...row, ...source } : row);
            if (error && sendKmSource && kmSourceMissing(error)) {
                sendKmSource = false;
                ({ error } = await supabase.from('service_visits').insert(row));
            }
            if (error) throw new Error(visitError(error));
            setVisit(emptyVisit()); setTripChoice(null); setTypedKm(null); setKmNote(''); setTypedPin('');
            await onSaved?.();
        }, 'Visit distance and amount saved.', 'issue');
    };

    let toText = '';
    if (trip && site) toText = `Km is counted to the customer's saved location (${siteSourceText(site)})${trip.reached_at ? `. Reached site was tapped ${formatDateTime(trip.reached_at)}` : ''}.`;
    else if (trip?.reached_at) toText = `Reached site ${formatDateTime(trip.reached_at)}${accuracyText(trip.reached_accuracy_m) ? ` (${accuracyText(trip.reached_accuracy_m)})` : ''}, so km is counted to that point.`;
    else if (trip) toText = endPin ? `"Reached site" not tapped, so km is counted to the customer pincode ${endPin}${customerPin?.pin ? ` (from ${customerPin.from})` : ''}.` : '"Reached site" not tapped.';

    const graceText = `${TRIP_ROUND_TRIP ? ' x 2 (there and back)' : ''} + ${TRIP_GRACE_KM} km grace`;
    const rule = chosen?.source === 'google' ? `Google road km${graceText}` : `straight line x ${TRIP_ROAD_FACTOR} road${graceText}`;
    const otherMode = roadKm?.travelModeUsed && roadKm.travelModeUsed !== TRIP_TRAVEL_MODE;
    const minutes = Number(roadAnswer?.durationMinutes);
    const input = 'mt-1 block w-full min-h-11 rounded-lg border p-2';
    return <form onSubmit={save} className="grid gap-2 sm:grid-cols-3 border-t pt-3">
        <h3 className="sm:col-span-3 text-sm font-bold">Record a visit payment</h3>
        <div className="sm:col-span-3 space-y-1 rounded-lg bg-sky-50 p-2 text-xs text-sky-950">
            {openTrips.length > 0 && <label className="block font-semibold">Trip
                <select value={trip?.id || ''} onChange={e => chooseTrip(e.target.value)} className={`${input} bg-white text-sm font-normal`}>
                    {openTrips.map(row => <option key={row.id} value={row.id}>{formatDateTime(row.started_at)} from {startText(row, points)}</option>)}
                    <option value="">No trip (type the km)</option>
                </select>
            </label>}
            {trip && <p>Started {formatDateTime(trip.started_at)} from {startText(trip, points)}. {toText}</p>}
            {trip && !trip.reached_at && !site && !customerPin?.pin && customerPin !== null && <label className="block font-semibold">Customer pincode missing. Type it to work out the km
                <input value={typedPin} onChange={e => { setTypedPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setTypedKm(null); }} inputMode="numeric" maxLength={6} placeholder="385340" className={`${input} bg-white text-sm`} />
            </label>}
            {roadLoading
                ? <p role="status" className="text-stone-500">Getting the road distance from Google…</p>
                : chosen
                    ? <p className="font-semibold">{chosen.explanation}</p>
                    : reason && <p className="font-semibold text-amber-900">{reason} {reasonAction}</p>}
            {roadKm && (otherMode || minutes > 0) && <p className="text-stone-500">{otherMode ? `No ${MODE_TEXT[TRIP_TRAVEL_MODE] || 'two-wheeler'} route found, so the ${MODE_TEXT[roadKm.travelModeUsed] || 'road'} route is used. ` : ''}{minutes > 0 ? `About ${Math.round(minutes)} min one way.` : ''}</p>}
            {roadFailed && estimate && <p className="text-stone-500" title={roadAnswer?.error || ''}>Road distance not available, using the estimate</p>}
            {warnings.map(text => <p key={text} className="rounded bg-amber-100 p-1.5 font-semibold text-amber-900">{text}</p>)}
            <p className="text-stone-500">Km = {rule}. You can change it with a reason.</p>
        </div>
        <label className="text-xs">Date<input required type="date" value={visit.visit_date} onChange={e => setVisit(v => ({ ...v, visit_date: e.target.value }))} className={input} /></label>
        <label className="text-xs">Km travelled<input required min="0" step="0.01" type="number" inputMode="decimal" value={shownKm} onChange={e => setTypedKm(e.target.value)} className={input} /></label>
        <label className="text-xs">Amount (₹)<input required min="0" step="0.01" type="number" inputMode="decimal" value={visit.amount_inr} onChange={e => setVisit(v => ({ ...v, amount_inr: e.target.value }))} className={input} /></label>
        {kmChanged && <label className="sm:col-span-3 text-xs font-semibold">Why is the km different from the {chosen.source === 'google' ? 'road distance' : 'estimate'} ({chosen.km} km)? *
            <input required maxLength={300} value={kmNote} onChange={e => setKmNote(e.target.value)} placeholder="e.g. road closed, went via Santalpur" className={`${input} text-sm font-normal`} />
        </label>}
        <input maxLength={1000} value={visit.note} onChange={e => setVisit(v => ({ ...v, note: e.target.value }))} placeholder="Visit note (optional)" className="sm:col-span-3 min-h-11 rounded-lg border p-2 text-sm" />
        <button disabled={busy || roadLoading || (kmChanged && !kmNote.trim())} className="sm:col-span-3 min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50">Save visit</button>
    </form>;
}
