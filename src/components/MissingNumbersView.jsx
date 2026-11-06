import { useState, useEffect, useCallback, useMemo } from 'react';
import { Search, RefreshCw, Hash, UserCheck, Check, X, Loader2, FileSpreadsheet, Pencil } from 'lucide-react';
import { supabase } from '../supabase';
import { logActivity, updateAdminRecord } from '../utils';
import { CUSTOMER_CARD_COLUMNS, PRIMARY_STAGES } from '../constants';
import { stageRank } from '../utils/stageRequirements';
import { useGlobalPopup } from './GlobalPopup';

// The Inverter page, for admin and office (sales). Three tabs:
//   Missing              customers past Material Integration with no inverter make or serial
//                        and/or no panel serials (filter), to fill in from the offline paperwork.
//   File no mismatch     sheet rows the 5 Nov import left out because the name and the
//                        number disagree (public.serial_number_review).
//   Uploaded from sheet  what the import wrote to each card (public.serial_number_import).

const PAGE_SIZE = 50;

// Panel serials as a list, from a JSON array or text split by new lines, commas or semicolons.
function serialList(value) {
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
const COLUMNS = `${CUSTOMER_CARD_COLUMNS}, inverter_make, inverter_serial_no, panel_serial_no`;
const STAGES_AFTER_INTEGRATION = PRIMARY_STAGES.map(s => s.id).filter(id => stageRank(id) > 5);
const FIELDS = [
    ['inverter_make', 'Inverter make'],
    ['inverter_serial_no', 'Inverter serial'],
    ['panel_serial_no', 'Panel serials'],
];

const INVERTER_FIELDS = ['inverter_make', 'inverter_serial_no'];

const isBlank = (field, value) => field === 'panel_serial_no'
    ? serialList(value).length === 0
    : !String(value ?? '').trim();
const missingFields = card => FIELDS.filter(([field]) => isBlank(field, card[field])).map(([field]) => field);
const panelText = text => serialList(text).join('\n');
const shownValue = (field, value) => field === 'panel_serial_no' ? serialList(value).join(', ') : String(value ?? '').trim();
const labelOf = field => FIELDS.find(([f]) => f === field)?.[1] || field;

async function loadAll(build) {
    let rows = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await build().range(from, from + 999);
        if (error) throw error;
        rows = rows.concat(data || []);
        if (!data || data.length < 1000) return rows;
    }
}

// Writes only the fields that are still empty on the live card, so nothing someone
// else typed in the meantime is overwritten. Returns the fields written.
async function fillEmptyFields(cardId, values) {
    const { data: live, error } = await supabase.from('admin')
        .select('customer_name, inverter_make, inverter_serial_no, panel_serial_no').eq('id', cardId).single();
    if (error) throw error;
    const updates = {};
    for (const [field] of FIELDS) {
        const value = field === 'panel_serial_no' ? panelText(values[field]) : String(values[field] ?? '').trim();
        if (value && isBlank(field, live[field])) updates[field] = value;
    }
    if (Object.keys(updates).length === 0) return { written: [], name: live.customer_name };
    const result = await updateAdminRecord(cardId, updates);
    if (!result.ok) throw result.error;
    return { written: Object.keys(updates), name: live.customer_name };
}

function TabButton({ active, onClick, icon: Icon, label, count }) {
    return (
        <button type="button" role="tab" aria-selected={active} onClick={onClick}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-bold ${active ? 'bg-stone-900 text-white' : 'border bg-white text-stone-700'}`}>
            <Icon size={14} /> {label}{count !== null && <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? 'bg-white/20' : 'bg-stone-100'}`}>{count}</span>}
        </button>
    );
}

function SearchBox({ value, onChange, placeholder }) {
    return (
        <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
            <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-amber-300" />
        </div>
    );
}

const matchesSearch = (search, ...values) => {
    const term = search.trim().toLowerCase();
    return !term || values.some(value => String(value ?? '').toLowerCase().includes(term));
};

