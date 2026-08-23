import { useState, useEffect } from 'react';
import { Wrench } from 'lucide-react';
import { normalizeInstallationStatus } from '../utils';
import { INSTALLATION_TAGS, INSTALLATION_TAG_COLORS } from '../constants';
import { supabase } from '../supabase';

export { normalizeInstallationStatus };

export default function InstallationView({ onSelectCustomer, isChannelPartnerOffice, partnerName, channelPartnerFilter }) {
    const [activeFilter, setActiveFilter] = useState(null);
    const [installationCustomers, setInstallationCustomers] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchInstallation = async () => {
            setLoading(true);
            let allRows = [];
            let from = 0;
            const step = 1000;

            while (true) {
                let query = supabase
                    .from('admin')
                    .select('*')
                    .is('deleted_at', null)
                    .neq('installation_status', null)
                    .neq('installation_status', '')
                    .range(from, from + step - 1);
                
                if (isChannelPartnerOffice) {
                    query = query.ilike('channel_partner', partnerName);
                } else if (channelPartnerFilter) {
                    query = query.ilike('channel_partner', channelPartnerFilter);
                }

                const { data, error } = await query;
                if (error || !data || data.length === 0) break;
                allRows.push(...data);
                if (data.length < step) break;
                from += step;
            }

            setInstallationCustomers(allRows);
            setLoading(false);
        };
        fetchInstallation();
    }, [isChannelPartnerOffice, partnerName, channelPartnerFilter]);

    if (loading) return <div className="p-10 text-center animate-pulse text-stone-400">Loading installation tags...</div>;

    // Normalize customer installation statuses for consistent grouping
    const normalizedCustomers = installationCustomers.map(c => ({
        ...c,
        normalized_installation_status: normalizeInstallationStatus(c.installation_status)
    }));

    const tagged = normalizedCustomers.filter(c => c.normalized_installation_status);

    const grouped = INSTALLATION_TAGS.reduce((acc, tag) => {
        const group = tagged.filter(c => c.normalized_installation_status === tag.id);
        acc[tag.id] = group;
        return acc;
    }, {});

    if (tagged.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <Wrench className="w-10 h-10 mb-3 text-stone-300 animate-pulse" />
            <p className="font-semibold text-stone-500 text-sm">No installation status active</p>
            <p className="text-xs text-stone-400 mt-1">Assign installation status tags inside customer detail cards.</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tag filter buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <button onClick={() => setActiveFilter(null)}
                    className={`rounded-2xl p-4 border text-left transition-all ${activeFilter === null ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-900/10' : 'bg-white border-stone-100 text-stone-800 hover:border-stone-200'}`}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">All Installations</p>
                    <p className="text-2xl font-bold">{tagged.length}</p>
                </button>
                {INSTALLATION_TAGS.map(tag => {
                    const groupCount = (grouped[tag.id] || []).length;
                    const colors = INSTALLATION_TAG_COLORS[tag.id] || {};
                    const isSelected = activeFilter === tag.id;
                    return (
                        <button
                            key={tag.id}
                            onClick={() => setActiveFilter(isSelected ? null : tag.id)}
                            className={`rounded-2xl p-3 border transition-all text-left ${isSelected ? 'ring-2 ring-stone-900 ring-offset-2' : ''} ${colors.bg} ${colors.border}`}
                        >
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${colors.text}`}>{tag.label}</p>
                            <p className={`text-xl font-bold ${colors.text}`}>{groupCount}</p>
                        </button>
                    );
                })}
            </div>

            {/* Grouped listing */}
            {INSTALLATION_TAGS.filter(tag => !activeFilter || activeFilter === tag.id).map(tag => {
                const group = grouped[tag.id];
                if (!group) return null;
                const colors = INSTALLATION_TAG_COLORS[tag.id] || {};
                return (
                    <div key={tag.id} className="animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">{tag.label}</h3>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>{group.length}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.map(c => {
                                return (
                                    <button key={c.id} onClick={() => onSelectCustomer(c)}
                                        className="w-full bg-white rounded-2xl border border-stone-100 p-4 text-left hover:border-amber-200 hover:shadow-sm transition-all group">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-stone-800 text-sm group-hover:text-amber-600 transition-colors">{c.customer_name}</p>
                                                <p className="text-[10px] text-stone-400 font-medium mt-0.5">{[c.crn, c.location].filter(Boolean).join(' · ')}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-50 text-[10px]">
                                            <div>
                                                <p className="text-stone-400 font-bold uppercase">System Capacity</p>
                                                <p className="text-xs font-semibold text-stone-700 mt-0.5">{c.system_capacity_kwp ? `${c.system_capacity_kwp} kWp` : '–'}</p>
                                            </div>
                                            <div>
                                                <p className="text-stone-400 font-bold uppercase">Current Stage</p>
                                                <p className="text-xs font-semibold text-amber-600 mt-0.5">{c.stage || '–'}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
