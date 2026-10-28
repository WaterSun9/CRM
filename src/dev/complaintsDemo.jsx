// Local-only demo of Complaints & Warranty for the walkthrough video. Made-up
// customers, an in-memory fake database, no login and no network. ?view=office |
// operations | technician | partner.
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClipboardList, ShieldCheck, Users } from 'lucide-react';
import '../index.css';
import ServiceIssuesView from '../components/ServiceIssuesView';
import WarrantyView from '../components/WarrantyView';
import ServiceSettingsSection from '../components/service/ServiceSettingsSection';
import PartnerProfile from '../components/service/PartnerProfile';
import { GlobalPopupProvider } from '../components/GlobalPopup';
import { supabase } from '../supabase';
import { warrantyInfo } from '../utils/warranty';

const OFFICE = { id: 'u-office', name: 'Watersun Office', userType: 'admin' };
const TECH = { id: 'u-tech', name: 'Ramesh (Technician)', userType: 'technician' };
const PARTNER = { id: 'u-partner', name: 'Sun Partner Office', userType: 'channel_partner_office', channel_partner: 'Sun Energy Partners' };
const now = Date.now(), ago = h => new Date(now - h * 3600e3).toISOString();
const serials = n => JSON.stringify(Array.from({ length: n }, (_, i) => `WS24A${String(1001 + i)}`));
const customer = (id, name, extra) => ({ id, customer_name: name, consumer_no: `PGVCL-${id.slice(-4)}`, stage: 'COMPLETED', deleted_at: null, channel_partner: 'Sun Energy Partners', sub_channel_partner: 'Patan Dealer', phone_number: '98250 11223', module_brand: 'WAAREE', module_wp: 540, no_of_modules: 10, system_capacity_kwp: 5.4, inverter_make: 'Growatt', inverter_serial_no: 'GRW-55K-7781', panel_serial_no: serials(10), updated_at: ago(5), ...extra });
const admin = [
    customer('c-0001', 'Mahesh Patel', { full_address: 'Near Ram Mandir, Radhanpur', pincode: '385340', installation_date: '2024-03-12' }),
    customer('c-0002', 'Kiran Desai', { full_address: 'Station Road, Patan', pincode: '384265', installation_date: '2025-07-02' }),
    customer('c-0003', 'Jayesh Thakor', { full_address: 'Bus stand area, Sami', pincode: '384245', installation_date: '2023-11-20' }),
    customer('c-0004', 'Hetal Shah', { full_address: 'Old Market, Chanasma', pincode: '384220', installation_date: '2019-06-15' }),
    customer('c-0005', 'Bharat Rabari', { full_address: 'Village road, Santalpur', pincode: '385350', installation_date: null, material_delivery_date: null, completed_at: null }),
    customer('c-0006', 'Nita Chaudhary', { full_address: 'Highway, Harij', pincode: '384240', installation_date: '2020-01-10' }),
    customer('c-0007', 'Charan Laxamandan', { full_address: 'Ranod', pincode: null, installation_date: '2026-09-12', channel_partner: 'Gujarat Solar Hub', inverter_make: null, inverter_serial_no: null, panel_serial_no: null }),
];
const issue = (id, ticket, c, extra) => ({ id, ticket_no: ticket, customer_id: c.id, customer_name: c.customer_name, consumer_no: c.consumer_no, customer_phone: c.phone_number, service_address: `${c.full_address}, ${c.pincode}`, channel_partner_name: c.channel_partner, system_company_name: 'WAAREE', system_kw: 5.4, comment: '', required_date: '2026-10-28', warranty_status: warrantyInfo(c).status, warranty_start: warrantyInfo(c).start, warranty_end: warrantyInfo(c).end, created_by: OFFICE.id, created_at: ago(30), updated_at: ago(1), status: 'open', assigned_to: null, visit_stage: null, ...extra });
const db = {
    admin,
    metadata: [{ id: 'm1', category: 'channel_partner', label: 'Sun Energy Partners', phone: '9909012345' }, { id: 'm2', category: 'channel_partner', label: 'Gujarat Solar Hub', phone: null }],
    service_km_settings: [{ id: true, rate_per_km: 5, grace_km: 5, round_trip: true }],
    service_issues: [
        issue('i-1', 1001, admin[1], { problem_type: 'Inverter showing fault', comment: 'Customer says no generation since Monday.' }),
        issue('i-2', 1002, admin[0], { problem_type: 'Low generation', status: 'assigned', assigned_to: TECH.id, assigned_at: ago(20) }),
        issue('i-3', 1003, admin[2], { problem_type: 'Panel cleaning and check', status: 'assigned', assigned_to: TECH.id, assigned_at: ago(26), visit_stage: 'visited', visit_stage_at: ago(3) }),
        issue('i-4', 1004, admin[5], { problem_type: 'Earthing wire loose', status: 'assigned', assigned_to: TECH.id, assigned_at: ago(40), visit_stage: 'second_visit', visit_stage_note: 'MC4 connector to be ordered', visit_stage_at: ago(10) }),
        issue('i-5', 1005, admin[3], { problem_type: 'Meter display blank', status: 'completed', assigned_to: TECH.id, completion_method: 'otp', completed_at: ago(48) }),
        issue('i-6', 998, admin[0], { problem_type: 'Inverter tripping at noon', comment: 'Raised by partner: customer sent a video of the error code.', created_by: PARTNER.id, created_at: '2026-08-04T05:30:00Z', status: 'completed', assigned_to: TECH.id, completion_method: 'otp', completed_at: '2026-08-09T11:15:00Z' }),
    ],
    service_issue_events: [
        { id: 'e1', issue_id: 'i-3', event: 'raised', note: 'Panel cleaning and check', actor_name: 'Watersun Office', created_at: ago(30) },
        { id: 'e2', issue_id: 'i-3', event: 'assigned', note: 'Ramesh (Technician)', actor_name: 'Watersun Office', created_at: ago(26) },
        { id: 'e3', issue_id: 'i-3', event: 'visited', note: null, actor_name: 'Ramesh (Technician)', created_at: ago(3) },
        { id: 'e4', issue_id: 'i-4', event: 'raised', note: 'Earthing wire loose', actor_name: 'Sun Partner Office', created_at: ago(50) },
        { id: 'e5', issue_id: 'i-4', event: 'claimed', note: 'Ramesh (Technician)', actor_name: 'Ramesh (Technician)', created_at: ago(40) },
        { id: 'e6', issue_id: 'i-4', event: 'visited', note: null, actor_name: 'Ramesh (Technician)', created_at: ago(30) },
        { id: 'h1', issue_id: 'i-6', event: 'raised', note: 'Inverter tripping at noon', actor_name: 'Sun Partner Office', created_at: '2026-08-04T05:30:00Z' },
        { id: 'h2', issue_id: 'i-6', event: 'claimed', note: 'Ramesh (Technician)', actor_name: 'Ramesh (Technician)', created_at: '2026-08-04T09:00:00Z' },
        { id: 'h3', issue_id: 'i-6', event: 'visited', note: null, actor_name: 'Ramesh (Technician)', created_at: '2026-08-05T06:10:00Z' },
        { id: 'h4', issue_id: 'i-6', event: 'second_visit', note: 'Inverter card replacement ordered', actor_name: 'Ramesh (Technician)', created_at: '2026-08-05T07:00:00Z' },
        { id: 'h5', issue_id: 'i-6', event: 'visited', note: null, actor_name: 'Ramesh (Technician)', created_at: '2026-08-09T10:20:00Z' },
        { id: 'h6', issue_id: 'i-6', event: 'code_sent', note: null, actor_name: null, created_at: '2026-08-09T11:05:00Z' },
        { id: 'h7', issue_id: 'i-6', event: 'completed', note: "Closed with the customer's code", actor_name: null, created_at: '2026-08-09T11:15:00Z' },
        { id: 'e7', issue_id: 'i-4', event: 'second_visit', note: 'MC4 connector to be ordered', actor_name: 'Ramesh (Technician)', created_at: ago(10) },
    ],
    service_issue_comments: [{ id: 'k2', issue_id: 'i-6', author_id: PARTNER.id, author_name: 'Sun Partner Office', author_role: 'channel_partner_office', body: 'Customer shared a video of error code 302.', created_at: '2026-08-04T05:35:00Z' }, { id: 'k1', issue_id: 'i-4', author_id: PARTNER.id, author_name: 'Sun Partner Office', author_role: 'channel_partner_office', body: 'Customer is available after 4 pm.', created_at: ago(9) }],
    service_issue_files: [
        { id: 'f3', issue_id: 'i-6', kind: 'before', storage_path: 'i-6/u-tech/before-1.jpg', file_name: 'before.jpg', mime_type: 'image/jpeg', uploaded_by: TECH.id, created_at: '2026-08-05T06:15:00Z' },
        { id: 'f4', issue_id: 'i-6', kind: 'after', storage_path: 'i-6/u-tech/after-1.jpg', file_name: 'after.jpg', mime_type: 'image/jpeg', uploaded_by: TECH.id, created_at: '2026-08-09T11:00:00Z' },
        { id: 'f1', issue_id: 'i-2', kind: 'before', storage_path: 'i-2/u-tech/before-1.jpg', file_name: 'before.jpg', mime_type: 'image/jpeg', uploaded_by: TECH.id, created_at: ago(2) },
        { id: 'f2', issue_id: 'i-2', kind: 'after', storage_path: 'i-2/u-tech/after-1.jpg', file_name: 'after.jpg', mime_type: 'image/jpeg', uploaded_by: TECH.id, created_at: ago(1) },
    ],
    service_trips: [{ id: 't1', issue_id: 'i-2', technician_id: TECH.id, started_at: ago(3), start_source: 'manual', start_pincode: '384265', reached_at: ago(2), reached_lat: 23.83, reached_lng: 71.6, reached_accuracy_m: 20 }],
    service_visits: [{ id: 'v2', issue_id: 'i-6', technician_id: TECH.id, visit_date: '2026-08-05', kilometers: 46, amount_inr: 230, note: 'Found faulty card' }, { id: 'v3', issue_id: 'i-6', technician_id: TECH.id, visit_date: '2026-08-09', kilometers: 46, amount_inr: 230, note: 'Card replaced' }, { id: 'v1', issue_id: 'i-5', technician_id: TECH.id, visit_date: '2026-10-25', kilometers: 62, km_estimate: 62, amount_inr: 310, rate_per_km: 5, round_trip: true, note: '' }],
};

