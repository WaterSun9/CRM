import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EVENT_LABELS, INVERTER_NEEDED_TEXT, eventLabel, inverterSerialMissing } from '../src/components/service/serviceLabels.js';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('no inverter serial: empty, dashes, zeros, NA and the like', () => {
    for (const blank of [null, undefined, '', '   ', '-', '--', '.', '0', '000', 'NA', 'n/a', 'N.A.', 'nil', 'None', 'NULL']) {
        assert.equal(inverterSerialMissing(blank), true, String(blank));
    }
    for (const serial of ['GRW-55K-7781', '53000N3A263L8503', 'A1', '0A', 'NA1']) assert.equal(inverterSerialMissing(serial), false, serial);
    assert.equal(INVERTER_NEEDED_TEXT, 'Add the inverter serial number first.');
});

test('a replaced inverter has a history label', () => {
    assert.equal(eventLabel('inverter_replaced'), 'Inverter replaced');
    assert.ok(EVENT_LABELS.inverter_added);
});

test('the app, service-otp and the database use the same rule and message', () => {
    const sql = read('supabase/migrations/20261107130000_inverter_serial_rules.sql');
    const helpers = read('supabase/functions/service-otp/helpers.ts');
    assert.match(sql, /'\^\(na\|nil\|none\|null\|0\*\)\$'/);
    assert.match(helpers, /\/\^\(na\|nil\|none\|null\|0\*\)\$\//);
    assert.ok(sql.includes(`raise exception '${INVERTER_NEEDED_TEXT}'`));
    assert.ok(helpers.includes(`error: '${INVERTER_NEEDED_TEXT}'`));
    // Every event the 5 Nov list allowed is still allowed, plus inverter_replaced.
    const events = text => [...text.matchAll(/service_issue_events_event_check check \(event in \(([^;]+?)\)\);/g)].at(-1)[1].match(/'[a-z_]+'/g);
    const before = events(read('supabase/migrations/20261105120000_technician_visits.sql'));
    assert.deepEqual(events(sql), [...before, "'inverter_replaced'"]);
    for (const event of events(sql)) assert.ok(EVENT_LABELS[event.slice(1, -1)], `label for ${event}`);
});
