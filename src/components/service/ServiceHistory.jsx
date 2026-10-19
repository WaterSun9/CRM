import { useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { supabase } from '../../supabase';
import { STATUS_LABELS, STATUS_PILL } from './serviceLabels';

const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const rupees = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// Complaints and technician visits of one customer, newest first, on the
// completed customer's card. Each row opens that complaint. Office sees every
// complaint, the visits and the technician; a partner sees the complaints they raised.
export default function ServiceHistory({ customerId }) {
    const [rows, setRows] = useState(null);
    const [failed, setFailed] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        const changed = () => setReload(n => n + 1);
        window.addEventListener('complaints-changed', changed);
        return () => window.removeEventListener('complaints-changed', changed);
    }, []);

    useEffect(() => {
        if (!customerId) return undefined;
        let active = true;
        (async () => {
            const { data: issues, error } = await supabase.from('service_issues')
                .select('id, ticket_no, created_at, problem_type, status, completed_at, completion_method, override_reason, assigned_to')
                .eq('customer_id', customerId).order('created_at', { ascending: false }).limit(50);
            if (!active) return;
            if (error) { setFailed(true); return; }
            const ids = (issues || []).map(issue => issue.id);
            // Visits and technician names are office-only; anyone else just gets the complaints.
            const [visits, techs] = ids.length ? await Promise.all([
                supabase.from('service_visits').select('issue_id, visit_date, kilometers, amount_inr').in('issue_id', ids),
                supabase.rpc('service_technicians'),
            ]) : [{ data: [] }, { data: [] }];
            if (!active) return;
            const names = new Map((techs.data || []).map(tech => [tech.id, tech.name]));
            setRows((issues || []).map(issue => ({
                ...issue,
                technician: names.get(issue.assigned_to) || '',
                visits: (visits.data || []).filter(visit => visit.issue_id === issue.id),
            })));
            setFailed(false);
        })();
        return () => { active = false; };
    }, [customerId, reload]);

    if (failed) return null;
    const count = rows?.length ?? 0;
    return <details className="mb-6 rounded-2xl border border-stone-200 bg-white p-4" open={count > 0 && count <= 3}>
        <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-bold text-stone-700">
            <History size={14} className="text-stone-400" /> Complaints and visits {rows ? `(${count})` : ''}
        </summary>
        {!rows ? <p className="mt-2 text-xs text-stone-400">Loading…</p>
            : !count ? <p className="mt-2 text-xs text-stone-500">No complaints yet.</p>
                : <ul className="mt-2 space-y-2">{rows.map(issue => {
                    const km = issue.visits.reduce((sum, visit) => sum + Number(visit.kilometers || 0), 0);
                    const amount = issue.visits.reduce((sum, visit) => sum + Number(visit.amount_inr || 0), 0);
                    const closed = issue.status === 'completed'
                        ? `Fixed ${day(issue.completed_at)}${issue.completion_method === 'otp' ? ' (customer code)' : issue.completion_method === 'office_override' ? ' (closed by office)' : ''}`
                        : '';
                    return <li key={issue.id}>
                        <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('open-complaint', { detail: { issueId: issue.id } }))}
                            className="block w-full rounded-xl border border-stone-100 bg-stone-50 p-3 text-left hover:border-stone-300">
                            <span className="flex flex-wrap items-center gap-2 text-xs">
                                <strong className="text-stone-800">#{issue.ticket_no}</strong>
                                <span className="text-stone-500">{day(issue.created_at)}</span>
                                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${STATUS_PILL[issue.status] || ''}`}>{STATUS_LABELS[issue.status] || issue.status}</span>
                            </span>
                            <span className="mt-1 block text-xs font-semibold text-stone-700 break-words">{issue.problem_type}</span>
                            <span className="mt-0.5 block text-[11px] text-stone-500">
                                {[issue.technician && `Technician: ${issue.technician}`, closed,
                                    issue.visits.length ? `${issue.visits.length} visit${issue.visits.length === 1 ? '' : 's'} · ${km} km · ${rupees(amount)}` : ''].filter(Boolean).join(' · ')}
                            </span>
                        </button>
                    </li>;
                })}</ul>}
    </details>;
}
