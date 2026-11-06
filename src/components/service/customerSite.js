// The customer's saved map point (table customer_sites, from
// 20261013120000_customer_sites.sql). Saved the first time a technician taps
// "Reached site" with a good GPS fix, or set by the office from a Google Maps
// link. The office visit form counts the km to it before anything else.
// One small shared store, so the office "Customer location" box and the visit
// form show the same point and both update when the office changes it.
import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../supabase';

const listeners = new Map();   // customerId -> Set of callbacks
const inflight = new Map();    // customerId -> Promise

// Table or function not there: the customer location SQL has not been run.
export const siteNotSetUp = failure => ['PGRST202', 'PGRST205', '42P01', '42883'].includes(failure?.code)
    || /could not find the (function|table)/i.test(failure?.message || '');

function siteError(failure) {
    const message = failure?.message || '';
    if (siteNotSetUp(failure)) return 'Customer location is not set up on the server yet (the customer location SQL has not been run).';
    if (failure?.code === '23514' || /outside india|_lat|_lng|lat_check|lng_check/i.test(message)) return 'This point is outside India. Check the numbers.';
    if (failure?.code === '42501' || /required|not allowed|permission denied/i.test(message)) return 'Only admin and office can change the customer location.';
    return message || 'Could not save the customer location. Try again.';
}

const validSite = row => {
    const lat = Number(row?.lat);
    const lng = Number(row?.lng);
    if (!row || Array.isArray(row) || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng, source: row.source || '', set_at: row.set_at || null };
};

function notify(customerId, state) {
    for (const callback of listeners.get(customerId) || []) callback(state);
}

// After a save: wait for a read that started before it, then read again.
async function freshRead(customerId) {
    if (inflight.has(customerId)) await inflight.get(customerId);
    return refreshCustomerSite(customerId);
}

// Reads the point and tells every open screen for that customer.
// -> { status: 'ready' | 'not_set_up' | 'error', site }
export function refreshCustomerSite(customerId) {
    if (!customerId) return Promise.resolve({ status: 'ready', site: null });
    if (inflight.has(customerId)) return inflight.get(customerId);
    const request = Promise.resolve(supabase.from('customer_sites').select('lat, lng, source, set_at').eq('customer_id', customerId).maybeSingle())
        .then(({ data, error }) => {
            if (error) return { status: siteNotSetUp(error) ? 'not_set_up' : 'error', site: null, error: error.message || '' };
            return { status: 'ready', site: validSite(data) };
        }, failure => ({ status: 'error', site: null, error: failure?.message || '' }))
        .then(state => { inflight.delete(customerId); notify(customerId, state); return state; });
    inflight.set(customerId, request);
    return request;
}

// { status: 'loading' | 'ready' | 'not_set_up' | 'error', site } for one customer.
// Reads again whenever refreshKey changes (the visit form passes its visits, so a
// point saved by the technician's "Reached site" shows up at the next poll).
// While the table is missing (SQL not run) only the first read is made, so the
// 15-second poll does not keep asking for it; opening the complaint again re-checks.
export function useCustomerSite(customerId, refreshKey) {
    const [state, setState] = useState({ status: customerId ? 'loading' : 'ready', site: null });
    const notSetUp = useRef(false);
    useEffect(() => {
        if (!customerId) { setState({ status: 'ready', site: null }); return undefined; }
        let active = true;
        const callback = next => { if (active) { notSetUp.current = next.status === 'not_set_up'; setState(next); } };
        if (!listeners.has(customerId)) listeners.set(customerId, new Set());
        listeners.get(customerId).add(callback);
        if (!notSetUp.current) refreshCustomerSite(customerId);
        return () => {
            active = false;
            const set = listeners.get(customerId);
            set?.delete(callback);
            if (set && !set.size) listeners.delete(customerId);
        };
    }, [customerId, refreshKey]);
    return state;
}

// Office (admin / sales) sets the point. Throws a plain message.
export async function saveCustomerSite(customerId, point) {
    const { data, error } = await supabase.rpc('set_customer_site', { p_customer_id: customerId, p_lat: point.lat, p_lng: point.lng });
    if (error) throw new Error(siteError(error));
    if (!data) throw new Error('Could not save the location: customer not found. Refresh the page.');
    await freshRead(customerId);
}

// Office removes the point (e.g. it was wrong). Throws a plain message.
export async function removeCustomerSite(customerId) {
    const { error } = await supabase.rpc('clear_customer_site', { p_customer_id: customerId });
    if (error) throw new Error(siteError(error));
    // false = nothing was saved; the screen just catches up.
    await freshRead(customerId);
}

const shortDate = value => {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
};

// "from technician, 12 Oct" / "set by office, 12 Oct".
export function siteSourceText(site) {
    if (!site) return '';
    const who = site.source === 'technician_reached' ? 'from technician' : site.source === 'office' ? 'set by office' : 'saved';
    const when = shortDate(site.set_at);
    return when ? `${who}, ${when}` : who;
}
