import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Megaphone, Plus, Search, SendHorizontal, Users, X } from 'lucide-react';
import { supabase } from '../supabase';
import { APP_ROLES, DIRECT_MESSAGES_ENABLED, TECHNICIAN_FEATURE_ENABLED } from '../constants';

// WhatsApp-style team chat. The database decides who may read and send
// (crm_chat_* policies + chat_recipient_allowed / chat_directory, migration
// 20261004140000); this screen only arranges what it is given:
//   * Admin and Office see every chat and can reply in any of them (a reply
//     inside a chat between two people copies both of them via cc_id). They
//     post announcements and can message anyone directly.
//   * Everyone else has an "Office team" chat (send to the office; office replies
//     land there too), announcements meant for them, and direct chats with the
//     people the database lets them message (CPO: own staff and dealers;
//     dealer: own CPO). Anyone may reply to a person who messaged them.
const OFFICE_ROLES = new Set(['admin', 'sales']);
const BRANCH_ROLES = new Set(['channel_partner_office', 'office2', 'agent2']);
const TOPICS = [['general', 'General'], ['installation', 'Installation'], ['material_delivery', 'Material delivery']];
// target_role values. 'channel_partner_office' also reaches CPO staff (office2).
const GROUPS = [
    ['vendor', 'All vendors'],
    ['channel_partner_office', 'All CPOs'],
    ['agent', 'All channel partners'],
    ['agent2', 'All dealers'],
    ['stamp', 'All stamp makers'],
    ...(TECHNICIAN_FEATURE_ENABLED ? [['technician', 'All technicians']] : []),
    ['sales', 'All sales staff'],
];
const groupLabel = role => GROUPS.find(([id]) => id === role)?.[1] || role;
const roleLabel = type => APP_ROLES.find(role => role.user_type === type)?.label || '';
const PUBLIC_KEY = 'public';
const OFFICE_KEY = 'office';          // non-office users: their one chat with the office team
const ANNOUNCE_KEY = 'announcements'; // single-chat view: all announcements in one tab
const roleKey = role => `role:${role}`;
const pairKey = (a, b) => `pair:${[a, b].sort().join(':')}`;   // admin: a chat between two other people
const isBroadcastKey = key => key === PUBLIC_KEY || key?.startsWith('role:');
const isPairKey = key => key?.startsWith('pair:');
const PAGE = 500;
const CHAT_COLUMNS = 'id,sender_id,recipient_id,cc_id,audience,target_role,topic,body,created_at';
const POLL_MS = 15000;

// ── Role Preview (local dev only): messages live in this browser tab ─────────
const PREVIEW_MESSAGES_KEY = 'watersun-role-preview-chat-v1';
const PREVIEW_PEOPLE = APP_ROLES.map((role, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `${role.label} (Preview)`,
    email: `preview-${role.user_type}@watersun.dev`,
    user_type: role.user_type,
    status: 'active',
}));
const readPreviewMessages = () => {
    try {
        const rows = JSON.parse(window.sessionStorage.getItem(PREVIEW_MESSAGES_KEY) || '[]');
        return Array.isArray(rows) ? rows : [];
    } catch { return []; }
};
const canReadPreviewMessage = (message, user) =>
    OFFICE_ROLES.has(user.userType)
    || message.sender_id === user.id || message.recipient_id === user.id || message.cc_id === user.id
    || message.audience === 'public'
    || (message.audience === 'role' && (message.target_role === user.userType
        || (message.target_role === 'channel_partner_office' && ['office2', 'channel_partner_office_manager'].includes(user.userType))))
    || (user.userType === 'sales' && message.audience === 'admin' && !message.recipient_id);
// Same shape as the chat_directory() database function, with simplified rules.
const previewDirectory = user => PREVIEW_PEOPLE.filter(person => person.id !== user.id).map(person => {
    const mine = user.userType;
    const theirs = person.user_type;
    const canMessage = OFFICE_ROLES.has(mine)
        || (['channel_partner_office', 'office2'].includes(mine) && (OFFICE_ROLES.has(theirs) || BRANCH_ROLES.has(theirs)))
        || (mine === 'agent2' && ['channel_partner_office', 'office2'].includes(theirs));
    return { ...person, can_message: canMessage };
}).filter(person => OFFICE_ROLES.has(user.userType) || person.can_message);

