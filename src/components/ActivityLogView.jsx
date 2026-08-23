// ─── ActivityLogView.jsx ──────────────────────────────────────────────────────
// Full-page activity log with real-time Supabase subscription.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Activity } from 'lucide-react';

const ACTION_COLORS = {
    create:       'bg-green-100 text-green-700',
    update:       'bg-blue-100 text-blue-700',
    delete:       'bg-red-100 text-red-700',
    stage_change: 'bg-amber-100 text-amber-700',
    note:         'bg-yellow-100 text-yellow-700',
};

export default function ActivityLogView() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('activity_log')
                .select('*, profiles(name)')
                .order('created_at', { ascending: false })
                .limit(200);
            if (!error) setLogs(data || []);
            setLoading(false);
        };
        
        fetchLogs();

        const channel = supabase.channel('activity_log_realtime')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, async (payload) => {
                // Fetch just the newly inserted row to get the joined profile name
                const { data } = await supabase
                    .from('activity_log')
                    .select('*, profiles(name)')
                    .eq('id', payload.new.id)
                    .single();
                    
                if (data) {
                    setLogs(prev => [data, ...prev].slice(0, 200));
                }
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
            {logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                    <Activity className="w-12 h-12 mb-3 text-stone-300" />
                    <p className="font-medium text-stone-500">No activity logged yet</p>
                </div>
            ) : logs.map(log => (
                <div key={log.id} className="bg-white rounded-xl p-4 border border-stone-100 shadow-sm flex items-start gap-3">
                    <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase flex-shrink-0 ${ACTION_COLORS[log.action] || 'bg-stone-100 text-stone-700'}`}>
                        {log.action}
                    </span>
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
