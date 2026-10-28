import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import './service/service.css';
import { supabase } from '../supabase';
import WarrantyBadge from './WarrantyBadge';
import IssueForm from './service/IssueForm';
import TechnicianJobPanel from './service/TechnicianJobPanel';
import OfficeIssuePanel from './service/OfficeIssuePanel';
import VisitForm from './service/VisitForm';
import { announceComplaintsChanged } from './service/complaintStatus';
import WhatsAppLog from './service/WhatsAppLog';
import { WHATSAPP_ENABLED } from '../constants';
import ComplaintPhotos from './service/ComplaintPhotos';
import ComplaintComments from './service/ComplaintComments';
import CustomerFacts from './service/CustomerFacts';
import ComplaintHistory from './service/ComplaintHistory';
import VisitStage from './service/VisitStage';
import RaisedBy from './service/RaisedBy';
import CombinedVisitForm from './service/CombinedVisitForm';
import {
    ACTIVE_STATUSES, OFFICE_FILTERS, PARTNER_TYPES, STAGE_LABELS, STAGE_PILL, STATUS_LABELS, TECHNICIAN_FILTERS, WARRANTY_PILL,
    formatDateTime, isOpenJobFor, issueStage, matchesFilter, money, ticketLabel, warrantyLabel
} from './service/serviceLabels';

// The tab the complaint is in (Raised, In process, Visited, ...); "Waiting for code" is said too.
const StatusPill = ({ issue }) => {
    const stage = issueStage(issue);
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STAGE_PILL[stage] || 'bg-stone-100 text-stone-700'}`}>{STAGE_LABELS[stage] || STATUS_LABELS[issue.status] || issue.status}{issue.status === 'completion_pending' ? ` · ${STATUS_LABELS.completion_pending}` : ''}</span>;
};
const WarrantyPill = ({ status }) => <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${WARRANTY_PILL[status] || WARRANTY_PILL.unknown}`}>{warrantyLabel(status)}</span>;

// One saved visit: km (and the trip estimate when the office changed it), amount, note.
// In 'pro' mode the pre-filled km can be the Google road km (km_source 'google', or
// route_km kept when the office changed it).
function VisitRow({ visit }) {
    if (visit.trip_group) {
        const lead = visit.group?.find(row => Number(row.kilometers) > 0 || Number(row.amount_inr) > 0) || visit;
        const tickets = (visit.group || [visit]).map(row => row.ticket).filter(Boolean).join(', ');
        return <p className="rounded-lg bg-stone-50 p-2 text-xs">
            {visit.visit_date} · <strong>Combined trip</strong>{tickets ? ` (${tickets})` : ''} · {lead.kilometers} km · {money(lead.amount_inr)} for the whole trip{lead.km_note ? ` · ${lead.km_note}` : ''}
        </p>;
    }
    const estimate = visit.km_estimate === null || visit.km_estimate === undefined ? null : Number(visit.km_estimate);
    const changed = estimate !== null && Number(visit.kilometers) !== estimate;
    const google = visit.km_source === 'google' || (visit.route_km !== null && visit.route_km !== undefined);
    return <p className="rounded-lg bg-stone-50 p-2 text-xs">
        {visit.visit_date} · {visit.kilometers} km{estimate !== null && (changed ? ` (${google ? 'Google Maps road km' : 'estimate'} ${estimate} km${visit.km_note ? `: ${visit.km_note}` : ''})` : google ? ' (Google Maps road km)' : ' (trip estimate)')} · {money(visit.amount_inr)}{visit.rate_per_km != null && ` · ${visit.round_trip === false ? 'one way' : 'round trip'}, ₹${Number(visit.rate_per_km)}/km`}{visit.note ? ` · ${visit.note}` : ''}
    </p>;
}

// Shows how a closed complaint was closed, or that a code is on its way.
function ClosureNote({ issue, forTechnician }) {
    if (issue.status === 'completed') {
        const how = issue.completion_method === 'otp' ? "Closed with the customer's code" : `Closed by office: ${issue.override_reason || 'no reason given'}`;
        return <p className="rounded-lg bg-green-50 p-2 text-xs text-green-900"><strong>{how}</strong>{issue.completed_at && <span className="block">Completed {formatDateTime(issue.completed_at)}</span>}</p>;
    }
    if (issue.status === 'cancelled') return <p className="rounded-lg bg-stone-100 p-2 text-xs text-stone-700"><strong>Cancelled:</strong> {issue.cancel_reason || 'no reason given'}</p>;
    if (issue.status === 'completion_pending' && !forTechnician) return <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">Completion code sent to the customer{issue.completion_requested_at ? ` on ${formatDateTime(issue.completion_requested_at)}` : ''}. Waiting for the technician to enter it.</p>;
    return null;
}

