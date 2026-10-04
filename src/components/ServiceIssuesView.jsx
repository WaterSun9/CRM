import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase';

const today = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
const validFiles = files => files.length <= 5 && files.every(file => file.size <= 10 * 1024 * 1024 && acceptedTypes.has(file.type));
const issueDraft = (customer, defaultPartner) => ({
    channel_partner_name: customer?.channel_partner || defaultPartner,
    consumer_no: String(customer?.consumer_no ?? ''),
    customer_name: customer?.customer_name || '',
    customer_phone: String(customer?.phone_number ?? ''),
    service_address: customer?.full_address || [customer?.villages, customer?.sub_divisions, customer?.district].filter(Boolean).join(', '),
    problem_type: '',
    system_company_name: customer?.module_brand || '',
    system_kw: customer?.system_capacity_kwp ?? '',
    comment: '',
    required_date: today()
});
async function uploadIssueFiles(issueId, files, userId) {
    const failed = [];
    for (const file of files) {
        const path = `${issueId}/${userId}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const uploaded = await supabase.storage.from('service-issues').upload(path, file, { upsert: false, contentType: file.type });
        if (uploaded.error) { failed.push(file.name); continue; }
        const recorded = await supabase.from('service_issue_files').insert({ issue_id: issueId, storage_path: path, file_name: file.name, mime_type: file.type, uploaded_by: userId });
        if (recorded.error) { await supabase.storage.from('service-issues').remove([path]); failed.push(file.name); }
    }
    return failed;
}

export default function ServiceIssuesView({ user, initialCustomer = null, formOnly = false }) {
    const isTechnician = user?.userType === 'technician';
    const canManage = ['admin', 'sales'].includes(user?.userType);
    const defaultPartner = ['channel_partner_office', 'office2', 'agent', 'agent2'].includes(user?.userType) ? user?.channel_partner || '' : '';
    const [issues, setIssues] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [visits, setVisits] = useState([]);
    const [files, setFiles] = useState([]);
    const [extraFiles, setExtraFiles] = useState([]);
    const [attachedFiles, setAttachedFiles] = useState([]);
    const [newIssue, setNewIssue] = useState(() => issueDraft(initialCustomer, defaultPartner));
    const [newVisit, setNewVisit] = useState({ visit_date: today(), kilometers: '', amount_inr: '', note: '' });
    const [giveUpReason, setGiveUpReason] = useState('');
    const [filter, setFilter] = useState(isTechnician ? 'open' : 'all');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        const rows = [];
        if (isTechnician) {
            const { data: queue, error: queueError } = await supabase.rpc('open_service_issue_queue');
            if (queueError) { setError(queueError.message); return; }
            rows.push(...(queue || []));
        }
        for (let offset = 0; ; offset += 500) {
            const { data, error: readError } = await supabase.from('service_issues').select('*')
                .order('required_date', { ascending: true }).range(offset, offset + 499);
            if (readError) { setError(readError.message); return; }
            rows.push(...(data || []));
            if (!data || data.length < 500) break;
        }
        // The technician queue RPC and the table query can return the same
        // open issue. Keep one row per id so counts and actions stay accurate.
        setIssues([...new Map(rows.map(issue => [issue.id, issue])).values()]);
        setError('');
    }, [isTechnician]);
    useEffect(() => {
        if (formOnly) return undefined;
        load();
        const timer = setInterval(load, 15000);
        return () => clearInterval(timer);
    }, [load, formOnly]);

    const selected = issues.find(issue => issue.id === selectedId);
    useEffect(() => {
        if (!selectedId) { setVisits([]); return; }
        let active = true;
        supabase.from('service_visits').select('*').eq('issue_id', selectedId).order('visit_date', { ascending: false })
            .then(({ data, error: readError }) => { if (active) { if (readError) setError(readError.message); else setVisits(data || []); } });
        return () => { active = false; };
    }, [selectedId, issues]);
    useEffect(() => {
        if (!selectedId) { setAttachedFiles([]); return; }
        let active = true;
        supabase.from('service_issue_files').select('id,file_name,storage_path').eq('issue_id', selectedId).order('created_at')
            .then(({ data, error: readError }) => { if (active) { if (readError) setError(readError.message); else setAttachedFiles(data || []); } });
        return () => { active = false; };
    }, [selectedId, issues]);

    const run = async (action, successMessage) => {
        if (busy) return;
        setBusy(true); setError(''); setNotice('');
        try {
            const { data: authData, error: authError } = await supabase.auth.getUser();
            if (authError || !authData?.user) throw new Error('Your login has expired. Sign in again before saving.');
            if (user?.id !== authData.user.id) throw new Error('This is a role preview, not a login to that account. Sign in as the user to raise or change a service issue.');
            const message = await action();
            setNotice(message || successMessage);
            if (!formOnly) await load();
        }
        catch (failure) { setError(failure.message || 'Could not save the change.'); }
        finally { setBusy(false); }
    };
    const update = async (id, changes, filters = []) => {
        let query = supabase.from('service_issues').update(changes).eq('id', id);
        for (const [field, value] of filters) query = query.eq(field, value);
        const { data, error: writeError } = await query.select('id');
        if (writeError) throw writeError;
        if (!data?.length) throw new Error('This issue changed before your action. Refresh and try again.');
    };
    const create = event => {
        event.preventDefault();
        run(async () => {
            const { data, error: writeError } = await supabase.from('service_issues')
                .insert({ ...newIssue, system_kw: newIssue.system_kw === '' ? null : Number(newIssue.system_kw), created_by: user.id }).select('id').single();
            if (writeError) throw writeError;
            if (!formOnly) setSelectedId(data.id);
            setNewIssue(issueDraft(formOnly ? initialCustomer : null, defaultPartner));
            setFiles([]);
            const failed = await uploadIssueFiles(data.id, files, user.id);
            return failed.length ? `Issue raised, but ${failed.length} photo(s) did not upload: ${failed.join(', ')}. Open the issue and add them later.` : 'Issue raised. Technicians can now claim it.';
        }, 'Issue raised. Technicians can now claim it.');
    };
    const claim = issue => run(async () => {
        const { data, error: claimError } = await supabase.rpc('claim_service_issue', { p_issue_id: issue.id });
        if (claimError) throw claimError;
        if (!data) throw new Error('Another technician has already claimed this issue.');
        setSelectedId(issue.id); setFilter('mine');
    }, 'Issue assigned to you.');
    const giveUp = issue => run(async () => {
        if (!giveUpReason.trim()) throw new Error('Enter a reason before giving up this issue.');
        const { data, error: giveUpError } = await supabase.rpc('give_up_service_issue', { p_issue_id: issue.id, p_reason: giveUpReason.trim() });
        if (giveUpError) throw giveUpError;
        if (!data) throw new Error('This assignment changed before your action. Refresh and try again.');
        setGiveUpReason(''); setSelectedId(null);
    }, 'Issue returned to the open queue for reassignment.');
    const saveVisit = event => {
        event.preventDefault();
        run(async () => {
            const { error: writeError } = await supabase.from('service_visits').insert({
                issue_id: selected.id, technician_id: selected.assigned_to, entered_by: user.id,
                visit_date: newVisit.visit_date, kilometers: Number(newVisit.kilometers),
                amount_inr: Number(newVisit.amount_inr), note: newVisit.note.trim()
            });
            if (writeError) throw writeError;
            setNewVisit({ visit_date: today(), kilometers: '', amount_inr: '', note: '' });
            const { data } = await supabase.from('service_visits').select('*').eq('issue_id', selected.id).order('visit_date', { ascending: false });
            setVisits(data || []);
        }, 'Visit distance and amount saved.');
    };
    const addPhotos = async event => {
        event.preventDefault();
        if (!selected || !extraFiles.length || attachedFiles.length + extraFiles.length > 5 || !validFiles(extraFiles)) { setError('An issue can have at most 5 files, each no larger than 10 MB.'); return; }
        await run(async () => {
            const failed = await uploadIssueFiles(selected.id, extraFiles, user.id);
            setExtraFiles([]);
            const { data } = await supabase.from('service_issue_files').select('id,file_name,storage_path').eq('issue_id', selected.id).order('created_at');
            setAttachedFiles(data || []);
            return failed.length ? `${failed.length} file(s) did not upload: ${failed.join(', ')}` : 'Files attached.';
        }, 'Files attached.');
    };
    const openPhoto = async photo => {
        const { data, error: linkError } = await supabase.storage.from('service-issues').createSignedUrl(photo.storage_path, 120);
        if (linkError) { setError(linkError.message); return; }
        window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
    };

    const shown = issues.filter(issue => {
        if (filter === 'open') return issue.status === 'open';
        if (filter === 'mine') return issue.assigned_to === user.id;
        return filter === 'all' || issue.status === filter;
    });

    return <div className={formOnly ? 'w-full space-y-3' : 'mx-auto w-full max-w-6xl p-3 sm:p-6 space-y-4'}>
        {!formOnly && <header className="rounded-2xl border bg-white p-4"><h1 className="text-xl font-bold">Field Service Management</h1><p className="text-sm text-stone-500">{isTechnician ? 'Claim an open issue to see its details and manage your assignment.' : canManage ? 'Raise issues, review assignments, and record each visit’s distance and amount.' : 'Raise a service issue and track its status.'}</p></header>}
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-800">{notice}</p>}
        {!isTechnician && <form onSubmit={create} className="rounded-2xl border bg-white p-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><h2 className="font-bold">{formOnly ? `Raise an issue for ${initialCustomer?.customer_name || 'customer'}` : 'Raise an issue'}</h2>{formOnly && <p className="mt-1 text-xs text-stone-500">Customer details are filled from the completed record. Review them and enter the problem details.</p>}</div>
            <label className="text-xs font-semibold">Channel Partner name<input maxLength={160} value={newIssue.channel_partner_name} onChange={e => setNewIssue(v => ({ ...v, channel_partner_name: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Consumer Number *<input required maxLength={100} value={newIssue.consumer_no} onChange={e => setNewIssue(v => ({ ...v, consumer_no: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Customer name<input required maxLength={160} value={newIssue.customer_name} onChange={e => setNewIssue(v => ({ ...v, customer_name: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Required date<input required type="date" value={newIssue.required_date} onChange={e => setNewIssue(v => ({ ...v, required_date: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Customer mobile number<input type="tel" value={newIssue.customer_phone} onChange={e => setNewIssue(v => ({ ...v, customer_phone: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Customer address<input value={newIssue.service_address} onChange={e => setNewIssue(v => ({ ...v, service_address: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">Type of problem<input required autoFocus={formOnly} maxLength={160} value={newIssue.problem_type} onChange={e => setNewIssue(v => ({ ...v, problem_type: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">System company name<input value={newIssue.system_company_name} onChange={e => setNewIssue(v => ({ ...v, system_company_name: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="text-xs font-semibold">System kW<input type="number" min="0" step="0.01" value={newIssue.system_kw} onChange={e => setNewIssue(v => ({ ...v, system_kw: e.target.value }))} className="mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm" /></label>
            <label className="sm:col-span-2 text-xs font-semibold">Comment<textarea maxLength={2000} rows={3} value={newIssue.comment} onChange={e => setNewIssue(v => ({ ...v, comment: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm" /></label>
            <label className="sm:col-span-2 text-xs font-semibold">Photos of the problem (optional, up to 5 files, 10 MB each)<input key={selectedId || 'new'} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => {
                const chosen = [...e.target.files];
                if (!validFiles(chosen)) { setFiles([]); setError('Choose at most 5 JPG, PNG, WebP or PDF files, each no larger than 10 MB.'); e.target.value = ''; return; }
                setFiles(chosen); setError('');
            }} className="mt-1 block w-full rounded-lg border p-2 text-sm" />{files.length > 0 && <span className="block mt-1">{files.length} file(s) selected</span>}</label>
            <button disabled={busy} className="rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold disabled:opacity-50">Raise issue</button>
        </form>}
        {!formOnly && <><div className="flex flex-wrap gap-2">{(isTechnician ? [['open','Open jobs'],['mine','My jobs']] : [['all','All'],['open','Open'],['assigned','Assigned'],['completed','Completed']]).map(([key,label]) =>
            <button key={key} type="button" onClick={() => setFilter(key)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === key ? 'bg-stone-900 text-white' : 'bg-white border text-stone-700'}`}>{label}</button>)}</div>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
            <div className="space-y-2">{shown.length === 0 && <p className="rounded-2xl border bg-white p-4 text-sm text-stone-500">No issues in this view.</p>}{shown.map(issue =>
                <button key={issue.id} type="button" onClick={() => setSelectedId(issue.id)} className={`block w-full rounded-2xl border p-4 text-left ${selectedId === issue.id ? 'border-amber-500 bg-amber-50' : 'bg-white'}`}>
                    <strong className="block">{issue.customer_name}</strong><span className="text-xs text-stone-500">{issue.consumer_no ? `${issue.consumer_no} · ` : ''}Required {issue.required_date} · {issue.status}</span>
                    <p className="mt-1 truncate text-sm text-stone-700">{issue.problem_type}</p>
                </button>)}</div>
            <div className="rounded-2xl border bg-white p-4 space-y-4 min-w-0">
                {!selected ? <p className="text-sm text-stone-500">Select an issue to see details.</p> : <>
                    <div><h2 className="font-bold text-lg">{selected.customer_name}</h2><p className="text-xs text-stone-500">Required {selected.required_date} · {selected.status}</p></div>
                    {(!isTechnician || selected.assigned_to === user.id) && <div className="space-y-1 text-sm break-words"><p><strong>Channel Partner:</strong> {selected.channel_partner_name || '—'}</p><p><strong>Consumer Number:</strong> {selected.consumer_no}</p><p><strong>Phone:</strong> {selected.customer_phone || '—'}</p><p><strong>Address:</strong> {selected.service_address || '—'}</p><p><strong>Type of problem:</strong> {selected.problem_type}</p><p><strong>System company:</strong> {selected.system_company_name || '—'}</p><p><strong>System kW:</strong> {selected.system_kw ?? '—'}</p><p><strong>Comment:</strong> {selected.comment || '—'}</p></div>}
                    {selected.give_up_reason && <p className="rounded-lg bg-amber-50 p-2 text-xs">Previous give-up reason: {selected.give_up_reason}</p>}
                    {(!isTechnician || selected.assigned_to === user.id) && <div className="border-t pt-3 space-y-2"><h3 className="text-sm font-bold">Problem files ({attachedFiles.length}/5)</h3>{attachedFiles.map(photo => <button key={photo.id} type="button" onClick={() => openPhoto(photo)} className="block text-sm font-semibold text-blue-700 underline break-all">{photo.file_name}</button>)}{!isTechnician && attachedFiles.length < 5 && <form onSubmit={addPhotos} className="space-y-2"><input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => setExtraFiles([...e.target.files])} className="block w-full text-xs" /><button disabled={busy || !extraFiles.length} className="min-h-10 rounded-lg border px-3 text-xs font-bold">Add files</button></form>}</div>}
                    {isTechnician && selected.status === 'open' && <button type="button" disabled={busy} onClick={() => claim(selected)} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold">Claim this job</button>}
                    {isTechnician && selected.status === 'assigned' && selected.assigned_to === user.id && <div className="space-y-2"><label className="text-xs font-semibold">Reason for giving up<textarea value={giveUpReason} onChange={e => setGiveUpReason(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 text-sm" /></label><button type="button" disabled={busy || !giveUpReason.trim()} onClick={() => giveUp(selected)} className="min-h-11 rounded-lg border px-4 text-xs font-bold">Give up and reopen</button></div>}
                    {canManage && <div className="flex flex-wrap gap-2">
                        {selected.status === 'assigned' && <><button type="button" disabled={busy} onClick={() => run(() => update(selected.id, { status: 'open', assigned_to: null, assigned_at: null }, [['status','assigned']]), 'Issue reopened for reassignment.')} className="min-h-10 rounded-lg border px-3 text-xs font-bold">Reopen for reassignment</button><button type="button" disabled={busy} onClick={() => run(() => update(selected.id, { status: 'completed' }, [['status','assigned']]), 'Issue marked completed.')} className="min-h-10 rounded-lg bg-stone-900 px-3 text-xs font-bold text-white">Mark completed</button></>}
                        {selected.status === 'completed' && <button type="button" disabled={busy} onClick={() => run(() => update(selected.id, { status: 'assigned' }, [['status','completed']]), 'Issue reopened.')} className="min-h-10 rounded-lg border px-3 text-xs font-bold">Reopen issue</button>}
                    </div>}
                    <div className="border-t pt-3 space-y-2"><h3 className="text-sm font-bold">Visits and travel</h3>{visits.length === 0 && <p className="text-xs text-stone-500">No visits recorded.</p>}{visits.map(visit => <p key={visit.id} className="rounded-lg bg-stone-50 p-2 text-xs">{visit.visit_date} · {visit.kilometers} km · {money(visit.amount_inr)}{visit.note ? ` · ${visit.note}` : ''}</p>)}</div>
                    {canManage && selected.assigned_to && <form onSubmit={saveVisit} className="grid gap-2 sm:grid-cols-3 border-t pt-3"><h3 className="sm:col-span-3 text-sm font-bold">Record a visit payment</h3><label className="text-xs">Date<input required type="date" value={newVisit.visit_date} onChange={e => setNewVisit(v => ({ ...v, visit_date: e.target.value }))} className="mt-1 block w-full min-h-10 rounded-lg border p-2" /></label><label className="text-xs">Kilometres<input required min="0" step="0.01" type="number" value={newVisit.kilometers} onChange={e => setNewVisit(v => ({ ...v, kilometers: e.target.value }))} className="mt-1 block w-full min-h-10 rounded-lg border p-2" /></label><label className="text-xs">Amount (₹)<input required min="0" step="0.01" type="number" value={newVisit.amount_inr} onChange={e => setNewVisit(v => ({ ...v, amount_inr: e.target.value }))} className="mt-1 block w-full min-h-10 rounded-lg border p-2" /></label><input maxLength={1000} value={newVisit.note} onChange={e => setNewVisit(v => ({ ...v, note: e.target.value }))} placeholder="Visit note (optional)" className="sm:col-span-3 min-h-10 rounded-lg border p-2 text-sm" /><button disabled={busy} className="sm:col-span-3 min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold">Save visit</button></form>}
                </>}
            </div>
        </div></>}
    </div>;
}
