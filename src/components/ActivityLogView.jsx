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

    const fetchLogs = useCallback(async ({ silent = false } = {}) => {
        if (inFlight.current) return;      // never stack refreshes
        inFlight.current = true;
        if (!silent) setRefreshing(true);
        try {
            const { data, error } = await supabase
                .from('activity_log')
                .select('*, profiles(name)')
                .order('created_at', { ascending: false })
                .limit(200);
            if (!error) {
                setLogs(data || []);
                setLastLoadedAt(new Date());
            } else {
                console.error('Failed to load activity log:', error);
            }
        } finally {
            inFlight.current = false;
            setRefreshing(false);
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchLogs({ silent: true }); }, [fetchLogs]);

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
                if (data) setLogs(prev => [data, ...prev.filter(l => l.id !== data.id)].slice(0, 200));
            })
            .subscribe();
        return () => supabase.removeChannel(channel);
    }, []);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto space-y-3">
            <div className="flex items-center justify-between gap-3 pb-1">
                <p className="text-[11px] font-medium text-stone-400">
                    {lastLoadedAt
                        ? `Showing the latest ${logs.length} entries · updated ${lastLoadedAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
                        : `Showing the latest ${logs.length} entries`}
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
                    <p className="font-medium text-stone-500">No activity logged yet</p>
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
        </div>
    );
}