// A small chainable fake of the Supabase query builder.
function query(table) {
    const rows = () => (db[table] ||= []);
    const filters = []; let action = 'select', body = null, head = false, single = false, maybe = false, from = 0, to = 1e6; const sort = [];
    const q = {
        select(_cols, opts) { if (opts?.head) head = true; return q; },
        eq(k, v) { filters.push(r => r[k] === v); return q; }, neq(k, v) { filters.push(r => r[k] !== v); return q; },
        is(k, v) { filters.push(r => (v === null ? r[k] == null : r[k] === v)); return q; },
        in(k, vals) { filters.push(r => vals.includes(r[k])); return q; },
        not() { return q; }, gte() { return q; },
        filter(k, op, pattern) { if (op === 'imatch') filters.push(r => new RegExp(pattern, 'i').test(String(r[k] || ''))); return q; },
        ilike(k, v) { const t = String(v).replaceAll('%', '').toLowerCase(); filters.push(r => String(r[k] || '').toLowerCase().includes(t)); return q; },
        or(text) {
            if (text.startsWith('installation_date.gt')) filters.push(r => warrantyInfo(r).status === 'in_warranty');
            else if (text.startsWith('installation_date.lte')) filters.push(r => warrantyInfo(r).status === 'out_of_warranty');
            else if (text.includes('.ilike.')) { const t = text.split('.ilike.')[1].split(',')[0].replaceAll('%', '').toLowerCase(); filters.push(r => [r.customer_name, r.consumer_no, r.phone_number].some(v => String(v || '').toLowerCase().includes(t))); }
            return q;
        },
        order(k, { ascending = true } = {}) { sort.push([k, ascending]); return q; },
        range(a, b) { from = a; to = b; return q; }, limit(n) { to = from + n - 1; return q; },
        single() { single = true; return q; }, maybeSingle() { single = true; maybe = true; return q; },
        insert(v) { action = 'insert'; body = v; return q; }, update(v) { action = 'update'; body = v; return q; }, delete() { action = 'delete'; return q; },
        then(resolve, reject) {
            return Promise.resolve().then(() => {
                let matched = rows().filter(r => filters.every(f => f(r)));
                if (action === 'insert') { matched = (Array.isArray(body) ? body : [body]).map(v => ({ id: crypto.randomUUID(), created_at: new Date().toISOString(), ...v, ...(table === 'service_issue_comments' ? { author_name: OFFICE.name, author_role: 'admin' } : {}) })); rows().push(...matched); }
                if (action === 'update') matched.forEach(r => Object.assign(r, body, { updated_at: new Date().toISOString() }, body.visit_stage !== undefined ? { visit_stage_at: new Date().toISOString() } : {}));
                if (action === 'delete') db[table] = rows().filter(r => !matched.includes(r));
                matched = [...matched].sort((a, b) => { for (const [k, asc] of sort) if (a[k] !== b[k]) return (a[k] < b[k] ? -1 : 1) * (asc ? 1 : -1); return 0; });
                const count = matched.length;
                if (head) return { data: null, count, error: null };
                matched = matched.slice(from, to + 1);
                if (single) return { data: structuredClone(matched[0] || null), error: matched.length || maybe ? null : { code: 'PGRST116', message: 'No row' } };
                return { data: structuredClone(matched), error: null, count };
            }).then(resolve, reject);
        },
    };
    return q;
}

