import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { warrantyInfo, formatWarrantyDate } from '../../utils/warranty';
import { complaintError, todayLocal, uploadIssueFiles, validFiles } from './serviceLabels';

const WARRANTY_DATE_FIELDS = ['installation_date', 'material_delivery_date', 'completed_at'];
const SOURCE_LABELS = { installation_date: 'installation date', material_delivery_date: 'material delivery date', completed_at: 'completion date' };

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
    required_date: todayLocal()
});

function WarrantyBanner({ customer, failed }) {
    if (failed) return <p className="sm:col-span-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Could not check the warranty right now. It is worked out again when the complaint is saved.</p>;
    if (!customer) return <p className="sm:col-span-2 rounded-lg bg-stone-50 p-3 text-sm text-stone-500">Checking warranty…</p>;
    const info = warrantyInfo(customer);
    const from = info.start && <span className="mt-1 block text-xs font-normal">Counted from the {SOURCE_LABELS[info.source] || 'start date'} ({formatWarrantyDate(info.start)}).</span>;
    if (info.status === 'in_warranty') return <p className="sm:col-span-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">In warranty until {formatWarrantyDate(info.end)}{from}</p>;
    if (info.status === 'out_of_warranty') return <p className="sm:col-span-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">Out of warranty (ended {formatWarrantyDate(info.end)}). This complaint will be marked Out of warranty.{from}</p>;
    return <p className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">Warranty date missing<span className="mt-1 block text-xs font-normal">This customer has no installation, delivery or completion date. The complaint can still be raised.</span></p>;
}

