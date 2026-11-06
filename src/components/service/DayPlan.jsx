import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { STAGE_LABELS, STAGE_PILL, issueStage, ticketLabel, todayLocal } from './serviceLabels';
import { pincodeInText } from './tripLabels';

const addDays = (day, n) => { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + n); return date.toISOString().slice(0, 10); };
const dayName = day => new Date(`${day}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const missing = failure => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(failure?.code) || /could not find the (function|table)/i.test(failure?.message || '');
const finished = issue => !issue || ['completed', 'cancelled', 'completion_pending'].includes(issue.status);

// The technician's plan for one day: issue ids in order (service_plan_stops).
export async function readDayPlan(userId, day) {
    const { data, error } = await supabase.from('service_plan_stops').select('issue_id, position')
        .eq('technician_id', userId).eq('plan_date', day).order('position');
    if (error) throw error;
    return (data || []).map(row => row.issue_id);
}

// "My trip": the technician picks the houses for a day (their jobs, or open jobs, which
// are claimed on save), puts them in order, saves, and starts the journey at the first.
// From each house the trip panel offers the next house of the plan.
export default function DayPlan({ user, issues, busy, run, onOpen, onPlanSaved }) {
    const [day, setDay] = useState(todayLocal);
    const [stops, setStops] = useState(null);
    const [saved, setSaved] = useState([]);
    const [problem, setProblem] = useState('');

    useEffect(() => {
        let active = true;
        setStops(null);
        readDayPlan(user.id, day).then(ids => { if (active) { setStops(ids); setSaved(ids); setProblem(''); } },
            failure => { if (active) { setStops([]); setSaved([]); setProblem(missing(failure) ? 'My trip is not set up on the server yet. Tell the office.' : failure.message); } });
        return () => { active = false; };
    }, [user.id, day]);

    const byId = new Map(issues.map(issue => [issue.id, issue]));
    const mine = issues.filter(issue => issue.assigned_to === user.id && issue.status === 'assigned');
    const open = issues.filter(issue => issue.status === 'open');
    const inPlan = new Set(stops || []);
    const choices = [...mine, ...open].filter(issue => !inPlan.has(issue.id));
    const changed = JSON.stringify(stops) !== JSON.stringify(saved);
    const today = day === todayLocal();
    const firstToDo = (stops || []).map(id => byId.get(id)).find(issue => issue && !finished(issue));

    const move = (index, by) => setStops(current => {
        const next = [...current];
        const [item] = next.splice(index, 1);
        next.splice(Math.max(0, Math.min(next.length, index + by)), 0, item);
        return next;
    });
    const save = () => run(async () => {
        const { data, error } = await supabase.rpc('service_save_plan', { p_date: day, p_issue_ids: stops });
        if (error) throw new Error(missing(error) ? 'My trip is not set up on the server yet. Tell the office.' : error.message);
        const kept = (data || []).map(row => (typeof row === 'string' ? row : Object.values(row)[0]));
        const dropped = stops.length - kept.length;
        setStops(kept); setSaved(kept);
        onPlanSaved?.();
        return dropped > 0 ? `Trip saved. ${dropped} house${dropped === 1 ? ' was' : 's were'} taken by another technician and left out.` : `Trip for ${dayName(day)} saved.`;
    }, '');

    const houseText = issue => [pincodeInText(issue.service_address), issue.problem_type].filter(Boolean).join(' · ');
    const tomorrow = addDays(todayLocal(), 1);
    const dayButton = (value, text) => <button key={value} type="button" onClick={() => setDay(value)} aria-pressed={day === value}
        className={`min-h-10 rounded-lg px-3 text-xs font-bold ${day === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{text}</button>;
    const label = 'text-xs font-bold uppercase tracking-wider text-stone-500';
    const iconButton = 'flex h-9 w-9 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-800 disabled:opacity-20';

    return <div className="space-y-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl bg-stone-100 p-1">
                {dayButton(todayLocal(), 'Today')}
                {dayButton(tomorrow, 'Tomorrow')}
            </div>
            <input type="date" aria-label="Other day" min={todayLocal()} value={day} onChange={e => e.target.value && setDay(e.target.value)}
                className="min-h-11 rounded-xl border border-stone-200 px-2 text-xs font-semibold text-stone-600 focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
        {problem && <p role="alert" className="rounded-xl bg-amber-50 p-2 text-xs text-amber-900">{problem}</p>}

        <section className="space-y-2">
            <h3 className={label}>{dayName(day)} · {stops ? stops.length : '…'} {stops?.length === 1 ? 'house' : 'houses'}</h3>
            {stops && !stops.length && <p className="rounded-xl border border-dashed border-stone-200 p-4 text-center text-xs text-stone-400">Add houses from below</p>}
            {stops?.length > 0 && <ol className="divide-y divide-stone-100 rounded-xl border border-stone-200">{stops.map((id, index) => {
                const issue = byId.get(id);
                const stage = issueStage(issue);
                return <li key={id} className="flex items-center gap-3 p-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-white">{index + 1}</span>
                    <button type="button" onClick={() => issue && onOpen(id)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate text-sm font-bold">{issue ? issue.customer_name : 'Job no longer yours'}</span>
                        {issue && <span className="block truncate text-xs text-stone-400">{ticketLabel(issue)} · {houseText(issue)}</span>}
                    </button>
                    {issue && <span className={`hidden shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold sm:inline ${issue.status === 'open' ? 'bg-amber-100 text-amber-900' : STAGE_PILL[stage] || ''}`}>{issue.status === 'open' ? 'Open' : STAGE_LABELS[stage]}</span>}
                    <span className="flex shrink-0">
                        <button type="button" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)} className={iconButton}><ArrowUp size={16} /></button>
                        <button type="button" aria-label="Move down" disabled={index === stops.length - 1} onClick={() => move(index, 1)} className={iconButton}><ArrowDown size={16} /></button>
                        <button type="button" aria-label="Remove from trip" onClick={() => setStops(stops.filter(other => other !== id))} className={`${iconButton} hover:text-red-700`}><X size={16} /></button>
                    </span>
                </li>;
            })}</ol>}
            {changed && <button type="button" disabled={busy} onClick={save} className="min-h-12 w-full rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50">Save trip</button>}
            {!changed && today && firstToDo && <button type="button" onClick={() => onOpen(firstToDo.id)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 text-sm font-bold text-stone-900">
                Start journey <span aria-hidden="true">→</span></button>}
        </section>

        <section className="space-y-2">
            <h3 className={label}>Add houses</h3>
            {!choices.length && <p className="text-xs text-stone-400">No other jobs.</p>}
            <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200">{choices.map(issue => <li key={issue.id}>
                <button type="button" onClick={() => setStops([...(stops || []), issue.id])} className="flex w-full items-center gap-3 p-2.5 text-left hover:bg-stone-50">
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{issue.customer_name}</span>
                        <span className="block truncate text-xs text-stone-400">{ticketLabel(issue)} · {houseText(issue)}</span></span>
                    {issue.status === 'open' && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">Open</span>}
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 text-stone-600"><Plus size={16} /></span>
                </button>
            </li>)}</ul>
        </section>
    </div>;
}