const photo = (label, color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='300' height='300' fill='${color}'/><text x='150' y='160' font-size='34' text-anchor='middle' fill='white' font-family='sans-serif'>${label}</text></svg>`)}`;
let user = OFFICE;
supabase.from = query;
supabase.auth.getUser = async () => ({ data: { user: { id: user.id } }, error: null });
supabase.auth.resetPasswordForEmail = async () => ({ data: {}, error: null });
const fakeStorage = { from: () => ({ createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: photo(path.includes('before') ? 'Before' : 'After', path.includes('before') ? '#b45309' : '#15803d') })), error: null }), upload: async () => ({ error: null }), remove: async () => ({ error: null }) }) };
// supabase.functions and .storage are getters that make a new client each time, so replace the getters.
Object.defineProperty(supabase, 'storage', { configurable: true, get: () => fakeStorage });
const invoke = async (_name, { body }) => {
    const job = db.service_issues.find(row => row.id === body.issueId);
    if (body.action === 'send') { Object.assign(job, { status: 'completion_pending', completion_requested_at: new Date().toISOString() }); return { data: { ok: true, channel: 'sms', maskedPhone: '98XXXXX223', resendAfterSeconds: 45 }, error: null }; }
    if (body.action === 'verify') { Object.assign(job, { status: 'completed', completion_method: 'otp', completed_at: new Date().toISOString() }); return { data: { ok: true, verified: true }, error: null }; }
    return { data: { ok: true }, error: null };
};
Object.defineProperty(supabase, 'functions', { configurable: true, get: () => ({ invoke }) });
supabase.rpc = async (name, args = {}) => {
    const card = id => db.admin.find(row => row.id === db.service_issues.find(i => i.id === id)?.customer_id);
    if (name === 'service_technicians') return { data: [{ id: TECH.id, name: TECH.name }], error: null };
    if (name === 'service_job_customer') { const c = card(args.p_issue_id); return { data: c ? [{ ...c, partner_phone: '9909012345' }] : [], error: null }; }
    if (name === 'open_service_issue_queue') return { data: db.service_issues.filter(i => i.status === 'open').map(i => ({ id: i.id, ticket_no: i.ticket_no, customer_name: i.customer_name, problem_type: i.problem_type, required_date: i.required_date, status: i.status, warranty_status: i.warranty_status })), error: null };
    if (name === 'my_partner_profile') return { data: [{ partner_name: 'Sun Energy Partners', phone: db.metadata[0].phone, is_dealer: false, partner_phone: db.metadata[0].phone }], error: null };
    if (name === 'contact_phones') return { data: [{ partner_phone: db.metadata.find(m => m.label === args.p_partner)?.phone || null, dealer_phone: args.p_dealer === 'Patan Dealer' ? '9898012345' : null }], error: null };
    if (name === 'set_my_partner_phone') { db.metadata[0].phone = args.p_phone; return { data: args.p_phone, error: null }; }
    if (name === 'claim_service_issue') { Object.assign(db.service_issues.find(i => i.id === args.p_issue_id), { status: 'assigned', assigned_to: TECH.id, assigned_at: new Date().toISOString() }); return { data: true, error: null }; }
    return { data: null, error: { code: 'PGRST202', message: 'Could not find the function' } };
};

