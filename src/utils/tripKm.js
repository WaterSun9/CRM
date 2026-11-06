// Km for a technician visit is ESTIMATED, not tracked: a website cannot follow
// a phone in the background. Start = the phone's location when the technician
// taps "Start trip" (or a typed pincode if location fails). End = the exact
// "Reached site" location if tapped, else the customer's pincode.
//   km = ceil(straight-line km x road factor x 2 (there and back) + grace km)
// Office can change the km with a reason. Pincode points come from
// src/data/gujaratPincodes.json (India Post directory, rebuilt by
// scripts/build_gujarat_pincodes.mjs); a pincode missing there means
// "no estimate", never a guess.
// Plain module (no React) so tests/tripKm.test.mjs can run it under node.

import { TRIP_ROAD_FACTOR, TRIP_ROUND_TRIP, TRIP_GRACE_KM } from '../constants.js';

const EARTH_RADIUS_KM = 6371.0088;   // mean Earth radius
// A phone location is named after the nearest pincode only when that pincode's
// point is this close; further away (outside Gujarat, or a pincode missing
// from the table) the label just says "phone location". TripPanel uses the same 20 km.
export const NEAR_PINCODE_KM = 20;

// ---- pincode table ------------------------------------------------------------

let dataPromise = null;

// The table is ~35 KB, so Vite makes it a separate chunk, loaded only when a
// trip screen needs it. Cached; a failed load is retried next time.
// No `with { type: 'json' }`: Vite 8 then leaves the path un-bundled and the
// load fails in the built app. Node needs that attribute, so node tests read
// the JSON file themselves and pass `points` in.
function loadData() {
    if (!dataPromise) {
        dataPromise = import('../data/gujaratPincodes.json')
            .then((mod) => mod.default ?? mod)
            .catch((err) => { dataPromise = null; throw err; });
    }
    return dataPromise;
}

// -> { '385340': [lat, lng], ... }
export async function loadPincodes() {
    return (await loadData()).points;
}

// Attribution line for the pincode data (GODL licence asks for it).
export async function loadPincodeSource() {
    return (await loadData()).source;
}

// ---- small helpers --------------------------------------------------------------

const round1 = (n) => Math.round(n * 10) / 10;
const fmt1 = (n) => round1(n).toFixed(1);

// '385 340', 385340 -> '385340'; anything that is not a 6-digit Indian pincode -> null.
export function normalizePincode(value) {
    const pin = String(value ?? '').replace(/\s+/g, '');
    return /^[1-9]\d{5}$/.test(pin) ? pin : null;
}

const toNumber = (v) => (v === null || v === undefined || v === '' ? NaN : Number(v));

// [lat, lng] or { lat, lng } (also latitude/longitude) -> { lat, lng } or null.
function toLatLng(p) {
    if (!p) return null;
    const lat = toNumber(Array.isArray(p) ? p[0] : (p.lat ?? p.latitude));
    const lng = toNumber(Array.isArray(p) ? p[1] : (p.lng ?? p.lon ?? p.longitude));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
}

