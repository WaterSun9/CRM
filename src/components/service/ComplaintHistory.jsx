import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { eventLabel, formatDateTime, missingTable } from './serviceLabels';

// Steps the complaint itself still knows, for a database without the history table yet.
function stepsFromIssue(issue) {
    const steps = [['raised', issue.created_at, issue.problem_type], ['assigned', issue.assigned_at],
        [issue.visit_stage, issue.visit_stage_at, issue.visit_stage_note], ['code_sent', issue.completion_requested_at],
        [issue.status === 'completed' ? 'completed' : null, issue.completed_at]];
    return steps.filter(([event, at]) => event && at).map(([event, created_at, note], i) => ({ id: `issue:${i}`, event, created_at, note }));
}

// Every step of one complaint with its date and who did it, oldest first
// (service_issue_events, written by the database). Reloads when the complaint changes.
export default function ComplaintHistory({ issue }) {
    const [events, setEvents] = useState(null);
    const issueKey = `${issue.id}:${issue.updated_at || ''}`;

    useEffect(() => {
        let active = true;
        supabase.from('service_issue_events').select('id, event, note, actor_name, created_at')
            .eq('issue_id', issue.id).order('created_at', { ascending: true }).limit(200)
            .then(({ data, error }) => {
                if (!active) return;
                if (error) { if (missingTable(error)) setEvents(stepsFromIssue(issue)); return; }
                setEvents(data?.length ? data : stepsFromIssue(issue));
            });
        return () => { active = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueKey]);

    return <section aria-label="History" className="space-y-2 border-t pt-3">
        <h3 className="text-sm font-bold">History</h3>
        {!events ? <p className="text-xs text-stone-500">Loading…</p>
            : <ol className="relative space-y-3 border-l-2 border-stone-200 pl-4">{events.map(row =>
                <li key={row.id} className="relative text-xs">
                    <span className="absolute -left-[1.4rem] top-1 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden="true" />
                    <p><strong>{eventLabel(row.event)}</strong> · {formatDateTime(row.created_at)}</p>
                    {(row.note || row.actor_name) && <p className="text-stone-600">{[row.note, row.actor_name && row.actor_name !== row.note && `by ${row.actor_name}`].filter(Boolean).join(' · ')}</p>}
                </li>)}</ol>}
    </section>;
}
