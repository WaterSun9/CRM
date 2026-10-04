// Customer red flags: one shared, in-memory list of flagged customer ids.
//
// Every card, list row and customer window reads the same list, so a flag
// raised in one place shows everywhere at once without each card querying the
// database. The list is reloaded when the window regains focus (to pick up
// flags colleagues raised) and whenever the signed-in user changes.
//
// The database table keeps its original name, customer_payment_review_flags,
// for compatibility. Who may read/raise flags is enforced by its RLS policies;
// RED_FLAG_ROLES only decides which screens show the controls.
import { useSyncExternalStore } from 'react';
import { supabase } from '../supabase';
import { CUSTOMER_RED_FLAGS_ENABLED } from '../constants';

export const RED_FLAG_TABLE = 'customer_payment_review_flags';

// Office ("laptop") users, Channel Partners and Dealers.
export const RED_FLAG_ROLES = [
    'admin', 'sales', 'channel_partner_office', 'office2', 'channel_partner_office_manager',
    'agent', 'agent2',
];

export const canUseRedFlags = user =>
    CUSTOMER_RED_FLAGS_ENABLED && RED_FLAG_ROLES.includes(user?.userType);

const EMPTY = { ids: new Set(), available: false };
let state = EMPTY;
let ownerId = null;
let loading = null;
let lastLoad = 0;
const listeners = new Set();
let wired = false;

const emit = () => listeners.forEach(listener => listener());

// "Table not found" means the SQL has not been run yet: hide the feature
// instead of showing errors.
const isMissingTable = error =>
    error && (error.code === '42P01' || error.code === 'PGRST205' || /does not exist|schema cache/i.test(error.message || ''));

export function refreshRedFlags() {
    if (!CUSTOMER_RED_FLAGS_ENABLED) return Promise.resolve();
    if (loading) return loading;
    loading = (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        const uid = session?.user?.id || null;
        if (!uid) { ownerId = null; state = EMPTY; emit(); return; }
        const ids = new Set();
        for (let from = 0; ; from += 1000) {
            const { data, error } = await supabase.from(RED_FLAG_TABLE)
                .select('admin_id')
                .eq('active', true)
                .range(from, from + 999);
            if (error) {
                if (!isMissingTable(error)) console.warn('Could not load red flags:', error.message);
                ownerId = uid;
                state = { ids: new Set(), available: false };
                emit();
                return;
            }
            (data || []).forEach(row => ids.add(row.admin_id));
            if (!data || data.length < 1000) break;
        }
        ownerId = uid;
        lastLoad = Date.now();
        state = { ids, available: true };
        emit();
    })().finally(() => { loading = null; });
    return loading;
}

function wireOnce() {
    if (wired || typeof window === 'undefined') return;
    wired = true;
    window.addEventListener('focus', () => {
        if (listeners.size && Date.now() - lastLoad > 30000) refreshRedFlags();
    });
    supabase.auth.onAuthStateChange((_event, session) => {
        const uid = session?.user?.id || null;
        if (uid !== ownerId) {
            state = EMPTY;
            emit();
            if (uid && listeners.size) refreshRedFlags();
        }
    });
}

function subscribe(listener) {
    wireOnce();
    listeners.add(listener);
    if (!lastLoad && !loading) refreshRedFlags();
    return () => listeners.delete(listener);
}

const noopSubscribe = () => () => {};
const getState = () => state;
const getEmpty = () => EMPTY;

// { ids: Set<customerId>, available: boolean }. Pass enabled=false (e.g. for
// vendors or stamp makers) to skip loading entirely.
export function useRedFlags(enabled = true) {
    const on = CUSTOMER_RED_FLAGS_ENABLED && enabled;
    return useSyncExternalStore(on ? subscribe : noopSubscribe, on ? getState : getEmpty, getEmpty);
}

export async function setCustomerRedFlag(customerId, active, userId) {
    const { error } = await supabase.from(RED_FLAG_TABLE).upsert({
        admin_id: customerId,
        active,
        updated_by: userId,
        updated_at: new Date().toISOString(),
    }, { onConflict: 'admin_id' });
    if (error) return { error };
    const ids = new Set(state.ids);
    if (active) ids.add(customerId); else ids.delete(customerId);
    state = { ids, available: true };
    emit();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('watersun-red-flag-updated'));
    return { error: null };
}
