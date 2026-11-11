import test from 'node:test';
import assert from 'node:assert/strict';
import { beforeSave, isRepeatSave, readSameDayVisits, sameDayKey, sameDayWarning, saveKeyMissing } from '../src/components/service/visitSave.js';

test('a repeat Save is recognised only by our two indexes', () => {
    assert.equal(isRepeatSave({ code: '23505', message: 'duplicate key value violates unique constraint "service_visits_save_key"' }), true);
    assert.equal(isRepeatSave({ code: '23505', message: 'duplicate key value violates unique constraint "service_visits_group_issue"' }), true);
    // The trip index means a real clash (another visit on that trip), not a repeat.
    assert.equal(isRepeatSave({ code: '23505', message: 'duplicate key value violates unique constraint "service_visits_one_per_trip"' }), false);
    assert.equal(isRepeatSave({ code: '42501', message: 'service_visits_save_key' }), false);
    assert.equal(isRepeatSave(null), false);
});

test('missing save_key column is detected', () => {
    assert.equal(saveKeyMissing({ code: 'PGRST204', message: "Could not find the 'save_key' column of 'service_visits'" }), true);
    assert.equal(saveKeyMissing({ code: '42703', message: 'column service_visits.save_key does not exist' }), true);
    assert.equal(saveKeyMissing({ code: '42703', message: 'column km_source does not exist' }), false);
});

test('before saving: our own earlier save, someone else\'s, or nothing', () => {
    assert.equal(beforeSave({ mine: true, others: [{ id: 1 }] }, false), 'saved');
    assert.equal(beforeSave({ mine: false, others: [{ id: 1 }] }, false), 'ask');
    assert.equal(beforeSave({ mine: false, others: [{ id: 1 }] }, true), 'save');
    assert.equal(beforeSave({ mine: false, others: [] }, false), 'save');
});

test('same-day key ignores the order of complaints', () => {
    assert.equal(sameDayKey(['b', 'a'], '2026-11-11'), sameDayKey(['a', 'b'], '2026-11-11'));
    assert.notEqual(sameDayKey(['a'], '2026-11-11'), sameDayKey(['a'], '2026-11-12'));
});

test('warning lists what is already saved', () => {
    assert.equal(sameDayWarning([]), '');
    const text = sameDayWarning([{ issue_id: 'x', kilometers: 12, amount_inr: 120 }], { ticketOf: () => 'WS-7', dateText: '2026-11-11' });
    assert.match(text, /2026-11-11/);
    assert.match(text, /WS-7: 12 km, ₹120/);
    assert.match(text, /tap Save again/);
});

// A fake supabase client: rows in, the same query shape as the real one.
const fakeClient = (rows, { noSaveKey = false } = {}) => ({
    from: () => ({
        select: columns => ({
            in: (_, ids) => ({
                eq: (__, date) => {
                    if (noSaveKey && columns.includes('save_key')) return Promise.resolve({ data: null, error: { code: '42703', message: 'column service_visits.save_key does not exist' } });
                    return Promise.resolve({ data: rows.filter(r => ids.includes(r.issue_id) && r.visit_date === date), error: null });
                },
            }),
        }),
    }),
});

test('same-day read splits our own save from others', async () => {
    const rows = [
        { id: 1, issue_id: 'a', visit_date: '2026-11-11', save_key: 'k1' },
        { id: 2, issue_id: 'a', visit_date: '2026-11-11', save_key: 'k2' },
        { id: 3, issue_id: 'a', visit_date: '2026-11-10', save_key: 'k3' },
    ];
    const found = await readSameDayVisits(fakeClient(rows), ['a'], '2026-11-11', 'k1');
    assert.equal(found.mine, true);
    assert.deepEqual(found.others.map(r => r.id), [2]);
    const none = await readSameDayVisits(fakeClient(rows), ['a'], '2026-11-11', 'other');
    assert.equal(none.mine, false);
    assert.equal(none.others.length, 2);
});

test('same-day read still works before the save_key SQL is run', async () => {
    const rows = [{ id: 1, issue_id: 'a', visit_date: '2026-11-11' }];
    const found = await readSameDayVisits(fakeClient(rows, { noSaveKey: true }), ['a'], '2026-11-11', 'k1');
    assert.equal(found.mine, false);
    assert.equal(found.others.length, 1);
});
