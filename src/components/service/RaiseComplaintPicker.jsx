import { useEffect, useState } from 'react';
import { Search, Wrench } from 'lucide-react';
import { supabase } from '../../supabase';
import { CUSTOMER_CARD_COLUMNS, STAGE_IDS } from '../../constants';
import { fuzzyPatterns, mergeSearchResults } from '../../utils/fuzzySearch';
import { warrantyInfo } from '../../utils/warranty';
import WarrantyBadge from '../WarrantyBadge';

const LIMIT = 20;
const cleanSearch = term => term.replace(/[,()"\\]/g, ' ').trim();

// "Raise a complaint" on the Complaints page: find the completed customer (name,
// consumer no. or phone, spelling-tolerant), then onRaise(customer) opens the form with
// their details filled in. Partners only find their own customers (database rules).
export default function RaiseComplaintPicker({ onRaise }) {
    const [open, setOpen] = useState(false);
    const [term, setTerm] = useState('');
    const [rows, setRows] = useState(null);
    const [failed, setFailed] = useState('');

    useEffect(() => {
        const q = cleanSearch(term);
        if (!open || q.length < 2) { setRows(null); return undefined; }
        let active = true;
        const timer = setTimeout(async () => {
            const base = () => supabase.from('admin').select(CUSTOMER_CARD_COLUMNS).is('deleted_at', null).eq('stage', STAGE_IDS.COMPLETED);
            const exact = await base().or(`customer_name.ilike.%${q}%,consumer_no.ilike.%${q}%,phone_number.ilike.%${q}%`).order('customer_name').limit(LIMIT);
            if (!active) return;
            if (exact.error) { setFailed(exact.error.message); return; }
            let found = exact.data || [];
            const patterns = fuzzyPatterns(q);
            if (patterns.length && found.length < LIMIT) {
                const loose = await patterns.reduce((query, pattern) => query.filter('customer_name', 'imatch', pattern), base().limit(100));
                if (!active) return;
                if (!loose.error) found = mergeSearchResults(q, found, loose.data || [], LIMIT);
            }
            setRows(found); setFailed('');
        }, 300);
        return () => { active = false; clearTimeout(timer); };
    }, [term, open]);

    if (!onRaise) return null;
    if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-stone-900 shadow-sm">
        <Wrench size={16} fill="currentColor" strokeWidth={1.5} /> Raise a complaint</button>;

    return <div className="space-y-2 rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Raise a complaint: find the customer</h2>
            <button type="button" onClick={() => { setOpen(false); setTerm(''); }} className="min-h-11 rounded-lg border px-3 text-xs font-bold">Cancel</button></div>
        <label className="relative block">
            <span className="sr-only">Search completed customers</span>
            <Search size={16} className="absolute left-3 top-3.5 text-stone-400" />
            <input autoFocus value={term} onChange={e => setTerm(e.target.value)} placeholder="Name, consumer no. or phone"
                className="block w-full min-h-11 rounded-xl border pl-9 pr-3 text-sm" />
        </label>
        {failed && <p role="alert" className="text-xs text-red-700">Could not search: {failed}</p>}
        {rows && !rows.length && <p className="text-xs text-stone-500">No completed customer matches "{cleanSearch(term)}". Complaints can only be raised for completed customers.</p>}
        {rows && rows.length > 0 && <ul className="max-h-80 space-y-1 overflow-y-auto">{rows.map(customer =>
            <li key={customer.id}><button type="button" onClick={() => { setOpen(false); setTerm(''); onRaise(customer); }}
                className="flex w-full flex-wrap items-center gap-2 rounded-xl border p-3 text-left hover:border-amber-400 hover:bg-amber-50">
                <span className="min-w-0 flex-1"><strong className="block break-words text-sm">{customer.customer_name}</strong>
                    <span className="text-xs text-stone-500">{[customer.consumer_no, customer.channel_partner, customer.villages].filter(Boolean).join(' · ')}</span></span>
                <WarrantyBadge info={warrantyInfo(customer)} />
            </button></li>)}</ul>}
        {!rows && <p className="text-xs text-stone-500">Type at least 2 letters. Spelling mistakes are fine.</p>}
    </div>;
}
