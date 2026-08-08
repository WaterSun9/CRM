import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Activity, Calendar, User, Filter, X, Plus, Edit3, Trash2, MoveRight } from 'lucide-react';

const ACTION_ICONS = {
    create: Plus,
    update: Edit3,
    delete: Trash2,
    stage_change: MoveRight,
};

const ACTION_COLORS = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    delete: 'bg-red-100 text-red-700',
    stage_change: 'bg-purple-100 text-purple-700',
};

export default function ActivityLogView({ onClose }) {
    const [logs, setLogs] = useState([]);
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [userFilter, setUserFilter] = useState('');
    const [dateFilter, setDateFilter] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        // Fetch profile names for filter dropdown
        supabase.from('profiles').select('id, name').then(({ data }) => {
            if (data) setProfiles(data.map(p => p.name));
        });

        const fetchLogs = async () => {
            const { data, error } = await supabase
                .from('activity_log')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                console.error('Error fetching activity logs:', error);
                setLogs([]);
            } else {
                // Fetch user profiles to map names
                const { data: profiles } = await supabase.from('profiles').select('id, name');
                const profileMap = {};
                if (profiles) {
                    profiles.forEach(p => {
                        profileMap[p.id] = p.name;
                    });
                }
                // Enrich logs with profile names
                const enrichedLogs = (data || []).map(log => ({
                    ...log,
                    profiles: { name: profileMap[log.user_id] || 'Unknown User' }
                }));
                setLogs(enrichedLogs);
            }
            setLoading(false);
        };

        fetchLogs();

        // Realtime updates
        const channel = supabase
            .channel('activity_log_changes')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, () => {
                fetchLogs();
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
    }, []);

    const filteredLogs = logs.filter(log => {
        const userName = log.profiles?.name || '';
        const matchesUser = !userFilter || userName === userFilter;
        const matchesDate = !dateFilter || log.created_at?.startsWith(dateFilter);
        return matchesUser && matchesDate;
    });

    const clearFilters = () => { setUserFilter(''); setDateFilter(''); };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleString('en-IN', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    };

    return (
        <div className="fixed inset-0 modal-backdrop flex items-end sm:items-center justify-center z-50">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col">
                <div className="bg-gray-900 px-4 py-3 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Activity className="w-5 h-5 text-white" />
                        <h2 className="font-heading text-lg font-bold text-white">Activity Log</h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`p-2 rounded-lg transition-colors ${showFilters ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'}`}
                        >
                            <Filter className="w-4 h-4" />
                        </button>
                        <button onClick={onClose} className="text-white/70 hover:text-white p-2">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {showFilters && (
                    <div className="bg-gray-50 px-4 py-3 border-b flex flex-wrap gap-3 items-center">
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-gray-400" />
                            <select
                                value={userFilter}
                                onChange={(e) => setUserFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-gray-400"
                            >
                                <option value="">All Users</option>
                                {profiles.map(name => <option key={name} value={name}>{name}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-gray-400" />
                            <input
                                type="date"
                                value={dateFilter}
                                onChange={(e) => setDateFilter(e.target.value)}
                                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:ring-2 focus:ring-gray-400"
                            />
                        </div>
                        {(userFilter || dateFilter) && (
                            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear filters</button>
                        )}
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="w-6 h-6 border-2 border-gray-900 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : filteredLogs.length > 0 ? (
                        <div className="space-y-2">
                            {filteredLogs.map(log => {
                                const Icon = ACTION_ICONS[log.action] || Activity;
                                const colorClass = ACTION_COLORS[log.action] || 'bg-gray-100 text-gray-700';
                                return (
                                    <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                                        <div className={`p-2 rounded-full ${colorClass}`}>
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-gray-800">
                                                <span className="font-medium">{log.profiles?.name || 'Unknown'}</span>
                                                {' '}{log.message}
                                            </p>
                                            {log.new_value && (
                                                <p className="text-xs text-gray-500 mt-0.5">{log.new_value}</p>
                                            )}
                                            <p className="text-[10px] text-gray-400 mt-1">{formatTime(log.created_at)}</p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                            <Activity className="w-10 h-10 mb-2" />
                            <p className="text-sm">No activity logs found</p>
                            {(userFilter || dateFilter) && (
                                <button onClick={clearFilters} className="text-xs text-gray-500 underline mt-1">Clear filters</button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}