// ─── ActivityLogView.jsx ──────────────────────────────────────────────────────
// Full-page activity log.
//
// activity_log was removed from the `supabase_realtime` publication: it gets an
// INSERT on EVERY action by EVERY user, making it the highest-volume WAL
// producer in the system, and it was being decoded continuously for a page that
// is almost never open. realtime.list_changes was consuming 61% of database CPU.
//
// This page now refreshes on demand instead: when you open it, when you return
// to the tab, and via the Refresh button. If the table is put back into the
// publication the live path below picks up again automatically.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabase';
import { Activity, RefreshCw } from 'lucide-react';
import { ACTION_COLORS } from '../constants';

export default function ActivityLogView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastLoadedAt, setLastLoadedAt] = useState(null);
    const inFlight = useRef(false);
    // Mirrors `logs` so fetchLogs can read the current offset without
    // taking `logs` as a dependency (which would rebuild it on every load).
    const logsRef = useRef([]);

    // Who to show. Filtering happens SERVER-side: filtering the 200 already
    // fetched would show only that user's share of the newest 200 overall -
    // for a quiet user, usually nothing at all. With .eq() you get their
    // latest 200, which is what "filter by user" has to mean.
    const [userFilter, setUserFilter] = useState('all');   // 'all' | 'unattributed' | <profile id>
    const [actionFilter, setActionFilter] = useState('all');
    const [actors, setActors] = useState([]);              // [{ id, name }]

    // Paging. PAGE_SIZE at a time; `hasMore` is true while the last page came
    // back full, which is the only reliable signal without a count query.
    const PAGE_SIZE = 200;
    const [hasMore, setHasMore] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);

    // `append` loads the NEXT page and keeps what is already on screen.
    // Paging is server-side via .range(), and the filters are part of the same
    // query - so "load more" respects whatever filter is active rather than
    // pulling 200 unfiltered rows and hiding most of them.
    const fetchLogs = useCallback(async ({ silent = false, append = false } = {}) => {
        if (inFlight.current) return;      // never stack refreshes
        inFlight.current = true;
        if (append) setLoadingMore(true);
        else if (!silent) setRefreshing(true);
        try {
            const from = append ? logsRef.current.length : 0;

            let query = supabase
                .from('activity_log')
                .select('*, profiles(name)')
                .order('created_at', { ascending: false })
                .range(from, from + PAGE_SIZE - 1);

            if (userFilter === 'unattributed') query = query.is('user_id', null);
            else if (userFilter !== 'all') query = query.eq('user_id', userFilter);

            if (actionFilter !== 'all') query = query.eq('action', actionFilter);

            const { data, error } = await query;
            if (!error) {
                const page = data || [];
                setLogs(prev => {
                    if (!append) return page;
                    // De-duplicate: a row inserted while paging would otherwise
                    // shift the window and appear twice.
                    const seen = new Set(prev.map(l => l.id));
                    return [...prev, ...page.filter(l => !seen.has(l.id))];
                });
                setHasMore(page.length === PAGE_SIZE);
                setLastLoadedAt(new Date());
            } else {
                console.error('Failed to load activity log:', error);
            }
        } finally {
            inFlight.current = false;
            setLoadingMore(false);
            setRefreshing(false);
            setLoading(false);
        }
    }, [userFilter, actionFilter]);

    useEffect(() => { logsRef.current = logs; }, [logs]);

    useEffect(() => { fetchLogs({ silent: true }); }, [fetchLogs]);

    // The people who appear in the log. Built from profiles so a name shows even
    // for someone with no entries yet - "this person has done nothing" is itself
    // worth being able to see.
    useEffect(() => {
        let cancelled = false;
        supabase.from('profiles').select('id, name').order('name').then(({ data, error }) => {
            if (!cancelled && !error) setActors(data || []);
        });
        return () => { cancelled = true; };
    }, []);

    // Refresh when the operator comes back to the tab - covers the common case
    // (leave it open, come back later) at no idle cost.
    useEffect(() => {
        const onFocus = () => { if (document.visibilityState === 'visible') fetchLogs({ silent: true }); };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [fetchLogs]);

    // Still honours realtime IF activity_log is in the publication. When it is
    // not, this subscribes and simply never fires - no errors, no polling.
    useEffect(() => {
        const channel = supabase.channel('activity_log_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
                const { data } = await supabase
                    .from('activity_log')
                    .select('*, profiles(name)')
                    .eq('id', payload.new.id)
                    .single();
                if (!data) return;
                // Do not let a live insert bypass the active filter.
                const matchesUser = userFilter === 'all'
                    || (userFilter === 'unattributed' ? data.user_id === null : data.user_id === userFilter);
                const matchesAction = actionFilter === 'all' || data.action === actionFilter;
                if (!matchesUser || !matchesAction) return;
                setLogs(prev => [data, ...prev.filter(l => l.id !== data.id)]);
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, [userFilter, actionFilter]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex flex-wrap items-center gap-2 pb-1">
                <select
                    value={userFilter}
                    onChange={e => setUserFilter(e.target.value)}
                    className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer shadow-xs max-w-[190px]"
                >
                    <option value="all">Everyone</option>
                    {actors.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    <option value="unattributed">System / unattributed</option>
                </select>

                <select
                    value={actionFilter}
                    onChange={e => setActionFilter(e.target.value)}
                    className="bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-400 cursor-pointer shadow-xs"
                >
                    <option value="all">All actions</option>
                    {['create', 'update', 'stage_change', 'delete', 'email', 'error_occurred'].map(a => (
                        <option key={a} value={a}>{a.replace('_', ' ')}</option>
                    ))}
                </select>

                {(userFilter !== 'all' || actionFilter !== 'all') && (
                    <button
                        type="button"
                        onClick={() => { setUserFilter('all'); setActionFilter('all'); }}
                        className="text-[11px] font-bold text-stone-500 hover:text-amber-600 underline underline-offset-2 cursor-pointer"
                    >
                        Clear
                    </button>
                )}

                <p className="text-[11px] font-medium text-stone-400 ml-auto">
                    {lastLoadedAt
                        ? `${logs.length} loaded · updated ${lastLoadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                        : `${logs.length} loaded`}
                </p>
                <button
                    type="button"
                    onClick={() => fetchLogs()}
                    disabled={refreshing}
                    className="flex items-center gap-1.5 bg-white border border-stone-200 rounded-xl px-3 py-1.5 text-[11px] font-bold text-stone-600 hover:text-amber-600 hover:border-amber-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                >
                    <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
            </div>
            {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                    <Activity className="w-12 h-12 mb-3 text-stone-300" />
                    <p className="font-medium text-stone-500">
                        {userFilter === 'all' && actionFilter === 'all'
                            ? 'No activity logged yet'
                            : 'No activity matches these filters'}
                    </p>
                    {(userFilter !== 'all' || actionFilter !== 'all') && (
                        <p className="text-[11px] mt-1">
                            {userFilter !== 'all'
                                ? `${actors.find(a => a.id === userFilter)?.name || 'This user'} has no matching entries.`
                                : 'Try a different action type.'}
                        </p>
                    )}
                </div>
            ) : logs.map(log => (
                <div key={log.id} className="bg-white rounded-xl p-4 border border-stone-100 shadow-sm flex items-start gap-3">
                    {(() => {
                        const c = ACTION_COLORS[log.action] || { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-200' };
                        return (
                            <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase flex-shrink-0 border ${c.bg} ${c.text} ${c.border || ''}`}>
                                {log.action}
                            </span>
                        );
                    })()}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm text-stone-800">{log.message}</p>
                        {log.new_value && <p className="text-xs text-stone-500 mt-0.5">{log.new_value}</p>}
                        <p className="text-[10px] text-stone-400 mt-1 font-bold uppercase">
                            {log.profiles?.name || 'Unknown'} • {new Date(log.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                    </div>
                </div>
            ))}

            {logs.length > 0 && (
                <div className="pt-1 pb-2 flex flex-col items-center gap-1.5">
                    {hasMore ? (
                        <button
                            type="button"
                            onClick={() => fetchLogs({ append: true })}
                            disabled={loadingMore}
                            className="bg-white border border-stone-200 rounded-xl px-4 py-2 text-[11px] font-bold text-stone-600 hover:text-amber-600 hover:border-amber-200 transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                        >
                            {loadingMore ? 'Loading…' : `Load ${PAGE_SIZE} more`}
                        </button>
                    ) : (
                        <p className="text-[11px] text-stone-400 font-medium">
                            That&rsquo;s everything{userFilter !== 'all' || actionFilter !== 'all' ? ' for these filters' : ''}.
                        </p>
                    )}
                    <p className="text-[10px] text-stone-400">{logs.length} entries shown</p>
                </div>
            )}
        </div>
    );
}
