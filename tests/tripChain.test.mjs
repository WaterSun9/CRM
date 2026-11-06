import test from 'node:test';
import assert from 'node:assert/strict';
import { isNextLeg, nextLegStart, tripChain, tripChainTrips, tripSummary } from '../src/utils/tripChain.js';
import { haversineKm } from '../src/utils/tripKm.js';

const at = minutes => new Date(Date.UTC(2026, 9, 29, 4, 0) + minutes * 60000).toISOString();
const pins = { A: '384245', B: '384240', C: '385340', X: '384220' };
const pinOf = id => pins[id];

// A started from home (typed pincode), reached with GPS; B started from A's point;
// B reached with GPS; C started from B's point.
const tripA = { issue_id: 'A', started_at: at(0), start_source: 'manual', start_pincode: '384265', start_lat: null, start_lng: null, reached_at: at(40), reached_lat: 23.71, reached_lng: 71.79 };
const tripB = { issue_id: 'B', started_at: at(90), start_source: 'gps', start_pincode: '384245', start_lat: 23.71, start_lng: 71.79, reached_at: at(120), reached_lat: 23.88, reached_lng: 71.95 };
const tripC = { issue_id: 'C', started_at: at(150), start_source: 'gps', start_pincode: '384240', start_lat: 23.88, start_lng: 71.95, reached_at: at(200), reached_lat: 23.83, reached_lng: 71.6 };
// Another job the same day, started on its own from a different place.
const tripX = { issue_id: 'X', started_at: at(300), start_source: 'gps', start_pincode: null, start_lat: 23.5, start_lng: 72.1, reached_at: null, reached_lat: null, reached_lng: null };

test('nextLegStart uses the Reached site point of the house', () => {
    assert.deepEqual(nextLegStart(tripA, '384245'),
        { p_lat: 23.71, p_lng: 71.79, p_accuracy: null, p_pincode: '384245', p_source: 'gps' });
});

test('nextLegStart falls back to the house pincode, else null', () => {
    const notReached = { ...tripA, reached_at: null, reached_lat: null, reached_lng: null };
    assert.deepEqual(nextLegStart(notReached, '384245'),
        { p_lat: null, p_lng: null, p_accuracy: null, p_pincode: '384245', p_source: 'manual' });
    assert.equal(nextLegStart(notReached, ''), null);
});

test('isNextLeg: same point, or the house pincode, within 12 hours', () => {
    assert.equal(isNextLeg(tripA, tripB, pins.A), true);
    assert.equal(isNextLeg(tripB, tripA, pins.B), false);
    assert.equal(isNextLeg(tripC, tripX, pins.C), false);
    const typed = { issue_id: 'B', started_at: at(60), start_source: 'manual', start_pincode: '384245', start_lat: null, start_lng: null };
    assert.equal(isNextLeg({ ...tripA, reached_at: null, reached_lat: null, reached_lng: null }, typed, pins.A), true);
    assert.equal(isNextLeg(tripA, { ...tripB, started_at: at(40 + 13 * 60) }, pins.A), false);
});

test('tripChain finds the whole trip from any of its houses', () => {
    const trips = [tripX, tripC, tripB, tripA];
    assert.deepEqual(tripChain(trips, 'A', pinOf), ['A', 'B', 'C']);
    assert.deepEqual(tripChain(trips, 'B', pinOf), ['A', 'B', 'C']);
    assert.deepEqual(tripChain(trips, 'C', pinOf), ['A', 'B', 'C']);
    assert.deepEqual(tripChain(trips, 'X', pinOf), ['X']);
    assert.deepEqual(tripChain(trips, 'none', pinOf), ['none']);
});

test('tripSummary: start, each house by pincode, back, grace and rate from the office settings', () => {
    const chain = tripChainTrips([tripX, tripC, tripB, tripA], 'B', pinOf);
    const points = { 384265: [23.6, 71.7], 384245: [23.71, 71.79], 384240: [23.88, 71.95], 385340: [23.83, 71.6] };
    const settings = { rate_per_km: 5, grace_km: 5, round_trip: true };
    const sum = tripSummary({ chain, pincodeOf: pinOf, points, settings });
    const path = [[23.6, 71.7], [23.71, 71.79], [23.88, 71.95], [23.83, 71.6], [23.6, 71.7]];
    let straight = 0;
    for (let i = 1; i < path.length; i += 1) straight += haversineKm({ lat: path[i - 1][0], lng: path[i - 1][1] }, { lat: path[i][0], lng: path[i][1] });
    const expectedKm = Math.ceil(Math.round((Math.round(straight * 10) / 10) * 1.3 * 1e6 + 5e6) / 1e6);
    assert.equal(sum.houses, 3);
    assert.equal(sum.km, expectedKm);
    assert.equal(sum.amount, expectedKm * 5);
    assert.match(sum.explanation, /^Start 384265 -> 384245 -> 384240 -> 385340 -> back: .* \+ 5 km grace = \d+ km$/);

    const oneWay = tripSummary({ chain, pincodeOf: pinOf, points, settings: { ...settings, round_trip: false, grace_km: 0, rate_per_km: 0 } });
    assert.ok(oneWay.km < sum.km);
    assert.equal(oneWay.amount, 0);
    assert.doesNotMatch(oneWay.explanation, /back/);
});

test('tripSummary uses a Reached site point only for a house with no pincode', () => {
    const chain = tripChainTrips([tripC, tripB, tripA], 'B', id => (id === 'C' ? '' : pinOf(id)));
    const sum = tripSummary({ chain, pincodeOf: id => (id === 'C' ? '' : pinOf(id)), points: { 384265: [23.6, 71.7], 384245: [23.71, 71.79], 384240: [23.88, 71.95] }, settings: { rate_per_km: 5, grace_km: 5, round_trip: true } });
    assert.match(sum.explanation, /^Start 384265 -> 384245 -> 384240 -> Reached site -> back:/);
});

test('tripSummary is null when a point is unknown', () => {
    const chain = tripChainTrips([tripA], 'A', pinOf);
    assert.equal(tripSummary({ chain, pincodeOf: pinOf, points: {}, settings: { rate_per_km: 5, grace_km: 5, round_trip: true } }), null);
});
