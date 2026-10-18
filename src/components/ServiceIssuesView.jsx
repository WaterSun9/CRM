import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabase';
import WarrantyBadge from './WarrantyBadge';
import IssueForm from './service/IssueForm';
import TechnicianJobPanel from './service/TechnicianJobPanel';
import OfficeIssuePanel from './service/OfficeIssuePanel';
import VisitForm from './service/VisitForm';
import WhatsAppLog from './service/WhatsAppLog';
import {
    ACTIVE_STATUSES, OFFICE_FILTERS, STATUS_LABELS, STATUS_PILL, TECHNICIAN_FILTERS, WARRANTY_PILL,
    formatDateTime, matchesFilter, money, ticketLabel, uploadIssueFiles, validFiles, warrantyLabel
} from './service/serviceLabels';

const StatusPill = ({ status }) => <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_PILL[status] || 'bg-stone-100 text-stone-700'}`}>{STATUS_LABELS[status] || status}</span>;
const WarrantyPill = ({ status }) => <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${WARRANTY_PILL[status] || WARRANTY_PILL.unknown}`}>{warrantyLabel(status)}</span>;

// One saved visit: km (and the trip estimate when the office changed it), amount, note.
// In 'pro' mode the pre-filled km can be the Google road km (km_source 'google', or
// route_km kept when the office changed it).
function VisitRow({ visit }) {
    const estimate = visit.km_estimate === null || visit.km_estimate === undefined ? null : Number(visit.km_estimate);
    const changed = estimate !== null && Number(visit.kilometers) !== estimate;
    const google = visit.km_source === 'google' || (visit.route_km !== null && visit.route_km !== undefined);
    return <p className="rounded-lg bg-stone-50 p-2 text-xs">
        {visit.visit_date} · {visit.kilometers} km{estimate !== null && (changed ? ` (${google ? 'Google Maps road km' : 'estimate'} ${estimate} km${visit.km_note ? `: ${visit.km_note}` : ''})` : google ? ' (Google Maps road km)' : ' (trip estimate)')} · {money(visit.amount_inr)}{visit.note ? ` · ${visit.note}` : ''}
    </p>;
}

// Shows how a closed complaint was closed, or that a code is on its way.
function ClosureNote({ issue, forTechnician }) {
    if (issue.status === 'completed') {
        const how = issue.completion_method === 'otp' ? "Closed with the customer's WhatsApp code" : `Closed by office: ${issue.override_reason || 'no reason given'}`;
        return <p className="rounded-lg bg-green-50 p-2 text-xs text-green-900"><strong>{how}</strong>{issue.completed_at && <span className="block">Completed {formatDateTime(issue.completed_at)}</span>}</p>;
    }
    if (issue.status === 'cancelled') return <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-700"><strong>Cancelled:</strong> {issue.cancel_reason || 'no reason given'}</p>;
    if (issue.status === 'completion_pending' && !forTechnician) return <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Completion code sent to the customer{issue.completion_requested_at ? ` on ${formatDateTime(issue.completion_requested_at)}` : ''}. Waiting for the technician to enter it.</p>;
    return null;
}

