import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, ChevronLeft, FileClock, Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabase';
import { logActivity, logFieldChanges, updateAdminRecord } from '../utils';
import { useGlobalPopup } from './GlobalPopup';
import { OEM_NAMES, OemPastLine, READING_KEYS, REPLACEMENTS, REPLACEMENT_TEXT, entryTitle, isReplacement, serialLabels } from './service/OemPastRecords';
import { READING_GROUPS } from './service/SiteVisitForm';

// OEM past data (client meeting 14 Nov 2026), for the office (admin and sales).
// The past history of completed customers is on paper, in many places, and nobody knows
// how many there are. So: search any completed customer by name (the whole database, not
// only the rows on screen), Add history, then Add another, as many as the papers show.
// Each entry is one past visit: date if on the paper, readings, replacement (default None),
// comments. It shows on the warranty customer, the complaints and the customer card.
// When everything is typed in, "All done" is pressed once so the developer can remove the page.
// Tables: oem_past_records, oem_past_finish (20261116130000).

const PAGE = 50;
const COLUMNS = 'id, customer_name, consumer_no, phone_number, inverter_make, inverter_serial_no, installation_date';
const EMPTY = { part: 'None', oem: '', claim_date: '', ticket_no: '', old_serial: '', new_serial: '', notes: '', readings: {} };
// Readings as typed: numbers only, up to 7 characters (same as the technician's form).
const cleanReading = value => String(value ?? '').replace(/[^\d.]/g, '').slice(0, 7);
const day = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '');
const notSetUp = error => ['42P01', 'PGRST205'].includes(error?.code) || /does not exist|could not find the table/i.test(error?.message || '');
// Commas, brackets and % would break the database search filter.
const searchText = text => String(text || '').replace(/[,()%*\\]/g, ' ').trim().slice(0, 60);

// Every row, 1000 at a time (the database sends at most 1000 per read).
async function loadAll(build) {
    let rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await build().range(from, from + 999);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) return rows;
    }
}

// Panel numbers on the card: a JSON list or text, one per line (or comma / semicolon).
function panelList(value) {
    if (value === null || value === undefined) return [];
    let list = value;
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text || text === 'null' || text === '[]') return [];
        try { list = JSON.parse(text); } catch { list = text; }
    }
    if (typeof list === 'string') list = list.split(/[\n,;]+/);
    if (!Array.isArray(list)) list = [String(list)];
    return list.flat().map(item => String(item ?? '').trim()).filter(Boolean);
}

const input = 'min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300';
const label = 'mb-1 block text-[10px] font-bold uppercase tracking-wider text-stone-500';

