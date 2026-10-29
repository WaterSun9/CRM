import test from 'node:test';
import assert from 'node:assert/strict';
import { isNextLeg, nextLegStart, tripChain } from '../src/utils/tripChain.js';

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
