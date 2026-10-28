import { useEffect, useState } from 'react';
import { Cpu, History, MapPin, Pencil, Plus, ShieldCheck, Store, User, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { warrantyInfo, formatWarrantyDate, todayIST } from '../../utils/warranty';
import { logFieldChanges } from '../../utils';
import WarrantyBadge from '../WarrantyBadge';
import ComplaintHistory from './ComplaintHistory';
import ComplaintComments from './ComplaintComments';
import ComplaintPhotos from './ComplaintPhotos';
import {
    OFFICE_TYPES, PARTNER_TYPES, STAGE_LABELS, STAGE_PILL, cleanMobile, formatDateTime, issueStage, money, serialList, ticketLabel
} from './serviceLabels';
import { isPincode, pincodeInText } from './tripLabels';
import { contactPhones } from './contactPhones';

const CARD_COLUMNS = 'id, customer_name, phone_number, consumer_no, full_address, pincode, villages, district, channel_partner, sub_channel_partner, panel_serial_no, inverter_serial_no, inverter_make, module_brand, module_wp, no_of_modules, system_capacity_kwp, installation_date, material_delivery_date, completed_at';
const DAY = 86400000;

const showPhone = phone => { const m = cleanMobile(phone); return m ? `${m.slice(0, 5)} ${m.slice(5)}` : phone; };

// Years and months between two ISO dates, in words ("3 years 4 months").
function span(fromIso, toIso) {
    const from = new Date(`${fromIso}T00:00:00Z`), to = new Date(`${toIso}T00:00:00Z`);
    let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
    if (to.getUTCDate() < from.getUTCDate()) months -= 1;
    if (months < 1) return `${Math.max(0, Math.round((to - from) / DAY))} days`;
    const y = Math.floor(months / 12), m = months % 12;
    return [y && `${y} year${y > 1 ? 's' : ''}`, m && `${m} month${m > 1 ? 's' : ''}`].filter(Boolean).join(' ');
}

// How much of the 5 years is used, as a bar.
function WarrantyBar({ card }) {
    const info = warrantyInfo(card);
    if (!info.start || !info.end) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Warranty date missing.</strong> Add the installation date on the full customer card.</div>;
    const today = todayIST();
    const total = Date.parse(info.end) - Date.parse(info.start), used = Math.min(Math.max(Date.parse(today) - Date.parse(info.start), 0), total);
    const pct = total > 0 ? Math.round((used / total) * 100) : 100;
    const live = info.status === 'in_warranty';
    return <div className={`rounded-2xl border p-4 ${live ? 'border-emerald-200 bg-emerald-50/60' : 'border-red-200 bg-red-50/60'}`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className={`text-sm font-bold ${live ? 'text-emerald-900' : 'text-red-900'}`}>{live ? `${span(today, info.end)} of warranty left` : `Warranty ended ${formatWarrantyDate(info.end)}`}</p>
            <p className="text-xs text-stone-600">{formatWarrantyDate(info.start)} to {formatWarrantyDate(info.end)}</p>
        </div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Warranty used">
            <div className={`h-full rounded-full ${live ? 'bg-emerald-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
        </div>
    </div>;
}

// One fact. Office (admin / staff) gets Add when it is missing and Edit when it is
// not, for the fields that can be filled in here.
function Fact({ label, value, href, edit, canEdit, multiline }) {
    const [open, setOpen] = useState(false);
    const [text, setText] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const missing = value === null || value === undefined || value === '';
    const start = () => { setText(edit.initial ?? (missing ? '' : String(value))); setError(''); setOpen(true); };
    const save = async event => {
        event.preventDefault();
        setSaving(true); setError('');
        try { await edit.save(text); setOpen(false); } catch (failure) { setError(failure.message || 'Could not save.'); } finally { setSaving(false); }
    };
    const input = 'block w-full rounded-lg border bg-white p-2 text-sm';
    return <div className="flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-stone-100 py-2.5 last:border-0">
        <dt className="w-32 shrink-0 text-xs font-semibold text-stone-500">{label}</dt>
        <dd className="min-w-0 flex-1 break-words text-sm">
            {open ? <form onSubmit={save} className="space-y-2">
                {multiline ? <textarea autoFocus rows={6} value={text} onChange={e => setText(e.target.value)} placeholder={edit.placeholder} className={`${input} font-mono`} />
                    : <input autoFocus value={text} onChange={e => setText(e.target.value)} inputMode={edit.inputMode} placeholder={edit.placeholder} className={`${input} min-h-11`} />}
                {edit.hint && <p className="text-xs text-stone-500">{edit.hint}</p>}
                {error && <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>}
                <div className="flex gap-2"><button disabled={saving} className="min-h-10 rounded-lg bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                    <button type="button" onClick={() => setOpen(false)} className="min-h-10 rounded-lg border bg-white px-4 text-xs font-bold">Cancel</button></div>
            </form>
                : missing ? <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Missing</span>
                    : href ? <a href={href} className="font-semibold text-blue-700 underline">{value}</a> : <span className="font-medium">{value}</span>}
        </dd>
        {canEdit && edit && !open && <button type="button" onClick={start} className="inline-flex min-h-9 items-center gap-1 rounded-lg border bg-white px-2.5 text-xs font-bold text-stone-700 hover:border-amber-400">
            {missing ? <><Plus size={13} /> Add</> : <><Pencil size={12} /> Edit</>}</button>}
    </div>;
}

const Section = ({ icon: Icon, title, children }) => <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
    <h3 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500"><Icon size={14} className="text-amber-600" /> {title}</h3>
    <dl>{children}</dl>
</section>;

function Details({ card, partnerPhone, dealerPhone, canEdit, canEditLocation, saveCard, saveLocation, savePartnerPhone }) {
    const panels = serialList(card.panel_serial_no);
    const modules = card.no_of_modules ? `${card.no_of_modules} x ${card.module_wp ? `${card.module_wp} Wp` : 'panels'}` : '';
    const pincode = String(card.pincode ?? '').replace(/\D/g, '') || pincodeInText(card.full_address);
    const phone = cleanMobile(card.phone_number);
    const field = (column, extra = {}) => ({ save: text => saveCard({ [column]: text.trim() || null }), ...extra });
    return <div className="space-y-3">
        <WarrantyBar card={card} />
        <div className="grid gap-3 lg:grid-cols-2">
            <Section icon={User} title="Customer">
                <Fact label="Name" value={card.customer_name} />
                <Fact label="Consumer number" value={card.consumer_no} />
                <Fact label="Phone" value={showPhone(card.phone_number) || ''} href={phone ? `tel:+91${phone}` : undefined} canEdit={canEdit}
                    edit={{ initial: phone || card.phone_number || '', inputMode: 'tel', placeholder: '10-digit mobile', save: text => { const m = cleanMobile(text); if (!m) throw new Error('Enter a 10-digit mobile number.'); return saveCard({ phone_number: m }); },
                        hint: 'The completion OTP goes to this number.' }} />
            </Section>
            <Section icon={MapPin} title="Location">
                <Fact label="Address" value={card.full_address || [card.villages, card.district].filter(Boolean).join(', ')} canEdit={canEditLocation}
                    edit={{ placeholder: 'House, street, village', save: text => { if (!text.trim()) throw new Error('Enter the address.'); return saveLocation({ full_address: text.trim() }); } }} />
                <Fact label="Pincode" value={pincode} canEdit={canEditLocation}
                    edit={{ inputMode: 'numeric', placeholder: '385340', save: text => { const pin = text.replace(/\D/g, ''); if (!isPincode(pin)) throw new Error('Enter the 6-digit pincode.'); return saveLocation({ pincode: pin }); } }} />
            </Section>
            <Section icon={Store} title="Channel partner">
                <Fact label="Partner" value={card.channel_partner} />
                <Fact label="Dealer" value={card.sub_channel_partner} />
                <Fact label="Partner phone" value={showPhone(partnerPhone) || ''} href={cleanMobile(partnerPhone) ? `tel:+91${cleanMobile(partnerPhone)}` : undefined} canEdit={canEdit && Boolean(card.channel_partner)}
                    edit={{ initial: cleanMobile(partnerPhone) || '', inputMode: 'tel', placeholder: '10-digit mobile', save: savePartnerPhone, hint: 'Shown on every complaint of this partner\'s customers. The partner can also set it in their Profile.' }} />
                {card.sub_channel_partner && <Fact label="Dealer phone" value={showPhone(dealerPhone) || ''} href={cleanMobile(dealerPhone) ? `tel:+91${cleanMobile(dealerPhone)}` : undefined} />}
                {card.sub_channel_partner && !dealerPhone && <p className="pt-1 text-xs text-stone-500">The dealer adds their number in their Profile.</p>}
            </Section>
            <Section icon={Cpu} title="System">
                <Fact label="Panels" value={[card.module_brand, card.system_capacity_kwp ? `${card.system_capacity_kwp} kW` : '', modules].filter(Boolean).join(' · ')} />
                <Fact label="Inverter make" value={card.inverter_make} canEdit={canEdit} edit={field('inverter_make', { placeholder: 'e.g. Growatt' })} />
                <Fact label="Inverter serial" value={card.inverter_serial_no} canEdit={canEdit} edit={field('inverter_serial_no', { placeholder: 'Serial number on the inverter' })} />
            </Section>
        </div>
        <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-500"><ShieldCheck size={14} className="text-amber-600" /> Panel serial numbers ({panels.length})</h3>
            </div>
            <dl><Fact label={panels.length ? `${panels.length} panels` : 'Serials'} value={panels.length ? 'Listed below' : ''} canEdit={canEdit} multiline
                edit={{ initial: panels.join('\n'), placeholder: 'One serial number per line', hint: 'One per line. Pasting a comma-separated list works too.', save: text => saveCard({ panel_serial_no: serialList(text) }) }} /></dl>
            {panels.length > 0 && <ol className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs sm:grid-cols-3">{panels.map((serial, i) => <li key={`${serial}:${i}`} className="rounded bg-stone-50 px-2 py-1"><span className="text-stone-400">{i + 1}.</span> {serial}</li>)}</ol>}
        </section>
    </div>;
}

const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const Chip = ({ label, value, tone = 'bg-stone-100 text-stone-700' }) => <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs ${tone}`}><span className="font-semibold">{label}</span> {value}</span>;

// One past complaint. Closed, it is a summary: the problem, solved or not, the raise /
// visit / solved dates, the counts, and the latest comment (usually the partner's) as a
// gist. Opened: the dated steps and visits on one side, the photos and comments on the other.
function PastComplaint({ issue, visits, extra, user, run, busy }) {
    const stage = issueStage(issue);
    const office = OFFICE_TYPES.includes(user?.userType);
    const partner = PARTNER_TYPES.includes(user?.userType);
    const visited = [...new Set([...(extra?.visited || []).map(day), ...visits.map(v => day(`${v.visit_date}T12:00:00Z`))])];
    const gist = extra?.lastComment ? { text: extra.lastComment.body, by: extra.lastComment.author_name } : issue.comment ? { text: issue.comment, by: 'when raised' } : null;
    const solved = issue.status === 'completed';
    return <details className="group rounded-2xl border border-stone-200 bg-white shadow-sm open:shadow-md">
        <summary className="cursor-pointer list-none p-4 hover:bg-stone-50/60 [&::-webkit-details-marker]:hidden">
            <div className="flex flex-wrap items-center gap-2">
                <strong className="text-stone-400">{ticketLabel(issue)}</strong>
                <span className="min-w-0 flex-1 break-words text-base font-bold">{issue.problem_type}</span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STAGE_PILL[stage]}`}>{solved ? 'Solved' : STAGE_LABELS[stage]}</span>
                <span className="text-xs font-bold text-amber-700 group-open:hidden">Open ›</span><span className="hidden text-xs font-bold text-stone-500 group-open:inline">Close ˄</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                <Chip label="Raised" value={`${day(issue.created_at)}${extra?.raisedBy ? ` by ${extra.raisedBy}` : ''}`} />
                {visited.length > 0 && <Chip label={visited.length > 1 ? `Visited ${visited.length}x` : 'Visited'} value={visited.join(', ')} tone="bg-teal-50 text-teal-900" />}
                {issue.visit_stage === 'second_visit' && !solved && <Chip label="Second visit" value={issue.visit_stage_note || 'needed'} tone="bg-orange-50 text-orange-900" />}
                {solved && <Chip label="Solved" value={`${day(issue.completed_at)}${issue.completion_method === 'otp' ? ' (customer OTP)' : ' (by office)'}`} tone="bg-green-50 text-green-900" />}
                {issue.status === 'cancelled' && <Chip label="Cancelled" value={issue.cancel_reason || ''} />}
            </div>
            {gist && <p className="mt-2 line-clamp-2 border-l-4 border-amber-300 pl-3 text-sm text-stone-700">"{gist.text}" <span className="text-xs text-stone-500">· {gist.by}</span></p>}
            <p className="mt-2 text-xs text-stone-500">{[`${visits.length || visited.length} visit${(visits.length || visited.length) === 1 ? '' : 's'}`, !partner && `${extra?.photos ?? 0} photo${extra?.photos === 1 ? '' : 's'}`, `${extra?.comments ?? 0} comment${extra?.comments === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}{issue.channel_partner_name ? ` · ${issue.channel_partner_name}` : ''}</p>
        </summary>
        <div className="grid gap-4 border-t p-4 lg:grid-cols-2">
            <div className="space-y-3">
                <p className="rounded-xl bg-stone-50 p-3 text-sm"><strong>Raised for:</strong> {issue.problem_type}{issue.comment ? <span className="mt-1 block italic">"{issue.comment}"</span> : null}</p>
                {solved && <p className="rounded-xl bg-green-50 p-3 text-sm text-green-900">{issue.completion_method === 'otp' ? "Closed with the customer's OTP" : `Closed by office: ${issue.override_reason || 'no reason given'}`} · {formatDateTime(issue.completed_at)}</p>}
                {issue.status === 'cancelled' && <p className="rounded-xl bg-stone-100 p-3 text-sm">Cancelled: {issue.cancel_reason || 'no reason given'}</p>}
                <ComplaintHistory issue={issue} />
                {office && visits.length > 0 && <section className="space-y-1 border-t pt-3"><h3 className="text-sm font-bold">Technician visits</h3>
                    {visits.map(visit => <p key={visit.id} className="rounded-lg bg-stone-50 p-2 text-xs">{day(`${visit.visit_date}T12:00:00Z`)} · {visit.kilometers} km · {money(visit.amount_inr)}{visit.trip_group ? ' · combined trip' : ''}{visit.note ? ` · ${visit.note}` : ''}</p>)}</section>}
            </div>
            <div className="space-y-3">
                {!partner && <ComplaintPhotos issue={issue} userId={user?.id} userType={user?.userType} busy={busy} run={run} />}
                <ComplaintComments issue={issue} user={user} busy={busy} run={run} />
            </div>
        </div>
    </details>;
}

// The customer's warranty details and complaint history, with Details / History tabs.
// Used in the Warranty panel and as the "Warranty & complaints" tab of the full customer
// card. Admin and staff (sales) can add or correct missing details here.
export function WarrantyCustomerBody({ customer, user, onCardChanged }) {
    const [tab, setTab] = useState('details');
    const [card, setCard] = useState(customer);
    const [partnerPhone, setPartnerPhone] = useState('');
    const [dealerPhone, setDealerPhone] = useState('');
    const [issues, setIssues] = useState(null);
    const [visits, setVisits] = useState([]);
    const [extras, setExtras] = useState({});
    const [failed, setFailed] = useState('');
    const [reload, setReload] = useState(0);
    const [busy, setBusy] = useState(false);
    const [message, setMessage] = useState(null);
    // Office edits the details; partners and dealers can only see them, except the address
    // and pincode (set_customer_location, 20261028130000_partner_customer_location.sql).
    const canEdit = OFFICE_TYPES.includes(user?.userType);
    const canEditLocation = canEdit || PARTNER_TYPES.includes(user?.userType);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data, error } = await supabase.from('admin').select(CARD_COLUMNS).eq('id', customer.id).maybeSingle();
            if (!active) return;
            if (error) { setFailed(error.message); return; }
            const row = data || customer;
            setCard(row);
            const phones = await contactPhones(row.channel_partner, row.sub_channel_partner);
            if (active) { setPartnerPhone(phones.partner); setDealerPhone(phones.dealer); }
        })();
        return () => { active = false; };
    }, [customer]);

    useEffect(() => {
        let active = true;
        (async () => {
            const { data, error } = await supabase.from('service_issues').select('*').eq('customer_id', customer.id).order('created_at', { ascending: false }).limit(100);
            if (!active) return;
            if (error) { setFailed(error.message); setIssues([]); return; }
            setIssues(data || []);
            const ids = (data || []).map(issue => issue.id);
            // For the closed summaries: visit dates, the latest comment and the counts.
            if (ids.length) {
                const [events, comments, files] = await Promise.all([
                    supabase.from('service_issue_events').select('issue_id, event, actor_name, created_at').in('issue_id', ids).in('event', ['visited', 'raised']),
                    supabase.from('service_issue_comments').select('issue_id, author_name, body, created_at').in('issue_id', ids).order('created_at', { ascending: false }),
                    PARTNER_TYPES.includes(user?.userType) ? { data: [] } : supabase.from('service_issue_files').select('issue_id, kind').in('issue_id', ids),
                ]);
                if (!active) return;
                setExtras(Object.fromEntries(ids.map(id => {
                    const own = (comments.data || []).filter(c => c.issue_id === id);
                    return [id, {
                        visited: (events.data || []).filter(e => e.issue_id === id && e.event === 'visited').map(e => e.created_at),
                        raisedBy: (events.data || []).find(e => e.issue_id === id && e.event === 'raised')?.actor_name || '',
                        lastComment: own[0] || null,
                        comments: own.length,
                        photos: (files.data || []).filter(f => f.issue_id === id && ['before', 'after'].includes(f.kind)).length,
                    }];
                })));
            }
            // Visits are office-only (database rules); others simply get none.
            if (ids.length && OFFICE_TYPES.includes(user?.userType)) {
                const { data: rows } = await supabase.from('service_visits').select('id, issue_id, visit_date, kilometers, amount_inr, note, trip_group').in('issue_id', ids).order('visit_date', { ascending: true });
                if (active) setVisits(rows || []);
            }
        })();
        return () => { active = false; };
    }, [customer.id, user?.userType, reload]);

    // Saves to the customer card and logs it in the card's history like any other edit.
    const saveCard = async patch => {
        const before = Object.fromEntries(Object.keys(patch).map(key => [key, card[key] ?? null]));
        const { data, error } = await supabase.from('admin').update(patch).eq('id', card.id).select(CARD_COLUMNS);
        if (error) throw new Error(error.message);
        if (!data?.length) throw new Error('You cannot change this customer.');
        setCard(data[0]);
        void logFieldChanges(user?.id, card.id, card.customer_name, before, patch, 'Warranty details');
        onCardChanged?.(data[0]);
    };
    const saveLocation = async patch => {
        const { data, error } = await supabase.rpc('set_customer_location', { p_customer_id: card.id, p_address: patch.full_address ?? null, p_pincode: patch.pincode ?? null });
        if (error) {
            // Database not updated yet: the office can still save directly.
            if (canEdit && /could not find the function|PGRST202/i.test(`${error.code} ${error.message}`)) return saveCard(patch);
            throw new Error(error.message);
        }
        const before = Object.fromEntries(Object.keys(patch).map(key => [key, card[key] ?? null]));
        const next = { ...card, ...(data?.[0] || patch) };
        setCard(next);
        void logFieldChanges(user?.id, card.id, card.customer_name, before, patch, 'Warranty details');
        onCardChanged?.(next);
    };
    const savePartnerPhone = async text => {
        const phone = text.trim() ? cleanMobile(text) : null;
        if (text.trim() && !phone) throw new Error('Enter a 10-digit mobile number.');
        const { data, error } = await supabase.from('metadata').update({ phone }).eq('category', 'channel_partner').ilike('label', card.channel_partner.trim()).select('id');
        if (error) throw new Error(/phone/.test(error.message || '') ? 'Partner phone numbers are not set up yet.' : error.message);
        if (!data?.length) throw new Error(`"${card.channel_partner}" is not in the partner directory (Operations).`);
        setPartnerPhone(phone || '');
    };

    const run = async (action, success) => {
        if (busy) return;
        setBusy(true); setMessage(null);
        try { const text = await action(); setMessage({ ok: true, text: text || success }); setReload(n => n + 1); }
        catch (failure) { setMessage({ ok: false, text: failure.message || 'Could not save.' }); }
        finally { setBusy(false); }
    };

    const tabButton = (id, label, Icon) => <button type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
        className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors sm:flex-none ${tab === id ? 'bg-stone-900 text-white shadow' : 'text-stone-600 hover:bg-stone-100'}`}><Icon size={15} /> {label}</button>;
    return <div className="space-y-3">
        <div role="tablist" className="flex gap-1 rounded-2xl border bg-white p-1">{tabButton('details', 'Details', User)}{tabButton('history', `History${issues ? ` (${issues.length})` : ''}`, History)}</div>
        {failed && <p role="alert" className="rounded-lg bg-red-50 p-2 text-xs text-red-700">Could not load everything: {failed}</p>}
        {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-2 text-xs ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        {tab === 'details' ? <Details card={card} partnerPhone={partnerPhone} dealerPhone={dealerPhone} canEdit={canEdit} canEditLocation={canEditLocation} saveCard={saveCard} saveLocation={saveLocation} savePartnerPhone={savePartnerPhone} />
            : !issues ? <p className="text-sm text-stone-500">Loading…</p>
                : !issues.length ? <p className="rounded-2xl border bg-white p-6 text-center text-sm text-stone-500">No complaints yet for this customer.</p>
                    : <div className="space-y-3">{issues.map(issue => <PastComplaint key={issue.id} issue={issue} visits={visits.filter(v => v.issue_id === issue.id)} extra={extras[issue.id]} user={user} run={run} busy={busy} />)}</div>}
    </div>;
}

const initials = name => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(word => word[0]).join('').toUpperCase();

// Opened from a Warranty customer. A fixed size (only the inside scrolls), so it does not
// jump when the tab changes or a complaint opens. "Open full customer card" is for admin and staff only.
export default function WarrantyCustomerPanel({ customer, user, onClose, onOpenCard }) {
    useEffect(() => {
        const onKey = event => { if (event.key === 'Escape') onClose(); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);
    const office = OFFICE_TYPES.includes(user?.userType);
    return <div role="dialog" aria-modal="true" aria-label={`${customer.customer_name || 'Customer'} warranty`} className="fixed inset-0 z-[80] flex items-stretch justify-center bg-stone-950/50 backdrop-blur-[2px] sm:items-center sm:p-6" onClick={onClose}>
        <div className="flex h-full w-full flex-col overflow-hidden bg-[#FCFBFA] shadow-2xl sm:h-[88vh] sm:max-h-[960px] sm:w-[min(72rem,100%)] sm:rounded-3xl" onClick={event => event.stopPropagation()}>
            <header className="flex items-start gap-3 bg-stone-900 p-4 text-white sm:p-5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-base font-black text-stone-900">{initials(customer.customer_name)}</span>
                <div className="min-w-0 flex-1">
                    <h2 className="break-words text-lg font-bold">{customer.customer_name || 'Customer'}</h2>
                    <p className="text-xs text-stone-400">Consumer no. {customer.consumer_no || '—'}{customer.channel_partner ? ` · ${customer.channel_partner}` : ''}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2"><WarrantyBadge info={warrantyInfo(customer)} />
                        {office && onOpenCard && <button type="button" onClick={onOpenCard} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-white/20 px-3 text-xs font-bold text-white hover:bg-white/10">Open full customer card</button>}</div>
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-white/20 hover:bg-white/10"><X size={20} /></button>
            </header>
            <div className="flex-1 overflow-y-auto p-3 sm:p-6"><WarrantyCustomerBody customer={customer} user={user} /></div>
        </div>
    </div>;
}