// Straight-line ("as the crow flies") km between two points, or null.
export function haversineKm(a, b) {
    const p = toLatLng(a);
    const q = toLatLng(b);
    if (!p || !q) return null;
    const toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(q.lat - p.lat);
    const dLng = toRad(q.lng - p.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(p.lat)) * Math.cos(toRad(q.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

// [lat, lng] for a pincode, or null if it is not in the table.
export function pincodePoint(points, pin) {
    const key = normalizePincode(pin);
    if (!key || !points || !Object.prototype.hasOwnProperty.call(points, key)) return null;
    const p = toLatLng(points[key]);
    return p ? [p.lat, p.lng] : null;
}

// Closest pincode point to a location -> { pincode, km } (km to 1 decimal), or null.
export function nearestPincode(points, lat, lng) {
    const here = toLatLng([lat, lng]);
    if (!here || !points) return null;
    let best = null;
    for (const [pincode, point] of Object.entries(points)) {
        const km = haversineKm(here, point);
        if (km !== null && (!best || km < best.km)) best = { pincode, km };
    }
    return best ? { pincode: best.pincode, km: round1(best.km) } : null;
}

// ---- trip estimate --------------------------------------------------------------

// A trip end: { lat, lng } (phone location) wins over { pincode }.
// -> { lat, lng, pincode, fromLocation } or null.
function resolvePoint(end, points) {
    if (!end) return null;
    const here = toLatLng(end);
    if (here) {
        const near = nearestPincode(points, here.lat, here.lng);
        const pincode = near && near.km <= NEAR_PINCODE_KM ? near.pincode : null;
        return { ...here, pincode, fromLocation: true };
    }
    const pin = normalizePincode(end.pincode);
    const p = pincodePoint(points, pin);
    return p ? { lat: p[0], lng: p[1], pincode: pin, fromLocation: false } : null;
}

const hasAnyPoint = (end) => Boolean(toLatLng(end) || String(end?.pincode ?? '').trim());

// Why no estimate is possible, in words for the office, or null if it is.
export function tripEstimateProblem({ start, end, points } = {}) {
    if (!hasAnyPoint(start)) return 'No start point';
    if (!resolvePoint(start, points)) {
        const pin = String(start.pincode ?? '').trim();
        return normalizePincode(pin)
            ? `Start pincode ${pin} is not in the Gujarat pincode list`
            : `Start pincode "${pin}" is not a 6-digit pincode`;
    }
    if (!hasAnyPoint(end)) return 'Customer pincode missing';
    if (!resolvePoint(end, points)) {
        const pin = String(end.pincode ?? '').trim();
        return normalizePincode(pin)
            ? `Customer pincode ${pin} is not in the Gujarat pincode list`
            : `Customer pincode "${pin}" is not a 6-digit pincode`;
    }
    return null;
}

// start / end: { lat, lng } or { pincode } (an optional `label` replaces the
// default wording). Returns null if either point is unknown (see
// tripEstimateProblem for why), else the km and a one-line working:
//   'Start 385340 (phone location) to customer 385350: 18.2 km x 1.3 road x 2 + 5 km grace = 53 km'
// The sum is done on the shown 1-decimal straight km, so office can check it by hand.
export function estimateTripKm({
    start,
    end,
    points,
    roadFactor = TRIP_ROAD_FACTOR,
    roundTrip = TRIP_ROUND_TRIP,
    graceKm = TRIP_GRACE_KM,
} = {}) {
    const a = resolvePoint(start, points);
    const b = resolvePoint(end, points);
    if (!a || !b) return null;

    const factor = Number.isFinite(Number(roadFactor)) && Number(roadFactor) > 0 ? Number(roadFactor) : TRIP_ROAD_FACTOR;
    const grace = Number.isFinite(Number(graceKm)) && Number(graceKm) >= 0 ? Number(graceKm) : TRIP_GRACE_KM;
    const both = Boolean(roundTrip);

    const straightKm = round1(haversineKm(a, b));
    const oneWayKm = round1(straightKm * factor);
    // Rounded to 6 places first: 10 x 1.3 x 2 + 5 is 31.000000000000004 in floating point.
    const raw = straightKm * factor * (both ? 2 : 1) + grace;
    const km = Math.ceil(Math.round(raw * 1e6) / 1e6);

    const startLabel = start.label || (a.fromLocation
        ? (a.pincode ? `${a.pincode} (phone location)` : 'phone location')
        : `${a.pincode} (typed pincode)`);
    const endLabel = end.label || (b.fromLocation
        ? (b.pincode ? `${b.pincode} (Reached site location)` : 'Reached site location')
        : b.pincode);

    const sum = [`${fmt1(straightKm)} km`];
    if (factor !== 1) sum.push(`x ${factor} road`);
    if (both) sum.push('x 2');
    if (grace) sum.push(`+ ${grace} km grace`);
    const explanation = `Start ${startLabel} to customer ${endLabel}: ${sum.join(' ')} = ${km} km`;

    return {
        km,
        oneWayKm,
        straightKm,
        roundTrip: both,
        graceKm: grace,
        roadFactor: factor,
        startLabel,
        endLabel,
        explanation,
    };
}

// One trip to several houses: start -> house 1 -> house 2 -> ... (-> back to start
// when roundTrip). Grace is added once for the whole trip. stops: [{ pincode } or
// { lat, lng }, with an optional label]. Null when the start or any stop is unknown.
//   'Start 385340 -> 385350 -> 385001 -> back: 41.0 km x 1.3 road + 5 km grace = 59 km'
export function estimateRouteKm({
    start,
    stops,
    points,
    roadFactor = TRIP_ROAD_FACTOR,
    roundTrip = TRIP_ROUND_TRIP,
    graceKm = TRIP_GRACE_KM,
} = {}) {
    const a = resolvePoint(start, points);
    const ends = (stops || []).map((stop) => resolvePoint(stop, points));
    if (!a || !ends.length || ends.some((end) => !end)) return null;

    const factor = Number.isFinite(Number(roadFactor)) && Number(roadFactor) > 0 ? Number(roadFactor) : TRIP_ROAD_FACTOR;
    const grace = Number.isFinite(Number(graceKm)) && Number(graceKm) >= 0 ? Number(graceKm) : TRIP_GRACE_KM;
    const both = Boolean(roundTrip);

    const path = [a, ...ends, ...(both ? [a] : [])];
    let straight = 0;
    for (let i = 1; i < path.length; i += 1) straight += haversineKm(path[i - 1], path[i]);
    const straightKm = round1(straight);
    const raw = straightKm * factor + grace;
    const km = Math.ceil(Math.round(raw * 1e6) / 1e6);

    const name = (point, given) => given || point.pincode || 'location';
    const route = [`Start ${name(a, start.label)}`, ...ends.map((end, i) => name(end, stops[i].label)), ...(both ? ['back'] : [])].join(' -> ');
    const sum = [`${fmt1(straightKm)} km`];
    if (factor !== 1) sum.push(`x ${factor} road`);
    if (grace) sum.push(`+ ${grace} km grace`);
    return { km, straightKm, roundTrip: both, graceKm: grace, roadFactor: factor, explanation: `${route}: ${sum.join(' ')} = ${km} km` };
}
