import { useState, useEffect, useCallback, useRef } from 'react';
import { ShieldAlert, ShieldCheck, ShieldQuestion, Search, RefreshCw, ChevronDown, Info, Wrench } from 'lucide-react';
import { CUSTOMER_CARD_COLUMNS, STAGE_IDS } from '../constants';
import { supabase } from '../supabase';
import { todayIST, warrantyInfo, expiredWarrantyOrFilter, inWarrantyOrFilter, formatWarrantyDate } from '../utils/warranty';
import WarrantyBadge from './WarrantyBadge';

const PAGE_SIZE = 50;

const TABS = [
    { id: 'in_warranty', label: 'In warranty', icon: ShieldCheck, selected: 'bg-emerald-600 border-emerald-600 text-white' },
    { id: 'expired', label: 'Out of warranty', icon: ShieldAlert, selected: 'bg-red-600 border-red-600 text-white' },
    { id: 'missing', label: 'Date missing', icon: ShieldQuestion, selected: 'bg-amber-500 border-amber-500 text-white' },
];

const SOURCE_LABELS = {
    installation_date: 'installation date',
    material_delivery_date: 'delivery date',
    completed_at: 'completed date',
};

// Commas and brackets would end the PostgREST or() filter early.
const cleanSearch = (term) => term.replace(/[,()"\\]/g, ' ').trim();

const withTab = (query, tabId, today) => tabId === 'missing'
    ? query.is('installation_date', null).is('material_delivery_date', null).is('completed_at', null)
    : query.or(tabId === 'in_warranty' ? inWarrantyOrFilter(today) : expiredWarrantyOrFilter(today));

// Warranty page: completed customers in warranty, out of warranty (5 years ended),
// worked out on the server from the same dates as the badge (src/utils/warranty.js),
// and the completed customers with no date at all so the office can fill them in.
export default function WarrantyView({ onSelectCustomer, onRaiseServiceIssue, isChannelPartnerOffice, partnerName, channelPartnerFilter, dealerFilter }) {
    const [activeTab, setActiveTab] = useState('in_warranty');
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [customers, setCustomers] = useState([]);
    const [loadError, setLoadError] = useState(null);
    const [tabCounts, setTabCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const fetchSeqRef = useRef(0);

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(cleanSearch(searchTerm));
            setPage(0);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Completed, not deleted, scoped to the partner / dealer like the other tag pages.
    const scopedQuery = useCallback((columns, options) => {
        const targetPartner = isChannelPartnerOffice ? partnerName : (channelPartnerFilter?.trim() || null);
        let query = supabase
            .from('admin')
            .select(columns, options)
            .is('deleted_at', null)
            .eq('stage', STAGE_IDS.COMPLETED);
        if (targetPartner) query = query.ilike('channel_partner', `%${targetPartner}%`);
        if (dealerFilter) query = query.ilike('sub_channel_partner', dealerFilter);
        return query;
    }, [isChannelPartnerOffice, partnerName, channelPartnerFilter, dealerFilter]);

    const fetchCounts = useCallback(async () => {
        const today = todayIST();
        try {
            const results = await Promise.all(TABS.map(tab =>
                withTab(scopedQuery('id', { count: 'exact', head: true }), tab.id, today)));
            const counts = {};
            TABS.forEach((tab, i) => { counts[tab.id] = results[i].error ? null : (results[i].count ?? 0); });
            setTabCounts(counts);
        } catch (err) {
            console.error('Error fetching warranty counts:', err);
        }
    }, [scopedQuery]);

    const fetchCustomers = useCallback(async (pageNum = 0, isAppend = false) => {
        const seq = ++fetchSeqRef.current;
        if (pageNum === 0) setLoading(true);
        else setLoadingMore(true);

        try {
            let query = withTab(scopedQuery(CUSTOMER_CARD_COLUMNS), activeTab, todayIST());
            // Newest start date first (most recently expired / installed). id keeps the pages stable when dates tie.
            query = activeTab === 'missing'
                ? query.order('updated_at', { ascending: false, nullsFirst: false })
                : query.order('installation_date', { ascending: false, nullsFirst: false })
                    .order('material_delivery_date', { ascending: false, nullsFirst: false })
                    .order('completed_at', { ascending: false, nullsFirst: false });
            query = query.order('id').range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

            if (debouncedSearch) {
                query = query.or(`customer_name.ilike.%${debouncedSearch}%,consumer_no.ilike.%${debouncedSearch}%`);
            }

            const { data, error } = await query;
            if (seq !== fetchSeqRef.current) return;   // a newer search or tab replaced this one
            if (error) {
                console.error('Warranty list query failed:', error);
                setLoadError(error.message || 'The list could not be loaded.');
                if (!isAppend) setCustomers([]);
                setHasMore(false);
                return;
            }
            setLoadError(null);
            const rows = data || [];
            if (isAppend) {
                setCustomers(prev => {
                    const existingIds = new Set(prev.map(c => c.id));
                    return [...prev, ...rows.filter(c => !existingIds.has(c.id))];
                });
            } else {
                setCustomers(rows);
            }
            setHasMore(rows.length === PAGE_SIZE);
        } catch (err) {
            if (seq !== fetchSeqRef.current) return;
            console.error('Error fetching warranty customers:', err);
            setLoadError(err?.message || 'The list could not be loaded.');
            if (!isAppend) setCustomers([]);
            setHasMore(false);
        } finally {
            if (seq === fetchSeqRef.current) {
                setLoading(false);
                setLoadingMore(false);
                if (pageNum === 0) void fetchCounts();
            }
        }
    }, [activeTab, debouncedSearch, scopedQuery, fetchCounts]);

    useEffect(() => {
        setPage(0);
        fetchCustomers(0, false);
    }, [fetchCustomers]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchCustomers(nextPage, true);
    };

    const isMissingTab = activeTab === 'missing';
    const today = todayIST();

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-2 rounded-2xl border border-sky-200 bg-sky-50 p-3 text-xs font-medium text-sky-900">
                <Info size={16} className="mt-0.5 flex-shrink-0 text-sky-600" />
                <p>Warranty is 5 years from the installation (commissioning) date. Customers with no installation date use the delivery date, then the completed date.</p>
            </div>

            {loadError && (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-3 flex items-start gap-2">
                    <span className="text-xs font-bold text-red-800">This list could not be loaded.</span>
                    <span className="text-[11px] text-red-700 font-medium">{loadError}</span>
                </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Search name or consumer no..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full min-h-11 pl-10 pr-10 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300 shadow-sm transition-all"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm('')}
                            aria-label="Clear search"
                            className="absolute right-1 top-0 h-11 w-10 text-stone-400 hover:text-stone-600 text-xs font-bold cursor-pointer"
                        >
                            ✕
                        </button>
                    )}
                </div>

                <button
                    type="button"
                    onClick={() => fetchCustomers(0, false)}
                    className="self-end sm:self-center inline-flex min-h-11 items-center gap-2 px-3 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-xs font-bold text-stone-600 transition-colors shadow-sm cursor-pointer"
                    title="Refresh list"
                >
                    <RefreshCw size={14} className={loading ? 'animate-spin text-amber-500' : ''} /> Refresh
                </button>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:max-w-xl">
                {TABS.map(tab => {
                    const isSelected = activeTab === tab.id;
                    const count = tabCounts[tab.id];
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => { setActiveTab(tab.id); setPage(0); }}
                            aria-pressed={isSelected}
                            className={`rounded-2xl p-3.5 border text-left transition-all cursor-pointer ${isSelected ? `${tab.selected} shadow-md` : 'bg-white border-stone-200/80 text-stone-800 hover:border-stone-300'}`}
                        >
                            <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-80 flex items-center gap-1">
                                <tab.icon size={12} /> {tab.label}
                            </p>
                            <p className="text-xl font-black">{count == null ? '–' : count.toLocaleString('en-IN')}</p>
                        </button>
                    );
                })}
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center p-16 text-stone-400 space-y-3">
                    <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                    <p className="text-xs font-bold text-stone-600">Loading customers...</p>
                </div>
            ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 bg-white rounded-3xl border border-dashed border-stone-200 p-8 text-stone-400 text-center">
                    <ShieldCheck className="w-10 h-10 mb-3 text-stone-300" />
                    <p className="font-bold text-stone-600 text-sm">
                        {debouncedSearch ? `No customers matched "${debouncedSearch}".`
                            : isMissingTab ? 'Every completed customer has a warranty date.'
                            : activeTab === 'in_warranty' ? 'No completed customers are in warranty.'
                            : 'No customers are out of warranty yet.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-stone-500 font-semibold px-1">
                        <span>Showing {customers.length} customers {debouncedSearch ? `for "${debouncedSearch}"` : ''}</span>
                    </div>
                    {isMissingTab && (
                        <p className="px-1 text-xs font-medium text-amber-800">
                            These completed customers have no installation, delivery or completed date. Open the customer and add the installation date (admin can unlock a completed customer).
                        </p>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {customers.map(c => {
                            const info = warrantyInfo(c, today);
                            return (
                                <div key={c.id} className="bg-white rounded-2xl border border-stone-200 hover:border-amber-400 hover:shadow-md transition-all">
                                    <button
                                        type="button"
                                        onClick={() => onSelectCustomer(c)}
                                        className="w-full p-4 pb-3 text-left group cursor-pointer"
                                    >
                                        <p className="font-bold text-stone-900 text-sm group-hover:text-amber-700 transition-colors truncate">
                                            {c.customer_name || 'Unnamed Customer'}
                                        </p>
                                        <div className="grid grid-cols-2 gap-2 pt-2.5 mt-2 border-t border-stone-100 text-[10px]">
                                            <div className="min-w-0">
                                                <p className="text-stone-400 font-bold uppercase tracking-wide">Consumer No.</p>
                                                <p className="text-xs font-semibold text-stone-700 mt-0.5 truncate">{c.consumer_no || '–'}</p>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-stone-400 font-bold uppercase tracking-wide">Channel Partner</p>
                                                <p className="text-xs font-semibold text-stone-700 mt-0.5 truncate">{c.channel_partner || '–'}</p>
                                            </div>
                                        </div>
                                        {info.start && (
                                            <p className="mt-2 text-[10px] font-medium text-stone-400">
                                                Started {formatWarrantyDate(info.start)} ({SOURCE_LABELS[info.source]})
                                            </p>
                                        )}
                                    </button>
                                    <div className="px-4 pb-4 flex flex-wrap items-center justify-between gap-2">
                                        <WarrantyBadge info={info} />
                                        {onRaiseServiceIssue && (
                                            <button
                                                type="button"
                                                onClick={() => onRaiseServiceIssue(c)}
                                                aria-label={`Raise complaint for ${c.customer_name || 'customer'}`} title="Raise complaint"
                                                className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-amber-600 hover:text-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 cursor-pointer"
                                            >
                                                <Wrench size={22} fill="currentColor" strokeWidth={1.5} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {hasMore && (
                        <div className="text-center pt-4 pb-8">
                            <button
                                type="button"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                                className="min-h-11 px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-extrabold shadow-md transition-all flex items-center gap-2 mx-auto cursor-pointer disabled:opacity-60"
                            >
                                {loadingMore ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Loading more...</span>
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown size={14} />
                                        <span>Load 50 more</span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