// ── Read markers (per person, per browser; only drives the unread dots) ──────
const readKey = userId => `watersun-chat-read-v1:${userId}`;
const loadReadMarks = userId => {
    try { return JSON.parse(window.localStorage.getItem(readKey(userId)) || '{}') || {}; } catch { return {}; }
};
const saveReadMarks = (userId, marks) => {
    try { window.localStorage.setItem(readKey(userId), JSON.stringify(marks)); } catch { /* storage blocked: dots just reset */ }
};

// Which chat a message belongs to, from the point of view of user `me`.
// Admin / Office: one chat per outside person, holding what they sent to the
// office and every office reply to them. Admin also sees chats between two
// other people (e.g. a CPO and their dealer) as read-only "A ↔ B" chats.
// Everyone else: anything to or from Admin/Office is the "Office team" chat;
// direct chats with their own branch people are per person.
const threadKeyFor = (message, me, isOffice, typeOf) => {
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

const AVATAR_COLORS = ['bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600', 'bg-teal-600', 'bg-indigo-600', 'bg-orange-600'];
const NAME_COLORS = ['text-emerald-700', 'text-sky-700', 'text-violet-700', 'text-rose-700', 'text-amber-700', 'text-teal-700', 'text-indigo-700', 'text-orange-700'];
const colorIndex = key => [...String(key || '')].reduce((h, c) => ((h * 31) + c.charCodeAt(0)) >>> 0, 0) % AVATAR_COLORS.length;
const avatarColor = key => AVATAR_COLORS[colorIndex(key)];
const nameColor = key => NAME_COLORS[colorIndex(key)];
const initials = name => String(name || '?').replace(/\(.*?\)/g, '').trim().split(/\s+/).slice(0, 2).map(part => part[0]?.toUpperCase() || '').join('') || '?';

const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const listTime = value => {
    const date = new Date(value);
    const now = new Date();
    if (sameDay(date, now)) return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};
const bubbleTime = value => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const dayLabel = value => {
    const date = new Date(value);
    const now = new Date();
    if (sameDay(date, now)) return 'Today';
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    if (sameDay(date, yesterday)) return 'Yesterday';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
};

function Avatar({ id, name, broadcast, size = 'h-10 w-10' }) {
    return <span aria-hidden="true" className={`${size} ${broadcast ? 'bg-stone-800' : avatarColor(id)} flex shrink-0 items-center justify-center rounded-full text-sm font-bold text-white`}>
        {broadcast ? (id === PUBLIC_KEY ? <Megaphone size={18} /> : <Users size={18} />) : initials(name)}
    </span>;
}

export default function TeamChat({ user, onClose, previewMode = false }) {
    const isOffice = OFFICE_ROLES.has(user?.userType);
    const canBroadcast = isOffice;
    // Outside the office, with personal chats off, there is only one chat to
    // write in: show it full-width with an Announcements tab, no chat list.
    const singleView = !isOffice && !DIRECT_MESSAGES_ENABLED;
    const [topic, setTopic] = useState('general');
    const [drafts, setDrafts] = useState({});
    const [messages, setMessages] = useState([]);
    const [names, setNames] = useState({});
    const [types, setTypes] = useState({});
    const [people, setPeople] = useState(null);           // chat_directory(): who I can see / message
    const [selected, setSelected] = useState(isOffice ? null : OFFICE_KEY);
    const [mobileOpen, setMobileOpen] = useState(false);  // phone: list or conversation
    const [picking, setPicking] = useState(false);        // "new chat" picker open
    const [search, setSearch] = useState('');
    const [confirmBroadcast, setConfirmBroadcast] = useState(false);
    const [readMarks, setReadMarks] = useState(() => loadReadMarks(user.id));
    const [error, setError] = useState('');
    const [sending, setSending] = useState(false);
    const messageScroller = useRef(null);
    const followLatest = useRef(true);
    const latestAt = useRef(null);
    const draftKey = selected || 'unselected';
    const body = drafts[draftKey] || '';

    const rememberNames = useCallback(async rows => {
        if (!isOffice) return;                                  // others get names from chat_directory()
        const ids = [...new Set(rows.flatMap(m => [m.sender_id, m.recipient_id]).filter(Boolean))];
        if (!ids.length) return;
        const { data: profiles } = await supabase.from('profiles').select('id,name,user_type').in('id', ids);
        setNames(prev => ({ ...prev, ...Object.fromEntries((profiles || []).map(p => [p.id, p.name])) }));
        setTypes(prev => ({ ...prev, ...Object.fromEntries((profiles || []).map(p => [p.id, p.user_type])) }));
    }, [isOffice]);

    // First load reads everything (paged). Later polls fetch only messages newer
    // than the latest one held: messages are never edited or deleted, so the
    // list can only grow.
    const load = useCallback(async () => {
        if (previewMode) {
            const rows = readPreviewMessages().filter(message => canReadPreviewMessage(message, user));
            setMessages(rows);
            setNames(Object.fromEntries([...PREVIEW_PEOPLE, { id: user.id, name: user.name || 'You' }].map(person => [person.id, person.name])));
            setTypes(Object.fromEntries([...PREVIEW_PEOPLE, { id: user.id, user_type: user.userType }].map(person => [person.id, person.user_type])));
            setError('');
            return;
        }
        const fresh = [];
        for (let offset = 0; ; offset += PAGE) {
            const page = cols => {
                let query = supabase.from('crm_chat_messages').select(cols);
                if (latestAt.current) query = query.gte('created_at', latestAt.current);
                return query.order('created_at', { ascending: true }).order('id').range(offset, offset + PAGE - 1);
            };
            let { data, error: readError } = await page(CHAT_COLUMNS);
            // Before migration 20261004140000 there is no cc_id column.
            if (readError && /cc_id/.test(readError.message || '')) ({ data, error: readError } = await page(CHAT_COLUMNS.replace(',cc_id', '')));
            if (readError) { setError(readError.message); return; }
            fresh.push(...(data || []));
            if (!data || data.length < PAGE) break;
        }
        setError('');
        if (fresh.length) latestAt.current = fresh[fresh.length - 1].created_at;
        setMessages(prev => {
            if (!fresh.length) return prev;
            const known = new Set(prev.map(m => m.id));
            const added = fresh.filter(m => !known.has(m.id));
            return added.length ? [...prev, ...added] : prev;
        });
        rememberNames(fresh);
    }, [previewMode, user, rememberNames]);

    useEffect(() => {
        load();
        if (previewMode) return undefined;
        const timer = setInterval(load, POLL_MS);
        return () => clearInterval(timer);
    }, [load, previewMode]);

    // Who I can message, and the names/roles of people I've talked with.
    // Re-read when new messages arrive, since a message to me makes its sender
    // someone I can reply to.
    const loadDirectory = useCallback(async () => {
        if (previewMode) { setPeople(previewDirectory(user)); return; }
        const { data, error: dirError } = await supabase.rpc('chat_directory');
        const rows = dirError ? [] : (data || []);
        const active = rows.filter(p => p.name && (TECHNICIAN_FEATURE_ENABLED || p.user_type !== 'technician'));
        setPeople(active);
        setNames(prev => ({ ...prev, ...Object.fromEntries(active.map(p => [p.id, p.name])) }));
        setTypes(prev => ({ ...prev, ...Object.fromEntries(active.map(p => [p.id, p.user_type])) }));
    }, [previewMode, user]);
    useEffect(() => { loadDirectory(); }, [loadDirectory, messages.length]);
    const typeOf = useCallback(id => types[id], [types]);

    const threadName = useCallback(key => {
        if (!key) return '';
        if (key === PUBLIC_KEY) return 'Everyone';
        if (key === OFFICE_KEY) return 'Office team';
        if (key === ANNOUNCE_KEY) return 'Announcements';
        if (key.startsWith('role:')) return groupLabel(key.slice(5));
        if (isPairKey(key)) return key.slice(5).split(':').map(id => names[id] || 'Someone').join(' ↔ ');
        return names[key] || `User ${key.slice(0, 8)}`;
    }, [names]);

    const byThread = useMemo(() => {
        const map = new Map();
        for (const message of messages) {
            const raw = threadKeyFor(message, user.id, isOffice, typeOf);
            const key = singleView && isBroadcastKey(raw) ? ANNOUNCE_KEY : raw;
            if (!key || key === user.id) continue;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(message);
        }
        return map;
    }, [messages, user.id, isOffice, typeOf, singleView]);

    const unreadIn = useCallback(key => {
        const seen = readMarks[key] || '';
        return (byThread.get(key) || []).filter(m => m.sender_id !== user.id && m.created_at > seen).length;
    }, [byThread, readMarks, user.id]);

    // Chat list: newest activity first; non-office users always see "Office team".
    const threads = useMemo(() => {
        const keys = new Set(byThread.keys());
        if (!isOffice) keys.add(OFFICE_KEY);
        return [...keys].map(key => {
            const rows = byThread.get(key) || [];
            return { key, last: rows[rows.length - 1] || null };
        }).sort((a, b) => (b.last?.created_at || '').localeCompare(a.last?.created_at || ''));
    }, [byThread, isOffice]);

    const term = search.trim().toLowerCase();
    const shownThreads = threads.filter(({ key }) => !term || threadName(key).toLowerCase().includes(term));
    const visible = useMemo(() => (selected ? (byThread.get(selected) || []) : []), [byThread, selected]);
    const selectedPerson = (people || []).find(person => person.id === selected);
    // Can I write in the open chat?
    const canWrite = !selected ? false
        : isBroadcastKey(selected) ? canBroadcast
        : isPairKey(selected) ? isOffice
        : selected === OFFICE_KEY ? true
        : isOffice || (DIRECT_MESSAGES_ENABLED && Boolean(selectedPerson?.can_message));

    // Opening a chat (or new messages arriving in the open one) marks it read.
    useEffect(() => {
        if (!selected || !visible.length) return;
        const newest = visible[visible.length - 1].created_at;
        if ((readMarks[selected] || '') >= newest) return;
        const next = { ...readMarks, [selected]: newest };
        setReadMarks(next);
        saveReadMarks(user.id, next);
    }, [selected, visible, readMarks, user.id]);

    useEffect(() => {
        const scroller = messageScroller.current;
        if (scroller && followLatest.current) scroller.scrollTop = scroller.scrollHeight;
    }, [selected, visible.length, mobileOpen]);

    const openChat = key => {
        setSelected(key);
        setPicking(false);
        setSearch('');
        setConfirmBroadcast(false);
        setMobileOpen(true);
        followLatest.current = true;
    };

    const send = async event => {
        event?.preventDefault();
        const text = body.trim();
        if (!text || text.length > 2000 || sending || !selected) return;
        if (!canWrite) return;
        if (isBroadcastKey(selected) && !confirmBroadcast) { setConfirmBroadcast(true); return; }
        let row = { sender_id: user.id, topic, body: text, audience: 'admin', recipient_id: null, target_role: null };
        if (selected === PUBLIC_KEY) row = { ...row, audience: 'public' };
        else if (selected.startsWith('role:')) row = { ...row, audience: 'role', target_role: selected.slice(5) };
        else if (isPairKey(selected)) {
            const [first, second] = selected.slice(5).split(':');
            row = { ...row, recipient_id: first, cc_id: second };   // both people in the chat see the reply
        } else if (selected !== OFFICE_KEY) row = { ...row, recipient_id: selected };
        setSending(true);
        let sendError;
        if (previewMode) {
            try {
                const next = [...readPreviewMessages(), { ...row, id: crypto.randomUUID(), created_at: new Date().toISOString() }].slice(-500);
                window.sessionStorage.setItem(PREVIEW_MESSAGES_KEY, JSON.stringify(next));
            } catch (writeError) { sendError = writeError; }
        } else {
            ({ error: sendError } = await supabase.from('crm_chat_messages').insert(row));
        }
        setSending(false);
        setConfirmBroadcast(false);
        if (sendError) { setError(sendError.message); return; }
        setDrafts(previous => ({ ...previous, [draftKey]: '' }));
        followLatest.current = true;
        await load();
    };

    const subtitle = key => {
        if (key === PUBLIC_KEY) return 'Announcement · everyone signed in can read';
        if (key?.startsWith('role:')) return `Announcement · ${threadName(key).toLowerCase()} can read`;
        if (key === OFFICE_KEY) return 'Group chat with the office · any office staff can reply';
        if (key === ANNOUNCE_KEY) return 'From the office';
        if (isPairKey(key)) return 'Chat between two people · your reply goes to both';
        const role = roleLabel(typeOf(key));
        if (isOffice && !OFFICE_ROLES.has(typeOf(key))) return `${role ? `${role} · ` : ''}office team chat · all office staff see it`;
        return isOffice && !DIRECT_MESSAGES_ENABLED ? `${role || 'Office'} · private` : `Direct message${role ? ` · ${role}` : ''}${isOffice ? '' : ' · the office can read and reply'}`;
    };

    const pickerTerm = term;
    // Office: anyone. Others: people they may message other than the office
    // itself (the office is reached through the "Office team" chat).
    const pickerPeople = (DIRECT_MESSAGES_ENABLED ? (people || []) : [])
        .filter(person => isOffice || (person.can_message && !OFFICE_ROLES.has(person.user_type)))
        .filter(person => !pickerTerm || `${person.name} ${person.email || ''}`.toLowerCase().includes(pickerTerm));
    const pickerGroups = !canBroadcast ? [] : [[PUBLIC_KEY, 'Everyone (announcement)'], ...GROUPS.map(([id, label]) => [roleKey(id), label])]
        .filter(([, label]) => !pickerTerm || label.toLowerCase().includes(pickerTerm));
    const canStartChat = canBroadcast || (DIRECT_MESSAGES_ENABLED && (people || []).some(person => person.can_message && !OFFICE_ROLES.has(person.user_type)));

    const listRow = (key, title, preview, time, unread, broadcast, extra) => <button key={key} type="button" onClick={() => openChat(key)} aria-current={selected === key ? 'true' : undefined}
        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${selected === key ? 'bg-stone-200/70' : 'hover:bg-stone-100'}`}>
        <Avatar id={key} name={title} broadcast={broadcast} />
        <span className="min-w-0 flex-1 border-b border-stone-100 pb-2.5">
            <span className="flex items-baseline justify-between gap-2">
                <strong className="truncate text-sm font-semibold text-stone-900">{title}</strong>
                {time && <time className={`shrink-0 text-[11px] ${unread ? 'font-semibold text-emerald-600' : 'text-stone-500'}`}>{time}</time>}
            </span>
            <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-xs text-stone-600">{preview}</span>
                {unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[11px] font-bold text-white" aria-label={`${unread} unread`}>{unread}</span>}
                {extra}
            </span>
        </span>
    </button>;

    let lastDay = '';
    return <section className="flex h-full min-h-0 flex-col bg-white pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:pb-0 sm:pt-0" role="dialog" aria-label="Team chat" aria-modal="true">
        {previewMode && <p role="status" className="shrink-0 bg-amber-100 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-950">Test chat · messages stay in this browser tab. Real CRM messages are not shown or sent.</p>}
        <div className="flex min-h-0 flex-1">
            {/* ── Chat list ── */}
            {!singleView && <aside className={`${mobileOpen ? 'hidden sm:flex' : 'flex'} w-full shrink-0 flex-col border-r border-stone-200 bg-white sm:w-72`} aria-label="Chats">
                <header className="flex shrink-0 items-center justify-between gap-2 bg-stone-50 px-3 py-3">
                    {picking
                        ? <><button type="button" onClick={() => { setPicking(false); setSearch(''); }} aria-label="Back to chats" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200"><ArrowLeft size={20} /></button><h2 className="flex-1 text-base font-bold text-stone-900">New chat</h2></>
                        : <h2 className="flex-1 text-lg font-bold text-stone-900">Chats</h2>}
                    {canStartChat && !picking && <button type="button" onClick={() => { setPicking(true); setSearch(''); }} aria-label="New chat" title="New chat" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200"><Plus size={20} /></button>}
                    <button type="button" onClick={onClose} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200"><X size={20} /></button>
                </header>
                <div className="shrink-0 px-3 pb-2 pt-1">
                    <label className="flex items-center gap-2 rounded-lg bg-stone-100 px-3 py-2">
                        <Search size={15} className="text-stone-500" aria-hidden="true" />
                        <input value={search} onChange={event => setSearch(event.target.value)} placeholder={picking ? 'Search people or groups' : 'Search chats'} aria-label={picking ? 'Search people or groups' : 'Search chats'} className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-500" />
                    </label>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {picking ? <>
                        {pickerGroups.length > 0 && <p className="px-4 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-emerald-700">Announcements</p>}
                        {pickerGroups.map(([key, label]) => listRow(key, label, key === PUBLIC_KEY ? 'Everyone signed in' : 'Everyone in this group', '', 0, true))}
                        {pickerPeople.length > 0 && <p className="px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-emerald-700">People</p>}
                        {pickerPeople.map(person => listRow(person.id, person.name, [roleLabel(person.user_type), person.email].filter(Boolean).join(' · '), '', 0, false))}
                        {people === null && <p className="p-4 text-xs text-stone-500">Loading people…</p>}
                    </> : <>
                        {shownThreads.length === 0 && <p className="p-4 text-sm text-stone-500">{term ? 'No chats match.' : canStartChat ? 'No chats yet. Tap + to start one.' : 'No messages yet.'}</p>}
                        {shownThreads.map(({ key, last }) => listRow(
                            key,
                            threadName(key),
                            last ? `${last.sender_id === user.id ? 'You: ' : (showSenderPrefix(key) || (isOffice && last.sender_id !== key)) ? `${names[last.sender_id] || 'Staff'}: ` : ''}${last.body}` : 'Send a message to the office team',
                            last ? listTime(last.created_at) : '',
                            unreadIn(key),
                            isBroadcastKey(key) || isPairKey(key),
                        ))}
                    </>}
                </div>
            </aside>}

            {/* ── Conversation ── */}
            <div className={`${singleView || mobileOpen ? 'flex' : 'hidden sm:flex'} min-w-0 flex-1 flex-col bg-[#efeae2]`}>
                {!selected ? <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/70 text-stone-500"><SendHorizontal size={24} /></span>
                    <p className="text-sm font-semibold text-stone-700">Pick a chat, or tap + to start a new one</p>
                </div> : <>
                    {singleView ? <header className="shrink-0 bg-stone-50 shadow-sm">
                        <div className="flex items-center gap-3 px-3 py-2">
                            <Avatar id={OFFICE_KEY} name="Office team" size="h-9 w-9" />
                            <div className="min-w-0 flex-1">
                                <h3 className="truncate text-sm font-bold text-stone-900">Office team</h3>
                                <p className="truncate text-xs text-stone-600">Any office staff can reply</p>
                            </div>
                            <button type="button" onClick={onClose} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200"><X size={20} /></button>
                        </div>
                        <nav className="flex border-t border-stone-200" aria-label="Chat sections">
                            {[[OFFICE_KEY, 'Messages'], [ANNOUNCE_KEY, 'Announcements']].map(([key, label]) => {
                                const unread = selected === key ? 0 : unreadIn(key);
                                return <button key={key} type="button" onClick={() => openChat(key)} aria-current={selected === key ? 'page' : undefined}
                                    className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2 text-xs font-bold ${selected === key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-stone-500 hover:text-stone-800'}`}>
                                    {label}{unread > 0 && <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-500 px-1 text-[10px] text-white">{unread}</span>}
                                </button>;
                            })}
                        </nav>
                    </header> : <header className="flex shrink-0 items-center gap-3 bg-stone-50 px-3 py-2.5 shadow-sm">
                        <button type="button" onClick={() => setMobileOpen(false)} aria-label="Back to chats" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200 sm:hidden"><ArrowLeft size={20} /></button>
                        <Avatar id={selected} name={threadName(selected)} broadcast={isBroadcastKey(selected) || isPairKey(selected)} />
                        <div className="min-w-0 flex-1">
                            <h3 className="truncate text-sm font-bold text-stone-900">{threadName(selected)}</h3>
                            <p className="truncate text-xs text-stone-600">{subtitle(selected)}</p>
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close chat" className="flex h-9 w-9 items-center justify-center rounded-full text-stone-700 hover:bg-stone-200 sm:hidden"><X size={20} /></button>
                    </header>}
                    {error && <p role="alert" className="mx-3 mt-2 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
                    <div ref={messageScroller} onScroll={event => { const node = event.currentTarget; followLatest.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80; }}
                        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3 sm:px-6" aria-live="polite">
                        {visible.length === 0 && <p className="mx-auto mt-6 w-fit rounded-lg bg-white/80 px-3 py-2 text-xs text-stone-600 shadow-sm">{isBroadcastKey(selected) || selected === ANNOUNCE_KEY ? 'No announcements yet.' : singleView ? 'Write to the office team. Any office staff can reply.' : 'No messages yet. Say hello.'}</p>}
                        {visible.map((message, index) => {
                            const mine = message.sender_id === user.id;
                            const day = dayLabel(message.created_at);
                            const showDay = day !== lastDay;
                            lastDay = day;
                            const prev = visible[index - 1];
                            const grouped = prev && !showDay && prev.sender_id === message.sender_id;
                            return <div key={message.id}>
                                {showDay && <p className="mx-auto my-3 w-fit rounded-lg bg-white/90 px-3 py-1 text-[11px] font-semibold text-stone-600 shadow-sm">{day}</p>}
                                <div className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? '' : 'pt-1.5'}`}>
                                    <article className={`max-w-[85%] rounded-lg px-2.5 py-1.5 shadow-sm sm:max-w-[70%] ${mine ? 'bg-[#d9fdd3]' : 'bg-white'}`}>
                                        {/* the office can post in any chat, so always say who wrote */}{!mine && !grouped && <p className={`text-xs font-bold ${nameColor(message.sender_id)}`}>{names[message.sender_id] || (isOffice ? `User ${message.sender_id.slice(0, 8)}` : 'Office team')}</p>}
                                        {message.topic && message.topic !== 'general' && <p className="text-[10px] font-semibold uppercase tracking-wide text-stone-500">#{TOPICS.find(([id]) => id === message.topic)?.[1] || message.topic}</p>}
                                        <p className="whitespace-pre-wrap break-words text-sm text-stone-900">{message.body}
                                            <time className="float-right ml-3 mt-1.5 text-[10px] leading-none text-stone-500" dateTime={message.created_at}>{bubbleTime(message.created_at)}</time>
                                        </p>
                                    </article>
                                </div>
                            </div>;
                        })}
                    </div>
                    {canWrite ? <form onSubmit={send} className="shrink-0 bg-stone-50 px-2 py-2 sm:px-3">
                        {confirmBroadcast && <p role="alert" className="mb-2 rounded-lg bg-amber-100 p-2 text-xs font-semibold text-amber-950">This goes to {selected === PUBLIC_KEY ? 'everyone signed in' : threadName(selected).toLowerCase()}. Press send again to confirm.</p>}
                        <div className="flex items-end gap-2">
                            <select aria-label="Message topic" value={topic} onChange={event => { setTopic(event.target.value); setConfirmBroadcast(false); }}
                                className="h-11 w-24 shrink-0 rounded-full border-0 bg-white px-2 text-xs font-semibold text-stone-700 shadow-sm">
                                {TOPICS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                            </select>
                            <textarea rows={1} aria-label="Message" placeholder="Type a message" maxLength={2000} value={body}
                                onChange={event => { const value = event.target.value; setDrafts(previous => ({ ...previous, [draftKey]: value })); setConfirmBroadcast(false); }}
                                onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }}
                                className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border-0 bg-white px-4 py-3 text-sm shadow-sm outline-none" />
                            <button type="submit" disabled={sending || !body.trim()} aria-label={confirmBroadcast ? 'Confirm send' : 'Send'}
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-40 ${confirmBroadcast ? 'bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                <SendHorizontal size={18} />
                            </button>
                        </div>
                        <p className="mt-1 hidden px-2 text-[10px] text-stone-500 md:block">Enter to send · Shift+Enter for a new line</p>
                    </form> : <p className="shrink-0 bg-stone-50 px-3 py-3 text-center text-xs text-stone-600">{isPairKey(selected) ? 'You can read this conversation but not reply in it.' : isBroadcastKey(selected) || selected === ANNOUNCE_KEY ? 'Only the office can post announcements.' : 'You can reply once this person messages you.'}{!isOffice && <> <button type="button" onClick={() => openChat(OFFICE_KEY)} className="font-semibold text-emerald-700 underline">{singleView ? 'Go to messages' : 'Message the office'}</button></>}</p>}
                </>}
            </div>
        </div>
    </section>;
}

// In shared chats (announcements, the office chat) show who wrote the last
// message in the list preview; one-to-one chats don't need it.
function showSenderPrefix(key) {
    return isBroadcastKey(key) || isPairKey(key) || key === OFFICE_KEY;
}
