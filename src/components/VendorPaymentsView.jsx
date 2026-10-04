import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';
import { buildVendorPaymentsWorkbook } from '../utils/vendorPaymentsWorkbook';
import { filterVendorPayments } from '../utils/vendorPaymentFilters';

const monthKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const amount = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);

export default function VendorPaymentsView({ user }) {
    const [records, setRecords] = useState([]);
    const [scope, setScope] = useState('month');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const currentMonth = monthKey(new Date());

    const load = useCallback(async () => {
        setLoading(true);
        const rows = [];
        for (let offset = 0; ; offset += 500) {
            const { data, error: readError } = await supabase.from('admin')
                .select('id,customer_name,consumer_no,system_capacity_kwp,vendor,vendor_quote,vendor_payment_status,vendor_paid_date,installation_date,installation_status')
                .is('deleted_at', null).ilike('vendor', user.name.trim())
                .order('created_at', { ascending: false }).range(offset, offset + 499);
            if (readError) { setError(readError.message); setLoading(false); return; }
            rows.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        setRecords(rows.filter(row => ['yes', 'installed'].includes(String(row.installation_status || '').trim().toLowerCase())
            || String(row.vendor_payment_status || '').trim().toLowerCase() === 'paid'));
        setError('');
        setLoading(false);
    }, [user.name]);
    useEffect(() => { load(); }, [load]);

    // Earlier months that have installations, newest first (this month has its own option).
    const pastMonths = useMemo(() => [...new Set(records.map(row => String(row.installation_date || '').slice(0, 7)))]
        .filter(key => /^\d{4}-\d{2}$/.test(key) && key !== currentMonth).sort().reverse(), [records, currentMonth]);
    const monthLabel = key => new Date(`${key}-01T00:00:00`).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
    const visible = useMemo(() => filterVendorPayments(records, scope, currentMonth), [records, scope, currentMonth]);
    const total = visible.reduce((sum, row) => sum + (Number(row.vendor_quote) || 0), 0);

    const exportPayments = () => {
        const bytes = buildVendorPaymentsWorkbook(visible);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = `vendor-payments-${scope === 'all' ? 'all' : scope === 'month' ? currentMonth : scope}.xlsx`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    };

    return <main className="flex-1 w-full max-w-3xl mx-auto p-3 sm:p-5 space-y-4">
        <div className="rounded-2xl border bg-white p-4">
            <h1 className="text-lg font-bold text-stone-900">My payments</h1>
            <p className="text-xs text-stone-500 mt-1">Pick a month to see paid and pending records installed in that month, or All payments for everything.</p>
            <div className="flex flex-wrap items-end gap-2 mt-4">
                <label className="text-xs font-semibold text-stone-700">Export range
                    <select value={scope} onChange={event => setScope(event.target.value)} className="block mt-1 min-h-11 rounded-lg border px-3 text-sm">
                        <option value="month">This month</option>
                        {pastMonths.map(key => <option key={key} value={key}>{monthLabel(key)}</option>)}
                        <option value="all">All payments</option>
                    </select>
                </label>
                <button type="button" disabled={loading || visible.length === 0} onClick={exportPayments} className="min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50">Export Excel</button>
                <button type="button" disabled={loading} onClick={load} className="min-h-11 rounded-lg border px-3 text-xs font-semibold">Refresh</button>
            </div>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="rounded-2xl border bg-white p-4"><p className="text-xs font-semibold text-stone-500">{visible.length} payments</p><p className="text-xl font-bold">{amount(total)}</p></div>
        <div className="space-y-2">
            {loading ? <p className="text-sm text-stone-500">Loading payments…</p> : visible.length === 0 ? <p className="rounded-2xl border bg-white p-4 text-sm text-stone-500">No payments for this range.</p> : visible.map(row =>
                <article key={row.id} className="rounded-2xl border bg-white p-4 flex flex-wrap justify-between gap-2 text-sm">
                    <div><strong className="block text-stone-900">{row.customer_name || 'Customer'}</strong><span className="text-xs text-stone-500">{row.consumer_no || 'No consumer number'} · Installed {row.installation_date || 'date pending'}</span></div>
                    <div className="text-right"><strong className="block">{amount(row.vendor_quote)}</strong><span className="text-xs text-stone-500">{row.vendor_payment_status || 'Pending'}{row.vendor_paid_date ? ` · ${row.vendor_paid_date}` : ''}</span></div>
                </article>)}
        </div>
    </main>;
}
