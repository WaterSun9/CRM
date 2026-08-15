import { useState } from 'react';
import { supabase } from '../supabase';
import { logActivity } from '../utils';
import { 
    Search, CreditCard, CheckCircle2, AlertCircle, Calendar, 
    ChevronRight
} from 'lucide-react';

export default function InstallationPaymentsView({ customers, onSelectCustomer, currentUser }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('All'); // 'All', 'Pending', 'Paid'
    const [selectedMonthKey, setSelectedMonthKey] = useState('All');
    const [updatingId, setUpdatingId] = useState(null);

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

    // Filter completed installations
    const installations = customers.filter(c => {
        // Installed status is 'Yes'
        return c.installation_status === 'Yes';
    });

    // Map payout details to records
    const records = installations.map(c => {
        const fallbackDate = c.created_at ? c.created_at.split('T')[0] : null;
        const details = getPayoutDetails(c.installation_date, fallbackDate);
        return {
            ...c,
            payoutMonthKey: details.monthKey,
            payoutMonthLabel: details.monthLabel,
            payoutDueDate: details.dueDate,
            payoutSortKey: details.sortKey
        };
    });

    // Filter by search query & payment status
    const filteredRecords = records.filter(r => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
            r.customer_name?.toLowerCase().includes(q) ||
            r.vendor?.toLowerCase().includes(q) ||
            r.installed_by?.toLowerCase().includes(q) ||
            r.phone_number?.includes(searchQuery);

        const currentStatus = r.vendor_payment_status || 'Pending';
        const matchesStatus = statusFilter === 'All' || currentStatus === statusFilter;

        const matchesMonth = selectedMonthKey === 'All' || r.payoutMonthKey === selectedMonthKey;

        return matchesSearch && matchesStatus && matchesMonth;
    });

    // Group for month tabs
    const monthGroups = {};
    records.forEach(r => {
        if (!monthGroups[r.payoutMonthKey]) {
            monthGroups[r.payoutMonthKey] = {
                label: r.payoutMonthLabel,
                count: 0
            };
        }
        monthGroups[r.payoutMonthKey].count += 1;
    });

    const uniqueMonths = Object.keys(monthGroups).sort((a, b) => b.localeCompare(a)); // Descending

    // Change Payment Status
    const handleStatusChange = async (customerRecord, nextStatus) => {
        if (currentUser.userType !== 'admin') return;
        
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
                // Mutate local state values
                customerRecord.vendor_payment_status = nextStatus;
                customerRecord.vendor_paid_date = paidDate;
                customerRecord.vendor_paid_by = paidBy;
                await logActivity(
                    currentUser.id,
                    'update',
                    `${customerRecord.customer_name}: Allotted vendor (${customerRecord.vendor}) payment status set to ${nextStatus}`,
                    '',
                    customerRecord.id
                );
            } else {
                console.error("Error updating vendor payment status:", error);
            }
        } catch (err) {
            console.error("Error changing payment status:", err);
        } finally {
            setUpdatingId(null);
        }
    };

    // Calculate Summary Stats for current selection/filters
    const totalPayouts = filteredRecords.length;
    const paidCount = filteredRecords.filter(r => (r.vendor_payment_status || 'Pending') === 'Paid').length;
    const pendingCount = totalPayouts - paidCount;

    return (
        <div className="p-4 lg:p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <p className="text-xs font-bold text-stone-400 uppercase tracking-widest">Payout Ledger</p>
                    <p className="text-xs text-stone-500 font-medium mt-1 max-w-xl">
                        Track installations and manage payouts to vendors. Payments are due on the 1st of the month following completion.
                    </p>
                </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600">
                        <CreditCard size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Scheduled Payouts</p>
                        <p className="text-xl font-black text-stone-850 mt-0.5">{totalPayouts}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
                        <CheckCircle2 size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Paid Payouts</p>
                        <p className="text-xl font-black text-stone-850 mt-0.5">{paidCount}</p>
                    </div>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex items-center gap-4">
                    <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-red-600">
                        <AlertCircle size={18} />
                    </div>
                    <div>
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Pending Payouts</p>
                        <p className="text-xl font-black text-stone-850 mt-0.5">{pendingCount}</p>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[24px] border border-stone-100 shadow-sm overflow-hidden">
                {/* Filters Toolbar */}
                <div className="p-4 border-b border-stone-100 flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center bg-stone-50/50">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by customer, vendor or phone..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 bg-white border border-stone-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-medium"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${statusFilter === status ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-800'}`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Ledger Table */}
                <div className="overflow-x-auto">
                    {filteredRecords.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-stone-100 bg-stone-50/20">
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Customer Details</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Vendor (Material Delivery)</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Installation Date</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Payout Date</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest">Payment Status</th>
                                    <th className="px-6 py-3.5 text-[9px] font-black text-stone-400 uppercase tracking-widest text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((r, idx) => (
                                    <tr key={r.id} className="border-b border-stone-50 hover:bg-stone-50/30 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-amber-50 rounded-xl flex items-center justify-center text-amber-700 font-bold text-xs">
                                                    {r.customer_name?.[0]?.toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-xs font-bold text-stone-800">{r.customer_name}</p>
                                                    <p className="text-[10px] text-stone-400 mt-0.5">{r.phone_number} · Capacity: {r.system_capacity_kwp || '–'} kWp</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {r.vendor ? (
                                                <div>
                                                    <p className="text-xs font-bold text-stone-800">{r.vendor}</p>
                                                    <p className="text-[10px] text-stone-400 mt-0.5">Allotted Installer</p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-stone-400 italic">No vendor allotted</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={12} className="text-stone-400" />
                                                    <span className="text-xs font-semibold text-stone-700">
                                                        {r.installation_date ? new Date(r.installation_date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' }) : <span className="text-stone-400 italic">Not set</span>}
                                                    </span>
                                                </div>
                                                {r.installed_by && (
                                                    <p className="text-[10px] text-stone-500 font-medium mt-1">
                                                        By: <span className="font-bold">{r.installed_by}</span>
                                                    </p>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-bold text-stone-800 bg-stone-100 px-2 py-0.5 rounded-lg">
                                                {r.payoutDueDate}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="space-y-1">
                                                <select
                                                    disabled={currentUser.userType !== 'admin' || updatingId === r.id}
                                                    value={r.vendor_payment_status || 'Pending'}
                                                    onChange={(e) => handleStatusChange(r, e.target.value)}
                                                    className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer ${
                                                        (r.vendor_payment_status || 'Pending') === 'Paid'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    } disabled:opacity-50`}
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Paid">Paid</option>
                                                </select>
                                                {(r.vendor_payment_status || 'Pending') === 'Paid' && (r.vendor_paid_date || r.vendor_paid_by) && (
                                                    <div className="text-[9px] text-stone-400 font-semibold space-y-0.5 mt-1">
                                                        {r.vendor_paid_date && (
                                                            <p>Paid on: {new Date(r.vendor_paid_date).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                        )}
                                                        {r.vendor_paid_by && (
                                                            <p>By: {r.vendor_paid_by}</p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => onSelectCustomer(r)}
                                                className="p-1 hover:bg-stone-100 rounded-lg transition-colors text-stone-400 hover:text-stone-700"
                                                title="View Customer Details"
                                            >
                                                <ChevronRight size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="p-8 text-center">
                            <AlertCircle className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                            <p className="text-xs text-stone-400 font-bold">No payout records found matching your filters.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
