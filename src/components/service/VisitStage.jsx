import { useState } from 'react';
import { supabase } from '../../supabase';
import { STAGE_LABELS, issueStage } from './serviceLabels';

const missingColumn = failure => /visit_stage/.test(failure?.message || '') && ['PGRST204', '42703'].includes(failure?.code);

// Visited / Second visit needed on a job that is still assigned. The technician on the
// job and the office set it; "Reached site" on a trip sets Visited by itself. The date
// and the history line are written by the database.
export default function VisitStage({ issue, busy, run, office = false }) {
    const [asking, setAsking] = useState(false);
    const [note, setNote] = useState('');
    if (!['assigned', 'completion_pending'].includes(issue.status)) return null;
    const stage = issueStage(issue);

    const save = (visit_stage, visit_stage_note, message) => run(async () => {
        const { data, error } = await supabase.from('service_issues').update({ visit_stage, visit_stage_note })
            .eq('id', issue.id).eq('status', issue.status).select('id');
        if (error) throw new Error(missingColumn(error) ? 'Visit stages are not set up yet. Ask the office.' : error.message);
        if (!data?.length) throw new Error('This complaint changed before your action. Refresh and try again.');
        setAsking(false); setNote('');
    }, message, 'issue');

    const button = 'min-h-11 rounded-lg border px-3 text-xs font-bold disabled:opacity-50';
    return <div className="space-y-2 rounded-xl border p-3">
        <p className="text-xs font-semibold">Stage: <span className="font-bold">{STAGE_LABELS[stage]}</span>{issue.visit_stage_note ? ` · ${issue.visit_stage_note}` : ''}</p>
        <div className="flex flex-wrap gap-2">
            {issue.visit_stage !== 'visited' && <button type="button" disabled={busy} onClick={() => save('visited', null, 'Marked as visited.')} className={button}>Mark visited</button>}
            <button type="button" disabled={busy} onClick={() => setAsking(!asking)} className={`${button} ${asking ? 'bg-stone-900 text-white' : ''}`}>Second visit needed</button>
            {office && issue.visit_stage && <button type="button" disabled={busy} onClick={() => save(null, null, 'Moved back to In process.')} className={button}>Back to In process</button>}
        </div>
        {asking && <form onSubmit={event => { event.preventDefault(); if (note.trim()) save('second_visit', note.trim(), 'Marked as needing a second visit.'); }} className="space-y-2">
            <label className="block text-xs font-semibold">Why is another visit needed? *
                <input required maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. inverter part to be ordered" className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" />
            </label>
            <button disabled={busy || !note.trim()} className="min-h-11 rounded-lg bg-orange-600 px-4 text-sm font-bold text-white disabled:opacity-50">Save: second visit needed</button>
        </form>}
    </div>;
}
