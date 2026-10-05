import test from 'node:test';
import assert from 'node:assert/strict';
import { countUnread } from '../src/utils/chatThreads.js';

const ME = 'me', OFFICE_A = 'oa', CPO = 'cpo', DEALER = 'dealer';
const types = { [ME]: 'admin', [OFFICE_A]: 'sales', [CPO]: 'channel_partner_office', [DEALER]: 'agent2' };
const typeOf = id => types[id];
const msg = (id, sender_id, recipient_id, created_at, extra = {}) => ({ id, sender_id, recipient_id, cc_id: null, audience: 'admin', target_role: null, created_at, ...extra });

test('non-office: office replies and announcements count, own messages and already-seen do not', () => {
    const rows = [
        msg(1, OFFICE_A, CPO, '2026-10-05T10:00:00Z'),
        msg(2, CPO, null, '2026-10-05T10:01:00Z'),                                     // my own
        msg(3, OFFICE_A, null, '2026-10-05T10:02:00Z', { audience: 'public' }),          // announcement
        msg(4, OFFICE_A, CPO, '2026-10-05T09:00:00Z'),                                   // before marker
    ];
    const marks = { office: '2026-10-05T09:30:00Z' };
    assert.equal(countUnread(rows, { me: CPO, isOffice: false, typeOf, marks }), 2);
});

test('office: inbox and direct messages count; chats between two other people do not', () => {
    const rows = [
        msg(1, CPO, null, '2026-10-05T10:00:00Z'),          // office inbox
        msg(2, CPO, DEALER, '2026-10-05T10:01:00Z'),        // CPO <-> dealer, not addressed to me
        msg(3, DEALER, ME, '2026-10-05T10:02:00Z'),         // to me
    ];
    assert.equal(countUnread(rows, { me: ME, isOffice: true, typeOf, marks: {} }), 2);
});

test('__since hides history from before tracking started', () => {
    const rows = [msg(1, OFFICE_A, CPO, '2026-10-01T10:00:00Z'), msg(2, OFFICE_A, CPO, '2026-10-06T10:00:00Z')];
    assert.equal(countUnread(rows, { me: CPO, isOffice: false, typeOf, marks: { __since: '2026-10-05T00:00:00Z' } }), 1);
});

test('personal (private) messages form their own chat and count as unread', async () => {
    const { threadKeyFor } = await import('../src/utils/chatThreads.js');
    const p = msg(9, ME, CPO, '2026-10-05T11:00:00Z', { is_private: true });
    assert.equal(threadKeyFor(p, ME, true, typeOf), `priv:${CPO}`);
    assert.equal(threadKeyFor(p, CPO, false, typeOf), `priv:${ME}`);
    assert.equal(countUnread([p], { me: CPO, isOffice: false, typeOf, marks: {} }), 1);
    assert.equal(countUnread([p], { me: CPO, isOffice: false, typeOf, marks: { [`priv:${ME}`]: '2026-10-05T12:00:00Z' } }), 0);
});
