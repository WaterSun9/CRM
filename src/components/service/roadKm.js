// "Pro" km (TRIP_DISTANCE_MODE = 'pro' in src/constants.js): real road km from
// Google Routes through the edge function trip-distance, then the same
// there-and-back and grace as the estimate:
//   km = ceil(road km x 2 + 5)
// Any failure (not set up, limit, no route, no internet) gives { ok: false } and
// the visit form falls back to the estimate. Plain module (no React).
import { TRIP_GRACE_KM, TRIP_ROUND_TRIP } from '../../constants';

const MODE_TEXT = { TWO_WHEELER: 'two-wheeler', DRIVE: 'car' };
const WAIT_MS = 20000;   // the function gives Google 15 s
const cache = new Map(); // request key -> answer (only answers worth keeping)
const pending = new Map(); // request key -> Promise

const round1 = n => Math.round(n * 10) / 10;
const coord = n => Math.round(Number(n) * 1e6) / 1e6;

// { lat, lng } with finite numbers, else null.
export function latLngOrNull(lat, lng) {
    if (lat === null || lat === undefined || lng === null || lng === undefined || lat === '' || lng === '') return null;
    const p = { lat: Number(lat), lng: Number(lng) };
    return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
}

export const roadRequestKey = (origin, destination, travelMode) =>
    `${coord(origin.lat)},${coord(origin.lng)}|${coord(destination.lat)},${coord(destination.lng)}|${travelMode}`;

// Google's one-way road km -> the visit km and the working shown to the office:
//   'Road distance (Google Maps, two-wheeler): 23.4 km x 2 + 5 km grace = 52 km'
// null for a missing or silly distance.
export function roadTripKm({ distanceKm, travelModeUsed } = {}, { roundTrip = TRIP_ROUND_TRIP, graceKm = TRIP_GRACE_KM } = {}) {
    const oneWay = Number(distanceKm);
    if (distanceKm === null || distanceKm === undefined || distanceKm === '' || !Number.isFinite(oneWay) || oneWay < 0 || oneWay > 3000) return null;
    const routeKm = round1(oneWay);
    const grace = Number.isFinite(Number(graceKm)) && Number(graceKm) >= 0 ? Number(graceKm) : TRIP_GRACE_KM;
    const both = Boolean(roundTrip);
    // Rounded to 6 places first, as in tripKm.js (floating point).
    const raw = routeKm * (both ? 2 : 1) + grace;
    const km = Math.ceil(Math.round(raw * 1e6) / 1e6);
    const sum = [`${routeKm.toFixed(1)} km`];
    if (both) sum.push('x 2');
    if (grace) sum.push(`+ ${grace} km grace`);
    const mode = MODE_TEXT[travelModeUsed] || 'road';
    return { km, routeKm, travelModeUsed: travelModeUsed || null, explanation: `Road distance (Google Maps, ${mode}): ${sum.join(' ')} = ${km} km` };
}

// Asks trip-distance once per start/end/mode (answers are kept for this page
// load). Never throws: -> { ok: true, distanceKm, durationMinutes, travelModeUsed }
// or { ok: false, code, error }.
export function fetchRoadDistance(client, { origin, destination, travelMode }) {
    const key = roadRequestKey(origin, destination, travelMode);
    if (cache.has(key)) return Promise.resolve(cache.get(key));
    // Two screens (or React's double mount in development) asking at once share one call.
    if (!pending.has(key)) pending.set(key, askGoogle(client, key, { origin, destination, travelMode }).finally(() => pending.delete(key)));
    return pending.get(key);
}

async function askGoogle(client, key, { origin, destination, travelMode }) {
    const body = {
        origin: { lat: coord(origin.lat), lng: coord(origin.lng) },
        destination: { lat: coord(destination.lat), lng: coord(destination.lng) },
        travelMode,
    };
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), WAIT_MS); });
    let answer;
    try {
        const reply = await Promise.race([client.functions.invoke('trip-distance', { body }), timeout]);
        if (reply?.timedOut) answer = { ok: false, code: 'timeout', error: 'Google took too long to answer.' };
        else if (!reply?.error) answer = reply?.data && typeof reply.data === 'object' ? reply.data : { ok: false, code: 'bad_answer', error: 'The server gave an unexpected answer.' };
        else {
            answer = { ok: false, code: 'unreachable', error: reply.error.message || 'The road distance service did not answer.' };
            try {
                const payload = await reply.error.context?.json?.();
                if (payload?.ok === false) answer = { ...payload, code: payload.code || 'refused' };
            } catch {
                // Keep the Supabase error text.
            }
        }
    } catch (failure) {
        answer = { ok: false, code: 'unreachable', error: failure?.message || 'The road distance service did not answer.' };
    } finally {
        clearTimeout(timer);
    }
    // A road distance does not change, and "not set up" stays so until the page
    // is reloaded. Limits and network trouble are asked again next time.
    if ((answer.ok && roadTripKm(answer)) || answer.code === 'not_configured') {
        if (cache.size > 200) cache.clear();
        cache.set(key, answer);
    }
    return answer;
}

// The request back from roadRequestKey (so a React effect can depend on the key alone).
export function roadRequestFromKey(key) {
    const [from, to, travelMode] = String(key || '').split('|');
    const point = text => { const [lat, lng] = String(text || '').split(',').map(Number); return latLngOrNull(lat, lng); };
    const origin = point(from);
    const destination = point(to);
    return origin && destination && travelMode ? { origin, destination, travelMode } : null;
}
