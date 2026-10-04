import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Save, Printer, ShoppingBag, User, Clock, AlertCircle, X, Layers, Zap, Copy, Check, ClipboardPaste, Plus, Trash2, PackageCheck } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';
import BomPrintModal from '../BomPrintModal';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE, COMMON_BOM_ITEMS } from '../../constants';
import { loadBomForCustomer } from '../../utils/bom';
import { useGlobalPopup } from '../GlobalPopup';

const parsePanelSerials = (raw) => {
    if (!raw) return [''];
    if (Array.isArray(raw)) {
        const serials = raw.map(value => String(value || '').trim()).filter(Boolean);
        return serials.length > 0 ? serials : [''];
    }

    const rawText = String(raw);
    try {
        const parsed = JSON.parse(rawText);
        if (Array.isArray(parsed)) {
            const serials = parsed.map(value => String(value || '').trim()).filter(Boolean);
            return serials.length > 0 ? serials : [''];
        }
    } catch { /* not valid JSON, fall through to default */ }

    if (rawText.includes('\n')) {
        return rawText.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (rawText.includes(',')) {
        return rawText.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [rawText.trim()];
};

const isSolarPanelItem = item => String(item?.product_name || '').trim().toLowerCase() === 'solar panel';
const panelLoadedDate = value => value ? new Date(value).toLocaleDateString('en-IN') : '';
let panelLoadingTableMissing = false;
// customer id + BOM type -> last BOM read, for instant display on reopen.
const bomCache = new Map();

// A plain tick box: empty square, or green with a check mark. Shown only
// while the Loading switch is on.
function TickBox({ label, checked, disabled, onToggle }) {
    return (
        <button type="button" role="checkbox" aria-checked={checked} aria-label={label}
            disabled={disabled} onClick={onToggle} title={checked ? 'Loaded - tap to untick' : 'Tap to tick as loaded'}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-50">
            <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors ${checked ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 bg-white'}`}>
                {checked && <Check size={14} strokeWidth={3} />}
            </span>
        </button>
    );
}

export default function MaterialIntegrationTab({
    customer,
    editData,
    setEditData,
    handleChange,
    isEditable,
    user,
    meta = {},
    logActivity,
    editingSection,
    setEditingSection,
    onUpdate,
    handleAdvanceStage,
    saving,
    setSaving,
    saveBomRef,
    onDirty,
    fullRecordLoaded
}) {
    const { showAlert } = useGlobalPopup();
    // The BOM is fetched after the first paint, so these fields rendered as "–"
    // for a moment before the real values arrived - which read as data loss.
    const [loadingBom, setLoadingBom] = useState(true);
    const [refreshingBom, setRefreshingBom] = useState(false);
    // True when the BOM could not be read. The tab then shows the blank
    // template, and saving would replace the real bom_items with template
    // defaults - so saveBOM refuses while this is set.
    const bomLoadFailedRef = useRef(false);
    const [bom, setBom] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [paperPreparedBy, setPaperPreparedBy] = useState('');
    const [paperPreparedDate, setPaperPreparedDate] = useState('');
    const [materialLoadedBy, setMaterialLoadedBy] = useState('');
    const [materialLoadedDate, setMaterialLoadedDate] = useState('');
    const [errorMessage, setErrorMessage] = useState(null);
    const bomDirtyRef = useRef(false);
    const bomEditVersionRef = useRef(0);
    const markBomDirty = () => {
        bomDirtyRef.current = true;
        bomEditVersionRef.current += 1;
        onDirty?.();
    };

    const [panelSerials, setPanelSerials] = useState(() => parsePanelSerials(customer?.panel_serial_no || editData?.panel_serial_no));
    const [loadingMode, setLoadingMode] = useState(false);
    const [loadingModeBusy, setLoadingModeBusy] = useState(false);
    const loadingMarkedRef = useRef(false);
    const [panelLoadBySerial, setPanelLoadBySerial] = useState({});
    const [panelLoadReady, setPanelLoadReady] = useState(false);
    const [panelLoadError, setPanelLoadError] = useState(null);
    const [panelRetryKey, setPanelRetryKey] = useState(0);
    const [panelTickBusy, setPanelTickBusy] = useState(false);
    const [showBulkPaste, setShowBulkPaste] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const inverterMakeOptions = (meta?.['inverter_make'] && meta['inverter_make'].length > 0)
        ? meta['inverter_make']
        : ['test1', 'test2', 'test3'];

    // Show the working value (editData) - it already holds the saved value plus
    // anything typed. Re-sync only when it differs from what is on screen, so
    // blank rows the user just added are not wiped. (This used to prefer the
    // saved copy, so a refresh mid-edit could show different serials from the
    // ones that would actually be saved.)
    const workingPanelValue = editData?.panel_serial_no ?? customer?.panel_serial_no;
    useEffect(() => {
        const target = parsePanelSerials(workingPanelValue).filter(Boolean);
        setPanelSerials(prev => {
            const onScreen = prev.filter(Boolean);
            if (onScreen.join('\n') === target.join('\n')) return prev;
            return target.length > 0 ? target : [''];
        });
    }, [workingPanelValue]);

    useEffect(() => {
        if (!customer?.id) return undefined;
        let active = true;
        setPanelLoadReady(false);
        setPanelLoadError(null);
        const loadPanelStatus = async () => {
            if (panelLoadingTableMissing) {
                if (active) setPanelLoadError('missing');
                return;
            }
            try {
                const { data, error } = await supabase.from('panel_loading')
                    .select('serial_no,loaded,loaded_at').eq('customer_id', customer.id);
                if (!active) return;
                if (error) {
                    const missing = ['PGRST205', '42P01'].includes(error.code)
                        || /could not find the table|relation .*panel_loading.* does not exist/i.test(error.message || '');
                    if (missing) panelLoadingTableMissing = true;
                    setPanelLoadError(missing ? 'missing' : 'connection');
                    return;
                }
                setPanelLoadBySerial(Object.fromEntries((data || []).map(row => [row.serial_no, row])));
                setPanelLoadError(null);
                setPanelLoadReady(true);
            } catch {
                if (active) setPanelLoadError('connection');
            }
        };
        void loadPanelStatus();
        window.addEventListener('online', loadPanelStatus);
        return () => { active = false; window.removeEventListener('online', loadPanelStatus); };
    }, [customer?.id, panelRetryKey]);

    // Until the full record has loaded, the panel list may be built from a
    // partial copy (it showed "0 panels" for a customer with 7 saved). Editing
    // it then would replace the real serials, so it stays read-only.
    // While Loading is on the list is locked: only the tick boxes work.
    const canEditPanels = isEditable && !loadingMode && fullRecordLoaded !== false;

    // Serial edits go through setEditData, which works out whether anything
    // really changed. They used to force the form "unsaved" - adding blank
    // rows (+5) with no serial typed was enough to trigger the save prompt.
    const handlePanelSerialChange = (idx, val) => {
        const next = [...panelSerials];
        next[idx] = val;
        setPanelSerials(next);
        const filtered = next.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const addPanelSerial = (count = 1) => {
        if (panelSerials.length >= 100) return;
        const toAdd = Math.min(count, 100 - panelSerials.length);
        const newItems = Array(toAdd).fill('');
        setPanelSerials(prev => [...prev, ...newItems]);
    };

    const removePanelSerial = (idx) => {
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
        const filtered = finalVal.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const handleBulkPasteApply = () => {
        if (!bulkText.trim()) return;
        const lines = bulkText
            .split(/[\n,]+/)
            .map(s => s.trim())
            .filter(Boolean);
        if (lines.length > 0) {
            const existing = panelSerials.filter(Boolean);
            const combined = [...existing, ...lines].slice(0, 100);
            const finalSerials = combined.length > 0 ? combined : [''];
            setPanelSerials(finalSerials);
            setEditData(prev => ({ ...prev, panel_serial_no: finalSerials.join('\n') }));
            setBulkText('');
            setShowBulkPaste(false);
        }
    };

    const copySingleSerial = (text, idx) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    const copyAllSerials = () => {
        const text = panelSerials.filter(Boolean).join('\n');
        if (!text) return;
        navigator.clipboard.writeText(text);
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    const filledCount = panelSerials.filter(Boolean).length;
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Integration By dropdown options. No placeholder fallback - fabricated
    // names used to be offered when the list was empty, and anything picked
    // was saved onto a real customer (the same way "Test Vendor (Solar Tech)"
    // ended up on live records). An empty list shows an empty list.
    const integrationByOptions = meta['integration_by'] || [];

    // Automatically determine Roof vs Shed from Material Order specification
    const roofShedVal = (editData?.roof_shed || customer?.roof_shed || '').toUpperCase();
    const activeType = roofShedVal.includes('SHED') ? 'SHED' : 'ROOF';

    // Show the last copy of this BOM at once while the fresh copy loads, so
    // the table no longer blanks out every time the tab is opened. A sequence
    // number drops answers from older requests (a ROOF load finishing after
    // the SHED load used to replace the right BOM with the wrong template).
    const loadSeqRef = useRef(0);
    const loadBOM = async () => {
        if (!customer?.id) return;
        const seq = ++loadSeqRef.current;
        const cacheKey = `${customer.id}:${activeType}`;
        const cached = bomCache.get(cacheKey);
        if (cached) {
            setPaperPreparedBy(cached.bom?.paper_prepared_by || '');
            setPaperPreparedDate(cached.bom?.paper_prepared_date || '');
            setMaterialLoadedBy(cached.bom?.material_loaded_by || '');
            setMaterialLoadedDate(cached.bom?.material_loaded_date || '');
            setBom(cached.bom);
            setBomItems(cached.items);
        }
        setLoadingBom(!cached);
        setRefreshingBom(true);
        bomLoadFailedRef.current = false;
        const editVersionAtLoad = bomEditVersionRef.current;
        try {
            const { bom: bomData, items, loadError } = await loadBomForCustomer({ ...customer, ...editData }, activeType);
            if (seq !== loadSeqRef.current) return;
            // Never replace the user's unsaved edits with a background refresh.
            if (bomEditVersionRef.current !== editVersionAtLoad) return;
            bomLoadFailedRef.current = !!loadError;
            if (loadError) {
                if (cached) {
                    // The copy on screen is the last one read from the database.
                    bomLoadFailedRef.current = false;
                    return;
                }
                showAlert(
                    'The Bill of Materials could not be loaded, so a blank template is shown. Do NOT save over it - your existing BOM is still in the database. Please reload and try again.',
                    { title: 'BOM not loaded', type: 'error' }
                );
            } else {
                bomCache.set(cacheKey, { bom: bomData, items });
            }
            setPaperPreparedBy(bomData?.paper_prepared_by || '');
            setPaperPreparedDate(bomData?.paper_prepared_date || '');
            setMaterialLoadedBy(bomData?.material_loaded_by || '');
            setMaterialLoadedDate(bomData?.material_loaded_date || '');
            setBom(bomData);
            setBomItems(items);
            bomDirtyRef.current = false;
        } catch (err) {
            console.error('loadBOM exception:', err);
        } finally {
            if (seq === loadSeqRef.current) {
                setLoadingBom(false);
                setRefreshingBom(false);
            }
        }
    };

    useEffect(() => {
        loadBOM();
    }, [customer?.id, activeType]);

    // Keep the instant-display copy in step with ticks and saves.
    useEffect(() => {
        if (!customer?.id || loadingBom || refreshingBom || bomLoadFailedRef.current || !bom?.id) return;
        bomCache.set(`${customer.id}:${activeType}`, { bom, items: bomItems });
    }, [customer?.id, activeType, bom, bomItems, loadingBom, refreshingBom]);

    const latestStateRef = useRef({});
    latestStateRef.current = {
        bom,
        bomItems,
        paperPreparedBy,
        paperPreparedDate,
        materialLoadedBy,
        materialLoadedDate,
        activeType,
        customer
    };

    const handleItemFieldChange = (index, field, value) => {
        markBomDirty();
        setBomItems(prev => {
            const next = prev.map((item, i) => (i === index ? { ...item, [field]: value } : item));
            try {
                const localData = {
                    bom: {
                        id: bom?.id || `bom-${customer.id}`,
                        admin_id: customer.id,
                        bom_type: activeType,
                        paper_prepared_by: paperPreparedBy,
                        paper_prepared_date: paperPreparedDate,
                        material_loaded_by: materialLoadedBy,
                        material_loaded_date: materialLoadedDate
                    },
                    items: next
                };
                localStorage.setItem(`watersun_bom_${customer.id}`, JSON.stringify(localData));
            } catch { /* best-effort, ignore failure */ }
            return next;
        });
    };

    // Loaded ticks: one per BOM line, so the person loading the truck can mark
    // each item as it goes on. Ticked OUTSIDE edit mode: each tick is saved at
    // once (bom_items.loaded) and written to the activity log. Edit mode is for
    // the BOM details only; a BOM save keeps the ticks.
    const filledPanelSerials = panelSerials.map(serial => serial.trim()).filter(Boolean);
    const panelLoadedCount = filledPanelSerials.filter(serial => panelLoadBySerial[serial]?.loaded === true).length;
    const panelAllLoaded = filledPanelSerials.length > 0 && panelLoadedCount === filledPanelSerials.length;
    const namedItems = bomItems.filter(item => item.product_name && item.product_name.trim() !== '');
    const otherNamedItems = namedItems.filter(item => !isSolarPanelItem(item));
    const isItemLoaded = item => isSolarPanelItem(item) ? panelLoadReady && panelAllLoaded : item.loaded === true;
    const loadedCount = namedItems.filter(isItemLoaded).length;
    const allLoaded = namedItems.length > 0 && loadedCount === namedItems.length;
    const TICK_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const canTick = isEditable && loadingMode && editingSection !== 'bom_items' && !loadingBom && !refreshingBom && !bomLoadFailedRef.current
        && namedItems.length > 0 && namedItems.every(item => TICK_ID_RE.test(String(item.id || '')));
    const canTogglePanels = isEditable && loadingMode && fullRecordLoaded !== false && panelLoadReady && !panelLoadError && !panelTickBusy
        && !loadingBom && !refreshingBom && !bomLoadFailedRef.current && !loadingModeBusy && !saving;
    const [tickBusy, setTickBusy] = useState(false);
    const todayLocal = () => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    };
    const saveLoadedDate = async (date) => {
        if (!bom?.id) {
            showAlert('Save the Bill of Materials before recording the loading date.', { title: 'Date not saved', type: 'error' });
            return false;
        }
        try {
            const { data, error } = await supabase.from('bom').update({ material_loaded_date: date }).eq('id', bom.id).select('id');
            if (error || !data?.length) throw error || new Error('The loading date could not be saved.');
        } catch (error) {
            showAlert(error?.message || 'The loading date could not be saved.', { title: 'Date not saved', type: 'error' });
            return false;
        }
        setMaterialLoadedDate(date);
        setBom(prev => ({ ...prev, material_loaded_date: date }));
        return true;
    };
    const lastSavedSerialsRef = useRef(null);
    const persistPanelSerials = async () => {
        if (!customer?.id || fullRecordLoaded === false) throw new Error('Wait for the customer record to finish loading.');
        const serials = panelSerials.map(value => value.trim()).filter(Boolean);
        if (new Set(serials).size !== serials.length) throw new Error('Remove duplicate panel serial numbers before saving.');
        const { data: savedCustomer, error } = await supabase.from('admin')
            .select('panel_serial_no').eq('id', customer.id).single();
        if (error) throw error;
        const stored = parsePanelSerials(savedCustomer?.panel_serial_no).map(value => value.trim()).filter(Boolean);
        if (stored.join('\n') === serials.join('\n')) return serials;
        const original = lastSavedSerialsRef.current
            ?? parsePanelSerials(customer.panel_serial_no).map(value => value.trim()).filter(Boolean);
        if (stored.join('\n') !== original.join('\n')) {
            throw new Error('The panel serial list changed in another session. Reopen this customer before saving.');
        }
        if (!onUpdate || await onUpdate(customer.id, { panel_serial_no: serials.join('\n') }) === false) {
            throw new Error('The panel serial numbers were not saved.');
        }
        lastSavedSerialsRef.current = serials;
        return serials;
    };
    const togglePanelLoaded = async serialValue => {
        const serial = String(serialValue || '').trim();
        if (!serial || !canTogglePanels || !customer?.id) return;
        setPanelTickBusy(true);
        try {
            const savedSerials = await persistPanelSerials();
            if (!savedSerials.includes(serial)) throw new Error('Enter the serial number before marking it loaded.');

            const nextLoaded = panelLoadBySerial[serial]?.loaded !== true;
            const { data: rows, error } = await supabase.from('panel_loading')
                .upsert({ customer_id: customer.id, serial_no: serial, loaded: nextLoaded }, { onConflict: 'customer_id,serial_no' })
                .select('serial_no,loaded,loaded_at');
            if (error || rows?.length !== 1) throw error || new Error('The panel loading status was not saved.');
            const nextStatuses = { ...panelLoadBySerial, [serial]: rows[0] };
            setPanelLoadBySerial(nextStatuses);

            const panelItem = bomItems.find(isSolarPanelItem);
            const everyPanelLoaded = savedSerials.length > 0 && savedSerials.every(value => nextStatuses[value]?.loaded === true);
            if (panelItem?.id && panelItem.loaded !== everyPanelLoaded) {
                const { data: updated, error: itemError } = await supabase.from('bom_items')
                    .update({ loaded: everyPanelLoaded }).eq('id', panelItem.id).select('id');
                if (itemError || !updated?.length) {
                    showAlert(itemError?.message || 'Panel status saved, but the BOM summary could not be updated.', { title: 'BOM summary not saved', type: 'warning' });
                } else {
                    setBomItems(prev => prev.map(item => isSolarPanelItem(item) ? { ...item, loaded: everyPanelLoaded } : item));
                }
            }
            if (nextLoaded) loadingMarkedRef.current = true;
            if (logActivity && user?.id) {
                void logActivity(user.id, 'update', `${customer.customer_name || 'Customer'}: Panel ${serial} ${nextLoaded ? 'marked loaded' : 'unmarked'}`, 'Material Integration - panel serial loading', customer.id);
            }
        } catch (error) {
            showAlert(error?.message || 'The panel loading status was not saved.', { title: 'Panel not saved', type: 'error' });
        } finally {
            setPanelTickBusy(false);
        }
    };
    const saveLoaded = async (targets, value) => {
        if (!canTick || tickBusy || targets.length === 0) return;
        const ids = targets.map(item => item.id);
        const before = bomItems;
        setTickBusy(true);
        setBomItems(prev => prev.map(item => (ids.includes(item.id) ? { ...item, loaded: value } : item)));
        try {
            const { data, error } = await supabase.from('bom_items').update({ loaded: value }).in('id', ids).select('id');
            if (error || (data || []).length !== ids.length) throw error || new Error('The BOM may have changed. Reopen the customer and try again.');
        } catch (error) {
            setBomItems(before);
            setTickBusy(false);
            showAlert(error?.message || 'The tick was not saved.', { title: 'Tick not saved', type: 'error' });
            return;
        }
        if (value) loadingMarkedRef.current = true;
        setTickBusy(false);
        const targetCust = customer || editData;
        if (logActivity && user?.id && targetCust?.id) {
            const what = targets.length === 1
                ? `BOM item "${targets[0].product_name}" ${value ? 'marked loaded' : 'unmarked (not loaded)'}`
                : `${value ? 'Marked all' : 'Unmarked all'} ${targets.length} BOM items ${value ? 'loaded' : '(not loaded)'}`;
            void logActivity(user.id, 'update', `${targetCust.customer_name || 'Customer'}: ${what}`, 'Material Integration - loaded ticks', targetCust.id);
        }
    };
    const setAllLoaded = value => saveLoaded(otherNamedItems.filter(item => (item.loaded === true) !== value), value);
    const LoadedProgress = ({ editable }) => (
        <div className={`mb-2 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2 ${allLoaded ? 'border-emerald-200 bg-emerald-50' : 'border-stone-200 bg-stone-50'}`}>
            <PackageCheck size={16} className={allLoaded ? 'text-emerald-600' : 'text-stone-400'} />
            <div className="min-w-[160px] flex-1">
                <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className={allLoaded ? 'text-emerald-700' : 'text-stone-700'}>{allLoaded ? 'All items loaded' : 'Loading progress'}</span>
                    <span className="text-stone-500">{loadedCount} of {namedItems.length} loaded</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
                    <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${namedItems.length ? (loadedCount / namedItems.length) * 100 : 0}%` }} />
                </div>
            </div>
            {editable && otherNamedItems.length > 0 && (
                <button type="button" disabled={tickBusy} onClick={() => setAllLoaded(!otherNamedItems.every(item => item.loaded === true))}
                    className="rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-[10px] font-bold text-stone-700 hover:border-emerald-300 hover:text-emerald-700">
                    {otherNamedItems.every(item => item.loaded === true) ? 'Clear other items' : 'Mark other items loaded'}
                </button>
            )}
        </div>
    );

    // Save BOM and Milestones together
    const saveBOM = async (loadedDateOverride = null) => {
        // The parent Save button also runs on this tab. Rewriting the BOM on
        // every unrelated customer edit created repeated errors and destroyed
        // useful evidence about which part of the save actually failed.
        if (!bomDirtyRef.current && !loadedDateOverride) return true;
        const state = latestStateRef.current;
        const targetCust = state.customer || customer;
        if (!targetCust?.id) return true;

        // The BOM on screen is a blank template because the read failed, not
        // because this customer has no BOM. Saving it would delete the real
        // bom_items and insert template defaults - and CustomerDetailModal
        // calls this on EVERY save while the tab is mounted, so editing any
        // unrelated field was enough to wipe it. Refuse instead.
        if (bomLoadFailedRef.current) {
            throw new Error(
                'The Bill of Materials could not be loaded, so it was not saved over. '
                + 'Close and reopen this customer, then try again.'
            );
        }

        const editVersionAtSave = bomEditVersionRef.current;

        try {
            const currentType = state.activeType || activeType;
            const prepBy = state.paperPreparedBy || null;
            const prepDate = state.paperPreparedDate || null;
            const loadBy = state.materialLoadedBy || null;
            const loadDate = loadedDateOverride || state.materialLoadedDate || null;
            const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const rawBomId = state.bom?.id;
            const currentBomId = UUID_RE.test(String(rawBomId || '')) ? rawBomId : null;
            const items = state.bomItems || [];
            const validItems = items.filter(item => item.product_name && item.product_name.trim() !== '');
            const expectedItemIds = items.map(item => item.id).filter(id => UUID_RE.test(String(id || '')));
            const { data: saved, error: saveError } = await supabase.rpc('save_bom_atomic', {
                p_admin_id: targetCust.id,
                p_bom: {
                    bom_type: currentType,
                    paper_prepared_by: prepBy,
                    paper_prepared_date: prepDate,
                    material_loaded_by: loadBy,
                    material_loaded_date: loadDate
                },
                p_items: validItems.map(item => ({
                    product_name: item.product_name,
                    quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
                    integration_by: item.integration_by || null,
                    note: item.note || null,
                    loaded: isSolarPanelItem(item) ? panelAllLoaded : item.loaded === true
                })),
                p_expected_bom_id: currentBomId,
                p_expected_item_ids: expectedItemIds
            });
            if (saveError) throw saveError;
            if (!saved?.success || !saved.bom_id || saved.item_ids?.length !== validItems.length) {
                throw new Error('The database did not confirm the BOM and all its lines.');
            }
            setBom(prev => ({
                ...(prev || {}), id: saved.bom_id, admin_id: targetCust.id,
                bom_type: currentType, paper_prepared_by: prepBy,
                paper_prepared_date: prepDate, material_loaded_by: loadBy,
                material_loaded_date: loadDate
            }));
            if (loadedDateOverride) setMaterialLoadedDate(loadedDateOverride);
            let savedIndex = 0;
            const savedItems = items.map(item =>
                item.product_name && item.product_name.trim() !== ''
                    ? { ...item, id: saved.item_ids[savedIndex++] }
                    : item
            );
            if (bomEditVersionRef.current === editVersionAtSave) setBomItems(savedItems);
            const savedBomId = saved.bom_id;

            // 4. Save to localStorage backup
            try {
                const localBomData = {
                    bom: {
                        // null, never a fabricated id - a fake id here is what made
                        // later saves target a row that does not exist.
                        id: savedBomId,
                        admin_id: targetCust.id,
                        bom_type: currentType,
                        paper_prepared_by: prepBy,
                        paper_prepared_date: prepDate,
                        material_loaded_by: loadBy,
                        material_loaded_date: loadDate
                    },
                    items: savedItems
                };
                localStorage.setItem(`watersun_bom_${targetCust.id}`, JSON.stringify(localBomData));
            } catch (e) {
                console.error('LocalStorage BOM save failed:', e);
            }

            if (logActivity && user?.id) {
                await logActivity(
                    user.id,
                    'update',
                    `Saved BOM and milestones for ${targetCust.customer_name}`,
                    '',
                    targetCust.id
                );
            }
            if (bomEditVersionRef.current === editVersionAtSave) bomDirtyRef.current = false;
            return true;

        } catch (err) {
            console.error('saveBOM exception:', err);
            throw err;
        }
    };

    useEffect(() => {
        if (saveBomRef) {
            saveBomRef.current = async () => {
                return saveBOM();
            };
        }
        return () => {
            if (saveBomRef) {
                saveBomRef.current = null;
            }
        };
    });


    const isEditingMilestones = editingSection === 'procurement_milestones';
    const isEditingBom = editingSection === 'bom_items';
    const toggleLoadingMode = async () => {
        if (!isEditable || loadingModeBusy || panelTickBusy || tickBusy || saving) return;
        if (!loadingMode) {
            if (editingSection) {
                showAlert('Save or close the current detail edit before starting Loading.', { title: 'Finish the current edit', type: 'warning' });
                return;
            }
            setLoadingModeBusy(true);
            try {
                await persistPanelSerials();
                loadingMarkedRef.current = false;
                setShowBulkPaste(false);
                setLoadingMode(true);
            } catch (error) {
                showAlert(error?.message || 'The panel serial numbers could not be saved, so Loading was not started.', { title: 'Loading not started', type: 'error' });
            } finally {
                setLoadingModeBusy(false);
            }
            return;
        }
        setLoadingModeBusy(true);
        try {
            await persistPanelSerials();
            const hasLoadedItems = Object.values(panelLoadBySerial).some(row => row.loaded)
                || bomItems.some(item => !isSolarPanelItem(item) && item.loaded === true);
            const loadingDate = loadingMarkedRef.current && hasLoadedItems ? todayLocal() : null;
            if (loadingDate && TICK_ID_RE.test(String(bom?.id || ''))) {
                if (!await saveLoadedDate(loadingDate)) throw new Error('The loading date was not saved.');
            }
            if (bomDirtyRef.current || (loadingDate && !TICK_ID_RE.test(String(bom?.id || '')))) {
                await saveBOM(loadingDate);
            }
            loadingMarkedRef.current = false;
            setLoadingMode(false);
            setShowBulkPaste(false);
        } catch (error) {
            showAlert(error?.message || 'Loading changes were not saved. Keep Loading on and try again.', { title: 'Loading not finished', type: 'error' });
        } finally {
            setLoadingModeBusy(false);
        }
    };

    return (
        <div className="space-y-3.5 animate-in fade-in duration-300">
            {/* Top Toolbar / Action Bar */}
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Material Integration & BOM</h4>
                    <p className="text-[11px] text-stone-500 font-medium">BOM configuration, loading milestones and equipment checklist.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {activeType} BOM
                    </span>
                    {bom && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            Saved
                        </span>
                    )}
                    {!loadingMode && materialLoadedDate && (
                        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-800">
                            Loading date: {materialLoadedDate.split('-').reverse().join('/')}
                        </span>
                    )}
                    {isEditable && (
                        <button type="button" role="switch" aria-checked={loadingMode} aria-label="Loading mode"
                            disabled={loadingModeBusy || panelTickBusy || tickBusy || saving}
                            onClick={toggleLoadingMode}
                            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 text-xs font-bold text-stone-800 hover:border-amber-300 disabled:opacity-60">
                            <span>Loading</span>
                            <span className={`inline-flex h-6 w-11 items-center rounded-full p-0.5 transition-colors ${loadingMode ? 'bg-emerald-600' : 'bg-stone-300'}`}>
                                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${loadingMode ? 'translate-x-5' : ''}`} />
                            </span>
                            <span className="min-w-7 text-left">{loadingModeBusy ? 'Saving' : loadingMode ? 'On' : 'Off'}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => setShowPrintModal(true)}
                        className="bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                    >
                        <Printer size={13} /> Print / Export PDF
                    </button>
                </div>
            </div>

            {errorMessage && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between text-xs text-rose-800">
                    <div className="flex items-center gap-2">
                        <AlertCircle size={15} className="text-rose-600 flex-shrink-0" />
                        <span className="font-semibold">{errorMessage}</span>
                    </div>
                    <button type="button" onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-700 cursor-pointer">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* 1. Material Order Specifications (View-Only Reference exactly matching Material Order tab) */}
            <section id="section-mat_order_ref">
                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-amber-500" /> Material Order Specifications (Reference)
                    </h3>
                    <span className="text-[9px] font-semibold text-stone-400 uppercase">View Only</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <EditableDetailItem
                        label="Roof / Shed"
                        field="roof_shed"
                        value={editData?.roof_shed || customer?.roof_shed}
                        isEditing={false}
                    />
                    <EditableDetailItem
                        label="DC Cable (Meters)"
                        field="dc_cable"
                        value={editData?.dc_cable || customer?.dc_cable}
                        isEditing={false}
                    />
                    <EditableDetailItem
                        label="AC Cable (Meters)"
                        field="ac_cable"
                        value={editData?.ac_cable || customer?.ac_cable}
                        isEditing={false}
                    />
                    <EditableDetailItem
                        label="Structure Front Leg Height (ft)"
                        field="structure_front_leg_height"
                        value={editData?.structure_front_leg_height || customer?.structure_front_leg_height}
                        isEditing={false}
                    />
                    <EditableDetailItem
                        label="Structure Rear Leg Height (ft)"
                        field="structure_rear_leg_height"
                        value={editData?.structure_rear_leg_height || customer?.structure_rear_leg_height}
                        isEditing={false}
                    />
                    <EditableDetailItem
                        label="Invoice Value (₹)"
                        field="invoice_value"
                        value={editData?.invoice_value || customer?.invoice_value}
                        isMoney={true}
                        isEditing={false}
                    />
                    <div className="col-span-2 md:col-span-3">
                        <EditableDetailItem
                            label="Notes / Special Instructions (Optional)"
                            field="material_order_notes"
                            value={editData?.material_order_notes || customer?.material_order_notes}
                            isEditing={false}
                        />
                    </div>
                </div>
            </section>

            {/* 2. Customer & Site Reference (View-Only Reference - Exactly matching Material Order tab) */}
            <section id="section-lead_details" className="pt-1.5 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <User size={12} className="text-amber-500" /> Customer & Site Reference
                    </h3>
                    <span className="text-[9px] font-semibold text-stone-400 uppercase">View Only</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <EditableDetailItem label="Customer Name" field="customer_name" value={customer?.customer_name || editData?.customer_name} isEditing={false} />
                    <EditableDetailItem label="Phone Number" field="phone_number" value={customer?.phone_number || editData?.phone_number} isEditing={false} />
                    <EditableDetailItem label="Email Address" field="email" value={customer?.email_address || customer?.email || editData?.email_address || editData?.email} isEditing={false} />
                    <EditableDetailItem label="Consumer No" field="consumer_no" value={customer?.consumer_no || editData?.consumer_no} isEditing={false} />
                    <EditableDetailItem label="Folder No" field="folder_no" value={customer?.folder_no || editData?.folder_no} isEditing={false} />
                    <EditableDetailItem label="Feasibility No" field="feasibility_no" value={customer?.registration_no || customer?.feasibility_no || editData?.registration_no || editData?.feasibility_no} isEditing={false} />
                    <EditableDetailItem label="Villages" field="villages" value={customer?.villages || editData?.villages} isEditing={false} />
                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={customer?.sub_divisions || editData?.sub_divisions} isEditing={false} />
                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={customer?.channel_partner || editData?.channel_partner} isEditing={false} />
                    <EditableDetailItem label="Dealer Name" field="sub_channel_partner" value={customer?.sub_channel_partner || editData?.sub_channel_partner} isEditing={false} />
                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={customer?.module_brand || editData?.module_brand} isEditing={false} />
                    <EditableDetailItem label="MODULE WP" field="module_wp" value={customer?.module_wp || editData?.module_wp} isEditing={false} />
                    <EditableDetailItem label="No of Modules" field="no_of_modules" value={customer?.no_of_modules || editData?.no_of_modules} isEditing={false} />
                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={customer?.system_capacity_kwp || editData?.system_capacity_kwp} isEditing={false} />
                </div>
            </section>

            {/* 3. Inverter & Equipment Details (Own Edit Pencil) */}
            <section id="section-inverter_equip_details" className="pt-1.5 border-t border-stone-100 space-y-3">
                <SectionHeader 
                    title="Inverter & Equipment Details" 
                    id="inverter_equip_details" 
                    icon={Zap} 
                    isEditable={isEditable && !loadingMode}
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <EditableDetailItem 
                        label="INVERTER MAKE *" 
                        field="inverter_make" 
                        value={editData?.inverter_make || customer?.inverter_make} 
                        options={inverterMakeOptions}
                        category="inverter_make"
                        meta={meta}
                        onChange={handleChange} 
                        isEditing={editingSection === 'inverter_equip_details'} 
                    />
                    <EditableDetailItem 
                        label="INVERTER SERIAL NO. *" 
                        field="inverter_serial_no" 
                        value={editData?.inverter_serial_no || customer?.inverter_serial_no} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'inverter_equip_details'} 
                    />
                </div>
            </section>

            {/* 4. Dedicated Standalone Panel Serial Numbers Section */}
            <section id="section-panel_serials" className="space-y-3 pt-1.5 border-t border-stone-100">
                {/* Header Row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-amber-50 rounded-lg text-amber-600">
                            <Layers size={14} />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wide flex items-center gap-2">
                                Panel Serial Numbers <span className="text-red-500">*</span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-600 border border-stone-200">
                                    {filledCount} {filledCount === 1 ? 'Panel' : 'Panels'}
                                </span>
                                {panelLoadReady && filledCount > 0 && (
                                    <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                        {panelLoadedCount}/{filledCount} loaded
                                    </span>
                                )}
                            </h4>
                            {isEditable && fullRecordLoaded === false && (
                                <p className="text-[10px] font-semibold text-stone-400 mt-0.5">Loading saved serials…</p>
                            )}
                        </div>
                    </div>

                    {/* Action buttons on top right */}
                    <div className="flex items-center gap-1.5">
                        {canEditPanels && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setShowBulkPaste(prev => !prev)}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 transition cursor-pointer"
                                >
                                    <ClipboardPaste size={13} />
                                    {showBulkPaste ? 'Hide Paste' : 'Bulk Paste'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(1)}
                                    disabled={panelSerials.length >= 100}
                                    className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition disabled:opacity-50 cursor-pointer shadow-xs"
                                >
                                    <Plus size={13} /> Add 1
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(5)}
                                    disabled={panelSerials.length >= 96}
                                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition disabled:opacity-50 cursor-pointer"
                                    title="Add 5 serial rows"
                                >
                                    +5
                                </button>
                                <button
                                    type="button"
                                    onClick={() => addPanelSerial(10)}
                                    disabled={panelSerials.length >= 91}
                                    className="text-[11px] font-bold px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/60 transition disabled:opacity-50 cursor-pointer"
                                    title="Add 10 serial rows"
                                >
                                    +10
                                </button>
                            </>
                        )}

                        {filledCount > 0 && (
                            <button
                                type="button"
                                onClick={copyAllSerials}
                                className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-stone-50 hover:bg-stone-100 text-stone-600 border border-stone-200 transition cursor-pointer"
                            >
                                {copiedAll ? (
                                    <>
                                        <Check size={13} className="text-emerald-600" />
                                        <span className="text-emerald-600 font-bold">Copied All!</span>
                                    </>
                                ) : (
                                    <>
                                        <Copy size={13} />
                                        <span>Copy All ({filledCount})</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
                {panelLoadError && (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-800">
                        {panelLoadError === 'missing'
                            ? 'Panel loading has not been set up yet. The serials are still available, but they cannot be ticked yet.'
                            : 'Connection lost while loading panel status. The serials are still available; reconnect and try again.'}
                        {panelLoadError === 'connection' && (
                            <button type="button" onClick={() => setPanelRetryKey(value => value + 1)}
                                className="ml-2 rounded-md bg-white px-2 py-1 font-bold text-amber-900 hover:bg-amber-100">
                                Retry
                            </button>
                        )}
                    </p>
                )}

                {/* Bulk Paste Box */}
                {canEditPanels && showBulkPaste && (
                    <div className="p-3.5 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-2 animate-in fade-in duration-200">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">
                                Quick Paste (one per line, comma or space separated)
                            </label>
                            <span className="text-[10px] text-stone-500">Supports Excel / WhatsApp lists</span>
                        </div>
                        <textarea
                            rows={4}
                            value={bulkText}
                            onChange={(e) => setBulkText(e.target.value)}
                            placeholder="Paste 20+ panel serial numbers here...&#10;e.g.&#10;SN100234&#10;SN100235&#10;SN100236"
                            className="w-full bg-white border border-amber-200 rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-amber-400 placeholder:text-stone-400"
                        />
                        <div className="flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => { setBulkText(''); setShowBulkPaste(false); }}
                                className="px-3 py-1 text-[11px] font-semibold text-stone-600 hover:text-stone-800 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleBulkPasteApply}
                                className="px-3.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition cursor-pointer"
                            >
                                Apply Numbers
                            </button>
                        </div>
                    </div>
                )}

                {/* Content Section: Simple, clean 1, 2, 3 indexing */}
                {canEditPanels ? (
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-[460px] overflow-y-auto pr-1">
                            {panelSerials.map((serial, idx) => (
                                <div 
                                    key={idx} 
                                    className="flex items-center bg-stone-50/80 hover:bg-stone-50 border border-stone-200/80 rounded-xl p-1.5 focus-within:border-amber-400 focus-within:bg-white transition"
                                >
                                    <span className="w-6 text-center text-xs font-bold text-stone-600 bg-stone-200/60 rounded-md py-1 mr-1.5 flex-shrink-0">
                                        {idx + 1}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <input
                                            type="text"
                                            value={serial}
                                            onChange={(e) => handlePanelSerialChange(idx, e.target.value)}
                                            className="w-full bg-transparent text-xs font-mono font-semibold text-stone-800 focus:outline-none placeholder:text-stone-300"
                                            placeholder={`Serial ${idx + 1}`}
                                        />
                                        {panelLoadBySerial[serial.trim()]?.loaded && (
                                            <p className="text-[9px] font-semibold text-emerald-700">{panelLoadBySerial[serial.trim()].loaded_at ? `Loaded ${panelLoadedDate(panelLoadBySerial[serial.trim()].loaded_at)}` : 'Loaded earlier'}</p>
                                        )}
                                    </div>
                                    {serial && (
                                        <button
                                            type="button"
                                            onClick={() => copySingleSerial(serial, idx)}
                                            className="p-1 text-stone-400 hover:text-stone-700 rounded transition cursor-pointer"
                                            title="Copy Serial"
                                        >
                                            {copiedIdx === idx ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        </button>
                                    )}
                                    {panelSerials.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removePanelSerial(idx)}
                                            className="text-stone-400 hover:text-red-500 p-1 rounded transition flex-shrink-0 cursor-pointer"
                                            title="Delete serial"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-stone-400 font-medium">
                            <span>Showing {panelSerials.length} rows ({filledCount} filled)</span>
                            <button
                                type="button"
                                onClick={() => addPanelSerial(1)}
                                className="text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 cursor-pointer"
                            >
                                <Plus size={12} /> Add row
                            </button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {filledCount === 0 ? (
                            <div className="text-center py-6 border border-dashed border-stone-200 rounded-xl bg-stone-50/50">
                                <p className="text-xs text-stone-400 italic">No panel serial numbers entered yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[460px] overflow-y-auto pr-1">
                                {panelSerials.filter(Boolean).map((serial, idx) => (
                                    <div 
                                        key={idx} 
                                        className="group flex min-h-12 items-center justify-between bg-stone-50 border border-stone-200/70 rounded-xl px-2.5 py-1 transition"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-stone-500 group-hover:text-amber-700 bg-stone-200/50 group-hover:bg-amber-100/60 w-6 text-center py-0.5 rounded">
                                                {idx + 1}
                                            </span>
                                            <span className="min-w-0">
                                                <span className="block truncate text-xs font-mono font-bold text-stone-700">{serial}</span>
                                                {panelLoadBySerial[serial.trim()]?.loaded && (
                                                    <span className="block text-[9px] font-semibold text-emerald-700">{panelLoadBySerial[serial.trim()].loaded_at ? `Loaded ${panelLoadedDate(panelLoadBySerial[serial.trim()].loaded_at)}` : 'Loaded earlier'}</span>
                                                )}
                                            </span>
                                        </div>
                                        {loadingMode ? (
                                            <TickBox label={`Panel ${serial.trim()} loaded`} checked={panelLoadBySerial[serial.trim()]?.loaded === true}
                                                disabled={!canTogglePanels} onToggle={() => togglePanelLoaded(serial)} />
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                {panelLoadReady && panelLoadBySerial[serial.trim()]?.loaded && (
                                                    <Check size={14} strokeWidth={3} className="text-emerald-600" aria-label="Loaded" />
                                                )}
                                                <button type="button" onClick={() => copySingleSerial(serial, idx)}
                                                    aria-label={`Copy serial ${serial}`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-stone-500 hover:bg-amber-50 hover:text-amber-700">
                                                    {copiedIdx === idx ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </section>

            {/* 5. Procurement & Loading Milestones (Own Edit Pencil) */}
            <section id="section-procurement_milestones" className="pt-1.5 border-t border-stone-100">
                <SectionHeader 
                    title="Procurement & Loading Milestones" 
                    id="procurement_milestones" 
                    icon={Clock} 
                    isEditable={isEditable && !loadingMode}
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />

                {isEditingMilestones ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared By <span className="text-red-500">*</span></label>
                            <select
                                value={paperPreparedBy}
                                onChange={(e) => { setPaperPreparedBy(e.target.value); markBomDirty(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <option value="">Select User...</option>
                                {/* Keep an already-saved name selectable even if it is no
                                    longer in the Integration Staff list, otherwise opening
                                    an older record silently blanks the field. */}
                                {paperPreparedBy && !integrationByOptions.includes(paperPreparedBy) && (
                                    <option value={paperPreparedBy}>{paperPreparedBy} (not in list)</option>
                                )}
                                {integrationByOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            {integrationByOptions.length === 0 && (
                                <p className="text-[9px] text-amber-700 font-semibold mt-1">
                                    No Integration Staff registered - add them in Operations → Integration Staff.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={paperPreparedDate}
                                onChange={(e) => { setPaperPreparedDate(e.target.value); markBomDirty(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded By <span className="text-red-500">*</span></label>
                            <select
                                value={materialLoadedBy}
                                onChange={(e) => { setMaterialLoadedBy(e.target.value); markBomDirty(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50 cursor-pointer disabled:cursor-not-allowed"
                            >
                                <option value="">Select User...</option>
                                {/* Keep an already-saved name selectable even if it is no
                                    longer in the Integration Staff list, otherwise opening
                                    an older record silently blanks the field. */}
                                {materialLoadedBy && !integrationByOptions.includes(materialLoadedBy) && (
                                    <option value={materialLoadedBy}>{materialLoadedBy} (not in list)</option>
                                )}
                                {integrationByOptions.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                            {integrationByOptions.length === 0 && (
                                <p className="text-[9px] text-amber-700 font-semibold mt-1">
                                    No Integration Staff registered - add them in Operations → Integration Staff.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={materialLoadedDate}
                                onChange={(e) => { setMaterialLoadedDate(e.target.value); markBomDirty(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-50/70 p-2.5 rounded-xl border border-stone-200/60">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared By <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{loadingBom ? <span className="inline-block w-16 h-3 bg-stone-200 rounded animate-pulse align-middle" /> : (paperPreparedBy || "–")}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared Date <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{loadingBom ? <span className="inline-block w-16 h-3 bg-stone-200 rounded animate-pulse align-middle" /> : (paperPreparedDate || "–")}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded By <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{loadingBom ? <span className="inline-block w-16 h-3 bg-stone-200 rounded animate-pulse align-middle" /> : (materialLoadedBy || "–")}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded Date <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{loadingBom ? <span className="inline-block w-16 h-3 bg-stone-200 rounded animate-pulse align-middle" /> : (materialLoadedDate || "–")}</p>
                        </div>
                    </div>
                )}
            </section>

            {/* 4. Bill of Materials (BOM) Items (Own Edit Pencil) */}
            <section id="section-bom_items" className="pt-1.5 border-t border-stone-100">
                <SectionHeader 
                    title={`Bill of Materials (${activeType})`} 
                    id="bom_items" 
                    icon={ClipboardList} 
                    isEditable={isEditable && !loadingMode}
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />

                {!loadingBom && !isEditingBom && <LoadedProgress editable={canTick} />}
                {isEditingBom ? (
                    <div className="overflow-x-auto border border-stone-200 rounded-xl bg-white shadow-xs">
                        <table className="min-w-full divide-y divide-stone-200 text-xs">
                            <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-bold text-[9px]">
                                <tr>
                                    <th className="px-3 py-2 text-left w-10">#</th>
                                    <th className="px-3 py-2 text-left">Product Name</th>
                                    <th className="px-3 py-2 text-left w-24">Qty</th>
                                    <th className="px-3 py-2 text-left w-20">UOM</th>
                                    <th className="px-3 py-2 text-left w-44">Integration By</th>
                                    <th className="px-3 py-2 text-left">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-200 bg-white font-medium text-stone-700">
                                {bomItems.map((item, idx) => (
                                    <tr
                                        key={item.id || `${item.product_name}-${idx}`}
                                        className="hover:bg-stone-50/40"
                                    >
                                        <td className="px-3 py-2 text-stone-400 font-bold">
                                            {idx + 1}
                                        </td>

                                        <td className="px-3 py-2 font-semibold text-stone-800">
                                            {item.product_name || ''}
                                        </td>

                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                value={item.quantity || ''}
                                                onChange={(e) =>
                                                    handleItemFieldChange(
                                                        idx,
                                                        'quantity',
                                                        e.target.value
                                                    )
                                                }
                                                className="w-20 bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-800"
                                                placeholder="Qty..."
                                            />
                                        </td>

                                        <td className="px-3 py-2 text-stone-500 font-semibold">
                                            {item.uom || ''}
                                        </td>

                                        <td className="px-3 py-2">
                                            <select
                                                value={item.integration_by || ''}
                                                onChange={(e) =>
                                                    handleItemFieldChange(
                                                        idx,
                                                        'integration_by',
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 font-medium text-stone-800"
                                            >
                                                <option value="">
                                                    Select User...
                                                </option>

                                                {integrationByOptions.map((opt) => (
                                                    <option key={opt} value={opt}>
                                                        {opt}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className="px-3 py-2">
                                            <input
                                                type="text"
                                                value={item.note || ''}
                                                onChange={(e) =>
                                                    handleItemFieldChange(
                                                        idx,
                                                        'note',
                                                        e.target.value
                                                    )
                                                }
                                                className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300"
                                                placeholder="Notes..."
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-stone-200/80 rounded-xl">
                        <table className="min-w-full divide-y divide-stone-200 text-xs">
                            <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-bold text-[9px]">
                                <tr>
                                    {loadingMode && <th className="px-3 py-2 text-center w-16">Loaded</th>}
                                    <th className="px-3 py-2 text-left w-12">#</th>
                                    <th className="px-3 py-2 text-left">Product Name</th>
                                    <th className="px-3 py-2 text-left w-24">Qty</th>
                                    <th className="px-3 py-2 text-left w-20">UOM</th>
                                    <th className="px-3 py-2 text-left w-44">Integration By</th>
                                    <th className="px-3 py-2 text-left">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-150 bg-white text-stone-700">
                                {loadingBom && bomItems.length === 0 && [0, 1, 2, 3].map(row => (
                                    <tr key={`loading-${row}`}>
                                        <td colSpan={loadingMode ? 7 : 6} className="px-3 py-2.5">
                                            <span className="block h-3 w-full animate-pulse rounded bg-stone-100" />
                                        </td>
                                    </tr>
                                ))}
                                {bomItems.map((item, idx) => (
                                    <tr
                                        key={item.id || `${item.product_name}-${idx}`}
                                        className={isItemLoaded(item) ? 'bg-emerald-50/50' : 'hover:bg-stone-50/50'}
                                    >
                                        {loadingMode && (
                                        <td className="px-3 py-1 text-center">
                                            {isSolarPanelItem(item) ? (
                                                <span className="inline-flex min-w-11 justify-center rounded-md bg-stone-100 px-1 py-1 text-[10px] font-bold text-stone-700"
                                                    title="Tick each panel serial number above">
                                                    {panelLoadReady ? `${panelLoadedCount}/${filledPanelSerials.length}` : '—'}
                                                </span>
                                            ) : item.product_name ? (
                                                <TickBox label={`${item.product_name} loaded`} checked={item.loaded === true}
                                                    disabled={!canTick || tickBusy} onToggle={() => saveLoaded([item], !item.loaded)} />
                                            ) : null}
                                        </td>
                                        )}
                                        <td className="px-3 py-2 text-stone-400 font-bold">
                                            {idx + 1}
                                        </td>

                                        <td className="px-3 py-2 font-semibold text-stone-800">
                                            <span className="inline-flex items-center gap-1.5">
                                                {!loadingMode && isItemLoaded(item) && <Check size={13} strokeWidth={3} className="shrink-0 text-emerald-600" aria-label="Loaded" />}
                                                {item.product_name || '–'}
                                            </span>
                                        </td>

                                        <td className="px-3 py-2 text-stone-700 font-semibold">
                                            {item.quantity || '–'}
                                        </td>

                                        <td className="px-3 py-2 text-stone-500 font-semibold">
                                            {item.uom || '–'}
                                        </td>

                                        <td className="px-3 py-2">
                                            {item.integration_by ? (
                                                <span className="px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-lg text-[10px] border border-amber-200/60">
                                                    {item.integration_by}
                                                </span>
                                            ) : (
                                                <span className="text-stone-400 italic text-[11px]">
                                                    –
                                                </span>
                                            )}
                                        </td>

                                        <td className="px-3 py-2 text-stone-600">
                                            {item.note || '–'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Dedicated Print & PDF Modal */}
            {showPrintModal && (
                <BomPrintModal
                    customer={{ ...customer, ...editData }}
                    /* The four milestones live in their own state, and `bom` is
                       only refreshed on load/insert - never after an update. So
                       printing showed stale or blank values for Paper Prepared
                       By / Material Loaded By and their dates. Overlay the live
                       values so the printout matches what is on screen. */
                    bom={{
                        ...(bom || {}),
                        paper_prepared_by: paperPreparedBy,
                        paper_prepared_date: paperPreparedDate,
                        material_loaded_by: materialLoadedBy,
                        material_loaded_date: materialLoadedDate,
                    }}
                    bomItems={bomItems}
                    activeType={activeType}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}
