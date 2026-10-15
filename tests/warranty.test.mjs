import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WARRANTY_YEARS, todayIST, warrantyStartOf, warrantyEndDate, warrantyInfo,
    expiredStartCutoff, istMidnightUtc, expiredWarrantyOrFilter, formatWarrantyDate, WARRANTY_STATUS_LABELS,
} from '../src/utils/warranty.js';

const addDays = (iso, days) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

test('installation date wins, then delivery date, then completed date', () => {
    const all = { installation_date: '2024-05-10', material_delivery_date: '2024-04-01', completed_at: '2024-06-01T10:00:00+00:00' };
    assert.deepEqual(warrantyStartOf(all), { date: '2024-05-10', source: 'installation_date' });
    assert.deepEqual(warrantyStartOf({ ...all, installation_date: null }), { date: '2024-04-01', source: 'material_delivery_date' });
    assert.deepEqual(warrantyStartOf({ ...all, installation_date: '', material_delivery_date: null }), { date: '2024-06-01', source: 'completed_at' });
    assert.deepEqual(warrantyStartOf({}), { date: null, source: null });
    assert.deepEqual(warrantyStartOf(null), { date: null, source: null });
});

test('completed_at is read as the date in India, not UTC', () => {
    assert.equal(warrantyStartOf({ completed_at: '2021-10-11T19:00:00Z' }).date, '2021-10-12');
    assert.equal(warrantyStartOf({ completed_at: '2021-10-11T18:29:59Z' }).date, '2021-10-11');
    assert.equal(warrantyStartOf({ completed_at: '2021-10-12T00:10:00+05:30' }).date, '2021-10-12');
    assert.equal(todayIST(new Date('2026-10-12T18:30:00Z')), '2026-10-13');
    assert.equal(todayIST(new Date('2026-10-12T18:29:00Z')), '2026-10-12');
});

test('end date is start + 5 years - 1 day, with 29 Feb clamped like Postgres', () => {
    assert.equal(WARRANTY_YEARS, 5);
    assert.equal(warrantyEndDate('2021-10-12'), '2026-10-11');
    assert.equal(warrantyEndDate('2024-02-29'), '2029-02-27');
    assert.equal(warrantyEndDate('2024-02-28'), '2029-02-27');
    assert.equal(warrantyEndDate('2024-03-01'), '2029-02-28');
    assert.equal(warrantyEndDate('2023-03-01'), '2028-02-29');
    assert.equal(warrantyEndDate('2024-01-01'), '2028-12-31');
    assert.equal(warrantyEndDate(null), null);
    assert.equal(warrantyEndDate('2025-02-30'), null);
});

test('the last day of cover is still in warranty, the next day is not', () => {
    const customer = { installation_date: '2021-10-12' };
    assert.deepEqual(warrantyInfo(customer, '2026-10-11'), { status: 'in_warranty', start: '2021-10-12', end: '2026-10-11', source: 'installation_date' });
    assert.equal(warrantyInfo(customer, '2026-10-12').status, 'out_of_warranty');
    assert.equal(warrantyInfo({ material_delivery_date: '2024-02-29' }, '2029-02-27').status, 'in_warranty');
    assert.equal(warrantyInfo({ material_delivery_date: '2024-02-29' }, '2029-02-28').status, 'out_of_warranty');
});

test('no dates at all is unknown', () => {
    assert.deepEqual(warrantyInfo({ installation_date: null, material_delivery_date: '', completed_at: null }, '2026-10-12'),
        { status: 'unknown', start: null, end: null, source: null });
    assert.equal(WARRANTY_STATUS_LABELS.unknown, 'Warranty date missing');
});

test('expired cutoff around leap years', () => {
    assert.equal(expiredStartCutoff('2026-10-12'), '2021-10-12');
    assert.equal(expiredStartCutoff('2029-02-28'), '2024-02-29');
    assert.equal(expiredStartCutoff('2029-03-01'), '2024-03-01');
    assert.equal(expiredStartCutoff('2028-02-29'), '2023-02-28');
    assert.equal(expiredStartCutoff('2028-03-01'), '2023-03-01');
    assert.equal(expiredStartCutoff('2028-03-02'), '2023-03-02');
});

test('expired cutoff matches warrantyInfo for every day from 2026 to 2034', () => {
    for (let today = '2026-01-01'; today <= '2034-12-31'; today = addDays(today, 1)) {
        const cutoff = expiredStartCutoff(today);
        assert.equal(warrantyInfo({ installation_date: cutoff }, today).status, 'out_of_warranty', `start ${cutoff} on ${today}`);
        assert.equal(warrantyInfo({ installation_date: addDays(cutoff, 1) }, today).status, 'in_warranty', `start after ${cutoff} on ${today}`);
    }
});

test('completed_at filter boundary is midnight IST of the next day', () => {
    assert.equal(istMidnightUtc('2021-10-12'), '2021-10-11T18:30:00.000Z');
    assert.equal(warrantyStartOf({ completed_at: istMidnightUtc('2021-10-12') }).date, '2021-10-12');
    assert.equal(warrantyStartOf({ completed_at: new Date(Date.parse(istMidnightUtc('2021-10-12')) - 1).toISOString() }).date, '2021-10-11');
});