export default function ServiceIssuesView({ user, initialCustomer = null, initialIssueId = null, formOnly = false, embedded = false, onOpenWarranty = null }) {
    const isTechnician = user?.userType === 'technician';
    const canManage = ['admin', 'sales'].includes(user?.userType);
    const isPartner = PARTNER_TYPES.includes(user?.userType);
    const defaultPartner = ['channel_partner_office', 'office2', 'agent', 'agent2'].includes(user?.userType) ? user?.channel_partner || '' : '';
    const [issues, setIssues] = useState([]);
    const [selectedId, setSelectedId] = useState(initialIssueId);
    const [visits, setVisits] = useState([]);
    const [filter, setFilter] = useState(isTechnician ? 'open' : initialIssueId ? 'all' : 'raised');
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

    // Loads overlap (the 15 s poll, an action, a slow phone network): only the newest
    // one may replace the list, so an older, slower answer never wipes newer data.
    const loadSeq = useRef(0);
    const load = useCallback(async () => {
        const seq = ++loadSeq.current;
        const rows = [];
        const fail = message => { if (seq === loadSeq.current) setLoadError(message); };
        try {
            if (isTechnician) {
                const { data: queue, error: queueError } = await supabase.rpc('open_service_issue_queue');
                if (queueError) { fail(queueError.message); return; }
                rows.push(...(queue || []));
            }
            for (let offset = 0; ; offset += 500) {
                const { data, error: readError } = await supabase.from('service_issues').select('*')
                    .order('required_date', { ascending: true }).range(offset, offset + 499);
                if (readError) { fail(readError.message); return; }
                rows.push(...(data || []));
                if (!data || data.length < 500) break;
            }
        } catch (failure) { fail(failure?.message || 'No internet.'); return; }
        if (seq !== loadSeq.current) return;
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
    const issuesRef = useRef(issues);
    issuesRef.current = issues;
    // Opened at one complaint (red wrench, customer history): bring it into view once it has loaded.
    const focusedOnce = useRef(false);
    useEffect(() => {
        if (!initialIssueId || focusedOnce.current || !issues.some(issue => issue.id === initialIssueId)) return;
        focusedOnce.current = true;
        if (window.matchMedia?.('(max-width: 1023px)').matches) setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }, [initialIssueId, issues]);
    const loadVisits = useCallback(async issueId => {
        const { data, error: readError } = await supabase.from('service_visits').select('*').eq('issue_id', issueId).order('visit_date', { ascending: false });
        if (readError) throw readError;
        const rows = data || [];
        // A combined trip: the visits of the other houses, for their tickets and the trip's km.
        const groups = [...new Set(rows.map(row => row.trip_group).filter(Boolean))];
        if (!groups.length) return rows;
        const { data: siblings } = await supabase.from('service_visits').select('id, issue_id, trip_group, kilometers, amount_inr, km_note').in('trip_group', groups);
        const ticketOf = id => ticketLabel(issuesRef.current.find(issue => issue.id === id)) || '';
        return rows.map(row => (row.trip_group
            ? { ...row, group: (siblings || []).filter(other => other.trip_group === row.trip_group).map(other => ({ ...other, ticket: ticketOf(other.issue_id) })) }
            : row));
    }, []);
    useEffect(() => {
        if (!selectedId || !(canManage || isTechnician)) { setVisits([]); return; }
        let active = true;
        loadVisits(selectedId).then(rows => { if (active) setVisits(rows); }, readError => { if (active) setError(readError.message); });
        return () => { active = false; };
    }, [selectedId, issues, canManage, isTechnician, loadVisits]);

    const run = async (action, successMessage, spot = 'top') => {
        if (busy) return;
        setBusy(true); setError(''); setNotice(''); setMessageSpot(spot);
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) throw new Error('Your login has expired. Sign in again before saving.');
            if (user?.id !== authData.user.id) throw new Error('This is a role preview, not a login to that account. Sign in as the user to raise or change a complaint.');
            const message = await action();
            setNotice(message ?? successMessage);
            announceComplaintsChanged();
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
    const chooseFilter = (key, keepSelection = false) => { filterChosen.current = true; setFilter(key); if (!keepSelection) { setSelectedId(null); setError(''); setNotice(''); } };
    const reloadVisits = async () => {
        try { setVisits(await loadVisits(selected.id)); } catch { /* the next poll tries again */ }
    };

    const filters = isTechnician ? TECHNICIAN_FILTERS : OFFICE_FILTERS;
    const countFor = key => issues.filter(issue => matchesFilter(issue, key, user?.id)).length;
    // Active complaints first, then closed ones; each group by required date.
    const closedLast = issue => (ACTIVE_STATUSES.includes(issue.status) ? 0 : 1);
    const shown = issues.filter(issue => matchesFilter(issue, filter, user?.id))
        .sort((a, b) => closedLast(a) - closedLast(b) || String(a.required_date).localeCompare(String(b.required_date)));
    const technicianName = id => technicians?.find(tech => tech.id === id)?.name || (technicians ? 'Technician no longer active' : 'Technician');
    // Partners see every complaint of their customers (database rules), not only the ones they raised.
    const showDetails = selected && (!isTechnician || selected.assigned_to === user.id);
    // The technician's own open job shows the photos (with the camera buttons) in the job panel.
    const photosInJobPanel = isTechnician && isOpenJobFor(selected, user?.id);
    // A technician sees visits only on a job of their own.
    const hasVisitColumn = canManage || (isTechnician && Boolean(showDetails));
    const banners = <>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
    </>;
    const bannersAtTop = formOnly || !selected || messageSpot === 'top';

    return <div className={formOnly ? 'w-full space-y-3' : `service-root ${embedded ? 'service-embedded' : ''} ${selected ? 'has-selection' : ''}`}>
        {!formOnly && <header className="service-heading">{!embedded && <h1 className="text-xl font-bold">Complaints</h1>}<p className="text-sm text-stone-500">{isTechnician ? "Claim an open job to see the customer's phone and address. When the work is done, tap Completed to send the OTP to the customer and type the OTP they read out." : canManage ? 'Assign complaints, follow each step, close them, and record each visit’s distance and amount. Complaints are raised from Warranty customers and show up here. The km rate is set in Operations.' : 'Track the complaints of your customers, step by step, and add comments. Raise a complaint from Warranty customers or the customer’s card.'}</p></header>}
        {loadError && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span className="flex-1">Could not load complaints: {loadError}</span><button type="button" onClick={() => load()} className="min-h-11 rounded-lg border bg-white px-3 text-xs font-bold">Try again</button></p>}
        {bannersAtTop && banners}
        <div className="service-tools">
        {/* Complaints are raised on Warranty customers (or the customer card) and show up here (owner, 28 Oct 2026). */}
        {!isTechnician && !formOnly && onOpenWarranty && <button type="button" onClick={onOpenWarranty} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold text-stone-800 hover:border-amber-400">
            Raise a complaint: go to Warranty customers <span aria-hidden="true">›</span></button>}
        {!isTechnician && formOnly && <IssueForm user={user} initialCustomer={initialCustomer} formOnly={formOnly} canManage={canManage} defaultPartner={defaultPartner}
            busy={busy} run={run} onRaised={setSelectedId} />}</div>
        {!formOnly && <><div className="service-filters flex flex-wrap gap-2">{filters.map(([key, label]) =>
            <button key={key} type="button" onClick={() => chooseFilter(key)} className={`min-h-11 rounded-full px-4 text-xs font-bold ${filter === key ? 'bg-stone-900 text-white' : 'bg-white border text-stone-700'}`}>{label} ({countFor(key)})</button>)}</div>
        <div className={`service-workspace ${selected ? 'has-selection' : ''} ${shown.length <= 1 ? 'single-result' : ''}`}>
            <div className="service-list space-y-2" aria-label="Complaint list">{shown.length === 0 && <p className="rounded-2xl border bg-white p-4 text-sm text-stone-500">No complaints in this view.</p>}{shown.map(issue =>
                <button key={issue.id} type="button" onClick={() => openIssue(issue.id)} aria-pressed={selectedId === issue.id} className={`service-list-item block w-full rounded-xl border p-3 text-left ${selectedId === issue.id ? 'border-amber-500 bg-amber-50' : 'bg-white'}`}>
                    <span className="flex items-start gap-2"><span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-stone-500">{ticketLabel(issue)}</span><strong className="block break-words">{issue.customer_name}</strong></span><ChevronRight size={16} className="mt-1 shrink-0 text-stone-400" /></span>
                    <span className="mt-2 inline-flex"><StatusPill issue={issue} /></span>
                </button>)}</div>
            <div ref={detailRef} className="service-detail scroll-mt-4 rounded-2xl border bg-white p-4 sm:p-5 space-y-4 min-w-0">
                {!selected ? null : <>
                    <button type="button" onClick={() => { setSelectedId(null); setError(''); setNotice(''); }} className="service-back inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-stone-600"><ArrowLeft size={16} /> All complaints</button>
                    <div className="space-y-1">
                        <h2 className="font-bold text-lg break-words">{selected.ticket_no && <span className="text-stone-500">{ticketLabel(selected)} </span>}{selected.customer_name}</h2>
                        <div className="flex flex-wrap items-center gap-1.5"><StatusPill issue={selected} />
                            {selected.warranty_end || !selected.warranty_status || selected.warranty_status === 'unknown'
                                ? <WarrantyBadge info={{ status: selected.warranty_status || 'unknown', start: selected.warranty_start || null, end: selected.warranty_end || null, source: null }} />
                                : <WarrantyPill status={selected.warranty_status} />}
                        </div>
                        <RaisedBy issue={selected} />
                        <p className="text-xs text-stone-500">Required {selected.required_date}{canManage && selected.assigned_to ? ` · Assigned to ${technicianName(selected.assigned_to)}` : ''}</p>
                    </div>
                    {!bannersAtTop && banners}
                    <ClosureNote issue={selected} forTechnician={isTechnician} />
                    {/* The technician's next step comes before the details, so the
                        code box is on screen without scrolling on a phone. */}
                    {isTechnician && <TechnicianJobPanel key={selected.id} issue={selected} userId={user.id} busy={busy} run={run}
                        onClaimed={id => { setSelectedId(id); chooseFilter('mine', true); }} onReleased={() => setSelectedId(null)} />}
                    <div className={`service-detail-grid ${hasVisitColumn ? '' : 'no-visit-column'}`}><div className="service-customer-column space-y-4">{showDetails && <CustomerFacts issue={selected} userType={user?.userType} />}
                    {selected.give_up_reason && <p className="rounded-lg bg-amber-50 p-2 text-xs">Previous give-up reason: {selected.give_up_reason}</p>}
                    {/* Before / After photos are the technician's; partners do not see the photo section. */}
                    {showDetails && !photosInJobPanel && !isPartner && <ComplaintPhotos key={`photos:${selected.id}`} issue={selected} userId={user?.id} userType={user?.userType} busy={busy} run={run} />}
                    {canManage && <VisitStage key={`stage:${selected.id}`} issue={selected} busy={busy} run={run} office />}
                    {canManage && <OfficeIssuePanel key={selected.id} issue={selected} technicians={technicians} techError={techError} busy={busy} run={run} update={update} />}
                    {showDetails && <ComplaintComments key={`comments:${selected.id}`} issue={selected} user={user} busy={busy} run={run} />}
                    {showDetails && <ComplaintHistory key={`history:${selected.id}`} issue={selected} />}
                    {canManage && WHATSAPP_ENABLED && <WhatsAppLog key={`wa:${selected.id}`} issueId={selected.id} />}
                    </div>{hasVisitColumn && <div className="service-visit-column space-y-4"><div className="space-y-2"><h3 className="text-sm font-bold">Visits and travel</h3>{visits.length === 0 && <p className="text-xs text-stone-500">No visits recorded.</p>}{visits.map(visit => <VisitRow key={visit.id} visit={visit} />)}</div>
                    {canManage && selected.assigned_to && <VisitForm key={`${selected.id}:${selected.assigned_to}`} issue={selected} user={user} busy={busy} run={run} visits={visits} onSaved={reloadVisits} />}
                    {canManage && selected.assigned_to && <CombinedVisitForm key={`combined:${selected.id}:${selected.assigned_to}`} issue={selected} issues={issues} user={user} busy={busy} run={run} onSaved={reloadVisits} />}</div>}</div>
                </>}
            </div>
        </div></>}
    </div>;
}