// Add or change one past visit. Everything is optional except that the entry says something:
// a date, a reading, a replacement or a comment.
function HistoryForm({ start, busy, onSave, onCancel }) {
    const [form, setForm] = useState({ ...EMPTY, ...start, readings: { ...(start?.readings || {}) } });
    const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
    const setReading = (key, value) => setForm(current => ({ ...current, readings: { ...current.readings, [key]: value } }));
    const [oldLabel, newLabel] = serialLabels(form.part);
    const replacing = isReplacement(form.part);
    const cardPart = form.part === 'Inverter' || form.part === 'Panel';
    const readings = form.readings || {};
    const anything = form.claim_date || replacing || String(form.notes || '').trim()
        || READING_KEYS.some(key => String(readings[key] ?? '').trim()) || typeof readings.floating === 'boolean';
    return <form onSubmit={event => { event.preventDefault(); if (anything) onSave(form); }} className="space-y-4 rounded-2xl border border-amber-200 bg-amber-50/40 p-4">
        <label className="block max-w-xs"><span className={label}>Date of the visit (if on the paper)</span>
            <input type="date" value={form.claim_date || ''} onChange={e => set('claim_date', e.target.value)} className={input} /></label>

        <div className="space-y-2"><span className={label}>Readings · volts (if on the paper)</span>
            {READING_GROUPS.map(([group, fields]) => <div key={group} className="grid grid-cols-[2rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2">
                <span className="text-xs font-bold text-stone-400">{group}</span>
                {fields.map(([key, name]) => <label key={key} className="relative block">
                    <span className="pointer-events-none absolute left-2 top-1 text-[10px] font-bold text-stone-400">{name}</span>
                    <input value={readings[key] ?? ''} aria-label={`${group} ${name}`} inputMode="decimal" onChange={e => setReading(key, cleanReading(e.target.value))}
                        className="block min-h-12 w-full rounded-xl border border-stone-200 bg-white px-2 pb-1 pt-4 text-base font-bold focus:outline-none focus:ring-2 focus:ring-amber-300" />
                </label>)}
            </div>)}
            <div className="grid grid-cols-[2rem_1fr] items-center gap-2">
                <span className="text-[10px] font-bold text-stone-400">Float</span>
                <div className="grid max-w-xs grid-cols-3 rounded-xl bg-stone-100 p-1" role="group" aria-label="Floating voltage">
                    {[[null, 'Not on paper'], [true, 'Yes'], [false, 'No']].map(([value, text]) => <button key={text} type="button" aria-pressed={(readings.floating ?? null) === value} onClick={() => setReading('floating', value)}
                        className={`min-h-9 rounded-lg px-1 text-xs font-bold ${(readings.floating ?? null) === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{text}</button>)}
                </div>
            </div>
        </div>

        <div><span className={label}>Replacement</span>
            <div className="grid grid-cols-4 rounded-xl bg-stone-100 p-1" role="group" aria-label="Replacement">
                {REPLACEMENTS.map(part => <button key={part} type="button" aria-pressed={form.part === part} onClick={() => set('part', part)}
                    className={`min-h-10 rounded-lg px-1 text-sm font-bold ${form.part === part ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{REPLACEMENT_TEXT[part]}</button>)}
            </div>
            <p className="mt-1 text-[11px] text-stone-500">{!replacing ? 'Nothing replaced on this visit.' : cardPart ? 'The new number also goes onto the customer card and the warranty card.' : 'History only. The cards are not changed.'}</p>
        </div>
        {replacing && <div className="grid gap-3 sm:grid-cols-2">
            <label><span className={label}>{oldLabel}</span>
                <input maxLength={120} value={form.old_serial || ''} onChange={e => set('old_serial', e.target.value)} className={input} /></label>
            <label><span className={label}>{newLabel}{cardPart ? ' *' : ''}</span>
                <input required={cardPart} maxLength={120} value={form.new_serial || ''} onChange={e => set('new_serial', e.target.value)} className={input} /></label>
            <label><span className={label}>OEM (maker)</span>
                <input list="oem-names" maxLength={80} value={form.oem || ''} onChange={e => set('oem', e.target.value)} placeholder="e.g. Tata Power" className={input} />
                <datalist id="oem-names">{OEM_NAMES.map(name => <option key={name} value={name} />)}</datalist></label>
            <label><span className={label}>OEM ticket no. (CSN / CRN)</span>
                <input maxLength={80} value={form.ticket_no || ''} onChange={e => set('ticket_no', e.target.value)} className={input} /></label>
        </div>}

        <label className="block"><span className={label}>Comments</span>
            <textarea rows={2} maxLength={500} value={form.notes || ''} onChange={e => set('notes', e.target.value)} placeholder="Anything extra on the paper: what was wrong, what was done"
                className="w-full rounded-xl border border-stone-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" /></label>
        {!anything && <p className="text-xs text-stone-500">Fill in at least one thing (a date, a reading, a replacement or a comment).</p>}
        <div className="flex gap-2">
            <button disabled={busy || !anything} className="min-h-11 flex-1 rounded-xl bg-stone-900 px-4 text-sm font-bold text-white disabled:opacity-40">{start?.id ? 'Save changes' : 'Save visit'}</button>
            <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-600">Cancel</button>
        </div>
    </form>;
}

// One customer: their past history, add / change / delete.
function CustomerHistory({ customer, user, onBack }) {
    const { showAlert, showConfirm } = useGlobalPopup();
    const [rows, setRows] = useState(null);
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);
    // The inverter number on the customer card, kept up to date after an inverter change.
    const [cardSerial, setCardSerial] = useState(customer.inverter_serial_no || '');
    const [notice, setNotice] = useState('');

    const load = useCallback(async () => {
        const { data, error } = await supabase.from('oem_past_records')
            .select('id, oem, part, claim_date, ticket_no, old_serial, new_serial, readings, notes, created_by_name, created_at')
            .eq('customer_id', customer.id).order('claim_date', { ascending: false, nullsFirst: false });
        if (error) { showAlert(notSetUp(error) ? 'Past visits are not set up yet. Tell the developer.' : `Could not read the past visits: ${error.message}`, { type: 'error' }); setRows([]); return; }
        setRows(data || []);
    }, [customer.id, showAlert]);
    useEffect(() => { load(); }, [load]);

    const act = async step => {
        setBusy(true);
        try { await step(); await load(); return true; }
        catch (error) { showAlert(error.message || String(error), { type: 'error' }); return false; }
        finally { setBusy(false); }
    };
    const what = row => `${entryTitle(row)}${row.claim_date ? `, ${day(row.claim_date)}` : ''}`;
    // Inverter changed with a new number: the customer card gets that number, but only when
    // this is the latest inverter change (by date; undated ones count as older, then by when
    // they were typed in), so typing in an older paper later never puts an old number back.
    const updateCardSerial = async (entryId, newSerial) => {
        const { data: changes, error } = await supabase.from('oem_past_records').select('id, claim_date, created_at')
            .eq('customer_id', customer.id).eq('part', 'Inverter');
        if (error) throw error;
        const latest = [...(changes || [])].sort((a, b) => String(a.claim_date || '').localeCompare(String(b.claim_date || ''))
            || String(a.created_at || '').localeCompare(String(b.created_at || ''))).pop();
        if (latest?.id !== entryId) return '';
        const { data: card, error: readError } = await supabase.from('admin').select('inverter_serial_no').eq('id', customer.id).maybeSingle();
        if (readError) throw readError;
        const before = String(card?.inverter_serial_no ?? '').trim();
        if (before === newSerial) return '';
        const { ok, error: writeError } = await updateAdminRecord(customer.id, { inverter_serial_no: newSerial });
        if (!ok) throw new Error(`The visit is saved, but the customer card's inverter number was not changed: ${writeError?.message || 'refused'}`);
        void logFieldChanges(user.id, customer.id, customer.customer_name, { inverter_serial_no: before || null }, { inverter_serial_no: newSerial }, 'OEM past data (inverter changed)');
        setCardSerial(newSerial);
        return `Customer card inverter no. changed${before ? ` from ${before}` : ''} to ${newSerial}.`;
    };
    // Panel changed: on the card's panel list (one number per line, shared by the customer card
    // and the warranty card) the old number becomes the new one. Every panel change of this
    // customer is applied, oldest first, until nothing changes, so the order the papers are
    // typed in does not matter. An old number that is not on the card changes nothing.
    const updateCardPanels = async (oldSerial, newSerial) => {
        const [{ data: card, error: readError }, { data: changes, error: listError }] = await Promise.all([
            supabase.from('admin').select('panel_serial_no').eq('id', customer.id).maybeSingle(),
            supabase.from('oem_past_records').select('old_serial, new_serial, claim_date, created_at').eq('customer_id', customer.id).eq('part', 'Panel'),
        ]);
        if (readError || listError) throw readError || listError;
        const before = panelList(card?.panel_serial_no);
        const list = [...before];
        const key = value => String(value || '').trim().toUpperCase();
        const ordered = [...(changes || [])].filter(c => key(c.old_serial) && key(c.new_serial))
            .sort((a, b) => String(a.claim_date || '').localeCompare(String(b.claim_date || '')) || String(a.created_at || '').localeCompare(String(b.created_at || '')));
        for (let round = 0, moved = true; moved && round < 20; round += 1) {
            moved = false;
            for (const change of ordered) {
                const at = list.findIndex(serial => key(serial) === key(change.old_serial));
                if (at >= 0 && !list.some(serial => key(serial) === key(change.new_serial))) { list[at] = String(change.new_serial).trim(); moved = true; }
            }
        }
        if (list.join('\n') === before.join('\n')) {
            return list.some(serial => key(serial) === key(newSerial)) ? ''
                : `Old panel no. ${oldSerial || '(blank)'} is not on the card, so the card's panel numbers were not changed.`;
        }
        const { ok, error: writeError } = await updateAdminRecord(customer.id, { panel_serial_no: list.join('\n') });
        if (!ok) throw new Error(`The visit is saved, but the card's panel numbers were not changed: ${writeError?.message || 'refused'}`);
        void logFieldChanges(user.id, customer.id, customer.customer_name, { panel_serial_no: before.join('\n') || null }, { panel_serial_no: list.join('\n') }, 'OEM past data (panel changed)');
        const swapped = before.map((serial, i) => [serial, list[i]]).filter(([a, b]) => a !== b);
        return `Card panel no. changed: ${swapped.map(([a, b]) => `${a} → ${b}`).join(', ')}.`;
    };
    const save = form => act(async () => {
        setNotice('');
        const replaced = isReplacement(form.part);
        // Readings: only the boxes that were filled in; none at all = null.
        const readings = {};
        for (const key of READING_KEYS) { const value = cleanReading(form.readings?.[key]); if (value) readings[key] = value; }
        if (typeof form.readings?.floating === 'boolean') readings.floating = form.readings.floating;
        // No replacement: no numbers, OEM or ticket.
        const body = { part: form.part, claim_date: form.claim_date || null, readings: Object.keys(readings).length ? readings : null, notes: form.notes,
            oem: replaced ? form.oem : null, ticket_no: replaced ? form.ticket_no : null,
            old_serial: replaced ? form.old_serial : null, new_serial: replaced ? form.new_serial : null };
        let entryId = form.id;
        if (form.id) {
            const { error } = await supabase.from('oem_past_records').update(body).eq('id', form.id);
            if (error) throw error;
        } else {
            const { data, error } = await supabase.from('oem_past_records').insert({ ...body, customer_id: customer.id }).select('id').single();
            if (error) throw error;
            entryId = data?.id;
        }
        void logActivity(user.id, 'update', `${customer.customer_name}: past visit ${form.id ? 'changed' : 'added'} (${what(form)})`,
            replaced && (form.old_serial || form.new_serial) ? `${form.old_serial || '—'} → ${form.new_serial || '—'}` : '', customer.id);
        setEditing(null);
        const newSerial = String(form.new_serial || '').trim();
        // Only an inverter or panel replacement touches the cards.
        if (replaced && form.part === 'Inverter' && newSerial && entryId) setNotice(await updateCardSerial(entryId, newSerial));
        if (replaced && form.part === 'Panel' && newSerial) setNotice(await updateCardPanels(String(form.old_serial || '').trim(), newSerial));
    });
    const remove = async row => {
        const yes = await showConfirm(`Delete "${what(row)}"${row.claim_date ? ` (${day(row.claim_date)})` : ''}?`, { title: 'Delete past visit?', confirmLabel: 'Delete', cancelLabel: 'Keep', type: 'warning' });
        if (!yes) return;
        act(async () => {
            const { error } = await supabase.from('oem_past_records').delete().eq('id', row.id);
            if (error) throw error;
            void logActivity(user.id, 'update', `${customer.customer_name}: past visit deleted (${what(row)})`, '', customer.id);
        });
    };

    return <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-stone-200 bg-white pl-2 pr-3 text-sm font-bold text-stone-700"><ChevronLeft size={18} /> Back to search</button>
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
            <h2 className="text-lg font-bold text-stone-900">{customer.customer_name}</h2>
            <p className="text-xs text-stone-500">{[customer.consumer_no, customer.phone_number, customer.installation_date && `Installed ${day(customer.installation_date)}`].filter(Boolean).join(' · ')}</p>
            {(customer.inverter_make || cardSerial) && <p className="mt-1 text-xs text-stone-500">Inverter on the card now: <b className="text-stone-700">{[customer.inverter_make, cardSerial].filter(Boolean).join(' · ')}</b></p>}
            <p className="mt-1 text-[11px] text-stone-400">An inverter or panel replacement also updates the customer card and the warranty card (inverter: the latest replacement; panel: the old number is swapped for the new one).</p>
        </div>
        {notice && <p role="status" className={`flex items-center gap-2 rounded-xl p-3 text-sm font-semibold ${/not on the card/.test(notice) ? 'bg-amber-50 text-amber-900' : 'bg-emerald-50 text-emerald-800'}`}><CheckCircle2 size={16} /> {notice}</p>}

        <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-500">Past visits {rows ? `· ${rows.length}` : ''}</h3>
            {rows === null ? <p className="text-sm text-stone-400">Loading…</p>
                : !rows.length && !editing ? <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">No past visits yet. Press Add past visit for each visit on the paper.</p>
                    : <ul className="space-y-2">{rows.map(row => editing?.id === row.id
                        ? <li key={row.id}><HistoryForm start={editing} busy={busy} onSave={save} onCancel={() => setEditing(null)} /></li>
                        : <li key={row.id} className="flex gap-3 rounded-xl border border-stone-200 bg-white p-3 text-sm">
                            <OemPastLine row={row} />
                            <span className="flex shrink-0 flex-col gap-1">
                                <button type="button" disabled={busy} onClick={() => setEditing({ ...row, claim_date: row.claim_date || '' })} aria-label={`Change ${what(row)}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-stone-600 hover:bg-stone-100"><Pencil size={13} /> Change</button>
                                <button type="button" disabled={busy} onClick={() => remove(row)} aria-label={`Delete ${what(row)}`} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-2 text-xs font-bold text-stone-400 hover:bg-red-50 hover:text-red-700"><Trash2 size={13} /> Delete</button>
                            </span>
                        </li>)}</ul>}
            {editing && !editing.id && <HistoryForm start={editing} busy={busy} onSave={save} onCancel={() => setEditing(null)} />}
            {!editing && <button type="button" disabled={busy || rows === null} onClick={() => setEditing({ ...EMPTY })}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-900 text-sm font-bold text-white disabled:opacity-50"><Plus size={16} /> {rows?.length ? 'Add another past visit' : 'Add past visit'}</button>}
        </section>
    </div>;
}

export default function OemPastDataView({ user }) {
    const { showAlert, showConfirm } = useGlobalPopup();
    const [query, setQuery] = useState('');
    const [typed, setTyped] = useState('');
    const [onlyWithHistory, setOnlyWithHistory] = useState(false);
    const [list, setList] = useState(null);
    const [total, setTotal] = useState(0);
    const [counts, setCounts] = useState(new Map());
    const [stats, setStats] = useState(null);
    const [finish, setFinish] = useState(null);
    const [problem, setProblem] = useState('');
    const [loadingMore, setLoadingMore] = useState(false);
    const [open, setOpen] = useState(null);
    const [busy, setBusy] = useState(false);

    // Search waits until typing stops for a moment.
    useEffect(() => { const timer = setTimeout(() => setQuery(searchText(typed)), 300); return () => clearTimeout(timer); }, [typed]);

    // How many customers have history and how many entries, and the All done row.
    const loadStats = useCallback(async () => {
        const [records, finished] = await Promise.all([
            loadAll(() => supabase.from('oem_past_records').select('customer_id').order('id')),
            supabase.from('oem_past_finish').select('requested_at, requested_by_name, customers, records').maybeSingle(),
        ]);
        const ids = new Set(records.map(r => r.customer_id));
        setStats({ customers: ids.size, records: records.length, ids: [...ids] });
        setFinish(finished.data || null);
        return [...ids];
    }, []);

    // Completed customers, searched in the database (name, consumer no., phone), 50 at a time.
    const fetchPage = useCallback(async (from, withIds) => {
        let read = supabase.from('admin').select(COLUMNS, { count: 'exact' })
            .eq('stage', 'COMPLETED').is('deleted_at', null).order('customer_name').range(from, from + PAGE - 1);
        if (query) read = read.or(`customer_name.ilike.%${query}%,consumer_no.ilike.%${query}%,phone_number.ilike.%${query}%`);
        if (withIds) read = read.in('id', withIds.length ? withIds : ['00000000-0000-0000-0000-000000000000']);
        const { data, error, count } = await read;
        if (error) throw error;
        const rows = data || [];
        if (rows.length) {
            const { data: entries } = await supabase.from('oem_past_records').select('customer_id').in('customer_id', rows.map(r => r.id));
            setCounts(current => {
                const next = new Map(current);
                rows.forEach(r => next.set(r.id, 0));
                (entries || []).forEach(e => next.set(e.customer_id, (next.get(e.customer_id) || 0) + 1));
                return next;
            });
        }
        return { rows, count: count ?? rows.length };
    }, [query]);

    const load = useCallback(async () => {
        setList(null);
        try {
            const ids = await loadStats();
            const { rows, count } = await fetchPage(0, onlyWithHistory ? ids : null);
            setList(rows); setTotal(count); setProblem('');
        } catch (error) {
            setList([]);
            setProblem(notSetUp(error) ? 'Past visits are not set up yet (database step not run). Tell the developer.' : `Could not load: ${error.message}`);
        }
    }, [loadStats, fetchPage, onlyWithHistory]);
    useEffect(() => { load(); }, [load]);

    const more = async () => {
        setLoadingMore(true);
        try {
            const { rows } = await fetchPage(list.length, onlyWithHistory ? stats?.ids || [] : null);
            setList(current => [...current, ...rows]);
        } catch (error) { showAlert(`Could not load more: ${error.message}`, { type: 'error' }); }
        finally { setLoadingMore(false); }
    };

    const requestFinish = async () => {
        const yes = await showConfirm(`Are all the papers typed in? (${stats?.records || 0} past visits for ${stats?.customers || 0} customers so far.) This tells the developer the page can be removed; the past visits stay on the customers.`,
            { title: 'All done?', confirmLabel: 'Yes, all done', cancelLabel: 'Not yet', type: 'warning' });
        if (!yes) return;
        setBusy(true);
        const { error } = await supabase.from('oem_past_finish').upsert({ id: true }, { onConflict: 'id' });
        setBusy(false);
        if (error) { showAlert(`Not sent: ${error.message}`, { type: 'error' }); return; }
        void logActivity(user.id, 'update', `OEM past data marked All done (${stats?.records || 0} past visits, ${stats?.customers || 0} customers)`, '', null);
        load();
    };

    if (open) return <div className="mx-auto max-w-2xl p-4 sm:p-6">
        <CustomerHistory customer={open} user={user} onBack={() => { setOpen(null); load(); }} />
    </div>;

    return <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <div>
            <h1 className="flex items-center gap-2 text-xl font-bold text-stone-900"><FileClock size={20} /> OEM past data</h1>
            <p className="mt-1 text-sm text-stone-500">Search a completed customer by name, open them and press Add past visit for each visit on the paper: date, readings, replacement if any, comments. Add another for the next one.</p>
        </div>
        {problem && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{problem}</p>}

        <label className="relative block"><Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input autoFocus value={typed} onChange={e => setTyped(e.target.value)} placeholder="Search customer name (or consumer no. / phone)" aria-label="Search completed customers"
                className="min-h-12 w-full rounded-2xl border border-stone-200 bg-white pl-11 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-amber-300" /></label>

        <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-xl bg-stone-100 p-1" role="group" aria-label="Show">
                {[[false, 'All completed'], [true, `With past visits (${stats?.customers ?? '…'})`]].map(([value, text]) =>
                    <button key={text} type="button" aria-pressed={onlyWithHistory === value} onClick={() => setOnlyWithHistory(value)}
                        className={`min-h-9 rounded-lg px-3 text-xs font-bold ${onlyWithHistory === value ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'}`}>{text}</button>)}
            </div>
            <p className="text-xs text-stone-500">{list === null ? 'Searching…' : `${total} customer${total === 1 ? '' : 's'}${query ? ` match "${query}"` : ''}`}</p>
        </div>

        {list === null ? <p className="flex items-center gap-2 text-sm text-stone-400"><Loader2 size={16} className="animate-spin" /> Searching completed customers…</p>
            : !list.length ? <p className="rounded-xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{query ? `No completed customer matches "${query}".` : 'No customers here.'}</p>
                : <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white">{list.map(c => {
                    const n = counts.get(c.id) || 0;
                    return <li key={c.id}><button type="button" onClick={() => setOpen(c)} className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left hover:bg-stone-50">
                        <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-stone-800">{c.customer_name}</span>
                            <span className="block truncate text-xs text-stone-400">{[c.consumer_no, c.phone_number, c.inverter_make].filter(Boolean).join(' · ')}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${n ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-500'}`}>{n ? `${n} past visit${n === 1 ? '' : 's'}` : 'None yet'}</span>
                    </button></li>;
                })}</ul>}
        {list && list.length < total && <button type="button" disabled={loadingMore} onClick={more}
            className="min-h-11 w-full rounded-xl border border-stone-200 bg-white text-sm font-bold text-stone-700 disabled:opacity-50">{loadingMore ? 'Loading…' : `Show more (${total - list.length} more)`}</button>}

        <div className="space-y-2 rounded-2xl border border-stone-200 bg-white p-4">
            <p className="text-sm text-stone-600">{stats ? <><b className="text-stone-900">{stats.records}</b> past visit{stats.records === 1 ? '' : 's'} typed in for <b className="text-stone-900">{stats.customers}</b> customer{stats.customers === 1 ? '' : 's'} so far.</> : 'Counting…'}</p>
            {finish
                ? <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800"><CheckCircle2 size={18} /> All done sent {day(finish.requested_at)}{finish.requested_by_name ? ` by ${finish.requested_by_name}` : ''}. The developer will remove this page.</p>
                : <button type="button" disabled={busy || !stats} onClick={requestFinish}
                    className="min-h-11 w-full rounded-xl border border-stone-900 bg-white px-4 text-sm font-bold text-stone-900 disabled:opacity-30">All papers typed in – tell the developer</button>}
        </div>
    </div>;
}