test('Warranty Expired page filter uses the cutoff for each date in order', () => {
    assert.equal(expiredWarrantyOrFilter('2026-10-12'), [
        'installation_date.lte.2021-10-12',
        'and(installation_date.is.null,material_delivery_date.lte.2021-10-12)',
        'and(installation_date.is.null,material_delivery_date.is.null,completed_at.lt."2021-10-12T18:30:00.000Z")',
    ].join(','));
    // Completed at 11:59 PM IST on the cutoff day: expired. At midnight: still covered.
    assert.equal(warrantyInfo({ completed_at: '2021-10-12T18:29:59Z' }, '2026-10-12').status, 'out_of_warranty');
    assert.equal(warrantyInfo({ completed_at: '2021-10-12T18:30:00Z' }, '2026-10-12').status, 'in_warranty');
});

test('dates are shown as 11 Oct 2031', () => {
    assert.equal(formatWarrantyDate('2031-10-11'), '11 Oct 2031');
    assert.equal(formatWarrantyDate('2026-03-03'), '3 Mar 2026');
    assert.equal(formatWarrantyDate(null), '');
});

// Worked out without warranty.js: let Date roll 29 Feb on to 1 Mar, then step
// back to the last day of February, which is what Postgres does.
const postgresEnd = (start) => {
    const [y, m, d] = start.split('-').map(Number);
    const date = new Date(Date.UTC(y + 5, m - 1, d));
    if (date.getUTCMonth() !== m - 1) date.setUTCDate(0);
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
};

test('end date follows the Postgres rule for every start from 2016 to 2036', () => {
    for (let start = '2016-01-01'; start <= '2036-12-31'; start = addDays(start, 1)) {
        assert.equal(warrantyEndDate(start), postgresEnd(start), start);
    }
});

test('timestamps in date columns and junk values do not break the badge', () => {
    assert.deepEqual(warrantyStartOf({ installation_date: '2024-05-10T00:00:00' }), { date: '2024-05-10', source: 'installation_date' });
    assert.deepEqual(warrantyStartOf({ installation_date: 'pending', material_delivery_date: '2024-04-01' }), { date: '2024-04-01', source: 'material_delivery_date' });
    assert.deepEqual(warrantyStartOf({ completed_at: 'not a time' }), { date: null, source: null });
    assert.equal(warrantyInfo({ installation_date: '2024-02-30' }, '2026-10-12').status, 'unknown');
    assert.equal(todayIST(new Date('not a time')), null);
    assert.equal(expiredStartCutoff('not a date'), null);
    assert.equal(formatWarrantyDate('2026-13-01'), '');
});

// Reads the or() string the way PostgREST does for the filters it uses, so the
// test checks the string itself (brackets, quoting) and not just the cutoff.
const splitTop = (text) => {
    const parts = [];
    let depth = 0, quoted = false, current = '';
    for (const ch of text) {
        if (ch === '"') quoted = !quoted;
        if (!quoted && ch === '(') depth++;
        if (!quoted && ch === ')') depth--;
        if (!quoted && depth === 0 && ch === ',') { parts.push(current); current = ''; } else current += ch;
    }
    assert.equal(depth, 0, `unbalanced brackets in ${text}`);
    assert.equal(quoted, false, `unclosed quote in ${text}`);
    return [...parts, current];
};
const matchesCondition = (part, row) => {
    if (part.startsWith('and(')) return splitTop(part.slice(4, -1)).every(p => matchesCondition(p, row));
    const [column, op, ...rest] = part.split('.');
    const raw = rest.join('.');
    // ':' is reserved inside or(); a value holding one must be double-quoted.
    if (!raw.startsWith('"')) assert.doesNotMatch(raw, /[:"]/, `unquoted reserved character in ${part}`);
    const value = raw.startsWith('"') ? raw.slice(1, -1) : raw;
    const field = row[column];
    if (op === 'is' && value === 'null') return field == null;
    if (op === 'lte') return field != null && field <= value;
    if (op === 'lt') return field != null && Date.parse(field) < Date.parse(value);
    throw new Error(`operator not handled in test: ${part}`);
};

test('Warranty Expired filter picks exactly the customers the badge calls out of warranty', () => {
    for (const today of ['2026-10-12', '2028-02-29', '2028-03-01', '2029-02-28', '2029-03-01', '2031-01-01']) {
        const filter = expiredWarrantyOrFilter(today);
        const cutoff = expiredStartCutoff(today);
        const rows = [{ installation_date: null, material_delivery_date: null, completed_at: null }];
        for (const delta of [-2, -1, 0, 1, 2]) {
            const day = addDays(cutoff, delta);
            rows.push({ installation_date: day, material_delivery_date: null, completed_at: null });
            rows.push({ installation_date: null, material_delivery_date: day, completed_at: null });
            // A later installation date wins over an old delivery date.
            rows.push({ installation_date: addDays(cutoff, 400), material_delivery_date: day, completed_at: null });
            const midnight = Date.parse(istMidnightUtc(day));
            for (const ms of [-1, 0, 1, 23 * 3600000, 86400000 - 1]) {
                rows.push({ installation_date: null, material_delivery_date: null, completed_at: new Date(midnight + ms).toISOString() });
            }
        }
        for (const row of rows) {
            const inFilter = splitTop(filter).some(part => matchesCondition(part, row));
            assert.equal(inFilter, warrantyInfo(row, today).status === 'out_of_warranty', `${today} ${JSON.stringify(row)}`);
        }
    }
});