export default function ServiceIssuesView({ user, initialCustomer = null, formOnly = false }) {
    const isTechnician = user?.userType === 'technician';
    const canManage = ['admin', 'sales'].includes(user?.userType);
    const defaultPartner = ['channel_partner_office', 'office2', 'agent', 'agent2'].includes(user?.userType) ? user?.channel_partner || '' : '';
    const [issues, setIssues] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [visits, setVisits] = useState([]);
    const [extraFiles, setExtraFiles] = useState([]);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [filter, setFilter] = useState(isTechnician ? 'open' : 'all');
    const [technicians, setTechnicians] = useState(null);
    const [techError, setTechError] = useState('');
    const [loadError, setLoadError] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    // Messages from actions on a complaint show next to that complaint, so a
    // technician on a phone sees "Wrong code" without scrolling to the top.
    const [messageSpot, setMessageSpot] = useState('top');
    const [busy, setBusy] = useState(false);
    const filterChosen = useRef(false);
    const detailRef = useRef(null);

    const load = useCallback(async () => {
        const rows = [];
        if (isTechnician) {
            const { data: queue, error: queueError } = await supabase.rpc('open_service_issue_queue');
            if (queueError) { setLoadError(queueError.message); return; }
            rows.push(...(queue || []));
        }
        for (let offset = 0; ; offset += 500) {
            const { data, error: readError } = await supabase.from('service_issues').select('*')
                .order('required_date', { ascending: true }).range(offset, offset + 499);
            if (readError) { setLoadError(readError.message); return; }
            rows.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        // The technician queue RPC and the table query can return the same
        // open issue. Keep one row per id so counts and actions stay accurate.
        setIssues([...new Map(rows.map(issue => [issue.id, issue])).values()]);
        setLoadError('');
        // A technician with a job in hand usually opens the app to finish it.
        if (isTechnician && !filterChosen.current) {
            filterChosen.current = true;
            if (rows.some(issue => issue.assigned_to === user?.id && ACTIVE_STATUSES.includes(issue.status))) setFilter('mine');
        }
    }, [isTechnician, user?.id]);
    useEffect(() => {
        if (formOnly) return undefined;
        load();
        const timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, [load, formOnly]);
    useEffect(() => {
        if (!canManage || formOnly) return undefined;
        let active = true;
        supabase.rpc('service_technicians').then(({ data, error: readError }) => {
            if (!active) return;
            if (readError) setTechError(readError.message); else { setTechnicians(data || []); setTechError(''); }
        });
        return () => { active = false; };
    }, [canManage, formOnly]);

    const selected = issues.find(issue => issue.id === selectedId);
    const loadVisits = useCallback(async issueId => {
        const { data, error: readError } = await supabase.from('service_visits').select('*').eq('issue_id', issueId).order('visit_date', { ascending: false });
        if (readError) throw readError;
        return data || [];
    }, []);
    useEffect(() => {
        if (!selectedId || !(canManage || isTechnician)) { setVisits([]); return; }
        let active = true;
        loadVisits(selectedId).then(rows => { if (active) setVisits(rows); }, readError => { if (active) setError(readError.message); });
        return () => { active = false; };
    }, [selectedId, issues, canManage, isTechnician, loadVisits]);
    useEffect(() => {
        if (!selectedId) { setAttachedFiles([]); return; }
        let active = true;
        supabase.from('service_issue_files').select('id,file_name,storage_path').eq('issue_id', selectedId).order('created_at')
            .then(({ data, error: readError }) => { if (active) { if (readError) setError(readError.message); else setAttachedFiles(data || []); } });
        return () => { active = false; };
    }, [selectedId, issues]);

    const run = async (action, successMessage, spot = 'top') => {
        if (busy) return;
        setBusy(true); setError(''); setNotice(''); setMessageSpot(spot);
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) throw new Error('Your login has expired. Sign in again before saving.');
            if (user?.id !== authData.user.id) throw new Error('This is a role preview, not a login to that account. Sign in as the user to raise or change a complaint.');
            const message = await action();
            setNotice(message ?? successMessage);
            if (!formOnly) await load();
        }
        catch (failure) {
            setError(failure.message || 'Could not save the change.');
            // "Not assigned to you any more", "already closed" and similar mean the
            // list is out of date, so refresh it now instead of at the next poll.
            if (!formOnly) void load();
        }
        finally { setBusy(false); }
    };
    const update = async (id, changes, filters = []) => {
        let query = supabase.from('service_issues').update(changes).eq('id', id);
        for (const [field, value] of filters) query = query.eq(field, value);
        const { data, error: writeError } = await query.select('id');
        if (writeError) throw writeError;
        if (!data?.length) throw new Error('This complaint changed before your action. Refresh and try again.');
    };
    const openIssue = id => {
        setSelectedId(id); setError(''); setNotice('');
        // On a phone the details sit below the list; bring them into view.
        if (window.matchMedia?.('(max-width: 1023px)').matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    };
    const chooseFilter = key => { filterChosen.current = true; setFilter(key); };
    const reloadVisits = async () => {
        try { setVisits(await loadVisits(selected.id)); } catch { /* the next poll tries again */ }
    };
    const addPhotos = async event => {
        event.preventDefault();
        if (!selected || !extraFiles.length || attachedFiles.length + extraFiles.length > 5 || !validFiles(extraFiles)) { setMessageSpot('issue'); setError('A complaint can have at most 5 files, each no larger than 10 MB.'); return; }
        await run(async () => {
            const failed = await uploadIssueFiles(selected.id, extraFiles, user.id);
            setExtraFiles([]);
            const { data } = await supabase.from('service_issue_files').select('id,file_name,storage_path').eq('issue_id', selected.id).order('created_at');
            setAttachedFiles(data || []);
            return failed.length ? `${failed.length} file(s) did not upload: ${failed.join(', ')}` : 'Files attached.';
        }, 'Files attached.', 'issue');
    };
    const openPhoto = async photo => {
        const { data, error: linkError } = await supabase.storage.from('service-issues').createSignedUrl(photo.storage_path, 120);
        if (linkError) { setMessageSpot('issue'); setError(linkError.message); return; }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    };

    const filters = isTechnician ? TECHNICIAN_FILTERS : OFFICE_FILTERS;
    const countFor = key => issues.filter(issue => matchesFilter(issue, key, user?.id)).length;
    // Active complaints first, then closed ones; each group by required date.
    const closedLast = issue => (ACTIVE_STATUSES.includes(issue.status) ? 0 : 1);
    const shown = issues.filter(issue => matchesFilter(issue, filter, user?.id))
        .sort((a, b) => closedLast(a) - closedLast(b) || String(a.required_date).localeCompare(String(b.required_date)));
    const technicianName = id => technicians?.find(tech => tech.id === id)?.name || (technicians ? 'Technician no longer active' : 'Technician');
    const showDetails = selected && (!isTechnician || selected.assigned_to === user.id);
    const banners = <>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    </>;
    const bannersAtTop = formOnly || !selected || messageSpot === 'top';

    return <div className={formOnly ? 'w-full space-y-3' : 'mx-auto w-full max-w-6xl p-3 sm:p-6 space-y-4'}>
        {!formOnly && <header className="rounded-2xl border bg-white p-4"><h1 className="text-xl font-bold">Complaints</h1><p className="text-sm text-stone-500">{isTechnician ? "Claim an open job to see the customer's phone and address. When the work is done, send the completion code to the customer." : canManage ? 'Assign complaints, close them, and record each visit’s distance and amount.' : 'Track the complaints you have raised.'}</p></header>}
        {loadError && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Could not load complaints: {loadError}</p>}
        {bannersAtTop && banners}
        {!isTechnician && <IssueForm user={user} initialCustomer={initialCustomer} formOnly={formOnly} canManage={canManage} defaultPartner={defaultPartner}
            busy={busy} run={run} setError={message => { setMessageSpot('top'); setError(message); }} onRaised={setSelectedId} />}
        {!formOnly && <><div className="flex flex-wrap gap-2">{filters.map(([key, label]) =>
            <button key={key} type="button" onClick={() => chooseFilter(key)} className={`min-h-11 rounded-full px-4 text-xs font-bold ${filter === key ? 'bg-stone-900 text-white' : 'bg-white border text-stone-700'}`}>{label} ({countFor(key)})</button>)}</div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-2">{shown.length === 0 && <p className="rounded-2xl border bg-white p-4 text-sm text-stone-500">No complaints in this view.</p>}{shown.map(issue =>
                <button key={issue.id} type="button" onClick={() => openIssue(issue.id)} className={`block w-full rounded-2xl border p-4 text-left ${selectedId === issue.id ? 'border-amber-500 bg-amber-50' : 'bg-white'}`}>
                    <span className="flex flex-wrap items-center gap-1.5">{issue.ticket_no && <span className="text-xs font-bold text-stone-500">{ticketLabel(issue)}</span>}<strong className="mr-1">{issue.customer_name}</strong><StatusPill status={issue.status} /><WarrantyPill status={issue.warranty_status} /></span>
                    <span className="mt-1 block text-xs text-stone-500">{issue.consumer_no ? `${issue.consumer_no} · ` : ''}Required {issue.required_date}{canManage && issue.assigned_to ? ` · ${technicianName(issue.assigned_to)}` : ''}</span>
                    <p className="mt-1 truncate text-sm text-stone-700">{issue.problem_type}</p>
                </button>)}</div>
            <div ref={detailRef} className="scroll-mt-4 rounded-2xl border bg-white p-4 space-y-4 min-w-0">
                {!selected ? <p className="text-sm text-stone-500">Select a complaint to see details.</p> : <>
                    <div className="space-y-1">
                        <h2 className="font-bold text-lg break-words">{selected.ticket_no && <span className="text-stone-500">{ticketLabel(selected)} </span>}{selected.customer_name}</h2>
                        <div className="flex flex-wrap items-center gap-1.5"><StatusPill status={selected.status} />
                            {selected.warranty_end || !selected.warranty_status || selected.warranty_status === 'unknown'
                                ? <WarrantyBadge info={{ status: selected.warranty_status || 'unknown', start: selected.warranty_start || null, end: selected.warranty_end || null, source: null }} />
                                : <WarrantyPill status={selected.warranty_status} />}
                        </div>
                        <p className="text-xs text-stone-500">Required {selected.required_date}{canManage && selected.assigned_to ? ` · Assigned to ${technicianName(selected.assigned_to)}` : ''}</p>
                    </div>
                    {!bannersAtTop && banners}
                    <ClosureNote issue={selected} forTechnician={isTechnician} />
                    {/* The technician's next step comes before the details, so the
                        code box is on screen without scrolling on a phone. */}
                    {isTechnician && <TechnicianJobPanel key={selected.id} issue={selected} userId={user.id} busy={busy} run={run}
                        onClaimed={id => { setSelectedId(id); chooseFilter('mine'); }} onReleased={() => setSelectedId(null)} />}
                    {showDetails && <div className="space-y-1 text-sm break-words"><p><strong>Channel Partner:</strong> {selected.channel_partner_name || '—'}</p><p><strong>Consumer Number:</strong> {selected.consumer_no}</p><p><strong>Phone:</strong> {selected.customer_phone ? <a href={`tel:${selected.customer_phone}`} className="font-semibold text-blue-700 underline">{selected.customer_phone}</a> : '—'}</p><p><strong>Address:</strong> {selected.service_address || '—'}</p><p><strong>Type of problem:</strong> {selected.problem_type}</p><p><strong>System company:</strong> {selected.system_company_name || '—'}</p><p><strong>System kW:</strong> {selected.system_kw ?? '—'}</p><p><strong>Comment:</strong> {selected.comment || '—'}</p></div>}
                    {selected.give_up_reason && <p className="rounded-lg bg-amber-50 p-2 text-xs">Previous give-up reason: {selected.give_up_reason}</p>}
                    {showDetails && <div className="border-t pt-3 space-y-2"><h3 className="text-sm font-bold">Problem files ({attachedFiles.length}/5)</h3>{attachedFiles.map(photo => <button key={photo.id} type="button" onClick={() => openPhoto(photo)} className="block min-h-9 text-left text-sm font-semibold text-blue-700 underline break-all">{photo.file_name}</button>)}{!isTechnician && attachedFiles.length < 5 && <form onSubmit={addPhotos} className="space-y-2"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setExtraFiles([...e.target.files])} className="block w-full text-xs" /><button disabled={busy || !extraFiles.length} className="min-h-11 rounded-lg border px-3 text-xs font-bold">Add files</button></form>}</div>}
                    {canManage && <OfficeIssuePanel key={selected.id} issue={selected} technicians={technicians} techError={techError} busy={busy} run={run} update={update} />}
                    {canManage && <WhatsAppLog key={`wa:${selected.id}`} issueId={selected.id} />}
                    {(canManage || isTechnician) && <div className="border-t pt-3 space-y-2"><h3 className="text-sm font-bold">Visits and travel</h3>{visits.length === 0 && <p className="text-xs text-stone-500">No visits recorded.</p>}{visits.map(visit => <VisitRow key={visit.id} visit={visit} />)}</div>}
                    {canManage && selected.assigned_to && <VisitForm key={`${selected.id}:${selected.assigned_to}`} issue={selected} user={user} busy={busy} run={run} visits={visits} onSaved={reloadVisits} />}
                </>}
            </div>
        </div></>}
    </div>;
}
