// One trip, several houses ("Next house" on the technician's trip panel). No React here.
import { estimateRouteKm } from './tripKm.js';

// The next job's trip starts where the technician is now, at the house they reached:
// that house's Reached site point when there is one (the same numbers, so the office
// can link the two trips), else the house's pincode. null when there is neither.
export function nextLegStart(reachedTrip, housePincode) {
    const pin = /^[1-9]\d{5}$/.test(String(housePincode || '')) ? housePincode : null;
    if (reachedTrip?.reached_at && Number.isFinite(reachedTrip.reached_lat) && Number.isFinite(reachedTrip.reached_lng)) {
        return { p_lat: reachedTrip.reached_lat, p_lng: reachedTrip.reached_lng, p_accuracy: reachedTrip.reached_accuracy_m ?? null, p_pincode: pin, p_source: 'gps' };
    }
    return pin ? { p_lat: null, p_lng: null, p_accuracy: null, p_pincode: pin, p_source: 'manual' } : null;
}

// Did trip `next` start at the house `prev` reached? The same point as prev's Reached
// site, or (no point) the pincode of prev's house, within 12 hours.
const LEG_GAP_MS = 12 * 60 * 60 * 1000;
export function isNextLeg(prev, next, prevPincode) {
    if (!prev || !next || prev.issue_id === next.issue_id) return false;
    const after = Date.parse(next.started_at) - Date.parse(prev.reached_at || prev.started_at);
    if (!(after >= 0 && after <= LEG_GAP_MS)) return false;
    if (next.start_source === 'gps') return prev.reached_lat != null && next.start_lat === prev.reached_lat && next.start_lng === prev.reached_lng;
    return Boolean(prevPincode) && next.start_pincode === prevPincode;
}

// The trips of one journey in the order visited: from the latest trip of `issueId`
// back to where the journey began and on to its last house.
// trips: one technician's trips; pincodeOf(issueId) gives a house's pincode.
export function tripChainTrips(trips, issueId, pincodeOf) {
    const base = trips.filter(t => t.issue_id === issueId).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
    if (!base) return [];
    const chain = [base];
    const before = () => trips.find(t => !chain.includes(t) && isNextLeg(t, chain[0], pincodeOf(t.issue_id)));
    const after = () => { const last = chain[chain.length - 1]; return trips.find(t => !chain.includes(t) && isNextLeg(last, t, pincodeOf(last.issue_id))); };
    for (let t = before(); t && chain.length < 20; t = before()) chain.unshift(t);
    for (let t = after(); t && chain.length < 20; t = after()) chain.push(t);
    return chain;
}

// The same journey as complaint ids (just [issueId] when it has no trip).
export function tripChain(trips, issueId, pincodeOf) {
    const chain = tripChainTrips(trips, issueId, pincodeOf);
    return chain.length ? [...new Set(chain.map(t => t.issue_id))] : [issueId];
}

// What the technician sees when a journey ends: km from the start through each house
// and back when round trip, plus the grace km, times the rate, all from the office's km
// settings. Pincodes first (the start pincode, each house's pincode), as the office's
// combine form works it out, so both show the same km; a phone point only where there
// is no pincode. Null when a point is unknown.
//   { km, straightKm, roadFactor, graceKm, roundTrip, rate, amount, explanation, houses }
export function tripSummary({ chain, pincodeOf, points, settings }) {
    if (!chain?.length) return null;
    const first = chain[0];
    const start = first.start_pincode || !Number.isFinite(first.start_lat)
        ? { pincode: first.start_pincode } : { lat: first.start_lat, lng: first.start_lng, label: 'phone location' };
    const stops = chain.map(t => {
        const pin = pincodeOf(t.issue_id);
        return pin || !(t.reached_at && Number.isFinite(t.reached_lat)) ? { pincode: pin } : { lat: t.reached_lat, lng: t.reached_lng, label: 'Reached site' };
    });
    const route = estimateRouteKm({ start, stops, points, roundTrip: Boolean(settings?.round_trip), graceKm: Number(settings?.grace_km) || 0 });
    if (!route) return null;
    const rate = Number(settings?.rate_per_km) || 0;
    const amount = Math.round(route.km * rate);
    return { ...route, rate, amount, houses: chain.length };
}
