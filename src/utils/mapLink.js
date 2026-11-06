// Reading a map point out of what the office pastes for a customer's location:
// plain coordinates or a Google Maps link. Plain module (no React) so
// tests/mapLink.test.mjs can run it under node.
//
//   parseLatLng('23.8312, 71.6043')                                -> { lat: 23.8312, lng: 71.6043 }
//   parseLatLng('https://www.google.com/maps/@23.8312,71.6043,17z') -> { lat: 23.8312, lng: 71.6043 }
//   parseLatLng('Ramesh house: 23.8312, 71.6043 (near temple)')    -> { lat: 23.8312, lng: 71.6043 }
//   parseLatLng('https://maps.app.goo.gl/AbC123')                  -> null (short link, see mapLinkHint)
//
// Never guesses: an address, a place name or a short link gives null. The office
// sees "Found ..." with a map link before anything is saved.

const NUM = '[-+]?\\d{1,3}(?:\\.\\d+)?';
// "23.8312, 71.6043", "23.8312 71.6043", "(23.8312,71.6043)", "23.8312° N, 71.6043° E".
const PAIR = new RegExp(`^\\(?\\s*(${NUM})\\s*°?\\s*([NS])?\\s*[,\\s]\\s*(${NUM})\\s*°?\\s*([EW])?\\s*\\)?$`, 'i');
// 23°49'52.3"N 71°36'15.5"E (Google Maps shows this form on a computer).
const DMS_PART = `(\\d{1,3})\\s*°\\s*(\\d{1,2})\\s*['′’]\\s*(\\d{1,2}(?:\\.\\d+)?)\\s*(?:["″”]|'')?\\s*([NSEW])`;
const DMS = new RegExp(`^${DMS_PART}[\\s,]+${DMS_PART}$`, 'i');
// A pair inside other words ("Location: 23.8312, 71.6043 (Ramesh house)"). Both numbers
// need 3+ decimals, so a house number, an amount or a pincode is never read as a point.
// N/E only as a single letter ("71.6043 West Gate" is not 71.6043 W).
const LOOSE_NUM = '[-+]?\\d{1,3}\\.\\d{3,}';
const LOOSE_PAIR = new RegExp(`(^|[^\\d.+-])(${LOOSE_NUM})\\s*°?\\s*([NS](?![a-z]))?\\s*[,\\s]\\s*(${LOOSE_NUM})\\s*°?\\s*([EW](?![a-z]))?(?!\\d|\\.\\d)`, 'gi');
const PIN_3D4D = new RegExp(`!3d(${NUM})!4d(${NUM})`);
const AT_POINT = new RegExp(`@(${NUM}),(${NUM})(?:,|$|/|\\?)`);
// Query parameters that carry "lat,lng" in Google (and other) map links, best first.
const POINT_PARAMS = ['q', 'query', 'll', 'destination', 'daddr', 'center', 'sll'];
const SHORT_HOSTS = /(^|\.)(maps\.app\.goo\.gl|goo\.gl|g\.co)$/i;

// Same box the database checks (customer_sites, service_trips).
export const INDIA_BOX = { minLat: 6, maxLat: 37, minLng: 68, maxLng: 98 };

function point(lat, lng) {
    const la = Number(lat);
    const ln = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180) return null;
    return { lat: la, lng: ln };
}

function signed(value, hemisphere) {
    const n = Number(value);
    return /^[SW]$/i.test(hemisphere || '') ? -Math.abs(n) : n;
}

// Plain text: a pair of numbers, optionally with ° and N/E, or degrees-minutes-seconds.
function parsePlain(text) {
    const pair = text.match(PAIR);
    // N/S can only follow the first number and E/W the second.
    if (pair) return point(signed(pair[1], pair[2]), signed(pair[3], pair[4]));
    const dms = text.match(DMS);
    if (dms) {
        const part = (d, m, s) => Number(d) + Number(m) / 60 + Number(s) / 3600;
        if (Number(dms[2]) >= 60 || Number(dms[3]) >= 60 || Number(dms[6]) >= 60 || Number(dms[7]) >= 60) return null;
        let first = signed(part(dms[1], dms[2], dms[3]), dms[4]);
        let second = signed(part(dms[5], dms[6], dms[7]), dms[8]);
        const firstIsLat = /^[NS]$/i.test(dms[4]);
        if (firstIsLat === /^[NS]$/i.test(dms[8])) return null;   // two latitudes or two longitudes
        if (!firstIsLat) [first, second] = [second, first];
        return point(first, second);
    }
    return null;
}

// Exactly one pair inside other words, else null (two pairs: which one is meant?).
// Not part of a longer list of numbers ("5, 23.8312, 71.6043" or "23.8312, 71.6043, 72.5").
function parseLoose(text) {
    const pairs = [...text.matchAll(LOOSE_PAIR)];
    if (pairs.length !== 1) return null;
    const [whole, before, lat, ns, lng, ew] = pairs[0];
    const head = text.slice(0, pairs[0].index + before.length);
    const tail = text.slice(pairs[0].index + whole.length);
    if (/\d\s*[,;]\s*$/.test(head) || /^\s*[,;]\s*[-+]?\d/.test(tail)) return null;
    return point(signed(lat, ns), signed(lng, ew));
}

