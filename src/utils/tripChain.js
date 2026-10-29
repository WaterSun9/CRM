// One trip, several houses ("Next house" on the technician's trip panel). No React here.

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

// The houses of one trip in the order visited, as complaint ids: from the latest trip
// of `issueId` back to where the trip began and on to its last house.
// trips: one technician's trips; pincodeOf(issueId) gives a house's pincode.
export function tripChain(trips, issueId, pincodeOf) {
    const base = trips.filter(t => t.issue_id === issueId).sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0];
    if (!base) return [issueId];
    const chain = [base];
    const before = () => trips.find(t => !chain.includes(t) && isNextLeg(t, chain[0], pincodeOf(t.issue_id)));
    const after = () => { const last = chain[chain.length - 1]; return trips.find(t => !chain.includes(t) && isNextLeg(last, t, pincodeOf(last.issue_id))); };
    for (let t = before(); t && chain.length < 20; t = before()) chain.unshift(t);
    for (let t = after(); t && chain.length < 20; t = after()) chain.push(t);
    return [...new Set(chain.map(t => t.issue_id))];
}