// Every empty number on the card can be typed in, on either missing tab; numbers the card
// already has are shown read only, to match against the paperwork.
function MissingRow({ card, onSaved, onOpen, user }) {
    const { showAlert } = useGlobalPopup();
    const missing = missingFields(card);
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);
    const typed = missing.some(field => String(values[field] ?? '').trim());

    const save = async () => {
        setSaving(true);
        try {
            const { written } = await fillEmptyFields(card.id, values);
            if (written.length) {
                await logActivity(user.id, 'update', `${card.customer_name}: ${written.map(labelOf).join(', ')} added from paperwork (Missing numbers page)`, '', card.id);
            } else {
                showAlert('Someone had already filled these in, so nothing was changed.', { type: 'info' });
            }
            await onSaved(card.id);
        } catch (err) {
            showAlert('Could not save: ' + (err?.message || err), { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <button type="button" onClick={() => onOpen(card)} className="text-left cursor-pointer">
                    <div className="text-sm font-bold text-stone-900 hover:underline">{card.customer_name}</div>
                    <div className="text-[11px] text-stone-500 font-medium">
                        File {card.folder_no ?? '-'} · Consumer {card.consumer_no || '-'} · {card.villages || card.district || ''} · {card.stage}
                    </div>
                </button>
                <div className="flex flex-wrap gap-1">
                    {missing.map(field => <span key={field} className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700">No {labelOf(field).toLowerCase()}</span>)}
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {FIELDS.map(([field, label]) => {
                    const id = `${card.id}-${field}`;
                    const filled = !missing.includes(field);
                    const shown = field === 'panel_serial_no' ? serialList(card[field]).join(', ') : card[field];
                    return (
                        <label key={field} htmlFor={id} className="block">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}</span>
                            {filled ? (
                                <div className="mt-1 truncate rounded-xl bg-stone-50 px-3 py-2 text-xs text-stone-600" title={shown}>{shown}</div>
                            ) : field === 'panel_serial_no' ? (
                                <textarea id={id} rows={3} value={values[field] || ''} placeholder="One serial per line"
                                    onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-amber-300" />
                            ) : (
                                <input id={id} type="text" value={values[field] || ''} list={field === 'inverter_make' ? 'missing-numbers-makes' : undefined}
                                    onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                                    className="mt-1 w-full rounded-xl border border-stone-200 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300" />
                            )}
                        </label>
                    );
                })}
            </div>
            <div className="flex justify-end">
                <button type="button" disabled={!typed || saving} onClick={save}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                </button>
            </div>
        </div>
    );
}

// Inverter make, inverter serial and panel serials side by side: the sheet, then each CRM card.
function CompareTable({ row, columns }) {
    const grid = columns.length > 1 ? 'grid-cols-[7rem_1fr_1fr_1fr]' : 'grid-cols-[7rem_1fr_1fr]';
    const value = (field, source) => {
        const text = shownValue(field, source?.[field]);
        const count = field === 'panel_serial_no' && text ? `(${serialList(source[field]).length}) ` : '';
        return text ? count + text : '-';
    };
    return (
        <div className="space-y-1 overflow-x-auto rounded-xl bg-stone-50 p-3">
            <div className={`grid ${grid} gap-2 text-[10px] font-bold uppercase tracking-wider text-stone-400`}>
                <span /><span>Client sheet</span>{columns.map(([title]) => <span key={title}>{title}</span>)}
            </div>
            {FIELDS.map(([field, label]) => (
                <div key={field} className={`grid ${grid} gap-2 text-xs`}>
                    <span className="font-bold text-stone-400">{label}</span>
                    <span className="font-mono text-stone-900 break-all">{value(field, row)}</span>
                    {columns.map(([title, card]) => <span key={title} className="font-mono text-stone-500 break-all">{value(field, card)}</span>)}
                </div>
            ))}
        </div>
    );
}

function CardSummary({ title, tone, card, fallbackName, onOpen }) {
    return (
        <button type="button" onClick={() => card && onOpen(card)} className="text-left cursor-pointer">
            <div className={`text-[10px] font-bold uppercase tracking-wider ${tone}`}>{title}</div>
            <div className="text-sm font-bold text-stone-900 hover:underline">{card?.customer_name || fallbackName || 'No card'}</div>
            {card && <div className="text-[11px] text-stone-500">File {card.folder_no ?? '-'} · Consumer {card.consumer_no || '-'} · {card.villages || ''}</div>}
        </button>
    );
}

// One sheet row whose name and number disagree. For a swapped row the name wins: the card
// with that name is offered first, the card on the sheet's number second.
function ReviewRow({ row, card, otherCard, onDone, onOpen, user }) {
    const { showAlert } = useGlobalPopup();
    const [busy, setBusy] = useState('');
    const swapped = row.kind === 'swapped';
    const numberLabel = row.panel_serial_no ? 'consumer no' : 'file no';

    const resolve = async (resolution) => {
        setBusy(resolution);
        try {
            const targetId = resolution === 'filled' ? row.admin_id : resolution === 'filled_other' ? row.alt_admin_id : null;
            if (targetId) {
                const { written, name } = await fillEmptyFields(targetId, row);
                if (written.length) {
                    await logActivity(user.id, 'update', `${name}: ${written.map(labelOf).join(', ')} filled from the client's sheet (name / ${numberLabel} checked by hand)`, '', targetId);
                } else {
                    showAlert('That card already has these numbers, so nothing was changed. The row is marked done.', { type: 'info' });
                }
            }
            const { error } = await supabase.from('serial_number_review')
                .update({ resolution, resolved_by: user.id, resolved_at: new Date().toISOString() })
                .eq('id', row.id).select('id').single();
            if (error) throw error;
            await onDone(row, targetId);
        } catch (err) {
            showAlert('Could not save: ' + (err?.message || err), { type: 'error' });
        } finally {
            setBusy('');
        }
    };

    const button = (resolution, label, primary, disabled) => (
        <button type="button" disabled={!!busy || disabled} onClick={() => resolve(resolution)}
            className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold disabled:opacity-40 cursor-pointer ${primary ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-stone-700'}`}>
            {busy === resolution ? <Loader2 size={14} className="animate-spin" /> : resolution === 'dismissed' ? <X size={14} /> : <Check size={14} />} {label}
        </button>
    );

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${swapped ? 'bg-violet-50 text-violet-700' : 'bg-amber-50 text-amber-700'}`}>
                    {swapped ? `Name is on another ${numberLabel}` : `Different name on this ${numberLabel}`}
                </span>
                <span className="text-[11px] text-stone-400">{row.source}</span>
            </div>
            <div className={`grid grid-cols-1 gap-3 ${swapped ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Client sheet</div>
                    <div className="text-sm font-bold text-stone-900">{row.sheet_name}</div>
                    <div className="text-[11px] text-stone-500">{row.panel_serial_no ? 'Consumer' : 'File'} {row.sheet_number}</div>
                </div>
                {swapped ? <>
                    <CardSummary title="CRM card with this name" tone="text-emerald-600" card={card} fallbackName={row.card_name} onOpen={onOpen} />
                    <CardSummary title={`CRM card on ${numberLabel} ${row.sheet_number}`} tone="text-stone-400" card={otherCard} onOpen={onOpen} />
                </> : <CardSummary title={`CRM card on ${numberLabel} ${row.sheet_number}`} tone="text-stone-400" card={card} fallbackName={row.card_name} onOpen={onOpen} />}
            </div>
            <CompareTable row={row} columns={swapped
                ? [['CRM card with this name', card], [`CRM card on ${numberLabel} ${row.sheet_number}`, otherCard]]
                : [['CRM card now', card]]} />
            <div className="flex flex-wrap justify-end gap-2">
                {button('dismissed', swapped ? 'Neither' : 'Different customer', false, false)}
                {swapped
                    ? <>
                        {button('filled_other', `Use the CRM card on ${numberLabel} ${row.sheet_number}`, false, !otherCard)}
                        {button('filled', `Use the CRM card with this name${card?.folder_no ? ` (file ${card.folder_no})` : ''}`, true, !card)}
                    </>
                    : button('filled', 'Same customer, fill empty fields', true, !card)}
            </div>
        </div>
    );
}

// What the import wrote to one card. Shows what is on the card now (it may have been
// changed since), with Edit to correct it. Edits overwrite, and each one is logged with
// the old and new value in the Activity Log, which is also the card's History tab.
function UploadedRow({ row, card, onSaved, onOpen, user }) {
    const { showAlert } = useGlobalPopup();
    const [editing, setEditing] = useState(false);
    const [values, setValues] = useState({});
    const [saving, setSaving] = useState(false);

    const startEdit = () => {
        setValues(Object.fromEntries(FIELDS.map(([field]) => [field, field === 'panel_serial_no' ? panelText(card?.[field]) : (card?.[field] ?? '')])));
        setEditing(true);
    };

    const save = async () => {
        setSaving(true);
        try {
            const { data: live, error } = await supabase.from('admin')
                .select('customer_name, inverter_make, inverter_serial_no, panel_serial_no').eq('id', row.admin_id).single();
            if (error) throw error;
            const updates = {};
            const changes = [];
            for (const [field, label] of FIELDS) {
                const next = field === 'panel_serial_no' ? panelText(values[field]) : String(values[field] ?? '').trim();
                if (shownValue(field, next) === shownValue(field, live[field])) continue;
                updates[field] = next || null;
                changes.push(field === 'panel_serial_no'
                    ? `${label}: ${serialList(live[field]).length} -> ${serialList(next).length} serials`
                    : `${label}: ${shownValue(field, live[field]) || 'empty'} -> ${next || 'empty'}`);
            }
            if (changes.length) {
                const result = await updateAdminRecord(row.admin_id, updates);
                if (!result.ok) throw result.error;
                await logActivity(user.id, 'update', `${live.customer_name}: ${changes.join('; ')} (edited on the Inverter page)`,
                    updates.panel_serial_no !== undefined ? `Panel serials: ${serialList(updates.panel_serial_no).join(', ')}` : '', row.admin_id);
            }
            setEditing(false);
            await onSaved(row.admin_id);
        } catch (err) {
            showAlert('Could not save: ' + (err?.message || err), { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <CardSummary title="CRM customer card" tone="text-stone-400" card={card} fallbackName={row.sheet_name} onOpen={onOpen} />
                <div className="text-right text-[11px] text-stone-400">
                    <div>Sheet name: <span className="font-semibold text-stone-600">{row.sheet_name}</span></div>
                    <div>{row.source}</div>
                </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                {FIELDS.map(([field, label]) => {
                    const now = shownValue(field, card?.[field]);
                    const fromSheet = shownValue(field, row[field]);
                    const count = field === 'panel_serial_no' && now ? ` (${serialList(card?.[field]).length})` : '';
                    const id = `${row.id}-${field}`;
                    return (
                        <label key={field} htmlFor={id} className="block rounded-xl bg-stone-50 px-3 py-2">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{label}{count}</span>
                            {editing ? (
                                field === 'panel_serial_no'
                                    ? <textarea id={id} rows={4} value={values[field]} placeholder="One serial per line" onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-300" />
                                    : <input id={id} type="text" value={values[field]} list={field === 'inverter_make' ? 'missing-numbers-makes' : undefined} onChange={e => setValues(v => ({ ...v, [field]: e.target.value }))}
                                        className="mt-1 w-full rounded-lg border border-stone-200 bg-white px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-300" />
                            ) : <>
                                <div className="font-mono text-stone-800 break-all">{now || <span className="text-stone-300">empty</span>}</div>
                                {fromSheet && fromSheet !== now && <div className="mt-1 text-[10px] text-amber-700">Sheet had: {fromSheet}</div>}
                                {!fromSheet && now && <div className="mt-1 text-[10px] text-stone-400">Not from the sheet</div>}
                            </>}
                        </label>
                    );
                })}
            </div>
            <div className="flex justify-end gap-2">
                {editing ? <>
                    <button type="button" disabled={saving} onClick={() => setEditing(false)}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 cursor-pointer">Cancel</button>
                    <button type="button" disabled={saving} onClick={save}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-stone-900 px-4 text-xs font-bold text-white disabled:opacity-40 cursor-pointer">
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Save
                    </button>
                </> : (
                    <button type="button" disabled={!card} onClick={startEdit}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 disabled:opacity-40 cursor-pointer">
                        <Pencil size={14} /> Edit
                    </button>
                )}
            </div>
        </div>
    );
}

// What the search box matches on a card.
const cardText = card => card ? [card.customer_name, card.folder_no, card.consumer_no, card.phone_number, card.villages, card.inverter_make, card.inverter_serial_no, card.panel_serial_no] : [];

async function loadCardsById(ids) {
    const linked = {};
    for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.from('admin').select(COLUMNS).in('id', ids.slice(i, i + 200));
        if (error) throw error;
        (data || []).forEach(card => { linked[card.id] = card; });
    }
    return linked;
}

const TABS = [
    ['missing', 'Missing', Hash, 'Customers from Material Delivery onwards with no inverter make, inverter serial or panel serials. Type them in from the paperwork; only empty fields are saved.'],
    ['review', 'File no mismatch', UserCheck, 'Rows from the client\'s sheet where the name and the file or consumer number point to different customers. Where the name is on another card, that card is offered first. Only empty fields are filled.'],
    ['uploaded', 'Uploaded from sheet', FileSpreadsheet, 'Inverter and panel numbers the import filled in from the client\'s sheet, matched on both name and number. Edit corrects a card; every change goes to the Activity Log and the card\'s History.'],
];

export default function MissingNumbersView({ user, meta, onSelectCustomer }) {
    const [tab, setTab] = useState('missing');
    const [cards, setCards] = useState([]);
    const [reviewRows, setReviewRows] = useState([]);
    const [uploadedRows, setUploadedRows] = useState([]);
    const [linkedCards, setLinkedCards] = useState({});
    const [sheetTablesReady, setSheetTablesReady] = useState(true);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState('all');
    const [shown, setShown] = useState(PAGE_SIZE);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        try {
            const rows = await loadAll(() => supabase.from('admin').select(COLUMNS)
                .is('deleted_at', null).in('stage', STAGES_AFTER_INTEGRATION).order('folder_no', { ascending: true }));
            setCards(rows.filter(card => missingFields(card).length > 0));

            // Both tables come with the 5 Nov migration; until it runs, only the first tab shows.
            let review, uploaded;
            try {
                review = await loadAll(() => supabase.from('serial_number_review').select('*').is('resolution', null).order('id'));
                uploaded = await loadAll(() => supabase.from('serial_number_import').select('*').order('id'));
            } catch {
                setSheetTablesReady(false);
                return;
            }
            setSheetTablesReady(true);
            setReviewRows(review);
            setUploadedRows(uploaded);
            const ids = [...new Set([...review.flatMap(r => [r.admin_id, r.alt_admin_id]), ...uploaded.map(r => r.admin_id)].filter(Boolean))];
            setLinkedCards(await loadCardsById(ids));
        } catch (err) {
            setLoadError(err?.message || String(err));
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    // After a save, re-read just that card instead of the whole list.
    const refreshCard = useCallback(async (id) => {
        const { data } = await supabase.from('admin').select(COLUMNS).eq('id', id).maybeSingle();
        setCards(prev => prev.map(card => card.id === id ? data : card).filter(card => card && missingFields(card).length > 0));
        if (data) setLinkedCards(prev => (prev[id] ? { ...prev, [id]: data } : prev));
    }, []);
    const reviewDone = useCallback(async (row, filledId) => {
        setReviewRows(prev => prev.filter(r => r.id !== row.id));
        if (filledId) await refreshCard(filledId);
    }, [refreshCard]);
    useEffect(() => { setShown(PAGE_SIZE); }, [search, filter, tab]);

    const makeOptions = useMemo(() => [...new Set((meta?.inverter_make || []).map(m => m?.label ?? m).filter(Boolean))], [meta]);

    const visibleMissing = useMemo(() => cards.filter(card => {
        const missing = missingFields(card);
        const inverter = missing.some(f => INVERTER_FIELDS.includes(f));
        const panels = missing.includes('panel_serial_no');
        if (filter === 'inverter' && !inverter) return false;
        if (filter === 'panels' && !panels) return false;
        if (filter === 'both' && !(inverter && panels)) return false;
        return matchesSearch(search, ...cardText(card));
    }), [cards, filter, search]);

    const visibleReview = useMemo(() => reviewRows.filter(row => {
        if (filter === 'swapped' && row.kind !== 'swapped') return false;
        if (filter === 'name_differs' && row.kind !== 'name_differs') return false;
        return matchesSearch(search, row.sheet_name, row.sheet_number, row.inverter_serial_no, row.panel_serial_no,
            ...cardText(linkedCards[row.admin_id]), ...cardText(linkedCards[row.alt_admin_id]));
    }), [reviewRows, linkedCards, filter, search]);

    const visibleUploaded = useMemo(() => uploadedRows.filter(row => matchesSearch(search,
        row.sheet_name, row.inverter_make, row.inverter_serial_no, row.panel_serial_no, ...cardText(linkedCards[row.admin_id]))),
    [uploadedRows, linkedCards, search]);

    const list = { missing: visibleMissing, review: visibleReview, uploaded: visibleUploaded }[tab];
    const counts = { missing: cards.length, review: reviewRows.length, uploaded: uploadedRows.length };
    const filters = {
        missing: [['all', 'All missing'], ['inverter', 'Inverter missing'], ['panels', 'Panel serials missing'], ['both', 'Both missing']],
        review: [['all', 'All mismatches'], ['swapped', 'Name on another number'], ['name_differs', 'Different name on number']],
    }[tab];
    const changeTab = id => { setTab(id); setFilter('all'); };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <h2 className="text-lg font-bold text-stone-900">Inverter</h2>
            <div role="tablist" aria-label="Inverter" className="flex flex-wrap gap-2">
                {TABS.filter(([id]) => id === 'missing' || sheetTablesReady).map(([id, label, Icon]) =>
                    <TabButton key={id} active={tab === id} onClick={() => changeTab(id)} icon={Icon} label={label} count={loading ? null : counts[id]} />)}
            </div>

            <p className="text-xs text-stone-500 font-medium">{TABS.find(([id]) => id === tab)[3]}</p>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
                <SearchBox value={search} onChange={setSearch} placeholder="Search name, file no, consumer no, serial..." />
                <div className="flex items-center gap-2">
                    {filters && (
                        <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Show"
                            className="min-h-10 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700">
                            {filters.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                        </select>
                    )}
                    <button type="button" onClick={load} title="Refresh"
                        className="p-2.5 bg-white hover:bg-stone-50 border border-stone-200 rounded-xl text-stone-600 cursor-pointer">
                        <RefreshCw size={14} className={loading ? 'animate-spin text-amber-500' : ''} />
                    </button>
                </div>
            </div>

            {loadError && <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-800">This list could not be loaded. {loadError}</div>}
            {!loading && !loadError && list.length === 0 && <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs font-semibold text-stone-400">Nothing to show.</div>}

            <div className="space-y-3">
                {tab === 'missing' && visibleMissing.slice(0, shown).map(card => <MissingRow key={card.id} card={card} user={user} onSaved={refreshCard} onOpen={onSelectCustomer} />)}
                {tab === 'review' && visibleReview.slice(0, shown).map(row => <ReviewRow key={row.id} row={row} card={linkedCards[row.admin_id]} otherCard={linkedCards[row.alt_admin_id]} user={user} onDone={reviewDone} onOpen={onSelectCustomer} />)}
                {tab === 'uploaded' && visibleUploaded.slice(0, shown).map(row => <UploadedRow key={row.id} row={row} card={linkedCards[row.admin_id]} user={user} onSaved={refreshCard} onOpen={onSelectCustomer} />)}
            </div>
            {makeOptions.length > 0 && <datalist id="missing-numbers-makes">{makeOptions.map(make => <option key={make} value={make} />)}</datalist>}
            {list.length > shown && (
                <div className="flex justify-center">
                    <button type="button" onClick={() => setShown(n => n + PAGE_SIZE)}
                        className="min-h-10 rounded-xl border border-stone-200 bg-white px-4 text-xs font-bold text-stone-700 cursor-pointer">
                        Show more ({list.length - shown} left)
                    </button>
                </div>
            )}
        </div>
    );
}
