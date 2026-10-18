import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import {
    haversineKm, normalizePincode, pincodePoint, nearestPincode, estimateTripKm, tripEstimateProblem, loadPincodes,
    NEAR_PINCODE_KM,
} from '../src/utils/tripKm.js';
import { TRIP_ROAD_FACTOR, TRIP_ROUND_TRIP, TRIP_GRACE_KM } from '../src/constants.js';

const KM_PER_DEG_LAT = 111.19508;   // 6371.0088 km x pi / 180
const north = ([lat, lng], km) => [Math.round((lat + km / KM_PER_DEG_LAT) * 1e4) / 1e4, lng];

// Tiny inline table: Radhanpur, a point 18.2 km north of it, and one 10.0 km north.
const RADHANPUR = [23.8324, 71.6047];
const POINTS = {
    385340: RADHANPUR,
    385350: north(RADHANPUR, 18.2),
    385360: north(RADHANPUR, 10.0),
    380001: [23.0282, 72.5834],
};

test('trip constants: 1.3 road factor, round trip, 5 km grace', () => {
    assert.equal(TRIP_ROAD_FACTOR, 1.3);
    assert.equal(TRIP_ROUND_TRIP, true);
    assert.equal(TRIP_GRACE_KM, 5);
});

test('haversineKm: straight-line km, arrays or objects, null for junk', () => {
    assert.ok(Math.abs(haversineKm([0, 0], [0, 1]) - 111.195) < 0.01);
    assert.ok(Math.abs(haversineKm({ lat: 23, lng: 72 }, [23 + 1, 72]) - 111.195) < 0.01);
    assert.equal(haversineKm(RADHANPUR, RADHANPUR), 0);
    // Radhanpur to Ahmedabad is about 134 km as the crow flies.
    const rToA = haversineKm(RADHANPUR, POINTS['380001']);
    assert.ok(rToA > 128 && rToA < 140, String(rToA));
    assert.equal(haversineKm(null, [0, 0]), null);
    assert.equal(haversineKm({ lat: '', lng: 72 }, [0, 0]), null);
    assert.equal(haversineKm({ lat: null, lng: null }, [0, 0]), null);
    assert.equal(haversineKm([91, 0], [0, 0]), null);
    assert.equal(haversineKm(['abc', 72], [0, 0]), null);
});

test('pincodes: 6 digits, spaces allowed, unknown -> null', () => {
    assert.equal(normalizePincode(' 385 340 '), '385340');
    assert.equal(normalizePincode(385340), '385340');
    assert.equal(normalizePincode('085340'), null);
    assert.equal(normalizePincode('38534'), null);
    assert.equal(normalizePincode(null), null);
    assert.deepEqual(pincodePoint(POINTS, '385 340'), RADHANPUR);
    assert.deepEqual(pincodePoint(POINTS, 385340), RADHANPUR);
    assert.equal(pincodePoint(POINTS, '999999'), null);
    assert.equal(pincodePoint(POINTS, 'constructor'), null);
    assert.equal(pincodePoint(null, '385340'), null);
});

test('nearestPincode: closest point, km to 1 decimal', () => {
    assert.deepEqual(nearestPincode(POINTS, RADHANPUR[0], RADHANPUR[1]), { pincode: '385340', km: 0 });
    const near = nearestPincode(POINTS, RADHANPUR[0] + 12 / KM_PER_DEG_LAT, RADHANPUR[1]);
    assert.equal(near.pincode, '385360');
    assert.equal(near.km, 2);
    assert.equal(nearestPincode(POINTS, NaN, 72), null);
    assert.equal(nearestPincode({}, 23, 72), null);
    assert.equal(nearestPincode(null, 23, 72), null);
});

test('estimate: the worked example the office sees', () => {
    const est = estimateTripKm({ start: { lat: RADHANPUR[0], lng: RADHANPUR[1] }, end: { pincode: '385350' }, points: POINTS });
    assert.equal(est.straightKm, 18.2);
    assert.equal(est.oneWayKm, 23.7);              // 18.2 x 1.3 = 23.66
    assert.equal(est.km, 53);                      // 18.2 x 1.3 x 2 + 5 = 52.32 -> 53
    assert.equal(est.roundTrip, true);
    assert.equal(est.graceKm, 5);
    assert.equal(est.roadFactor, 1.3);
    assert.equal(est.startLabel, '385340 (phone location)');
    assert.equal(est.endLabel, '385350');
    assert.equal(est.explanation, 'Start 385340 (phone location) to customer 385350: 18.2 km x 1.3 road x 2 + 5 km grace = 53 km');
});

test('estimate: whole km is not pushed up by floating point noise', () => {
    // 10.0 x 1.3 x 2 + 5 is 31.000000000000004 in JavaScript; must stay 31.
    const est = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385360' }, points: POINTS });
    assert.equal(est.straightKm, 10);
    assert.equal(est.km, 31);
    assert.equal(est.explanation, 'Start 385340 (typed pincode) to customer 385360: 10.0 km x 1.3 road x 2 + 5 km grace = 31 km');
});

