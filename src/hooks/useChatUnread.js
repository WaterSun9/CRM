import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import {
    CHAT_COLUMN_FALLBACKS, CHAT_NEW_EVENT, CHAT_READ_EVENT, OFFICE_ROLES, countUnread, isMissingChatColumn, loadReadMarks
} from '../utils/chatThreads';

// Number of unread chat messages for the badge on the chat button.
//
// Live: a realtime subscription on new chat messages (needs the table in the
// supabase_realtime publication - migration 20261005090000). The database's
// read rules decide which new messages reach this user. A slow poll and a
// re-check when the tab regains focus cover dropped connections, and the count
// updates at once when the chat window marks a chat read.
const LOOKBACK_DAYS = 60;
const POLL_MS = 60000;
const MAX_ROWS = 1000;

export default function useChatUnread(user, { enabled = true } = {}) {
    const [count, setCount] = useState(0);
    const typesRef = useRef({});
    const timerRef = useRef(null);
    const userId = user?.id;
    const isOffice = OFFICE_ROLES.has(user?.userType);

    const refresh = useCallback(async () => {
        if (!enabled || !userId) return;
        const marks = loadReadMarks(userId);
        const lookback = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
        const since = marks.__since && marks.__since > lookback ? marks.__since : lookback;
        let data = null;
        let error = null;
        for (const columns of CHAT_COLUMN_FALLBACKS) {
            ({ data, error } = await supabase.from('crm_chat_messages').select(columns)
                .gt('created_at', since).neq('sender_id', userId)
                .order('created_at', { ascending: false }).limit(MAX_ROWS));
            if (!error || !isMissingChatColumn(error)) break;   // retry only while a column is missing
        }
        if (error) return;                                  // keep the last count
        const rows = data || [];
        // Office staff need people's roles to tell their own chats from chats
        // between two other people.
        if (isOffice) {
            const unknown = [...new Set(rows.flatMap(m => [m.sender_id, m.recipient_id]).filter(id => id && !(id in typesRef.current)))];
            if (unknown.length) {
                const { data: profiles } = await supabase.from('profiles').select('id,user_type').in('id', unknown);
                for (const profile of profiles || []) typesRef.current[profile.id] = profile.user_type;
                for (const id of unknown) if (!(id in typesRef.current)) typesRef.current[id] = null;
            }
        }
        setCount(countUnread(rows, { me: userId, isOffice, typeOf: id => typesRef.current[id], marks }));
    }, [enabled, userId, isOffice]);

    useEffect(() => {
        if (!enabled || !userId) { setCount(0); return undefined; }
        refresh();
        // A burst of messages triggers one re-count.
        const soon = () => {
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(refresh, 400);
        };
        // Also tells an open chat window to fetch the new message straight away.
        const onInsert = () => {
            try { window.dispatchEvent(new CustomEvent(CHAT_NEW_EVENT)); } catch { /* old browser */ }
            soon();
        };
        const channel = supabase.channel(`chat-unread-${userId}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'crm_chat_messages' }, onInsert)
            .subscribe();
        const poll = setInterval(refresh, POLL_MS);
        const onRead = event => { if (!event.detail?.userId || event.detail.userId === userId) soon(); };
        const onStorage = event => { if (event.key?.startsWith('watersun-chat-read-v1:')) soon(); };
        const onVisible = () => { if (document.visibilityState === 'visible') soon(); };
        window.addEventListener(CHAT_READ_EVENT, onRead);
        window.addEventListener('storage', onStorage);
        window.addEventListener('focus', soon);
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            clearTimeout(timerRef.current);
            clearInterval(poll);
            supabase.removeChannel(channel);
            window.removeEventListener(CHAT_READ_EVENT, onRead);
            window.removeEventListener('storage', onStorage);
            window.removeEventListener('focus', soon);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [enabled, userId, refresh]);

    return count;
}
