import test from 'node:test';
import assert from 'node:assert/strict';
import { issueStage, matchesFilter, OFFICE_FILTERS, serialList, cleanMobile, combinedVisitRows, eventLabel } from '../src/components/service/serviceLabels.js';
import { estimateRouteKm, haversineKm } from '../src/utils/tripKm.js';

const issue = (status, visit_stage = null) => ({ id: 'i', status, visit_stage, assigned_to: status === 'open' ? null : 't' });

test('each complaint is in exactly one tab, cancelled under Closed', () => {
    assert.deepEqual(OFFICE_FILTERS.map(([key]) => key), ['raised', 'in_process', 'visited', 'second_visit', 'closed', 'all']);
    const cases = [
        [issue('open'), 'raised'], [issue('assigned'), 'in_process'], [issue('assigned', 'visited'), 'visited'],
        [issue('completion_pending'), 'visited'], [issue('assigned', 'second_visit'), 'second_visit'],
        [issue('completion_pending', 'second_visit'), 'second_visit'], [issue('completed', 'visited'), 'closed'], [issue('cancelled'), 'closed'],
    ];
    for (const [row, tab] of cases) {
        const tabs = OFFICE_FILTERS.map(([key]) => key).filter(key => key !== 'all' && matchesFilter(row, key, 't'));
        assert.deepEqual(tabs, [tab], `${row.status}/${row.visit_stage}`);
        assert.equal(matchesFilter(row, 'all', 't'), true);
    }
    assert.equal(issueStage(issue('cancelled')), 'cancelled');
    assert.equal(eventLabel('code_sent'), 'OTP sent to customer');
});

test('panel serial numbers from a JSON array or typed text', () => {
    assert.deepEqual(serialList('["A1","A2",""]'), ['A1', 'A2']);
    assert.deepEqual(serialList(['B1', ' B2 ']), ['B1', 'B2']);
    assert.deepEqual(serialList('C1\nC2, C3;C4'), ['C1', 'C2', 'C3', 'C4']);
    assert.deepEqual(serialList('"D1"'), ['D1']);
    for (const empty of [null, undefined, '', 'null', '[]']) assert.deepEqual(serialList(empty), []);
});

test('mobile numbers are cleaned to 10 digits or refused', () => {
    assert.equal(cleanMobile('+91 98765-43210'), '9876543210');
    assert.equal(cleanMobile('098765 43210'), '9876543210');
    assert.equal(cleanMobile('12345'), '');
    assert.equal(cleanMobile('5876543210'), '');
});

test('a combined trip puts the whole km and amount on the first complaint', () => {
    assert.deepEqual(combinedVisitRows(['a', 'b', 'c'], { km: 42, amount: 420 }), [
        { issue_id: 'a', kilometers: 42, amount_inr: 420 }, { issue_id: 'b', kilometers: 0, amount_inr: 0 }, { issue_id: 'c', kilometers: 0, amount_inr: 0 }]);
});

test('route km goes through every house, back to start, with grace once', () => {
    const points = { 385340: [23.8324, 71.6047], 385350: [23.996, 71.6047], 385360: [23.9223, 71.6047] };
    const legs = haversineKm(points[385340], points[385360]) + haversineKm(points[385360], points[385350]) + haversineKm(points[385350], points[385340]);
    const route = estimateRouteKm({ start: { pincode: '385340' }, stops: [{ pincode: '385360' }, { pincode: '385350' }], points, roadFactor: 1.3, roundTrip: true, graceKm: 5 });
    assert.equal(route.km, Math.ceil(Math.round((Math.round(legs * 10) / 10 * 1.3 + 5) * 1e6) / 1e6));
    assert.match(route.explanation, /^Start 385340 -> 385360 -> 385350 -> back: /);
    const oneWay = estimateRouteKm({ start: { pincode: '385340' }, stops: [{ pincode: '385350' }], points, roadFactor: 1, roundTrip: false, graceKm: 0 });
    assert.equal(oneWay.km, Math.ceil(Math.round(haversineKm(points[385340], points[385350]) * 10) / 10));
    assert.equal(estimateRouteKm({ start: { pincode: '385340' }, stops: [{ pincode: '999999' }], points }), null);
    assert.equal(estimateRouteKm({ start: { pincode: '385340' }, stops: [], points }), null);
});