// Text that looks like a web address (with or without https://), else null.
// A link inside a forwarded message ("Ramesh's house https://...") is picked out.
function asUrl(text) {
    let candidate = text;
    const inside = /\s/.test(candidate) && candidate.match(/https?:\/\/\S+/i);
    if (inside) candidate = inside[0];
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
        if (!/^(www\.|maps\.|goo\.gl|google\.)/i.test(candidate)) return null;
        candidate = `https://${candidate}`;
    }
    try { return new URL(candidate); } catch { return null; }
}

function safeDecode(value) {
    try { return decodeURIComponent(value); } catch { return value; }
}

// maps.app.goo.gl/..., goo.gl/maps/..., g.co/kgs/...: the point is only on Google's
// side, so the office has to open the link and copy the coordinates.
export function isShortMapLink(text) {
    const url = asUrl(String(text ?? '').trim());
    return Boolean(url && SHORT_HOSTS.test(url.hostname));
}

// A pasted Google Maps link or coordinates -> { lat, lng }, or null.
// In a link the dropped pin (!3d..!4d..) wins over ?q= / ?query=, which win
// over the map centre (@lat,lng,zoom).
export function parseLatLng(text) {
    const raw = String(text ?? '').trim();
    if (!raw || raw.length > 4000) return null;

    const geo = raw.match(new RegExp(`^geo:(${NUM}),(${NUM})`, 'i'));
    if (geo) {
        // Android shares "geo:0,0?q=23.8312,71.6043(Home)": then the point is in q.
        const q = safeDecode(raw).match(new RegExp(`[?&]q=(${NUM})\\s*,\\s*(${NUM})`, 'i'));
        if (q && Number(geo[1]) === 0 && Number(geo[2]) === 0) return point(q[1], q[2]);
        return point(geo[1], geo[2]);
    }

    const url = asUrl(raw);
    if (!url) {
        const text = raw.replace(/\s+/g, ' ');
        return parsePlain(text) || parseLoose(text);
    }
    if (SHORT_HOSTS.test(url.hostname)) return null;

    const whole = safeDecode(url.href);
    const pin = whole.match(PIN_3D4D);
    if (pin) return point(pin[1], pin[2]);
    for (const name of POINT_PARAMS) {
        const value = url.searchParams.get(name);
        if (!value) continue;
        const found = parsePlain(value.replace(/^loc:/i, '').trim().replace(/\s+/g, ' '));
        if (found) return found;
    }
    // Path parts: /maps/place/23.8312,71.6043 and /maps/search/23.8312,+71.6043 (also in
    // degrees-minutes-seconds) are the point itself; /maps/dir/A/B is a route, whose
    // last stop is the customer.
    const parts = url.pathname.split('/').map(part => safeDecode(part.replace(/\+/g, ' ')).trim().replace(/\s+/g, ' '));
    const kind = parts.findIndex(part => /^(place|search|dir)$/i.test(part));
    if (kind >= 0) {
        const stops = parts.slice(kind + 1).filter(part => part && !part.startsWith('@') && !/^data=/i.test(part));
        if (/^dir$/i.test(parts[kind])) {
            // A route without a point in it: the map centre (@) is neither end, so no guess.
            for (let i = stops.length - 1; i >= 0; i -= 1) { const found = parsePlain(stops[i]); if (found) return found; }
            return null;
        }
        const found = stops.length ? parsePlain(stops[0]) : null;
        if (found) return found;
    }
    const at = safeDecode(url.pathname + url.search).match(AT_POINT);
    if (at) return point(at[1], at[2]);
    return null;
}

export const inIndia = p => Boolean(p)
    && p.lat >= INDIA_BOX.minLat && p.lat <= INDIA_BOX.maxLat
    && p.lng >= INDIA_BOX.minLng && p.lng <= INDIA_BOX.maxLng;

// What to tell the office about a pasted text, or '' when it gives a point in India.
export function mapLinkHint(text) {
    const raw = String(text ?? '').trim();
    if (!raw) return '';
    if (isShortMapLink(raw)) return 'Open the link, then copy the coordinates (long-press the pin in Google Maps).';
    const found = parseLatLng(raw);
    if (found) {
        if (inIndia(found)) return '';
        if (inIndia({ lat: found.lng, lng: found.lat })) return 'The two numbers look swapped. Latitude comes first (about 20 to 25 in Gujarat), then longitude (about 68 to 75).';
        return 'This point is outside India. Check the numbers: latitude first, then longitude.';
    }
    if (asUrl(raw)) return 'This link has no coordinates in it. Open it in Google Maps, long-press the pin and copy the numbers (like 23.8312, 71.6043).';
    return 'Paste the coordinates like 23.8312, 71.6043, or a Google Maps link.';
}

// Six decimals is about 10 cm; enough for a house.
const fmt = n => String(Math.round(Number(n) * 1e6) / 1e6);

// "23.8312, 71.6043" for showing a point.
export const latLngText = p => (p ? `${fmt(p.lat)}, ${fmt(p.lng)}` : '');

// Google Maps page for a point (opens the app on a phone).
export const mapViewUrl = p => `https://www.google.com/maps/search/?api=1&query=${fmt(p.lat)},${fmt(p.lng)}`;
