import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { warrantyInfo, formatWarrantyDate } from '../../utils/warranty';
import { complaintError, todayLocal } from './serviceLabels';
import { isPincode, pincodeInText } from './tripLabels';
import { logFieldChanges } from '../../utils';

const WARRANTY_DATE_FIELDS = ['installation_date', 'material_delivery_date', 'completed_at'];
const SOURCE_LABELS = { installation_date: 'installation date', material_delivery_date: 'material delivery date', completed_at: 'completion date' };

const issueDraft = (customer, defaultPartner) => ({
    channel_partner_name: customer?.channel_partner || defaultPartner,
    consumer_no: String(customer?.consumer_no ?? ''),
    customer_name: customer?.customer_name || '',
    customer_phone: String(customer?.phone_number ?? ''),
    service_address: customer?.full_address || [customer?.villages, customer?.sub_divisions, customer?.district].filter(Boolean).join(', '),
    pincode: String(customer?.pincode ?? '').replace(/\D/g, '') || pincodeInText(customer?.full_address) || '',
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
// Raising sends the details and a comment only: no files. The technician adds
// Before and After photos at the site (ComplaintPhotos).
export default function IssueForm({ user, initialCustomer = null, formOnly = false, canManage, defaultPartner, busy, run, onRaised }) {
    const linked = Boolean(initialCustomer?.id);
    const [newIssue, setNewIssue] = useState(() => issueDraft(initialCustomer, defaultPartner));
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

    // The card's own address and pincode: the km of every visit is worked out from
    // them, so a missing one is shown with a button to open the card and fill it in.
    // Read again when that card is closed, and the form takes any newly filled value.
    const [card, setCard] = useState(null);
    const [cardReload, setCardReload] = useState(0);
    useEffect(() => {
        if (!linked) return undefined;
        const closed = event => { if (event.detail?.id === initialCustomer.id) setCardReload(n => n + 1); };
        window.addEventListener('customer-card-closed', closed);
        return () => window.removeEventListener('customer-card-closed', closed);
    }, [linked, initialCustomer?.id]);
    useEffect(() => {
        if (!linked) return undefined;
        let active = true;
        supabase.from('admin').select('full_address, pincode').eq('id', initialCustomer.id).maybeSingle().then(({ data, error: readError }) => {
            if (!active) return;
            // Could not read the card: do not block the complaint on it.
            if (readError || !data) { setCard({ address: '?', pincode: '?' }); return; }
            const pin = String(data.pincode ?? '').replace(/\D/g, '');
            setCard({ address: String(data.full_address ?? '').trim(), pincode: isPincode(pin) ? pin : '' });
            setNewIssue(v => ({
                ...v,
                service_address: String(data.full_address ?? '').trim() || v.service_address,
                pincode: (isPincode(pin) ? pin : '') || v.pincode || pincodeInText(data.full_address) || '',
            }));
        });
        return () => { active = false; };
    }, [linked, initialCustomer?.id, cardReload]);
    const cardMissing = !card ? '' : !card.address && !card.pincode ? 'Address and pincode' : !card.pincode ? 'Pincode' : !card.address ? 'Address' : '';
    const [confirmed, setConfirmed] = useState(false);
    const [savingCard, setSavingCard] = useState(false);
    const [cardError, setCardError] = useState('');

    // A complaint cannot be raised while the card lacks the address or pincode:
    // the form's address and pincode are saved to the customer (admin row) first,
    // logged in the card's history like any other edit.
    const saveToCard = async () => {
        const address = newIssue.service_address.trim();
        if (!address) { setCardError('Enter the customer\'s address.'); return; }
        if (!isPincode(newIssue.pincode)) { setCardError('Enter the customer\'s 6-digit pincode.'); return; }
        setSavingCard(true); setCardError('');
        try {
            const patch = {};
            if (!card.address) patch.full_address = address;
            if (!card.pincode) patch.pincode = newIssue.pincode;
            const { data, error: saveError } = await supabase.from('admin').update(patch).eq('id', initialCustomer.id).select('full_address, pincode');
            if (saveError) throw saveError;
            if (!data?.length) throw new Error('You cannot change this customer. Ask the office to add the address and pincode.');
            void logFieldChanges(user.id, initialCustomer.id, initialCustomer.customer_name, { full_address: card.address || null, pincode: card.pincode || null }, patch, 'Raise complaint');
            setCardReload(n => n + 1);
        } catch (failure) {
            setCardError(failure.message || 'Could not save to the customer card.');
        } finally {
            setSavingCard(false);
        }
    };

    if (!canManage && !linked) {
        return <p className="rounded-2xl border bg-white p-4 text-sm text-stone-600">To raise a complaint, open a completed customer and press Raise complaint.</p>;
    }
    if (raised) return null;

    const create = event => {
        event.preventDefault();
        run(async () => {
            if (linked && cardMissing) throw new Error('Save the address and pincode to the customer card first.');
            if (!isPincode(newIssue.pincode)) throw new Error('Enter the customer\'s 6-digit pincode.');
            if (!confirmed) throw new Error('Confirm the address and pincode with the customer first.');
            const { pincode, ...fields } = newIssue;
            // The pincode goes into the complaint address, so the visit km can use it
            // even while the customer card has none.
            const address = fields.service_address.trim();
            const service_address = pincodeInText(address) === pincode ? address : [address, pincode].filter(Boolean).join(', ');
            const payload = { ...fields, service_address, system_kw: fields.system_kw === '' ? null : Number(fields.system_kw), created_by: user.id };
            if (linked) payload.customer_id = initialCustomer.id;
            const { data, error: writeError } = await supabase.from('service_issues').insert(payload).select('id, ticket_no').single();
            if (writeError) throw new Error(complaintError(writeError));
            if (formOnly) setRaised(true);
            else { setNewIssue(issueDraft(null, defaultPartner)); setExpanded(false); onRaised?.(data.id); }
            setConfirmed(false);
            return `${data.ticket_no ? `Complaint #${data.ticket_no}` : 'Complaint'} raised. Technicians can now claim it.`;
        }, 'Complaint raised. Technicians can now claim it.');
    };

    if (!expanded) {
        return <div className="service-new-complaint space-y-2">
            <button type="button" onClick={() => setExpanded(true)} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold">Raise a complaint</button>
            <p className="text-xs text-stone-500">Existing customer? Raise the complaint from their completed customer card.</p>
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
            ? <dl className="sm:col-span-2 grid gap-x-4 gap-y-1 rounded-xl bg-stone-50 p-3 text-sm break-words sm:grid-cols-2">
                {[['Customer', newIssue.customer_name], ['Consumer number', newIssue.consumer_no], ['Phone', newIssue.customer_phone],
                    ['Channel partner', [initialCustomer?.channel_partner, initialCustomer?.sub_channel_partner].filter(Boolean).join(' / ')],
                    ['System', [newIssue.system_company_name, newIssue.system_kw ? `${newIssue.system_kw} kW` : ''].filter(Boolean).join(' · ')],
                    ['Address', [newIssue.service_address, newIssue.pincode].filter(Boolean).join(', ')]].map(([label, value]) =>
                    <div key={label} className="min-w-0"><dt className="text-xs text-stone-500">{label}</dt><dd className="font-semibold">{value || '—'}</dd></div>)}
            </dl>
            : <>
                <label className="text-xs font-semibold">Consumer Number *<input required maxLength={100} value={newIssue.consumer_no} onChange={e => setNewIssue(v => ({ ...v, consumer_no: e.target.value }))} className={field} /></label>
                <label className="text-xs font-semibold">Customer name *<input required maxLength={160} value={newIssue.customer_name} onChange={e => setNewIssue(v => ({ ...v, customer_name: e.target.value }))} className={field} /></label>
            </>}
        <label className="text-xs font-semibold">Channel Partner name<input maxLength={160} value={newIssue.channel_partner_name} onChange={e => setNewIssue(v => ({ ...v, channel_partner_name: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">Required date<input required type="date" value={newIssue.required_date} onChange={e => setNewIssue(v => ({ ...v, required_date: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">Customer mobile number<input type="tel" value={newIssue.customer_phone} onChange={e => setNewIssue(v => ({ ...v, customer_phone: e.target.value }))} className={field} />
            {linked && <span className="mt-1 block font-normal text-stone-500">The completion code always goes to the number on the customer record.</span>}</label>
        {linked && cardMissing && <p role="alert" className="sm:col-span-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
            {cardMissing} missing on the customer card. Ask the customer, fill in the address and pincode below and save them to the card. Then the complaint can be raised.
        </p>}
        <label className="text-xs font-semibold">Customer address *<input required maxLength={500} value={newIssue.service_address} onChange={e => { setNewIssue(v => ({ ...v, service_address: e.target.value })); setConfirmed(false); }} className={field} /></label>
        <label className="text-xs font-semibold">Pincode *<input required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} placeholder="385340" value={newIssue.pincode} onChange={e => { setNewIssue(v => ({ ...v, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })); setConfirmed(false); }} className={field} /></label>
        {linked && cardMissing && <div className="sm:col-span-2 space-y-2">
            <button type="button" disabled={savingCard || !newIssue.service_address.trim() || !isPincode(newIssue.pincode)} onClick={saveToCard}
                className="min-h-11 w-full rounded-lg bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40 sm:w-auto">{savingCard ? 'Saving…' : 'Save to customer card'}</button>
            {cardError && <p role="alert" className="text-xs font-semibold text-red-700">{cardError}</p>}
        </div>}
        <label className="sm:col-span-2 flex min-h-11 items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-sm font-semibold text-sky-950">
            <input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <span>I read this address and pincode out to the customer and they confirmed it is right.<span className="mt-0.5 block text-xs font-normal">The technician goes here and the km is worked out from it.</span></span>
        </label>
        <label className="text-xs font-semibold">Type of problem *<input required autoFocus={formOnly} maxLength={160} value={newIssue.problem_type} onChange={e => setNewIssue(v => ({ ...v, problem_type: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">System company name<input value={newIssue.system_company_name} onChange={e => setNewIssue(v => ({ ...v, system_company_name: e.target.value }))} className={field} /></label>
        <label className="text-xs font-semibold">System kW<input type="number" min="0" step="0.01" value={newIssue.system_kw} onChange={e => setNewIssue(v => ({ ...v, system_kw: e.target.value }))} className={field} /></label>
        <label className="sm:col-span-2 text-xs font-semibold">Comment<textarea maxLength={2000} rows={3} value={newIssue.comment} onChange={e => setNewIssue(v => ({ ...v, comment: e.target.value }))} className="mt-1 block w-full rounded-lg border p-2 text-sm" />
            <span className="mt-1 block font-normal text-stone-500">The technician adds Before and After photos at the site.</span></label>
        <button disabled={busy || (linked && (!card || Boolean(cardMissing)))} className="min-h-11 rounded-lg bg-amber-500 px-4 py-3 text-sm font-bold disabled:opacity-50">Raise complaint</button>
        {linked && cardMissing && <p className="self-center text-xs text-stone-500">Save the address and pincode to the customer card first.</p>}
    </form>;
}
