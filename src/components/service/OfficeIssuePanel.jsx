import { useState } from 'react';
import { OVERRIDE_REASONS } from './serviceLabels';
import CustomerPin from './CustomerPin';

// Office (admin / sales) actions on one complaint. Every change goes through
// update() with the current status as a filter, so two people acting on the
// same complaint cannot overwrite each other; the database guard checks the rules.
// Also the customer's saved map point (CustomerPin), when the complaint is linked to a customer.
export default function OfficeIssuePanel({ issue, technicians, techError, busy, run, update }) {
    const [assignTo, setAssignTo] = useState('');
    const [closing, setClosing] = useState(null);
    const [overrideReason, setOverrideReason] = useState('');
    const [overrideNote, setOverrideNote] = useState('');
    const [cancelReason, setCancelReason] = useState('');
    const active = ['open', 'assigned', 'completion_pending'].includes(issue.status);
    const sameStatus = [['status', issue.status]];

    const assign = () => run(async () => {
        if (!assignTo) throw new Error('Choose a technician first.');
        await update(issue.id, { status: 'assigned', assigned_to: assignTo, assigned_at: new Date().toISOString() }, sameStatus);
        setAssignTo('');
    }, 'Complaint assigned to the technician.', 'issue');

    const reopenForReassignment = () => run(
        () => update(issue.id, { status: 'open', assigned_to: null, assigned_at: null }, sameStatus),
        'Complaint reopened for reassignment.', 'issue');

    const completeWithoutCode = event => {
        event.preventDefault();
        run(async () => {
            const note = overrideNote.trim();
            if (!overrideReason) throw new Error('Choose why the job is being closed without a code.');
            if (overrideReason === 'Other' && !note) throw new Error('Write the reason for closing without a code.');
            const reason = overrideReason === 'Other' ? note : note ? `${overrideReason}: ${note}` : overrideReason;
            await update(issue.id, { status: 'completed', completion_method: 'office_override', override_reason: reason.slice(0, 500) }, sameStatus);
            setClosing(null); setOverrideReason(''); setOverrideNote('');
        }, 'Complaint marked completed without a code.', 'issue');
    };

    const cancel = event => {
        event.preventDefault();
        run(async () => {
            if (!cancelReason.trim()) throw new Error('Write why this complaint is being cancelled.');
            await update(issue.id, { status: 'cancelled', cancel_reason: cancelReason.trim() }, sameStatus);
            setClosing(null); setCancelReason('');
        }, 'Complaint cancelled.', 'issue');
    };

    const reopenClosed = () => run(async () => {
        // A technician who has since been switched off cannot get the job
        // back, so it goes to the open queue instead.
        const stillActive = issue.assigned_to && (!technicians || technicians.some(tech => tech.id === issue.assigned_to));
        const changes = stillActive ? { status: 'assigned' } : { status: 'open', assigned_to: null, assigned_at: null };
        try { await update(issue.id, changes, sameStatus); }
        catch (failure) {
            if (failure?.code === '23505' || /already open/i.test(failure?.message || '')) throw new Error('Another complaint is already open for this customer, so this one cannot be reopened.');
            throw failure;
        }
    }, 'Complaint reopened.', 'issue');

    const button = 'min-h-11 rounded-lg border px-3 text-xs font-bold disabled:opacity-50';
    return <div className="space-y-3 border-t pt-3">
        <h3 className="text-sm font-bold">Office actions</h3>
        {issue.status === 'open' && <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-semibold">Assign to a technician
                <select value={assignTo} onChange={e => setAssignTo(e.target.value)} className="mt-1 block w-full min-h-11 rounded-lg border bg-white p-2 text-sm">
                    <option value="">{technicians ? (technicians.length ? 'Choose a technician' : 'No active technicians') : 'Loading technicians…'}</option>
                    {(technicians || []).map(tech => <option key={tech.id} value={tech.id}>{tech.name || 'Technician'}</option>)}
                </select>
            </label>
            <button type="button" disabled={busy || !assignTo} onClick={assign} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50">Assign</button>
            {techError && <p className="w-full text-xs text-red-700">Could not load technicians: {techError}</p>}
        </div>}
        {active && <div className="flex flex-wrap gap-2">
            {issue.status !== 'open' && <button type="button" disabled={busy} onClick={reopenForReassignment} className={button}>Reopen for reassignment</button>}
            <button type="button" disabled={busy} onClick={() => setClosing(closing === 'complete' ? null : 'complete')} className={`${button} ${closing === 'complete' ? 'bg-stone-900 text-white' : ''}`}>Completed without code</button>
            <button type="button" disabled={busy} onClick={() => setClosing(closing === 'cancel' ? null : 'cancel')} className={`${button} ${closing === 'cancel' ? 'bg-stone-900 text-white' : ''}`}>Cancel complaint</button>
        </div>}
        {active && closing === 'complete' && <form onSubmit={completeWithoutCode} className="space-y-2 rounded-xl bg-stone-50 p-3">
            <label className="block text-xs font-semibold">Why close without the customer's code? *
                <select required value={overrideReason} onChange={e => setOverrideReason(e.target.value)} className="mt-1 block w-full min-h-11 rounded-lg border bg-white p-2 text-sm">
                    <option value="">Choose a reason</option>
                    {OVERRIDE_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </select>
            </label>
            <label className="block text-xs font-semibold">{overrideReason === 'Other' ? 'Reason *' : 'Details (optional)'}
                <input required={overrideReason === 'Other'} maxLength={400} value={overrideNote} onChange={e => setOverrideNote(e.target.value)} className="mt-1 block w-full min-h-11 rounded-lg border bg-white p-2 text-sm" />
            </label>
            <button disabled={busy || !overrideReason || (overrideReason === 'Other' && !overrideNote.trim())} className="min-h-11 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-50">Mark completed without code</button>
        </form>}
        {active && closing === 'cancel' && <form onSubmit={cancel} className="space-y-2 rounded-xl bg-stone-50 p-3">
            <label className="block text-xs font-semibold">Why cancel this complaint? *
                <input required maxLength={500} value={cancelReason} onChange={e => setCancelReason(e.target.value)} className="mt-1 block w-full min-h-11 rounded-lg border bg-white p-2 text-sm" />
            </label>
            <button disabled={busy || !cancelReason.trim()} className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">Cancel complaint</button>
        </form>}
        {['completed', 'cancelled'].includes(issue.status) && <button type="button" disabled={busy} onClick={reopenClosed} className={button}>Reopen complaint</button>}
        {issue.customer_id && <CustomerPin customerId={issue.customer_id} busy={busy} run={run} />}
    </div>;
}
