import { useState } from 'react';
import { inIndia, latLngText, mapLinkHint, mapViewUrl, parseLatLng } from '../../utils/mapLink';
import { refreshCustomerSite, removeCustomerSite, saveCustomerSite, siteSourceText, useCustomerSite } from './customerSite';

// Office box on a complaint: the customer's exact map point. The visit km is
// counted to it before the "Reached site" point or the pincode. It is saved
// the first time a technician taps "Reached site" with a good GPS fix, or the
// office pastes a Google Maps link here. Hidden until the customer location SQL is run.
export default function CustomerPin({ customerId, busy, run }) {
    const { status, site } = useCustomerSite(customerId);
    const [editing, setEditing] = useState(false);
    const [text, setText] = useState('');
    const [removing, setRemoving] = useState(false);
    if (!customerId || status === 'not_set_up') return null;

    const found = parseLatLng(text);
    const usable = Boolean(found) && inIndia(found);
    const hint = text.trim() ? mapLinkHint(text) : '';

    const save = event => {
        event.preventDefault();
        run(async () => {
            if (!usable) throw new Error(hint || 'Paste a Google Maps link or the coordinates first.');
            await saveCustomerSite(customerId, found);
            setEditing(false); setText('');
        }, 'Customer location saved.', 'issue');
    };
    const remove = () => run(async () => {
        await removeCustomerSite(customerId);
        setRemoving(false);
    }, 'Customer location removed.', 'issue');

    const button = 'min-h-11 rounded-lg border bg-white px-3 text-xs font-bold disabled:opacity-50';
    const link = 'inline-flex min-h-11 items-center rounded-lg border bg-white px-3 text-xs font-bold text-blue-700 underline';
    return <div className="space-y-2 rounded-xl border p-3">
        <h4 className="text-sm font-bold">Customer location</h4>
        {status === 'loading' && <p className="text-xs text-stone-500">Loading…</p>}
        {status === 'error' && <p role="alert" className="text-xs text-red-700">Could not load the customer location.{' '}
            <button type="button" onClick={() => refreshCustomerSite(customerId)} className="min-h-11 font-bold underline">Try again</button></p>}
        {status === 'ready' && (site
            ? <p className="text-sm"><strong>Customer location saved</strong> ({siteSourceText(site)})
                <span className="block text-xs text-stone-500">{latLngText(site)}. The visit km is counted to this point.</span></p>
            : <p className="text-sm"><strong>No exact location saved</strong>
                <span className="block text-xs text-stone-500">The visit km is counted to the "Reached site" point or the customer's pincode.</span></p>)}

        {status === 'ready' && !editing && !removing && <div className="flex flex-wrap gap-2">
            {site && <a href={mapViewUrl(site)} target="_blank" rel="noopener noreferrer" className={link}>View on map</a>}
            <button type="button" disabled={busy} onClick={() => { setEditing(true); setText(''); }} className={button}>{site ? 'Change location' : 'Set location'}</button>
            {site && <button type="button" disabled={busy} onClick={() => setRemoving(true)} className={button}>Remove</button>}
        </div>}

        {editing && <form onSubmit={save} className="space-y-2 rounded-lg bg-stone-50 p-2">
            <label className="block text-xs font-semibold">Paste a Google Maps link or coordinates (23.8312, 71.6043)
                <input autoFocus value={text} onChange={e => setText(e.target.value)} maxLength={4000} inputMode="url" autoComplete="off" spellCheck={false}
                    placeholder="https://www.google.com/maps/@23.8312,71.6043,17z" className="mt-1 block w-full min-h-11 rounded-lg border bg-white p-2 text-sm font-normal" />
            </label>
            {usable && <p className="text-xs text-green-800">Found {latLngText(found)}.{' '}
                <a href={mapViewUrl(found)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-bold text-blue-700 underline">Check on map</a></p>}
            {hint && <p role="status" className="rounded bg-amber-50 p-2 text-xs text-amber-900">{hint}</p>}
            {site?.source === 'technician_reached' && <p className="text-xs text-stone-500">This replaces the location saved from the technician's "Reached site".</p>}
            <div className="flex flex-wrap gap-2">
                <button disabled={busy || !usable} className="min-h-11 rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50">Save location</button>
                <button type="button" disabled={busy} onClick={() => { setEditing(false); setText(''); }} className={button}>Cancel</button>
            </div>
        </form>}

        {removing && <div className="space-y-2 rounded-lg bg-stone-50 p-2">
            <p className="text-xs font-semibold">Remove the saved location? The km will be counted to the "Reached site" point or the pincode again.</p>
            <div className="flex flex-wrap gap-2">
                <button type="button" disabled={busy} onClick={remove} className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-bold text-white disabled:opacity-50">Yes, remove</button>
                <button type="button" disabled={busy} onClick={() => setRemoving(false)} className={button}>Keep it</button>
            </div>
        </div>}
    </div>;
}
