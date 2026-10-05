import { DIRECT_MESSAGES_ENABLED } from '../constants.js';

// Shared by the chat window (TeamChat) and the unread badge on the chat
// button, so both put a message in the same chat and agree on what is unread.

export const OFFICE_ROLES = new Set(['admin', 'sales']);
export const BRANCH_ROLES = new Set(['channel_partner_office', 'office2', 'agent2']);
export const PUBLIC_KEY = 'public';
export const OFFICE_KEY = 'office';          // non-office users: their one chat with the office team
export const ANNOUNCE_KEY = 'announcements'; // single-chat view: all announcements in one tab
export const roleKey = role => `role:${role}`;
export const pairKey = (a, b) => `pair:${[a, b].sort().join(':')}`;   // office: a chat between two other people
export const isBroadcastKey = key => key === PUBLIC_KEY || key?.startsWith('role:');
export const isPairKey = key => key?.startsWith('pair:');
// Personal chat between an Admin and one other person (is_private messages): only those two read it.
export const privKey = other => `priv:${other}`;
export const isPrivKey = key => key?.startsWith('priv:');
export const CHAT_COLUMNS = 'id,sender_id,recipient_id,cc_id,audience,target_role,topic,body,created_at,is_private';
// Column lists to fall back to while a migration has not run yet
// (is_private: 20261005160000, cc_id: 20261004140000).
export const CHAT_COLUMN_FALLBACKS = [
    CHAT_COLUMNS,
    CHAT_COLUMNS.replace(',is_private', ''),
    CHAT_COLUMNS.replace(',is_private', '').replace(',cc_id', ''),
];
export const isMissingChatColumn = error => /is_private|cc_id/.test(error?.message || '');

// Non-office users without direct messages see one "Office team" chat with an
// Announcements tab, so every broadcast goes into one announcements chat.
export const isSingleView = isOffice => !isOffice && !DIRECT_MESSAGES_ENABLED;

// Which chat a message belongs to, from the point of view of user `me`.
// Admin / Office: one chat per outside person, holding what they sent to the
// office and every office reply to them. Admin also sees chats between two
// other people (e.g. a CPO and their dealer) as read-only "A ↔ B" chats.
// Everyone else: anything to or from Admin/Office is the "Office team" chat;
// direct chats with their own branch people are per person.
export const threadKeyFor = (message, me, isOffice, typeOf) => {
    if (message.is_private) return privKey(message.sender_id === me ? message.recipient_id : message.sender_id);
    if (message.audience === 'public') return PUBLIC_KEY;
    if (message.audience === 'role') return roleKey(message.target_role);
    const { sender_id: from, recipient_id: to, cc_id: cc } = message;
    if (cc) {                                                   // office reply inside a two-person chat
        if (isOffice) return pairKey(to, cc);
        return DIRECT_MESSAGES_ENABLED ? (to === me ? cc : to) : OFFICE_KEY;
    }
    if (isOffice) {
        if (!to) return from;                                   // office inbox
        if (from === me) return to;
        if (to === me) return from;
        const fromOffice = OFFICE_ROLES.has(typeOf(from));
        const toOffice = OFFICE_ROLES.has(typeOf(to));
        if (fromOffice && !toOffice) return to;                 // a colleague's reply to someone
        if (toOffice && !fromOffice) return from;
        return pairKey(from, to);                               // two other people
    }
    if (!to) return OFFICE_KEY;                                 // my own message to the office
    const other = from === me ? to : from;
    return DIRECT_MESSAGES_ENABLED && BRANCH_ROLES.has(typeOf(other)) ? other : OFFICE_KEY;
};

// The chat as shown on screen (broadcasts folded into Announcements in the
// single-chat view). Returns null for messages that belong to no chat.
export const displayThreadKey = (message, me, isOffice, typeOf) => {
    const raw = threadKeyFor(message, me, isOffice, typeOf);
    const key = isSingleView(isOffice) && isBroadcastKey(raw) ? ANNOUNCE_KEY : raw;
    return !key || key === me ? null : key;
};

// ── Read markers (per person, per browser) ──────────────────────────────────
// { [chatKey]: newest created_at seen, __since: start of tracking }.
// __since is set the first time someone has no markers at all, so a person's
// whole message history does not show as unread the day the badge arrives.
export const CHAT_READ_EVENT = 'watersun-chat-read';
export const CHAT_NEW_EVENT = 'watersun-chat-new';   // a new message arrived (realtime)
const readKey = userId => `watersun-chat-read-v1:${userId}`;

export const loadReadMarks = userId => {
    let marks = {};
    try { marks = JSON.parse(window.localStorage.getItem(readKey(userId)) || '{}') || {}; } catch { marks = {}; }
    if (!Object.keys(marks).length) {
        marks = { __since: new Date().toISOString() };
        try { window.localStorage.setItem(readKey(userId), JSON.stringify(marks)); } catch { /* storage blocked */ }
    }
    return marks;
};

export const saveReadMarks = (userId, marks) => {
    try { window.localStorage.setItem(readKey(userId), JSON.stringify(marks)); } catch { /* storage blocked: dots just reset */ }
    try { window.dispatchEvent(new CustomEvent(CHAT_READ_EVENT, { detail: { userId } })); } catch { /* old browser */ }
};

export const seenUpTo = (marks, key) => {
    const mark = marks?.[key] || '';
    const since = marks?.__since || '';
    return mark > since ? mark : since;
};

// Unread = sent by someone else, newer than what I have seen in that chat.
// Office staff can read every conversation, including chats between two other
// people; those are not addressed to them, so they do not count.
export const countUnread = (messages, { me, isOffice, typeOf, marks }) => {
    let total = 0;
    for (const message of messages) {
        if (message.sender_id === me) continue;
        const key = displayThreadKey(message, me, isOffice, typeOf);
        if (!key || isPairKey(key)) continue;
        if (message.created_at > seenUpTo(marks, key)) total += 1;
    }
    return total;
};
