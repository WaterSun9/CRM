import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { callServiceOtp, RESEND_SECONDS } from './serviceLabels';
import { phonePosition, roundAccuracy, tripError } from './tripLabels';
import TripPanel from './TripPanel';

// "Reached site now" waits at most this long for the phone's location, then sends
// the code anyway (a location prompt left unanswered must not hold up the job).
const REACH_WAIT_MS = 30000;
function positionWithin(ms) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('The phone took too long to find the location.')), ms);
        phonePosition().then(
            position => { clearTimeout(timer); resolve(position); },
            failure => { clearTimeout(timer); reject(failure); });
    });
}

function verifyMessage(data) {
    if (data.reason === 'wrong_code') {
        const left = data.attemptsLeft > 0 ? ` ${data.attemptsLeft} ${data.attemptsLeft === 1 ? 'try' : 'tries'} left.` : '';
        return `${data.message || 'Wrong code. Check with the customer and try again.'}${left}`;
    }
    if (data.reason === 'expired') return data.message || 'This code has expired. Press Send code again.';
    if (data.reason === 'locked') return data.message || 'Too many wrong tries. Press Send code again for a new code.';
    return data.message || 'Send a new code.';
}

// What a technician can do on one job: claim it, start a trip (for the km),
// send the completion code to the customer (SMS, or WhatsApp), type the code the
// customer reads out, or give up.
// The server sends and checks the code; this screen never sees it.
// "Work done" first reminds the technician to tap "Reached site" when the open
// trip has none (it never blocks: "Send code without it" goes straight on).
export default function TechnicianJobPanel({ issue, userId, busy, run, onClaimed, onReleased }) {
    const mine = issue.assigned_to === userId;
    const [sent, setSent] = useState(null);
    const [code, setCode] = useState('');
    const [resendAt, setResendAt] = useState(0);
    const [now, setNow] = useState(() => Date.now());
    const [giveUpReason, setGiveUpReason] = useState('');
    const [tripState, setTripState] = useState({ loaded: false, current: null });
    const [tripReload, setTripReload] = useState(0);
    const [nudge, setNudge] = useState(false);
    const [reaching, setReaching] = useState(false);

    // The last code's time also comes from the server, so the countdown
    // survives a page reload. Capped in case the phone clock is off.
    const lastSentAt = issue.status === 'completion_pending' ? Date.parse(issue.completion_requested_at || '') : NaN;
    const serverWait = Number.isFinite(lastSentAt) ? Math.min(RESEND_SECONDS, Math.ceil((lastSentAt + RESEND_SECONDS * 1000 - now) / 1000)) : 0;
    const waitSeconds = Math.max(0, Math.ceil((resendAt - now) / 1000), serverWait);
    useEffect(() => {
        if (waitSeconds <= 0) return undefined;
        const timer = setTimeout(() => setNow(Date.now()), 1000);
        return () => clearTimeout(timer);
    }, [waitSeconds, now]);
    const holdResend = seconds => { const at = Date.now(); setNow(at); setResendAt(at + seconds * 1000); };

    const claim = () => run(async () => {
        const { data, error: claimError } = await supabase.rpc('claim_service_issue', { p_issue_id: issue.id });
        if (claimError) throw claimError;
        if (!data) throw new Error('Another technician has already claimed this job.');
        onClaimed?.(issue.id);
    }, 'Job assigned to you.', 'issue');

    const requestCode = async () => {
        const data = await callServiceOtp({ action: 'send', issueId: issue.id });
        if (!data.ok) {
            if (data.retryAfterSeconds) holdResend(data.retryAfterSeconds);
            throw new Error(data.error || 'Could not send the code. Try again.');
        }
        setSent({ maskedPhone: data.maskedPhone, testMode: Boolean(data.testMode), channel: data.channel === 'whatsapp' ? 'on WhatsApp' : 'by SMS' });
        setCode('');
        holdResend(data.resendAfterSeconds || RESEND_SECONDS);
        return '';
    };
    const sendCode = () => { setNudge(false); run(requestCode, '', 'issue'); };

    // An open trip without "Reached site" gets the reminder first.
    const openTrip = tripState.current;
    const needsReach = Boolean(openTrip && !openTrip.reached_at);
    const workDone = () => { if (needsReach) setNudge(true); else sendCode(); };

    // "Reached site now": one GPS reading, save it, then send the code whatever
    // happened (a failed location must not stop the job being closed).
    const reachThenSend = () => run(async () => {
        let note;
        setReaching(true);
        try {
            const position = await positionWithin(REACH_WAIT_MS);
            const { data, error } = await supabase.rpc('service_mark_reached', { p_trip_id: openTrip.id, p_lat: position.lat, p_lng: position.lng, p_accuracy: roundAccuracy(position.accuracy) });
            if (error) note = `Reached site was not saved: ${tripError(error)}`;
            else note = data ? 'Reached site saved.' : 'Reached site was already saved.';
        } catch (failure) {
            note = `${failure.message} Reached site was not saved.`;
        } finally {
            setReaching(false);
            setTripReload(n => n + 1);
        }
        setNudge(false);
        try { await requestCode(); }
        catch (failure) { throw new Error(`${note} ${failure.message}`); }
        return note;
    }, '', 'issue');

    const verify = event => {
        event.preventDefault();
        if (!/^\d{6}$/.test(code)) return;
        run(async () => {
            const data = await callServiceOtp({ action: 'verify', issueId: issue.id, code });
            if (!data.ok) throw new Error(data.error || 'Could not check the code. Try again.');
            if (!data.verified) {
                // An expired or locked code cannot be retried; clear it for the new one.
                if (data.reason !== 'wrong_code') { setCode(''); setSent(null); }
                throw new Error(verifyMessage(data));
            }
            setCode(''); setSent(null);
        }, 'Job completed.', 'issue');
    };

    const giveUp = () => run(async () => {
        if (!giveUpReason.trim()) throw new Error('Enter a reason before giving up this job.');
        const { data, error: giveUpError } = await supabase.rpc('give_up_service_issue', { p_issue_id: issue.id, p_reason: giveUpReason.trim() });
        if (giveUpError) throw giveUpError;
        if (!data) throw new Error('This job changed before your action. Refresh and try again.');
        setGiveUpReason('');
        onReleased?.();
    }, 'Job returned to the open queue for reassignment.');

    if (issue.status === 'open') {
        return <button type="button" disabled={busy} onClick={claim} className="min-h-12 w-full rounded-xl bg-amber-500 px-4 text-sm font-bold disabled:opacity-50 sm:w-auto">Claim this job</button>;
    }
    if (!mine || !['assigned', 'completion_pending'].includes(issue.status)) return null;

    const showCodeEntry = issue.status === 'completion_pending' || Boolean(sent);
    // After a "wait" or "3 codes an hour" answer, both send buttons wait too.
    const waitText = waitSeconds >= 120 ? `${Math.ceil(waitSeconds / 60)} min` : `${waitSeconds} s`;
    // Before the work the trip comes first; once the code is sent, the code box does.
    const trip = <TripPanel issue={issue} userId={userId} busy={busy} run={run} onTripState={setTripState} reloadKey={tripReload} />;
    const showNudge = !showCodeEntry && nudge && needsReach;
    return <div className="space-y-3">
        {!showCodeEntry && trip}
        {!showCodeEntry && !showNudge && <button type="button" disabled={busy || waitSeconds > 0} onClick={workDone} className="min-h-14 w-full rounded-xl bg-green-600 px-4 text-base font-bold text-white disabled:opacity-50">
            {waitSeconds > 0 ? `Work done - send code (wait ${waitText})` : 'Work done - send code to customer'}
        </button>}
        {showNudge && <div role="alert" className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-semibold text-amber-950">You have not tapped Reached site. Tap it now so the km is correct.</p>
            <button type="button" disabled={busy} onClick={reachThenSend} className="min-h-12 w-full rounded-xl bg-sky-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                {reaching ? 'Finding your location…' : 'Reached site now'}</button>
            <button type="button" disabled={busy || waitSeconds > 0} onClick={sendCode} className="min-h-11 w-full rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50">
                {waitSeconds > 0 ? `Send code without it (wait ${waitText})` : 'Send code without it'}</button>
        </div>}
        {showCodeEntry && <form onSubmit={verify} className="space-y-3 rounded-xl border border-green-200 bg-green-50 p-3">
            <p className="text-sm text-green-900">{sent
                ? <>Code sent {sent.channel} to <strong>{sent.maskedPhone}</strong>. Ask the customer to read it out.</>
                : 'A code was sent to the customer. Ask the customer to read it out.'}</p>
            {sent?.testMode && <p className="rounded-lg bg-amber-100 p-2 text-xs font-semibold text-amber-900">Test mode: the code went to the test number, not to the customer.</p>}
            <label className="block text-xs font-semibold">6-digit code from the customer
                <input value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="------"
                    className="mt-1 block w-full min-h-14 rounded-lg border bg-white p-2 text-center text-2xl font-bold tracking-[0.5em]" />
            </label>
            <button disabled={busy || code.length !== 6} className="min-h-12 w-full rounded-xl bg-green-600 px-4 text-sm font-bold text-white disabled:opacity-50">Confirm code</button>
            <button type="button" disabled={busy || waitSeconds > 0} onClick={sendCode} className="min-h-11 w-full rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50">
                {waitSeconds > 0 ? `Send code again (${waitText})` : 'Send code again'}
            </button>
        </form>}
        {showCodeEntry && trip}
        <p className="text-xs text-stone-600">No code? Call the office and ask them to close this job.</p>
        <details className="rounded-xl border p-3">
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Cannot finish this job?</summary>
            <div className="mt-2 space-y-2">
                <label className="block text-xs font-semibold">Reason for giving up<textarea maxLength={1000} value={giveUpReason} onChange={e => setGiveUpReason(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 text-sm" /></label>
                <button type="button" disabled={busy || !giveUpReason.trim()} onClick={giveUp} className="min-h-11 rounded-lg border px-4 text-xs font-bold disabled:opacity-50">Give up and reopen</button>
            </div>
        </details>
    </div>;
}
