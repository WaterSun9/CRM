import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabase';

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const displayDate = (value) => {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const vendorColors = [
    'bg-blue-50 text-blue-900 border-blue-300',
    'bg-emerald-50 text-emerald-900 border-emerald-300',
    'bg-violet-50 text-violet-900 border-violet-300',
    'bg-rose-50 text-rose-900 border-rose-300',
    'bg-cyan-50 text-cyan-900 border-cyan-300',
    'bg-orange-50 text-orange-900 border-orange-300',
];
const vendorColor = (userId = '') => {
    const hash = [...userId].reduce((value, character) => ((value * 31) + character.charCodeAt(0)) >>> 0, 0);
    return vendorColors[hash % vendorColors.length];
};

export default function AvailabilityCalendar({ user }) {
    const isVendor = user?.userType === 'vendor';
    const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [entries, setEntries] = useState([]);
    const [start, setStart] = useState(dateKey(new Date()));
    const [end, setEnd] = useState(dateKey(new Date()));
    const [selectionAnchor, setSelectionAnchor] = useState(null);
    const [note, setNote] = useState('');
    const [error, setError] = useState('');
    const [setupMissing, setSetupMissing] = useState(false);
    const [busy, setBusy] = useState(false);

    const displayName = entry => entry.user_id === user.id ? 'You' : entry.vendor_name || `Vendor ${entry.user_id.slice(0, 8)}`;

    const first = dateKey(month);
    const last = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const load = useCallback(async () => {
        let query = supabase.from('crm_availability')
            .select('id,user_id,vendor_name,entry_kind,start_date,end_date,note,status,created_at')
            .eq('entry_kind', 'vendor_unavailable')
            .lte('start_date', last).gte('end_date', first).order('start_date');
        if (isVendor) query = query.eq('user_id', user.id);
        const { data, error: readError } = await query;
        if (readError) {
            const missing = readError.code === 'PGRST205' || /crm_availability.*schema cache/i.test(readError.message || '');
            setSetupMissing(missing);
            setError(missing ? 'Calendar is unavailable until office setup is complete. Please contact the office.' : readError.message);
            setEntries([]);
            return;
        }
        setEntries(data || []);
        setSetupMissing(false);
        setError('');
    }, [first, last, isVendor, user.id]);
    useEffect(() => { load(); }, [load]);

    const days = useMemo(() => {
        const offset = month.getDay();
        const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
        return [...Array(offset).fill(null), ...Array.from({ length: count }, (_, i) => dateKey(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
    }, [month]);
    const visibleEntries = entries;
    const today = dateKey(new Date());
    const selectedDayEntries = visibleEntries.filter(entry => entry.start_date <= start && entry.end_date >= start);

    const pickDay = (day) => {
        if (!isVendor) { setStart(day); setEnd(day); return; }
        if (!selectionAnchor) {
            setStart(day);
            setEnd(day);
            setSelectionAnchor(day);
            return;
        }
        setStart(day < selectionAnchor ? day : selectionAnchor);
        setEnd(day < selectionAnchor ? selectionAnchor : day);
        setSelectionAnchor(null);
    };

    const changeMonth = (offset) => {
        const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
        const selected = next.getMonth() === new Date().getMonth() && next.getFullYear() === new Date().getFullYear()
            ? today : dateKey(next);
        setMonth(next);
        setStart(selected);
        setEnd(selected);
        setSelectionAnchor(null);
    };

    const create = async (event) => {
        event.preventDefault();
        if (!isVendor || setupMissing) return;
        if (end < start) { setError('End date must be on or after the start date.'); return; }
        setBusy(true);
        const { error: writeError } = await supabase.from('crm_availability').insert({
            user_id: user.id, entry_kind: 'vendor_unavailable',
            start_date: start, end_date: end, note: note.trim(), status: 'approved'
        });
        setBusy(false);
        if (writeError) { setError(writeError.message); return; }
        setNote('');
        setSelectionAnchor(null);
        const targetMonth = new Date(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, 1);
        if (targetMonth.getTime() === month.getTime()) await load();
        else setMonth(targetMonth);
    };

    const remove = async (entry) => {
        setBusy(true);
        const { data: deleted, error: writeError } = await supabase.from('crm_availability').delete().eq('id', entry.id).select('id');
        setBusy(false);
        if (writeError || !deleted?.length) setError(writeError?.message || 'This availability entry was not deleted. Refresh and try again.');
        else await load();
    };

    return <section className={`max-w-5xl mx-auto ${isVendor ? 'flex flex-col gap-3 sm:gap-4' : 'space-y-4'}`}>
        <header className={`bg-white border rounded-2xl ${isVendor ? 'p-3 sm:p-4' : 'p-4'}`}>
            <h2 className="text-lg font-bold">Availability calendar</h2>
            <p className="text-xs text-stone-500">{isVendor ? 'Tap a date to mark yourself unavailable. You and office staff can see your dates.' : 'View vendor unavailable dates. Vendors manage their own dates.'}</p>
        </header>
        {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700"><span>{error}</span>{setupMissing && <button type="button" onClick={load} className="min-h-10 rounded-lg border border-red-200 bg-white px-3 text-xs font-bold">Try again</button>}</div>}
        {isVendor && !setupMissing && <form id="availability-entry-form" onSubmit={create} className="bg-white border rounded-2xl flex flex-wrap gap-3 items-end order-2 sm:order-none p-3 sm:p-4">
            <label className={`text-xs font-semibold ${isVendor ? 'hidden sm:block' : ''}`}>From<input required type="date" value={start} onChange={e => { setStart(e.target.value); setSelectionAnchor(null); }} className="block w-full border rounded-lg p-2 mt-1" /></label>
            <label className={`text-xs font-semibold ${isVendor ? 'hidden sm:block' : ''}`}>To<input required type="date" min={start} value={end} onChange={e => { setEnd(e.target.value); setSelectionAnchor(null); }} className="block w-full border rounded-lg p-2 mt-1" /></label>
            <label className="text-xs font-semibold flex-1 min-w-48">Note<input maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="Reason (optional)" className="block w-full border rounded-lg p-2 mt-1" /></label>
            <button disabled={busy} className="bg-amber-500 rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50 w-full sm:w-auto min-h-11">Mark unavailable</button>
        </form>}
        <div className={`bg-white border rounded-2xl ${isVendor ? 'order-1 sm:order-none p-2 sm:p-4' : 'p-4'}`}>
            <div className="flex items-center justify-between mb-2 sm:mb-3"><button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 border rounded-lg">←</button><h3 className="font-bold">{month.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</h3><button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="w-10 h-10 sm:w-auto sm:h-auto sm:px-3 sm:py-1 border rounded-lg">→</button></div>
            <p className={`text-xs text-stone-500 mb-2 ${isVendor ? 'hidden sm:block' : ''}`}>{isVendor ? (selectionAnchor ? 'Select an end date, or save this single day.' : 'Click a day to select it. Click a second day to select a range.') : 'Select a day to review vendor availability.'}</p>
            {!isVendor && <div className="mb-3 rounded-lg border border-stone-200 bg-stone-50 p-3 text-sm" aria-live="polite">
                <p className="font-semibold text-stone-900">{displayDate(start)} · {selectedDayEntries.length === 0 ? 'No vendor dates marked' : `${selectedDayEntries.length} vendor${selectedDayEntries.length === 1 ? '' : 's'}`}</p>
                {selectedDayEntries.length > 0 && <div className="mt-2 flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                    {selectedDayEntries.map(entry => <span key={entry.id} title={entry.note || undefined} className={`rounded-md border px-2 py-1 font-semibold ${vendorColor(entry.user_id)}`}>{displayName(entry)}</span>)}
                </div>}
            </div>}
            <div className={`grid grid-cols-7 text-center text-xs ${isVendor ? 'gap-0.5 sm:gap-1' : 'gap-1'}`}>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => <strong key={d} className="py-2">{isVendor ? <><span className="sm:hidden">{d[0]}</span><span className="hidden sm:inline">{d}</span></> : d}</strong>)}
                {days.map((day, index) => day ? (() => {
                    const dayEntries = visibleEntries.filter(entry => entry.start_date <= day && entry.end_date >= day);
                    const selected = day >= start && day <= end;
                    return <button key={day} type="button" onClick={() => pickDay(day)} aria-label={`Select ${day}${dayEntries.length ? `, ${dayEntries.map(displayName).join(', ')}` : ''}`} aria-pressed={selected} className={`${isVendor ? 'min-w-0 h-11 sm:min-h-24 sm:h-auto border rounded-lg flex flex-col items-center justify-center sm:block sm:text-left' : 'min-h-16 sm:min-h-24 border rounded-lg text-left'} p-1 overflow-hidden align-top hover:border-amber-500 focus-visible:outline-2 focus-visible:outline-amber-500 ${selected ? 'bg-amber-50 border-amber-400' : 'bg-white border-stone-200'}`}>
                        <strong className={`${isVendor ? `w-6 h-6 flex items-center justify-center rounded-full ${day === today ? 'bg-stone-900 text-white' : ''}` : ''}`}>{Number(day.slice(-2))}</strong>
                        {isVendor && dayEntries.length > 0 && <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-blue-600 sm:hidden" />}
                        <span className={isVendor ? 'hidden sm:block' : ''}>{dayEntries.slice(0, 2).map(e => <span key={e.id} title={`${displayName(e)}: ${e.note || e.entry_kind} (${e.status})`} className={`mt-1 block break-words rounded border px-1 text-left text-sm font-semibold leading-tight ${vendorColor(e.user_id)}`}>{displayName(e)}</span>)}{dayEntries.length > 2 && <span className="mt-1 block text-left font-semibold text-stone-700">+{dayEntries.length - 2} more</span>}</span>
                    </button>;
                })() : <div key={`blank-${index}`} className={isVendor ? 'h-11 sm:min-h-24' : 'min-h-16 sm:min-h-24'} />)}</div>
            {isVendor && <div className="sm:hidden mt-3 border-t pt-3 text-xs"><p className="font-semibold text-stone-800">Selected: {displayDate(start)}{end !== start ? ` – ${displayDate(end)}` : ''}</p><p className="text-stone-500 mt-1">{selectionAnchor ? 'Tap another date to select a range, or mark this day below.' : 'Tap a date to choose a day or range.'}</p>{selectedDayEntries.map(entry => <p key={entry.id} className="mt-2 text-blue-700">● Unavailable{entry.note ? ` · ${entry.note}` : ''}</p>)}</div>}
            {isVendor && !setupMissing && <div className="mt-3 hidden sm:flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold text-stone-700">Selected: {start}{end !== start ? ` to ${end}` : ''}</p><button type="submit" form="availability-entry-form" disabled={busy} className="bg-amber-500 disabled:opacity-50 rounded-lg px-4 py-2 text-xs font-bold">Mark selected dates unavailable</button></div>}
        </div>
        <div className={`bg-white border rounded-2xl p-4 space-y-2 ${isVendor ? 'order-3 sm:order-none' : ''}`}><h3 className="font-bold text-sm">{isVendor ? 'My unavailable dates' : 'Vendor unavailable dates this month'}</h3><div className={isVendor ? 'max-h-52 overflow-y-auto sm:max-h-none sm:overflow-visible' : ''}>{visibleEntries.length === 0 && <p className="text-xs text-stone-400">No unavailable dates this month.</p>}{visibleEntries.map(entry => <div key={entry.id} className="flex flex-wrap items-center gap-2 border-b py-2 text-xs"><strong className={`rounded border px-1.5 py-0.5 ${isVendor ? 'hidden sm:inline' : ''} ${vendorColor(entry.user_id)}`}>{displayName(entry)}</strong><span>{entry.start_date}{entry.end_date !== entry.start_date ? ` to ${entry.end_date}` : ''}</span><span className="text-stone-500 flex-1">{entry.note}</span>{isVendor && entry.user_id === user.id && <button type="button" disabled={busy} onClick={() => remove(entry)} className="text-stone-500 min-h-10 px-2">Remove</button>}</div>)}</div></div>
    </section>;
}
