import { useState, useMemo, useEffect, useCallback } from 'react';
import { supabase } from '../supabase';
import { logActivity, toIndianCommas, normalizeInstallationStatus } from '../utils';
import { CUSTOMER_CARD_COLUMNS } from '../constants';
import { 
    Search, CreditCard, CheckCircle2, AlertCircle, Calendar, 
    Building2, Users, Check, Loader2, RefreshCw 
} from 'lucide-react';
import { useGlobalPopup } from './GlobalPopup';

export default function InstallationPaymentsView({ onSelectCustomer, currentUser }) {
    const { showAlert } = useGlobalPopup();
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Pending', 'Paid'
    const [selectedMonthKey, setSelectedMonthKey] = useState('All');
    const [selectedVendor, setSelectedVendor] = useState('All');
    const [updatingId, setUpdatingId] = useState(null);
    const [payingAll, setPayingAll] = useState(false);
    const [installations, setInstallations] = useState([]);
    const [loading, setLoading] = useState(true);

    // Helper to compute payout details (1st of month M+1)
    const getPayoutDetails = (dateStr, fallbackDateStr) => {
        const targetDateStr = dateStr || fallbackDateStr || new Date().toISOString().split('T')[0];
        
        // Parse UTC date safely
        const parts = targetDateStr.split('-');
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // 0-indexed
        const day = parseInt(parts[2], 10) || 1;
        const instDate = new Date(year, month, day);

        // Move to the 1st day of the next month
        const payoutDate = new Date(year, month + 1, 1);
        
        const monthName = payoutDate.toLocaleString('default', { month: 'long' });
        const payoutYear = payoutDate.getFullYear();
        
        return {
            monthKey: `${payoutYear}-${String(payoutDate.getMonth() + 1).padStart(2, '0')}`,
            monthLabel: `${monthName} ${payoutYear}`,
            dueDate: payoutDate.toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }),
            sortKey: payoutDate.getTime()
        };
    };

    // Fast lightweight fetch strictly for completed installation status ("Yes")
    const fetchInstallations = useCallback(async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('admin')
                .select(CUSTOMER_CARD_COLUMNS)
                .is('deleted_at', null)
                .ilike('installation_status', '%yes%')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setInstallations(data);
            } else {
                console.error("Error fetching completed installations for ledger:", error);
                // Fallback: try fetching where installation_status is not null and filter in memory
                const { data: allData } = await supabase
                    .from('admin')
                    .select(CUSTOMER_CARD_COLUMNS)
                    .is('deleted_at', null)
                    .not('installation_status', 'is', null);
                if (allData) {
                    const matched = allData.filter(c => 
                        normalizeInstallationStatus(c.installation_status) === 'yes' || 
                        String(c.installation_status || '').trim().toLowerCase() === 'yes'
                    );
                    setInstallations(matched);
                } else {
                    setInstallations([]);
                }
            }
        } catch (err) {
            console.error("Error in fetchInstallations:", err);
            setInstallations([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInstallations();
    }, [fetchInstallations]);

    // Map payout details to records using material_delivery_date from delivery stage
    const records = useMemo(() => {
        return installations.map(c => {
            const fallbackDate = c.installation_date || (c.created_at ? c.created_at.split('T')[0] : null);
            const targetDate = c.material_delivery_date || fallbackDate;
            const details = getPayoutDetails(targetDate, fallbackDate);
            return {
                ...c,
                payoutMonthKey: details.monthKey,
                payoutMonthLabel: details.monthLabel,
                payoutDueDate: details.dueDate,
                payoutSortKey: details.sortKey
            };
        });
    }, [installations]);

    // Extract list of unique vendors for vendor filter
    const vendorsList = useMemo(() => {
        const set = new Set();
        (records || []).forEach(r => {
            if (r.vendor && String(r.vendor).trim()) {
                set.add(String(r.vendor).trim());
            }
        });
        return Array.from(set).sort((a, b) => a.localeCompare(b));
    }, [records]);

    // Filter by search query, payment status, month, and vendor
    const filteredRecords = useMemo(() => {
        const q = (searchQuery || '').trim().toLowerCase();
        return records.filter(r => {
            const matchesSearch = !q || (
                String(r.customer_name || '').toLowerCase().includes(q) ||
                String(r.vendor || '').toLowerCase().includes(q) ||
                String(r.installed_by || '').toLowerCase().includes(q) ||
                String(r.phone_number || '').includes(q) ||
                String(r.crn || '').toLowerCase().includes(q) ||
                String(r.consumer_no || '').toLowerCase().includes(q)
            );

            const currentStatus = r.vendor_payment_status || 'Pending';
            const matchesStatus = statusFilter === 'All' || currentStatus === statusFilter;
            const matchesMonth = selectedMonthKey === 'All' || r.payoutMonthKey === selectedMonthKey;
            const matchesVendor = selectedVendor === 'All' || String(r.vendor || '').trim().toLowerCase() === selectedVendor.trim().toLowerCase();

            return matchesSearch && matchesStatus && matchesMonth && matchesVendor;
        });
    }, [records, searchQuery, statusFilter, selectedMonthKey, selectedVendor]);

    // Group for month tabs
    const monthGroups = useMemo(() => {
        const groups = {};
        records.forEach(r => {
            if (!groups[r.payoutMonthKey]) {
                groups[r.payoutMonthKey] = {
                    label: r.payoutMonthLabel,
                    count: 0
                };
            }
            groups[r.payoutMonthKey].count += 1;
        });
        return groups;
    }, [records]);

    const uniqueMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a)); // Descending

    // Change Individual Payment Status: Unpaid (Pending) <-> Paid
    const handleStatusChange = async (customerRecord, nextStatus) => {
        if (currentUser?.userType !== 'admin') return;
        
        const isPaid = nextStatus === 'Paid';
        const paidDate = isPaid ? new Date().toISOString().split('T')[0] : null;
        const paidBy = isPaid ? currentUser.name : null;
        
        setUpdatingId(customerRecord.id);
        try {
            const { error } = await supabase
                .from('admin')
                .update({ 
                    vendor_payment_status: nextStatus,
                    vendor_paid_date: paidDate,
                    vendor_paid_by: paidBy
                })
                .eq('id', customerRecord.id);

            if (!error) {
                // Mutate local state
                setInstallations(prev => prev.map(item => {
                    if (item.id === customerRecord.id) {
                        return {
                            ...item,
                            vendor_payment_status: nextStatus,
                            vendor_paid_date: paidDate,
                            vendor_paid_by: paidBy
                        };
                    }
                    return item;
                }));

                await logActivity(
                    currentUser.id,
                    'update',
                    `${customerRecord.customer_name}: Vendor payment status set to ${nextStatus}${isPaid ? ` (Paid on: ${paidDate})` : ' (Cleared)'}`,
                    '',
                    customerRecord.id
                );
            } else {
                console.error("Error updating vendor payment status:", error);
                showAlert("Failed to update payment status: " + error.message, { type: 'error' });
            }
        } catch (err) {
            console.error("Error changing payment status:", err);
            showAlert("Error changing payment status: " + err.message, { type: 'error' });
        } finally {
            setUpdatingId(null);
        }
    };

    // Calculate Summary Stats
    const totalPayouts = filteredRecords.length;
    const paidRecords = filteredRecords.filter(r => (r.vendor_payment_status || 'Pending') === 'Paid');
    const pendingRecords = filteredRecords.filter(r => (r.vendor_payment_status || 'Pending') !== 'Paid');
    
    const paidCount = paidRecords.length;
    const pendingCount = pendingRecords.length;

    const totalAmount = filteredRecords.reduce((sum, r) => sum + (parseFloat(r.vendor_quote) || 0), 0);
    const paidAmount = paidRecords.reduce((sum, r) => sum + (parseFloat(r.vendor_quote) || 0), 0);
    const pendingAmount = pendingRecords.reduce((sum, r) => sum + (parseFloat(r.vendor_quote) || 0), 0);

    // Pay All in One Go for the selected Vendor
    const handlePayAllForVendor = async () => {
        if (currentUser?.userType !== 'admin' || selectedVendor === 'All') return;
        
        const unpaidRecords = filteredRecords.filter(r => (r.vendor_payment_status || 'Pending') !== 'Paid');
        if (unpaidRecords.length === 0) {
            showAlert(`All clients for ${selectedVendor} are already marked as Paid!`);
            return;
        }

        if (!window.confirm(`Mark all ${unpaidRecords.length} pending client payouts for ${selectedVendor} as PAID for a total of ₹${toIndianCommas(pendingAmount)}?`)) {
            return;
        }

        setPayingAll(true);
        const today = new Date().toISOString().split('T')[0];
        const paidBy = currentUser.name || 'Admin';
        const unpaidIds = unpaidRecords.map(r => r.id);

        try {
            const { error } = await supabase
                .from('admin')
                .update({
                    vendor_payment_status: 'Paid',
                    vendor_paid_date: today,
                    vendor_paid_by: paidBy
                })
                .in('id', unpaidIds);

            if (!error) {
                const unpaidSet = new Set(unpaidIds);
                setInstallations(prev => prev.map(item => {
                    if (unpaidSet.has(item.id)) {
                        return {
                            ...item,
                            vendor_payment_status: 'Paid',
                            vendor_paid_date: today,
                            vendor_paid_by: paidBy
                        };
                    }
                    return item;
                }));

                await logActivity(
                    currentUser.id,
                    'update',
                    `Paid all ${unpaidRecords.length} client installations for vendor ${selectedVendor} (Total: ₹${toIndianCommas(pendingAmount)})`,
                    '',
                    unpaidIds[0]
                );
            } else {
                console.error("Error in Pay All:", error);
                showAlert("Failed to pay all: " + error.message, { type: 'error' });
            }
        } catch (err) {
            console.error("Error in Pay All:", err);
            showAlert("Error: " + err.message, { type: 'error' });
        } finally {
            setPayingAll(false);
        }
    };

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto animate-in fade-in duration-300">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Installation Payout Ledger</p>
                        <button 
                            onClick={fetchInstallations}
                            className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-400 hover:text-stone-700 transition-colors"
                            title="Refresh Ledger"
                        >
                            <RefreshCw size={13} className={loading ? "animate-spin text-amber-500" : ""} />
                        </button>
                    </div>
                    <p className="text-xs text-stone-500 font-medium mt-0.5 max-w-xl">
                        Track installations completed with tag <b>"Yes"</b>, manage vendor commissions, and process payouts.
                    </p>
                </div>
            </div>

            {/* Quick Metrics Grid with Live Rupee Totals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 flex-shrink-0">
                        <CreditCard size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Commission / Payouts</p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <p className="text-xl font-black text-stone-850">₹{toIndianCommas(totalAmount)}</p>
                            <span className="text-[11px] font-bold text-stone-500">({totalPayouts} {totalPayouts === 1 ? 'client' : 'clients'})</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 flex-shrink-0">
                        <CheckCircle2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Paid to Vendors</p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <p className="text-xl font-black text-emerald-600">₹{toIndianCommas(paidAmount)}</p>
                            <span className="text-[11px] font-bold text-emerald-700/80">({paidCount} paid)</span>
                        </div>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-sm flex items-center gap-4">
                    <div className="w-11 h-11 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-600 flex-shrink-0">
                        <AlertCircle size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Pending (Unpaid)</p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                            <p className="text-xl font-black text-rose-600">₹{toIndianCommas(pendingAmount)}</p>
                            <span className="text-[11px] font-bold text-rose-700/80">({pendingCount} unpaid)</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* When a specific vendor is selected: Vendor Card with Pay All Button */}
            {selectedVendor !== 'All' && (
                <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-white p-4 rounded-2xl border border-amber-300 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in duration-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-sm shadow-amber-500/20 flex-shrink-0">
                            <Building2 size={20} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-stone-900">{selectedVendor}</h4>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 bg-amber-100 text-amber-900 rounded-md">
                                    {filteredRecords.length} Assigned Clients
                                </span>
                            </div>
                            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                                Total Commission: <b>₹{toIndianCommas(totalAmount)}</b> • Paid: <b className="text-emerald-700">₹{toIndianCommas(paidAmount)}</b> • Balance Due: <b className="text-rose-700">₹{toIndianCommas(pendingAmount)}</b>
                            </p>
                        </div>
                    </div>

                    {/* Pay All Button for This Vendor */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {pendingAmount > 0 ? (
                            <button
                                type="button"
                                disabled={payingAll}
                                onClick={handlePayAllForVendor}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                {payingAll ? (
                                    <><Loader2 size={13} className="animate-spin" /> Processing All...</>
                                ) : (
                                    <><Check size={14} className="stroke-[3]" /> Pay All (₹{toIndianCommas(pendingAmount)})</>
                                )}
                            </button>
                        ) : (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-2 rounded-xl border border-emerald-200 flex items-center gap-1.5">
                                <Check size={13} className="stroke-[3]" /> All Clients Paid for this Vendor
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Main Table Card */}
            <div className="bg-white rounded-[24px] border border-stone-150 shadow-sm overflow-hidden space-y-0">
                {/* Filters Toolbar */}
                <div className="p-4 border-b border-stone-100 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-stone-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4 pointer-events-none" />
                        <input
                            type="text"
                            placeholder="Search by customer, vendor, CRN, phone or consumer no..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-medium"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Vendor Filter Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedVendor}
                                onChange={e => setSelectedVendor(e.target.value)}
                                className="pl-3 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-stone-750 appearance-none cursor-pointer"
                            >
                                <option value="All">All Vendors ({vendorsList.length})</option>
                                {vendorsList.map(v => (
                                    <option key={v} value={v}>{v}</option>
                                ))}
                            </select>
                            <Building2 size={12} className="absolute right-3 top-3 text-stone-400 pointer-events-none" />
                        </div>

                        {/* Payout Month Dropdown */}
                        <div className="relative">
                            <select
                                value={selectedMonthKey}
                                onChange={e => setSelectedMonthKey(e.target.value)}
                                className="pl-3 pr-8 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-stone-750 appearance-none cursor-pointer"
                            >
                                <option value="All">All Payout Months</option>
                                {uniqueMonths.map(m => (
                                    <option key={m} value={m}>{monthGroups[m].label} ({monthGroups[m].count})</option>
                                ))}
                            </select>
                            <Calendar size={12} className="absolute right-3 top-3 text-stone-400 pointer-events-none" />
                        </div>

                        {/* Status Filter */}
                        <div className="bg-stone-100 p-0.5 rounded-xl flex">
                            {['All', 'Pending', 'Paid'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status)}
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${statusFilter === status ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                                >
                                    {status === 'Pending' ? 'Unpaid' : status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-16 text-stone-400 space-y-3">
                            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
                            <p className="text-xs font-bold text-stone-600">Loading payout records...</p>
                        </div>
                    ) : filteredRecords.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-stone-100 bg-stone-50/40">
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Customer Details</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Vendor</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Commission</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Material Delivery Date</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Installation Date</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Payout Date</th>
                                    <th className="px-5 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Payment Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((r) => {
                                    const isPaid = (r.vendor_payment_status || 'Pending') === 'Paid';
                                    const isUpdating = updatingId === r.id;

                                    return (
                                        <tr 
                                            key={r.id} 
                                            className="border-b border-stone-50 hover:bg-stone-50/50 transition-colors"
                                        >
                                            {/* Customer Details - Clickable to open customer detail modal */}
                                            <td 
                                                className="px-5 py-3.5 cursor-pointer group"
                                                onClick={() => onSelectCustomer(r)}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-7 h-7 bg-amber-50 group-hover:bg-amber-100 rounded-lg flex items-center justify-center text-amber-700 font-bold text-xs flex-shrink-0 transition-colors">
                                                        {r.customer_name?.[0]?.toUpperCase() || 'C'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-stone-850 group-hover:text-amber-600 transition-colors">{r.customer_name}</p>
                                                        <p className="text-[10px] text-stone-400 mt-0.5 font-medium">{r.phone_number || '–'} · {r.system_capacity_kwp ? `${r.system_capacity_kwp} kWp` : '–'}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Vendor */}
                                            <td className="px-5 py-3.5">
                                                {r.vendor ? (
                                                    <p className="text-xs font-bold text-stone-800">{r.vendor}</p>
                                                ) : (
                                                    <span className="text-xs text-stone-400 italic">No vendor allotted</span>
                                                )}
                                            </td>

                                            {/* Commission */}
                                            <td className="px-5 py-3.5">
                                                <span className="text-xs font-bold text-stone-900">
                                                    {r.vendor_quote ? `₹${toIndianCommas(r.vendor_quote)}` : <span className="text-stone-400 font-normal italic">₹0</span>}
                                                </span>
                                            </td>

                                            {/* Material Delivery Date */}
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs font-semibold text-stone-800">
                                                    {r.material_delivery_date || <span className="text-stone-400 font-normal">Pending</span>}
                                                </p>
                                            </td>

                                            {/* Installation Date */}
                                            <td className="px-5 py-3.5">
                                                <p className="text-xs font-semibold text-stone-800">
                                                    {r.installation_date || <span className="text-stone-400 font-normal">Pending</span>}
                                                </p>
                                            </td>

                                            {/* Payout Due Date */}
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-amber-600 flex-shrink-0" />
                                                    <div>
                                                        <p className="text-xs font-bold text-stone-800">{r.payoutDueDate}</p>
                                                        <p className="text-[9px] font-semibold text-stone-400 uppercase tracking-wider">{r.payoutMonthLabel}</p>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Payment Action / Status */}
                                            <td className="px-5 py-3.5">
                                                {currentUser?.userType === 'admin' ? (
                                                    <button
                                                        type="button"
                                                        disabled={isUpdating}
                                                        onClick={() => handleStatusChange(r, isPaid ? 'Pending' : 'Paid')}
                                                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                                                            isPaid 
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200' 
                                                                : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200'
                                                        }`}
                                                        title={isPaid ? 'Click to mark as Unpaid' : 'Click to mark as Paid'}
                                                    >
                                                        {isUpdating ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : isPaid ? (
                                                            <>
                                                                <Check size={12} className="stroke-[3] text-emerald-600" />
                                                                <span>Paid {r.vendor_paid_date ? `(${r.vendor_paid_date})` : ''}</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                                                <span>Mark as Paid</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className={`px-2.5 py-1 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 ${
                                                        isPaid 
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                                            : 'bg-amber-50 text-amber-800 border-amber-200'
                                                    }`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isPaid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                                        {isPaid ? 'Paid' : 'Unpaid'}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <div className="flex flex-col items-center justify-center p-12 text-stone-400 space-y-2">
                            <CheckCircle2 size={32} className="text-stone-300" />
                            <p className="text-sm font-bold text-stone-600">No matching completed installations found</p>
                            <p className="text-xs text-stone-400 max-w-sm text-center">
                                {searchQuery ? `No installations matched "${searchQuery}".` : 'Clients will appear here once their installation status is marked as "Yes".'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