test('estimate: same place is just the grace km', () => {
    const est = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385340' }, points: POINTS });
    assert.equal(est.straightKm, 0);
    assert.equal(est.km, 5);
});

test('estimate: Reached site location beats the pincode, and is labelled', () => {
    const site = north(RADHANPUR, 9.5);
    const est = estimateTripKm({
        start: { pincode: '385340' },
        end: { lat: site[0], lng: site[1], pincode: '380001' },
        points: POINTS,
    });
    assert.equal(est.straightKm, 9.5);
    assert.equal(est.endLabel, '385360 (Reached site location)');
    assert.equal(est.km, Math.ceil(9.5 * 1.3 * 2 + 5));
    // A location far from every pincode still works, just without a pincode name.
    const far = estimateTripKm({ start: { lat: 23.8324, lng: 71.6047 }, end: { pincode: '385340' }, points: {} });
    assert.equal(far, null);   // customer pincode unknown in an empty table
    const gpsOnly = estimateTripKm({ start: { lat: 23.8324, lng: 71.6047 }, end: { lat: 23.8324, lng: 71.6047 }, points: {} });
    assert.equal(gpsOnly.startLabel, 'phone location');
    assert.equal(gpsOnly.endLabel, 'Reached site location');
    assert.equal(gpsOnly.km, 5);
});

test('estimate: hand-worked sums, rounding up only once at the end', () => {
    // 25.0 km x 1.3 = 32.5; x 2 = 65; + 5 = 70 exactly -> 70, not 71.
    const exact = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385399' },
        points: { ...POINTS, 385399: north(RADHANPUR, 25) } });
    assert.equal(exact.straightKm, 25);
    assert.equal(exact.oneWayKm, 32.5);
    assert.equal(exact.km, 70);
    // 3.1 km: 3.1 x 1.3 x 2 + 5 = 13.06 -> 14 (always up, never down).
    const short = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385398' },
        points: { ...POINTS, 385398: north(RADHANPUR, 3.1) } });
    assert.equal(short.straightKm, 3.1);
    assert.equal(short.km, 14);
    // The sum uses the 1-decimal km that is shown: 7.69 km shows as 7.7, and
    // 7.7 x 1.3 x 2 + 5 = 25.02 -> 26, so the office can check it by hand.
    const shown = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385397' },
        points: { ...POINTS, 385397: north(RADHANPUR, 7.69) } });
    assert.equal(shown.straightKm, 7.7);
    assert.equal(shown.km, 26);
    assert.match(shown.explanation, /: 7\.7 km x 1\.3 road x 2 \+ 5 km grace = 26 km$/);
});

test('estimate: a phone location far from every pincode is not named after one', () => {
    assert.equal(NEAR_PINCODE_KM, 20);
    // 19 km north of Radhanpur: still "near" 385350 (18.2 km north).
    const near = north(RADHANPUR, 19);
    const named = estimateTripKm({ start: { lat: near[0], lng: near[1] }, end: { pincode: '385340' }, points: POINTS });
    assert.equal(named.startLabel, '385350 (phone location)');
    // 60 km north (e.g. across the Rajasthan border): the km still works, the label has no pincode.
    const far = north(RADHANPUR, 60);
    const unnamed = estimateTripKm({ start: { lat: far[0], lng: far[1] }, end: { pincode: '385340' }, points: POINTS });
    assert.equal(unnamed.startLabel, 'phone location');
    assert.equal(unnamed.straightKm, 60);
    assert.equal(unnamed.km, Math.ceil(60 * 1.3 * 2 + 5));
    const reached = estimateTripKm({ start: { pincode: '385340' }, end: { lat: far[0], lng: far[1] }, points: POINTS });
    assert.equal(reached.endLabel, 'Reached site location');
});

test('estimate: options for one way / no grace / custom labels', () => {
    const est = estimateTripKm({
        start: { pincode: '385340', label: 'Office' }, end: { pincode: '385350' }, points: POINTS, roundTrip: false, graceKm: 0,
    });
    assert.equal(est.km, Math.ceil(18.2 * 1.3));
    assert.equal(est.roundTrip, false);
    assert.equal(est.explanation, 'Start Office to customer 385350: 18.2 km x 1.3 road = 24 km');
    const flat = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385350' }, points: POINTS, roadFactor: 1 });
    assert.equal(flat.explanation, 'Start 385340 (typed pincode) to customer 385350: 18.2 km x 2 + 5 km grace = 42 km');
    // Junk options fall back to the defaults instead of producing NaN km.
    const junk = estimateTripKm({ start: { pincode: '385340' }, end: { pincode: '385350' }, points: POINTS, roadFactor: 'x', graceKm: -3 });
    assert.equal(junk.km, 53);
});

