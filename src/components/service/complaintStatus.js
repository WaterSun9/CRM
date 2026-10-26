import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '../../supabase';

// Complaint state of each customer, for the wrench on cards:
//   'open'  (red)   a complaint is raised and not fixed yet (open / assigned / waiting for the code)
//   'fixed' (green) the last complaint was fixed in the last FIXED_GREEN_DAYS days
//   null    (black) no complaint, or fixed longer ago
// One small list for the whole app (only open complaints and recently fixed ones),
// read once and again every few minutes, when the tab comes back, and whenever
// a complaint is raised or changed ('complaints-changed').
// Office reads every complaint; a channel partner sees every complaint of the customers
// they can see, whoever raised it (database rules).
export const FIXED_GREEN_DAYS = 30;
const OPEN_STATUSES = ['open', 'assigned', 'completion_pending'];
const REFRESH_MS = 3 * 60 * 1000;

let byCustomer = new Map();
let loading = null;
let loadedAt = 0;
let started = 0;
const listeners = new Set();
const emit = () => listeners.forEach(listener => listener());

async function load() {
    if (loading) return loading;
    loading = (async () => {
        const since = new Date(Date.now() - FIXED_GREEN_DAYS * 86400000).toISOString();
        const { data, error } = await supabase.from('service_issues')
            .select('id, customer_id, ticket_no, status, completed_at')
            .not('customer_id', 'is', null)
            .or(`status.in.(${OPEN_STATUSES.join(',')}),and(status.eq.completed,completed_at.gte."${since}")`)
            .order('created_at', { ascending: false })
            .limit(2000);
        if (error) return;   // keep the last known colours; the next refresh tries again
        const next = new Map();
        for (const row of data || []) {
            const current = next.get(row.customer_id);
            const state = OPEN_STATUSES.includes(row.status) ? 'open' : 'fixed';
            // An open complaint wins; otherwise the latest fix.
            if (!current || (state === 'open' && current.state !== 'open')
                || (state === 'fixed' && current.state === 'fixed' && row.completed_at > current.completedAt)) {
                next.set(row.customer_id, { state, issueId: row.id, ticketNo: row.ticket_no, completedAt: row.completed_at });
            }
        }
        byCustomer = next;
        loadedAt = Date.now();
        emit();
    })().finally(() => { loading = null; });
    return loading;
}

export const refreshComplaintStatus = () => { void load(); };
export const announceComplaintsChanged = () => window.dispatchEvent(new Event('complaints-changed'));

// Starts the shared loader while at least one wrench is on screen.
function useLoader(enabled) {
    useEffect(() => {
        if (!enabled) return undefined;
        started += 1;
        if (started === 1) {
            if (Date.now() - loadedAt > 30000) void load();
            const timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
            const onChange = () => void load();
            const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt > 60000) void load(); };
            window.addEventListener('complaints-changed', onChange);
            document.addEventListener('visibilitychange', onVisible);
            useLoader.stop = () => { clearInterval(timer); window.removeEventListener('complaints-changed', onChange); document.removeEventListener('visibilitychange', onVisible); };
        }
        return () => { started -= 1; if (started === 0) useLoader.stop?.(); };
    }, [enabled]);
}

const subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };

// -> { state: 'open' | 'fixed', issueId, ticketNo, completedAt } or null
export function useComplaintStatus(customerId) {
    useLoader(Boolean(customerId));
    return useSyncExternalStore(subscribe, () => (customerId ? byCustomer.get(customerId) ?? null : null));
}