const views = { office: 'Complaints & Warranty', operations: 'Operations', technician: 'Technician jobs', partner: 'Complaints & Warranty', profile: 'Profile' };
function Demo() {
    const view = new URLSearchParams(location.search).get('view') || 'office';
    user = view === 'technician' ? TECH : ['partner', 'profile'].includes(view) ? PARTNER : OFFICE;
    const [tab, setTab] = useState(new URLSearchParams(location.search).get('tab') || 'complaints');
    const [raising, setRaising] = useState(null);
    const nav = [['Complaints & Warranty', ClipboardList, ['office', 'partner'].includes(view)], ['Operations', Users, view === 'operations']];
    return <GlobalPopupProvider><div className="min-h-screen bg-[#FCFBFA] md:pl-64">
        <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-white p-5 md:block"><strong className="text-lg">Watersun CRM</strong><p className="mt-1 text-xs text-stone-500">Signed in as {user.name}</p>
            <div className="mt-6 space-y-1">{nav.map(([label, Icon, on]) => <p key={label} className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${on ? 'bg-stone-900 text-white' : 'text-stone-600'}`}><Icon size={16} /> {label}</p>)}</div></aside>
        <main className="p-4 lg:p-8"><h1 className="mb-4 text-2xl font-bold">{views[view]}</h1>
            {view === 'operations' && <ServiceSettingsSection user={OFFICE} />}
            {view === 'profile' && <PartnerProfile user={{ ...PARTNER, email: 'sunenergy@partner.in' }} />}
            {view === 'technician' && <ServiceIssuesView user={TECH} />}
            {['office', 'partner'].includes(view) && <>
                <div role="tablist" className="mb-4 flex gap-2">{[['complaints', 'Complaints', ClipboardList], ['warranty', 'Warranty customers', ShieldCheck]].map(([id, label, Icon]) =>
                    <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold ${tab === id ? 'bg-stone-900 text-white' : 'border bg-white text-stone-700'}`}><Icon size={14} /> {label}</button>)}</div>
                {tab === 'complaints' ? <ServiceIssuesView user={user} embedded onOpenWarranty={() => setTab('warranty')} /> : <WarrantyView user={user} onSelectCustomer={() => {}} onRaiseServiceIssue={setRaising} isChannelPartnerOffice={view === 'partner'} partnerName="Sun Energy Partners" />}
            </>}
        </main>
        {raising && <div role="dialog" className="fixed inset-0 z-[90] flex items-center justify-center bg-stone-950/60 p-3"><div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl bg-white"><div className="flex justify-end p-2"><button type="button" onClick={() => setRaising(null)} className="min-h-11 rounded-lg border px-3">Close</button></div><ServiceIssuesView user={user} initialCustomer={raising} formOnly /></div></div>}
        </div></GlobalPopupProvider>;
}

if (import.meta.env.DEV) createRoot(document.getElementById('root')).render(<Demo />);
else document.getElementById('root').textContent = 'Development demo only.';
