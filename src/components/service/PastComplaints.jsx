import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { STATUS_LABELS, STATUS_PILL, formatDateTime } from './serviceLabels';

// Earlier complaints of the same customer (service_customer_past), for the office and the
// technician, so the technician knows what was already done at this house.
export default function PastComplaints({ issue }) {
    const [rows, setRows] = useState(null);
    useEffect(() => {
        if (!issue.customer_id) { setRows([]); return undefined; }
        let active = true;
        supabase.rpc('service_customer_past', { p_issue_id: issue.id }).then(({ data, error }) => {
            if (active) setRows(error ? [] : data || []);
        });
        return () => { active = false; };
    }, [issue.id, issue.customer_id]);
    if (!rows?.length) return null;
    return <section className="space-y-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Earlier complaints · {rows.length}</h3>
        <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">{rows.map(row => <li key={row.id} className="flex items-start gap-3 p-2.5 text-xs">
            <span className="shrink-0 font-bold text-stone-400">#{row.ticket_no}</span>
            <span className="min-w-0 flex-1"><span className="block font-semibold text-stone-800 break-words">{row.problem_type}</span>
                <span className="block text-stone-400">{formatDateTime(row.created_at).split(',').slice(0, 2).join(',')}{row.visits ? ` · ${row.visits} visit${row.visits === 1 ? '' : 's'}` : ''}</span></span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_PILL[row.status] || ''}`}>{STATUS_LABELS[row.status] || row.status}</span>
        </li>)}</ul>
    </section>;
}
