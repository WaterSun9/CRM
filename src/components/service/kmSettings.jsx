import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../supabase';
import { TRIP_GRACE_KM, TRIP_ROUND_TRIP } from '../../constants';

// Km pay settings (public.service_km_settings, one row, migration
// 20261013110000_service_trips.sql): rate per km, grace km, round trip by default.
// Admin and office read and change them. Until the table exists the app uses the
// constants and no rate (status 'not_set_up').
export const DEFAULT_KM_SETTINGS = { rate_per_km: 0, grace_km: TRIP_GRACE_KM, round_trip: TRIP_ROUND_TRIP };
const missingTable = error => ['PGRST205', '42P01'].includes(error?.code) || /could not find the table/i.test(error?.message || '');

export function useKmSettings() {
    const [state, setState] = useState({ status: 'loading', settings: DEFAULT_KM_SETTINGS });
    const [reload, setReload] = useState(0);
    useEffect(() => {
        let active = true;
        supabase.from('service_km_settings').select('rate_per_km, grace_km, round_trip, updated_at').eq('id', true).maybeSingle()
            .then(({ data, error }) => {
                if (!active) return;
                if (error) setState({ status: missingTable(error) ? 'not_set_up' : 'error', settings: DEFAULT_KM_SETTINGS });
                else setState({ status: 'ready', settings: data ? { ...data, rate_per_km: Number(data.rate_per_km), grace_km: Number(data.grace_km) } : DEFAULT_KM_SETTINGS });
            });
        return () => { active = false; };
    }, [reload]);
    const refresh = useCallback(() => setReload(n => n + 1), []);
    return { ...state, refresh };
}

// Rupees for a visit: km x rate, to the nearest rupee.
export const kmAmount = (km, rate) => {
    const value = Number(km) * Number(rate);
    return Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
};

// Operations panel: change the rate, the grace km and the default trip type.
export function KmSettingsPanel({ user, busy, run, open = false }) {
    const { status, settings, refresh } = useKmSettings();
    const [form, setForm] = useState(null);
    if (status === 'not_set_up' || status === 'loading') return null;
    const shown = form || { rate: String(settings.rate_per_km), grace: String(settings.grace_km), roundTrip: settings.round_trip };
    const save = event => {
        event.preventDefault();
        run(async () => {
            const rate = Number(shown.rate);
            const grace = Number(shown.grace);
            if (shown.rate === '' || !Number.isFinite(rate) || rate < 0 || rate > 1000) throw new Error('Rate per km must be between ₹0 and ₹1000.');
            if (shown.grace === '' || !Number.isFinite(grace) || grace < 0 || grace > 100) throw new Error('Grace km must be between 0 and 100.');
            const { data, error } = await supabase.from('service_km_settings')
                .update({ rate_per_km: rate, grace_km: grace, round_trip: shown.roundTrip, updated_at: new Date().toISOString(), updated_by: user.id })
                .eq('id', true).select('id');
            if (error) throw error;
            if (!data?.length) throw new Error('Only Admin or Office can change the km settings.');
            setForm(null);
            refresh();
        }, 'Km settings saved. New visits use them; saved visits keep their own.');
    };
    const input = 'mt-1 block w-full min-h-11 rounded-lg border p-2 text-sm';
    return <details className="service-settings rounded-xl border bg-white p-3" open={open}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">Travel payment: money per km</summary>
        {status === 'error' && <p role="alert" className="text-xs text-red-700">Could not load the km settings.</p>}
        <form onSubmit={save} className="mt-2 grid gap-2 sm:grid-cols-3">
            <label className="text-xs font-semibold">Rate per km (₹)
                <input required min="0" max="1000" step="0.01" type="number" inputMode="decimal" value={shown.rate} onChange={e => setForm({ ...shown, rate: e.target.value })} className={input} /></label>
            <label className="text-xs font-semibold">Grace km per visit
                <input required min="0" max="100" step="0.5" type="number" inputMode="decimal" value={shown.grace} onChange={e => setForm({ ...shown, grace: e.target.value })} className={input} /></label>
            <TripTypeChoice value={shown.roundTrip} onChange={roundTrip => setForm({ ...shown, roundTrip })} label="Default trip" />
            <button disabled={busy || !form} className="sm:col-span-3 min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50">Save km settings</button>
        </form>
    </details>;
}

// Round trip (x 2) or one way.
export function TripTypeChoice({ value, onChange, label = 'Trip', className = '' }) {
    const option = (on, text) => <button type="button" aria-pressed={value === on} onClick={() => onChange(on)}
        className={`min-h-11 flex-1 rounded-lg border px-2 text-xs font-bold ${value === on ? 'border-stone-900 bg-stone-900 text-white' : 'bg-white'}`}>{text}</button>;
    return <div className={`text-xs font-semibold ${className}`}>{label}
        <div role="group" aria-label={label} className="mt-1 flex gap-1">{option(true, 'Round trip (x 2)')}{option(false, 'One way')}</div>
    </div>;
}
