import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { TRIP_DISTANCE_MODE, TRIP_TRAVEL_MODE } from '../../constants';
import { estimateTripKm } from '../../utils/tripKm';
import { fetchRoadDistance, latLngOrNull, roadTripKm } from './roadKm';
import { formatDateTime, visitLabel } from './serviceLabels';
import { ReadingsLine } from './SiteVisitForm';
import { pincodeInText, pincodePoints } from './tripLabels';

const PRO = TRIP_DISTANCE_MODE === 'pro';
const time = value => (value ? formatDateTime(value) : '');

// Km of one trip, from its start to Reached site (else the customer's pincode):
// Google road km in 'pro' when both ends are phone locations, else the estimate.
function useTripKm(trip, customerPin, points) {
    const [road, setRoad] = useState(null);
    const origin = trip && trip.start_source === 'gps' ? latLngOrNull(trip.start_lat, trip.start_lng) : null;
    const destination = trip?.reached_at ? latLngOrNull(trip.reached_lat, trip.reached_lng) : null;
    const key = PRO && origin && destination ? `${origin.lat},${origin.lng}|${destination.lat},${destination.lng}` : '';
    useEffect(() => {
        if (!key) { setRoad(null); return undefined; }
        let active = true;
        fetchRoadDistance(supabase, { origin, destination, travelMode: TRIP_TRAVEL_MODE }).then(answer => {
            if (active) setRoad(answer?.ok ? roadTripKm(answer) : null);
        });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
    if (road) return { km: road.km, how: 'Google road km' };
    if (!trip || !points) return null;
    const start = trip.start_source === 'gps' ? { lat: trip.start_lat, lng: trip.start_lng } : { pincode: trip.start_pincode };
    const end = destination || (customerPin ? { pincode: customerPin } : null);
    try {
        const estimate = end ? estimateTripKm({ start, end, points }) : null;
        return estimate ? { km: estimate.km, how: 'estimate' } : null;
    } catch { return null; }
}

const clock = value => new Date(value).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' });
const day = value => new Date(value).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short' });

function VisitRows({ issue, trip, customerPin, points }) {
    const km = useTripKm(trip, customerPin, points);
    const result = trip.outcome === 'fixed' ? ['Fixed', 'bg-emerald-100 text-emerald-800']
        : trip.outcome === 'revisit' ? ['Revisit', 'bg-amber-100 text-amber-900'] : ['In progress', 'bg-stone-100 text-stone-500'];
    const cell = (name, value) => <div><dt className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{name}</dt><dd className="font-semibold">{value || '—'}</dd></div>;
    return <li className="space-y-2 rounded-xl border border-stone-200 p-3">
        <div className="flex items-center gap-2">
            <p className="text-sm font-bold">{visitLabel(issue, trip.visit_no)}</p>
            <span className="text-xs text-stone-400">{day(trip.started_at)}</span>
            <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${result[1]}`}>{result[0]}</span>
        </div>
        <dl className="grid grid-cols-4 gap-2 text-xs">
            {cell('Started', clock(trip.started_at))}
            {cell('Reached', trip.reached_at ? clock(trip.reached_at) : '')}
            {cell('Km', km ? `${km.km}` : '')}
            {cell(trip.outcome === 'fixed' ? 'Fixed' : 'Result', trip.outcome_at ? clock(trip.outcome_at) : '')}
        </dl>
        {trip.readings && <ReadingsLine readings={trip.readings} />}
        {trip.outcome_note && <p className="text-xs text-stone-500">{trip.outcome_note}</p>}
    </li>;
}

// Every visit of one complaint, step by step: claimed, then per visit (#1001-1, #1001-2, ...)
// started, reached site, km, readings and Fixed / Revisit needed.
// Office sees every technician's trips; a technician sees their own.
export default function VisitTimeline({ issue, reloadKey }) {
    const [trips, setTrips] = useState(null);
    const [points, setPoints] = useState(null);
    useEffect(() => {
        let active = true;
        supabase.from('service_trips')
            .select('id, visit_no, started_at, start_source, start_lat, start_lng, start_pincode, start_accuracy_m, reached_at, reached_lat, reached_lng, readings, outcome, outcome_note, outcome_at')
            .eq('issue_id', issue.id).order('started_at', { ascending: true }).limit(60)
            .then(({ data, error }) => { if (active) setTrips(error ? [] : data || []); });
        return () => { active = false; };
        // `issue` is a new object after every action and every 15-second poll, so the
        // steps catch up with readings and Fixed / Revisit right away.
    }, [issue, reloadKey]);
    useEffect(() => {
        let active = true;
        pincodePoints().then(data => { if (active) setPoints(data); }, () => {});
        return () => { active = false; };
    }, []);

    // A restarted trip is the same visit: keep the last trip of each visit number.
    const visits = [...new Map((trips || []).map(trip => [trip.visit_no ?? trip.id, trip])).values()];
    const customerPin = pincodeInText(issue.service_address);
    return <section aria-label="Visit steps" className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Visits</h3>
            {issue.assigned_at && <span className="text-xs text-stone-400">Claimed {time(issue.assigned_at)}</span>}
        </div>
        {trips === null ? <p className="text-xs text-stone-400">Loading…</p>
            : !visits.length ? <p className="text-xs text-stone-400">No visit yet.</p>
                : <ol className="space-y-2">{visits.map(trip => <VisitRows key={trip.id} issue={issue} trip={trip} customerPin={customerPin} points={points} />)}</ol>}
    </section>;
}
