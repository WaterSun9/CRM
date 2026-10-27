import { useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { PARTNER_TYPES, cleanMobile, serialList } from './serviceLabels';
import { pincodeInText } from './tripLabels';
import { contactPhones } from './contactPhones';

const CARD_COLUMNS = 'customer_name, phone_number, full_address, pincode, villages, district, channel_partner, sub_channel_partner, panel_serial_no, inverter_serial_no, inverter_make, module_brand, module_wp, no_of_modules, system_capacity_kwp';
const missingFunction = failure => failure?.code === 'PGRST202' || failure?.code === '42883' || /could not find the function/i.test(failure?.message || '');

// The customer card behind a complaint. Office and the technician on the job read it
// through service_job_customer (technicians cannot read customer cards); partners read
// the card under their own rules. The partner's phone comes from Operations (metadata).
async function readCard(issue, userType) {
    if (PARTNER_TYPES.includes(userType)) {
        const { data, error } = await supabase.from('admin').select(CARD_COLUMNS).eq('id', issue.customer_id).maybeSingle();
        if (error) throw error;
        return data;
    }
    const { data, error } = await supabase.rpc('service_job_customer', { p_issue_id: issue.id });
    if (!error) return data?.[0] || null;
    // Database not updated yet: the office can still read the card directly.
    if (missingFunction(error) && userType !== 'technician') {
        const direct = await supabase.from('admin').select(CARD_COLUMNS).eq('id', issue.customer_id).maybeSingle();
        if (direct.error) throw direct.error;
        return direct.data;
    }
    throw error;
}

const Call = ({ phone }) => {
    const mobile = cleanMobile(phone);
    return mobile ? <a href={`tel:+91${mobile}`} className="font-semibold text-blue-700 underline">{mobile.slice(0, 5)} {mobile.slice(5)}</a> : (phone || null);
};

// Everything about the customer on one complaint: name, phone, address, pincode, partner
// and partner phone, the system, panel and inverter serial numbers, problem and comment.
// The card is read again whenever the complaint changes (every list poll), and the
// complaint's own copy is shown meanwhile, so the details never stay blank.
export default function CustomerFacts({ issue, userType }) {
    const [card, setCard] = useState(null);
    const [failed, setFailed] = useState('');
    const [attempt, setAttempt] = useState(0);
    const linked = Boolean(issue.customer_id);
    const issueKey = `${issue.id}:${issue.updated_at || ''}`;

    useEffect(() => {
        if (!linked) { setCard(null); return undefined; }
        let active = true;
        (async () => {
            try {
                const row = await readCard(issue, userType);
                const phones = await contactPhones(row?.channel_partner || issue.channel_partner_name, row?.sub_channel_partner);
                if (active) { setCard(row ? { ...row, partner_phone: phones.partner || row.partner_phone, dealer_phone: phones.dealer } : null); setFailed(''); }
            } catch (failure) {
                if (active) setFailed(failure?.message || 'Could not load the customer card.');
            }
        })();
        return () => { active = false; };
        // issueKey: read again when the complaint changes; attempt: the Try again button.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [issueKey, linked, userType, attempt]);

    // Partner phone for a complaint not linked to a card.
    const [loosePartnerPhone, setLoosePartnerPhone] = useState('');
    useEffect(() => {
        if (linked) return undefined;
        let active = true;
        contactPhones(issue.channel_partner_name, null).then(phones => { if (active) setLoosePartnerPhone(phones.partner); });
        return () => { active = false; };
    }, [linked, issue.channel_partner_name]);

    const c = card || {};
    const address = c.full_address || issue.service_address || [c.villages, c.district].filter(Boolean).join(', ');
    const pincode = String(c.pincode ?? '').replace(/\D/g, '') || pincodeInText(issue.service_address) || '';
    const partner = [c.channel_partner || issue.channel_partner_name, c.sub_channel_partner].filter(Boolean).join(' / ');
    const kw = c.system_capacity_kwp ?? issue.system_kw;
    const modules = c.no_of_modules ? `${c.no_of_modules} x ${c.module_wp ? `${c.module_wp} Wp` : 'panels'}` : '';
    const system = [c.module_brand || issue.system_company_name, kw ? `${kw} kW` : '', modules].filter(Boolean).join(' · ');
    const panels = serialList(c.panel_serial_no);
    const inverter = [c.inverter_make, c.inverter_serial_no].filter(Boolean).join(' · ');
    const rows = [
        ['Customer', c.customer_name || issue.customer_name],
        ['Consumer number', issue.consumer_no],
        ['Customer phone', <Call key="phone" phone={c.phone_number || issue.customer_phone} />],
        ['Address', address],
        ['Pincode', pincode],
        ['Channel partner', partner],
        ['Partner phone', <Call key="partner" phone={linked ? c.partner_phone : loosePartnerPhone} />],
        ...(c.sub_channel_partner ? [['Dealer phone', <Call key="dealer" phone={c.dealer_phone} />]] : []),
        ['Problem', issue.problem_type],
        ['System', system],
        ['Inverter', inverter],
        ['Comment', issue.comment],
    ];
    const empty = value => value === null || value === undefined || value === '' || (value?.props && !value.props.phone);
    return <div className="space-y-2">
        {failed && <p role="alert" className="flex flex-wrap items-center gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            <span className="flex-1">Could not load the full customer card ({failed}). Showing the complaint's copy.</span>
            <button type="button" onClick={() => setAttempt(n => n + 1)} className="min-h-11 rounded-lg border bg-white px-3 font-bold">Try again</button>
        </p>}
        <dl className="service-customer-facts text-sm break-words">
            {rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{empty(value) ? '—' : value}</dd></div>)}
        </dl>
        {linked && <details className="rounded-lg border p-2 text-sm" open={panels.length > 0 && panels.length <= 12}>
            <summary className="min-h-11 cursor-pointer py-2 text-xs font-bold">Panel serial numbers ({card ? panels.length : '…'})</summary>
            {panels.length ? <ol className="mt-1 grid grid-cols-1 gap-x-4 gap-y-0.5 font-mono text-xs sm:grid-cols-2">{panels.map((serial, i) => <li key={`${serial}:${i}`}>{i + 1}. {serial}</li>)}</ol>
                : <p className="text-xs text-stone-500">{card ? 'None on the customer card.' : 'Loading…'}</p>}
        </details>}
    </div>;
}