test('estimate: null when a point is unknown, with a reason for the office', () => {
    const base = { points: POINTS };
    assert.equal(estimateTripKm({ ...base, start: null, end: { pincode: '385350' } }), null);
    assert.equal(estimateTripKm({ ...base, start: { pincode: '385340' }, end: { pincode: '' } }), null);
    assert.equal(estimateTripKm({ ...base, start: { pincode: '385340' }, end: { pincode: '400001' } }), null);
    assert.equal(estimateTripKm({ ...base, start: { lat: 'x', lng: 72 }, end: { pincode: '385350' } }), null);
    assert.equal(estimateTripKm(), null);

    assert.equal(tripEstimateProblem({ ...base, start: null, end: { pincode: '385350' } }), 'No start point');
    assert.equal(tripEstimateProblem({ ...base, start: { pincode: '385340' }, end: { pincode: ' ' } }), 'Customer pincode missing');
    assert.equal(tripEstimateProblem({ ...base, start: { pincode: '385340' }, end: null }), 'Customer pincode missing');
    assert.equal(tripEstimateProblem({ ...base, start: { pincode: '385340' }, end: { pincode: '400001' } }),
        'Customer pincode 400001 is not in the Gujarat pincode list');
    assert.equal(tripEstimateProblem({ ...base, start: { pincode: '3853' }, end: { pincode: '385350' } }),
        'Start pincode "3853" is not a 6-digit pincode');
    assert.equal(tripEstimateProblem({ ...base, start: { pincode: '385340' }, end: { pincode: '385350' } }), null);
});

test('loadPincodes is exported for the app (Vite loads the JSON chunk)', () => {
    assert.equal(typeof loadPincodes, 'function');
});

// ---- the real table ------------------------------------------------------------

const JSON_URL = new URL('../src/data/gujaratPincodes.json', import.meta.url);

test('real pincode table: small, attributed, clean, and the towns are where they should be', () => {
    assert.ok(statSync(JSON_URL).size < 150 * 1024, `file is ${statSync(JSON_URL).size} bytes`);
    const data = JSON.parse(readFileSync(JSON_URL, 'utf8'));
    assert.match(data.source, /India Post/);
    assert.match(data.source, /data\.gov\.in/);
    assert.match(data.source, /Government Open Data License/);

    const pins = Object.keys(data.points);
    assert.ok(pins.length > 900, `${pins.length} pincodes`);
    for (const pin of pins) {
        const [lat, lng] = data.points[pin];
        assert.match(pin, /^3[6-9]\d{4}$/, pin);   // Gujarat pincodes are 36xxxx-39xxxx
        assert.ok(lat >= 20 && lat <= 24.8 && lng >= 68 && lng <= 74.6, `${pin} ${lat},${lng}`);
        assert.equal(Math.round(lat * 1e4) / 1e4, lat);
        assert.equal(Math.round(lng * 1e4) / 1e4, lng);
    }

    // Approximate town centres. The last six were 27-95 km off
    // before the review of 12 Oct 2026 (step 4 of the build script).
    const towns = [
        ['385340', 'Radhanpur', 23.83, 71.60],
        ['385001', 'Palanpur', 24.17, 72.43],
        ['384265', 'Patan', 23.85, 72.12],
        ['385535', 'Deesa', 24.25, 72.17],
        ['384001', 'Mehsana', 23.60, 72.39],
        ['383001', 'Himmatnagar', 23.60, 72.96],
        ['370140', 'Bhachau', 23.30, 70.34],
        ['370165', 'Rapar', 23.57, 70.64],
        ['370001', 'Bhuj', 23.25, 69.67],
        ['385565', 'Tharad', 24.40, 71.63],
        ['385575', 'Vav', 24.36, 71.53],
        ['382010', 'Gandhinagar', 23.22, 72.65],
        ['380001', 'Ahmedabad', 23.03, 72.58],
        ['384140', 'Kamli', 23.86, 72.40],
        ['382740', 'Pansar', 23.31, 72.49],
        ['394185', 'Kamrej', 21.27, 72.96],
        ['394520', 'Variav', 21.26, 72.81],
        ['382470', 'Digvijaynagar (Ahmedabad)', 23.11, 72.56],
        ['370615', 'Nakhatrana', 23.35, 69.26],
    ];
    for (const [pin, town, lat, lng] of towns) {
        const point = pincodePoint(data.points, pin);
        assert.ok(point, `${town} ${pin} missing`);
        const km = haversineKm(point, [lat, lng]);
        assert.ok(km < 15, `${town} ${pin} is ${km.toFixed(1)} km from the town centre`);
    }

    // Pincodes whose only points are wrong are left out (the app then asks for the
    // km by hand), never guessed: Lanva sat near Visnagar, Kandla Port on Bhuj,
    // Ladol near Kadi, Kadodara in the sea.
    for (const pin of ['384229', '384221', '384285', '384002', '384540', '370210', '370230', '370203', '394327', '391130']) {
        assert.equal(pincodePoint(data.points, pin), null, `${pin} should be left out`);
    }

    // A phone in Radhanpur town is "near 385340".
    assert.equal(nearestPincode(data.points, 23.832, 71.604).pincode, '385340');
    const est = estimateTripKm({ start: { lat: 23.832, lng: 71.604 }, end: { pincode: '385001' }, points: data.points });
    assert.ok(est.km > 200 && est.km < 260, est.explanation);   // Radhanpur -> Palanpur and back, ~92 km apart
    assert.match(est.explanation, /^Start 385340 \(phone location\) to customer 385001: \d+\.\d km x 1\.3 road x 2 \+ 5 km grace = \d+ km$/);
});
