import test from 'node:test';
import assert from 'node:assert/strict';
import { monthValueFor, recentMonthOptions } from '../src/utils/monthFilter.js';

const jan = new Date(2027, 0, 15);   // 15 Jan 2027
const nov = new Date(2026, 10, 11);  // 11 Nov 2026

test('in January, the month list goes back into last year', () => {
    const options = recentMonthOptions(jan);
    assert.equal(options.length, 12);
    assert.deepEqual(options[0], ['2027-01', 'January 2027']);
    assert.deepEqual(options[1], ['2026-12', 'December 2026']);
    assert.equal(options[11][0], '2026-02');
});

test('filter values become a year and month', () => {
    assert.equal(monthValueFor('this-month', jan), '2027-01');
    assert.equal(monthValueFor('2026-12', jan), '2026-12');
    assert.equal(monthValueFor('', jan), '');
    assert.equal(monthValueFor('junk', jan), '');
});

test('an old month-only value means the latest such month, never the future', () => {
    assert.equal(monthValueFor('12', jan), '2026-12');
    assert.equal(monthValueFor('01', jan), '2027-01');
    assert.equal(monthValueFor('11', nov), '2026-11');
    assert.equal(monthValueFor('12', nov), '2025-12');
});