// Raise-a-complaint form. From a completed customer card it links the
// complaint to that customer (customer_id) and the database fills the
// consumer number, name, WhatsApp number and warranty. Only the office may
// raise a free-form complaint for someone who is not in the CRM.
export default function IssueForm({ user, initialCustomer = null, formOnly = false, canManage, defaultPartner, busy, run, setError, onRaised }) {
    const linked = Boolean(initialCustomer?.id);
    const [newIssue, setNewIssue] = useState(() => issueDraft(initialCustomer, defaultPartner));
    const [files, setFiles] = useState([]);
    const [fileKey, setFileKey] = useState(0);
    const [expanded, setExpanded] = useState(formOnly);
    const [raised, setRaised] = useState(false);

    // Customer cards load only a few columns, so read the warranty dates when
    // they are missing instead of showing "Warranty date missing" by mistake.
    const needsDates = linked && WARRANTY_DATE_FIELDS.some(field => initialCustomer[field] === undefined);
    const [dates, setDates] = useState(null);
    const [datesFailed, setDatesFailed] = useState(false);
    useEffect(() => {
        if (!needsDates) return undefined;
        let active = true;
        supabase.from('admin').select(WARRANTY_DATE_FIELDS.join(',')).eq('id', initialCustomer.id).maybeSingle()
            .then(({ data, error: readError }) => { if (!active) return; if (readError || !data) setDatesFailed(true); else setDates(data); });
        return () => { active = false; };
    }, [needsDates, initialCustomer?.id]);
    const warrantyCustomer = !linked ? null : needsDates ? (dates && { ...initialCustomer, ...dates }) : initialCustomer;

    if (!canManage && !linked) {
        return <p className="rounded-2xl border bg-white p-4 text-sm text-stone-600">To raise a complaint, open a completed customer and press Raise complaint.</p>;
    }
    if (raised) return null;

    const create = event => {
        event.preventDefault();
        run(async () => {
            const payload = { ...newIssue, system_kw: newIssue.system_kw === '' ? null : Number(newIssue.system_kw), created_by: user.id };
            if (linked) payload.customer_id = initialCustomer.id;
            const { data, error: writeError } = await supabase.from('service_issues').insert(payload).select('id, ticket_no').single();
            if (writeError) throw new Error(complaintError(writeError));
            if (formOnly) setRaised(true);
            else { setNewIssue(issueDraft(null, defaultPartner)); setExpanded(false); onRaised?.(data.id); }
            setFiles([]); setFileKey(key => key + 1);
            const ticket = data.ticket_no ? `Complaint #${data.ticket_no}` : 'Complaint';
            const failed = await uploadIssueFiles(data.id, files, user.id);
            return failed.length
                ? `${ticket} raised, but ${failed.length} photo(s) did not upload: ${failed.join(', ')}. Open the complaint and add them later.`
                : `${ticket} raised. Technicians can now claim it.`;
        }, 'Complaint raised. Technicians can now claim it.');
    };

    if (!expanded) {
        return <div className="rounded-2xl border bg-white p-4 space-y-2">
            <button type="button" onClick={() => setExpanded(true)} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold">Raise a complaint</button>
            <p className="text-xs text-stone-500">For a customer in the CRM, open the completed customer and press Raise complaint, so the warranty and mobile number are filled in. Use this form only for someone who is not in the CRM.</p>
        </div>;
    }

    const field = 'mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm';
    return <form onSubmit={create} className="rounded-2xl border bg-white p-4 grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2 flex items-start justify-between gap-2">
            <div><h2 className="font-bold">Raise a complaint</h2>{linked && <p className="mt-1 text-xs text-stone-500">Customer details are filled from the completed record. Enter the problem details.</p>}</div>
            {!formOnly && <button type="button" onClick={() => setExpanded(false)} className="min-h-11 rounded-lg border px-3 text-xs font-bold">Hide</button>}
        </div>
        {linked && <WarrantyBanner customer={warrantyCustomer} failed={datesFailed} />}
        {linked
            ? <div className="sm:col-span-2 rounded-xl bg-stone-50 p-3 text-sm break-words"><strong className="block">{newIssue.customer_name || 'Customer'}</strong><span className="text-xs text-stone-500">Consumer Number: {newIssue.consumer_no || '—'}</span></div>
            : <>
                <label className="text-xs font-semibold">Consumer Number *<input required maxLength={100} value={newIssue.consumer_no} onChange={e => setNewIssue(v => ({ ...v, consumer_no: e.target.value }))} className={field} /></label>
                <label className="text-xs font-semibold">Customer name *<input required maxLength={160} value={newIssue.customer_name} onChange={e => setNewIssue(v => ({ ...v, customer_name: e.target.value }))} className={field} /></label>
            </>}
        <label className="text-xs font-semibold">Channel Partner name<input maxLength={160} value={newIssue.channel_partner_name} onChange={e => setNewIssue(v => ({ ...v, channel_partner_name: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">Required date<input required type="date" value={newIssue.required_date} onChange={e => setNewIssue(v => ({ ...v, required_date: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">Customer mobile number<input type="tel" value={newIssue.customer_phone} onChange={e => setNewIssue(v => ({ ...v, customer_phone: e.target.value }))} className={field} />
            {linked && <span className="mt-1 block font-normal text-stone-500">The completion code always goes to the number on the customer record.</span>}</label>
        <label className="text-xs font-semibold">Customer address<input value={newIssue.service_address} onChange={e => setNewIssue(v => ({ ...v, service_address: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">Type of problem *<input required autoFocus={formOnly} maxLength={160} value={newIssue.problem_type} onChange={e => setNewIssue(v => ({ ...v, problem_type: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">System company name<input value={newIssue.system_company_name} onChange={e => setNewIssue(v => ({ ...v, system_company_name: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">System kW<input type="number" min="0" step="0.01" value={newIssue.system_kw} onChange={e => setNewIssue(v => ({ ...v, system_kw: e.target.value }))} className={field} /></label>
        <label className="sm:col-span-2 text-xs font-semibold">Comment<textarea maxLength={2000} rows={3} value={newIssue.comment} onChange={e => setNewIssue(v => ({ ...v, comment: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm" /></label>
        <label className="sm:col-span-2 text-xs font-semibold">Photos of the problem (optional, up to 5 files, 10 MB each)<input key={fileKey} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={e => {
            const chosen = [...e.target.files];
            if (!validFiles(chosen)) { setFiles([]); setError('Choose at most 5 JPG, PNG, WebP or PDF files, each no larger than 10 MB.'); e.target.value = ''; return; }
            setFiles(chosen); setError('');
        }} className="mt-1 block w-full rounded-lg border p-2 text-sm" />{files.length > 0 && <span className="block mt-1">{files.length} file(s) selected</span>}</label>
        <button disabled={busy} className="min-h-11 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold disabled:opacity-50">Raise complaint</button>
    </form>;
}
