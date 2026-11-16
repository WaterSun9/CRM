import test from 'node:test';
import assert from 'node:assert/strict';
import { checkCards, fixFor, loginIndex, nameKey } from '../src/utils/cpDealerRules.js';

const profiles = [
    { name: 'KISHORBHAI', user_type: 'agent' },                              // independent CP
    { name: 'Bharat Unja', user_type: 'agent' },                             // independent CP
    { name: 'Sun Office', user_type: 'channel_partner_office', channel_partner: 'SUN ENERGY' },
    { name: 'Hub Office', user_type: 'channel_partner_office', channel_partner: 'GUJARAT SOLAR HUB' },
    { name: 'DASHRATH MALI', user_type: 'agent2', channel_partner: 'SUN ENERGY' },
    { name: 'RAVI DEALER', user_type: 'agent2', channel_partner: 'GUJARAT SOLAR HUB' },
    { name: 'OLD CP', user_type: 'agent', status: 'inactive' },
];
const index = loginIndex(profiles);
const card = (channel_partner, sub_channel_partner, extra = {}) => ({ id: 'x', channel_partner, sub_channel_partner, ...extra });

test('name key ignores capitals, spaces and dots', () => {
    assert.equal(nameKey(' Sun  Energy. '), nameKey('SUN ENERGY'));
});

test('CP written as dealer moves to the CP box', () => {
    assert.deepEqual(fixFor(card('SUN ENERGY', 'kishorbhai'), index), { rule: 'cp_as_dealer', to: { channel_partner: 'KISHORBHAI', sub_channel_partner: null } });
    // Written as its own dealer: CP stays, dealer emptied.
    assert.deepEqual(fixFor(card('KISHORBHAI', 'KISHORBHAI'), index), { rule: 'cp_as_dealer', to: { channel_partner: 'KISHORBHAI', sub_channel_partner: null } });
});

test('dealer under an independent CP is emptied', () => {
    assert.equal(fixFor(card('Bharat Unja', 'SOMEONE'), index).rule, 'dealer_under_cp');
});

test('dealer of another CPO is emptied, customer stays with its CPO', () => {
    assert.deepEqual(fixFor(card('SUN ENERGY', 'RAVI DEALER'), index), { rule: 'dealer_other_cpo', to: { channel_partner: 'SUN ENERGY', sub_channel_partner: null } });
});

test('spelling follows the login', () => {
    assert.deepEqual(fixFor(card('sun energy', 'dashrath  mali'), index), { rule: 'spelling', to: { channel_partner: 'SUN ENERGY', sub_channel_partner: 'DASHRATH MALI' } });
});

test('correct, unknown, deleted and DEBOARDED cards are left alone', () => {
    assert.equal(fixFor(card('SUN ENERGY', 'DASHRATH MALI'), index), null);
    assert.equal(fixFor(card('SUN ENERGY', 'DASHRATH'), index), null);           // not the same name: Data Review, not a rule
    assert.equal(fixFor(card('SUN ENERGY', 'KISHORBHAI', { deleted_at: '2026-01-01' }), index), null);
    assert.equal(fixFor(card('DEBOARDED', 'KISHORBHAI'), index), null);
    assert.equal(fixFor(card('SUN ENERGY', 'OLD CP'), index), null);              // inactive login does not count
});

test('checkCards groups by rule and lists only the changed fields', () => {
    const byRule = checkCards([card('SUN ENERGY', 'KISHORBHAI'), card('KISHORBHAI', 'KISHORBHAI'), card('SUN ENERGY', 'DASHRATH MALI')], profiles);
    assert.equal(byRule.cp_as_dealer.length, 2);
    assert.deepEqual(byRule.cp_as_dealer[0].changes, { channel_partner: 'KISHORBHAI', sub_channel_partner: null });
    assert.deepEqual(byRule.cp_as_dealer[1].changes, { sub_channel_partner: null });
    assert.equal(byRule.spelling.length, 0);
});
