// Local-only demo of the CP / dealer rules page. Made-up customers and logins, an in-memory
// fake database, no login and no network.
import { createRoot } from 'react-dom/client';
import '../index.css';
import CpDealerRulesView from '../components/CpDealerRulesView';
import { GlobalPopupProvider } from '../components/GlobalPopup';
import { supabase } from '../supabase';

const USER = { id: 'u-admin', name: 'Watersun Admin', userType: 'admin' };
let n = 0;
const card = (customer_name, channel_partner, sub_channel_partner, stage = 'LOAN') => ({ id: `c${++n}`, folder_no: String(4100 + n), customer_name, channel_partner, sub_channel_partner, stage, deleted_at: null });
const db = {
    profiles: [
        { id: 'p1', name: 'KISHORBHAI', user_type: 'agent' },
        { id: 'p2', name: 'BHARAT UNJA', user_type: 'agent' },
        { id: 'p3', name: 'Sun Office', user_type: 'channel_partner_office', channel_partner: 'SUN ENERGY' },
        { id: 'p4', name: 'Hub Office', user_type: 'channel_partner_office', channel_partner: 'GUJARAT SOLAR HUB' },
        { id: 'p5', name: 'DASHRATH MALI', user_type: 'agent2', channel_partner: 'SUN ENERGY' },
        { id: 'p6', name: 'RAVI DEALER', user_type: 'agent2', channel_partner: 'GUJARAT SOLAR HUB' },
        { id: 'p7', name: 'MANOJ SOLAR', email: 'manoj@example.com', user_type: 'agent2', channel_partner: 'SUN ENERGY', created_at: '2026-09-02T10:00:00Z' },
        { id: 'p8', name: 'VIPUL KHODA', email: 'vipul@example.com', user_type: 'agent', created_at: '2026-08-20T10:00:00Z' },
    ],
    admin: [
        card('MAHESH PATEL', 'SUN ENERGY', 'KISHORBHAI'),
        card('KIRAN DESAI', 'KISHORBHAI', 'KISHORBHAI', 'COMPLETED'),
        card('JAYESH THAKOR', '', 'Bharat Unja', 'REGISTRATION'),
        card('HETAL SHAH', 'BHARAT UNJA', 'VIPULBHAI'),
        card('NITA CHAUDHARY', 'SUN ENERGY', 'RAVI DEALER', 'MATERIAL ORDER'),
        card('BHARAT RABARI', 'sun energy', 'dashrath  mali'),
        card('SONAL MODI', 'Gujarat Solar Hub.', 'RAVI DEALER', 'COMPLETED'),
        card('AMIT JOSHI', 'SUN ENERGY', 'DASHRATH MALI'),
        card('DIPAK VAGHELA', 'SUN ENERGY', 'DASHRATH'),
        card('GITA PRAJAPATI', 'DEBOARDED', 'KISHORBHAI'),
        card('HARSH JOSHI', 'SUN ENERGY', 'JAYANTI'),
        card('RAKESH MODI', 'SUN ENERGY', 'JAYANTI', 'COMPLETED'),
        card('NILESH DESAI', 'KALPESH', '', 'SUBSIDY STATUS'),
        card('PARUL SHAH', 'KALPESH', '', 'LOAN'),
    ],
    activity_log: [],
};
window.__db = db;
function query(table) {
    const filters = []; let action = 'select', body = null, single = false, from = 0, to = 1e9;
    const q = new Proxy({}, { get(_t, name) {
        if (name === 'then') return (resolve, reject) => Promise.resolve().then(() => {
            let rows = (db[table] ||= []).filter(r => filters.every(f => f(r)));
            if (action === 'update') rows.forEach(r => Object.assign(r, body));
            if (action === 'insert') { db[table].push(...[body].flat()); rows = [body].flat(); }
            rows = rows.slice(from, to + 1);
            return { data: single ? structuredClone(rows[0] || null) : structuredClone(rows), error: null };
        }).then(resolve, reject);
        if (name === 'eq') return (k, v) => { filters.push(r => r[k] === v); return q; };
        if (name === 'is') return (k, v) => { filters.push(r => (r[k] ?? null) === v); return q; };
        if (name === 'range') return (a, b) => { from = a; to = b; return q; };
        if (name === 'maybeSingle' || name === 'single') return () => { single = true; return q; };
        if (name === 'update' || name === 'insert') return v => { action = name; body = v; return q; };
        return () => q;
    } });
    return q;
}
supabase.from = query;
supabase.rpc = async () => ({ data: null, error: null });
// supabase.functions is a getter that makes a new client each time, so replace the getter.
Object.defineProperty(supabase, 'functions', { configurable: true, get: () => ({ invoke: async () => ({ data: {}, error: null }) }) });
supabase.auth.getUser = async () => ({ data: { user: { id: USER.id } }, error: null });
supabase.auth.getSession = async () => ({ data: { session: { user: { id: USER.id } } }, error: null });
createRoot(document.getElementById('root')).render(<GlobalPopupProvider><div className="min-h-screen bg-[#FCFBFA]"><CpDealerRulesView user={USER} /></div></GlobalPopupProvider>);
