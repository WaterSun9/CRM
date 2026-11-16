import test from 'node:test';
import assert from 'node:assert/strict';
import { NO_CHANGE, changesFor, checkCards, findingFor, loginIndex, nameKey, unusedLogins } from '../src/utils/cpDealerRules.js';

const profiles = [
    { id: 'p1', name: 'KISHORBHAI', user_type: 'agent' },                    // independent CP
    { id: 'p2', name: 'Bharat Unja', user_type: 'agent' },                   // independent CP
    { id: 'p3', name: 'Sun Office', user_type: 'channel_partner_office', channel_partner: 'SUN ENERGY' },
    { id: 'p4', name: 'Hub Office', user_type: 'channel_partner_office', channel_partner: 'GUJARAT SOLAR HUB' },
    { id: 'p5', name: 'DASHRATH MALI', user_type: 'agent2', channel_partner: 'SUN ENERGY' },
    { id: 'p6', name: 'RAVI DEALER', user_type: 'agent2', channel_partner: 'GUJARAT SOLAR HUB' },
    { id: 'p7', name: 'OLD CP', user_type: 'agent', status: 'inactive' },
    { id: 'p8', name: 'NEW DEALER', user_type: 'agent2', channel_partner: 'SUN ENERGY', created_at: '2026-11-10' },
];
const index = loginIndex(profiles);
let n = 0;
const card = (channel_partner, sub_channel_partner, extra = {}) => ({ id: `c${++n}`, customer_name: `C${n}`, channel_partner, sub_channel_partner, ...extra });
const rowOf = (byRule, rule) => byRule[rule][0];

test('name key ignores capitals, spaces and dots', () => {
    assert.equal(nameKey(' Sun  Energy. '), nameKey('SUN ENERGY'));
});

test('CP written as dealer: moves to the CP box by default', () => {
    const c = card('SUN ENERGY', 'kishorbhai');
    const row = rowOf(checkCards([c], profiles), 'cp_as_dealer');
    assert.equal(row.choice, 'fix');
    assert.deepEqual(changesFor(row, c), { channel_partner: 'KISHORBHAI', sub_channel_partner: null });
    assert.deepEqual(changesFor(row, c, NO_CHANGE), {});
});

test('dealer of another CPO: empty by default, or move to that CPO', () => {
    const c = card('SUN ENERGY', 'RAVI DEALER');
    const row = rowOf(checkCards([c], profiles), 'dealer_other_cpo');
    assert.equal(row.choice, 'empty');
    assert.deepEqual(changesFor(row, c), { sub_channel_partner: null });
    assert.deepEqual(changesFor(row, c, 'move'), { channel_partner: 'GUJARAT SOLAR HUB' });
});

test('spelling: same person by default, different people = no change', () => {
    const c = card('sun energy', 'dashrath  mali');
    const row = rowOf(checkCards([c], profiles), 'spelling');
    assert.deepEqual(changesFor(row, c), { channel_partner: 'SUN ENERGY', sub_channel_partner: 'DASHRATH MALI' });
    assert.deepEqual(changesFor(row, c, NO_CHANGE), {});
});

test('dealer with no login: grouped, no change by default, DEBOARDED keeps the name', () => {
    const a = card('SUN ENERGY', 'JAYANTI'), b = card('Sun Energy', 'jayanti');
    const byRule = checkCards([a, b], profiles);
    // b is a spelling fix first (CP box); a goes to the no-login group.
    const row = rowOf(byRule, 'dealer_no_login');
    assert.equal(row.choice, NO_CHANGE);
    assert.equal(row.cards.length, 1);
    assert.deepEqual(changesFor(row, a, 'deboard'), { channel_partner: 'DEBOARDED' });
    assert.deepEqual(changesFor(row, a, 'empty'), { sub_channel_partner: null });
    assert.ok(row.options.some(o => o.id === 'login:DASHRATH MALI'));
    assert.deepEqual(changesFor(row, a, 'login:DASHRATH MALI'), { sub_channel_partner: 'DASHRATH MALI' });
});

test('CP with no login: grouped, DEBOARDED keeps the old CP as dealer, or pick a login', () => {
    const a = card('KALPESH', ''), b = card('kalpesh', 'X');
    const row = rowOf(checkCards([a, b], profiles), 'cp_no_login');
    assert.equal(row.cards.length, 2);
    assert.equal(row.choice, NO_CHANGE);
    assert.deepEqual(changesFor(row, a, 'deboard'), { channel_partner: 'DEBOARDED', sub_channel_partner: 'KALPESH' });
    assert.deepEqual(changesFor(row, b, 'login:SUN ENERGY'), { channel_partner: 'SUN ENERGY' });
});

test('correct, look-alike, deleted, DEBOARDED and empty-CP cards are left alone', () => {
    assert.equal(findingFor(card('SUN ENERGY', 'DASHRATH MALI'), index), null);
    assert.equal(findingFor(card('SUN ENERGY', 'KISHORBHAI', { deleted_at: '2026-01-01' }), index), null);
    assert.equal(findingFor(card('DEBOARDED', 'KISHORBHAI'), index), null);
    assert.equal(findingFor(card('', ''), index), null);
    assert.equal(findingFor(card('SUN ENERGY', 'DASHRATH'), index).rule, 'dealer_no_login');   // look-alike is not fixed as spelling
});

test('logins with no customers', () => {
    const cards = [card('SUN ENERGY', 'DASHRATH MALI'), card('KISHORBHAI', '')];
    const unused = unusedLogins(cards, profiles).map(u => u.login.name);
    assert.deepEqual(unused.sort(), ['Bharat Unja', 'Hub Office', 'NEW DEALER', 'RAVI DEALER']);
});
