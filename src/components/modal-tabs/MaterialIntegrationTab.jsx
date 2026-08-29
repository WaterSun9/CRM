import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Save, Printer, ShoppingBag, User, Clock, AlertCircle, X, Layers, Zap, Copy, Check, ClipboardPaste, Plus, Trash2 } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';
import BomPrintModal from '../BomPrintModal';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE, COMMON_BOM_ITEMS } from '../../constants';
import { loadBomForCustomer, getBomTemplateForType } from '../../utils/bom';
import { toIndianCommas } from '../../utils';

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
    } catch (e) { /* not valid JSON, fall through to default */ }

    if (rawText.includes('\n')) {
        return rawText.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (rawText.includes(',')) {
        return rawText.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [rawText.trim()];
};

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
    onDirty
}) {
    const [bom, setBom] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [paperPreparedBy, setPaperPreparedBy] = useState('');
    const [paperPreparedDate, setPaperPreparedDate] = useState('');
    const [materialLoadedBy, setMaterialLoadedBy] = useState('');
    const [materialLoadedDate, setMaterialLoadedDate] = useState('');
    const [actionSaving, setActionSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState(null);

    const [panelSerials, setPanelSerials] = useState(() => parsePanelSerials(customer?.panel_serial_no || editData?.panel_serial_no));
    const [showBulkPaste, setShowBulkPaste] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [copiedAll, setCopiedAll] = useState(false);

    const inverterMakeOptions = (meta?.['inverter_make'] && meta['inverter_make'].length > 0)
        ? meta['inverter_make']
        : ['test1', 'test2', 'test3'];

    useEffect(() => {
        setPanelSerials(parsePanelSerials(customer?.panel_serial_no || editData?.panel_serial_no));
    }, [customer?.panel_serial_no]);

    const handlePanelSerialChange = (idx, val) => {
        onDirty?.();
        const next = [...panelSerials];
        next[idx] = val;
        setPanelSerials(next);
        const filtered = next.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const addPanelSerial = (count = 1) => {
        onDirty?.();
        if (panelSerials.length >= 100) return;
        const toAdd = Math.min(count, 100 - panelSerials.length);
        const newItems = Array(toAdd).fill('');
        setPanelSerials(prev => [...prev, ...newItems]);
    };

    const removePanelSerial = (idx) => {
        onDirty?.();
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
        const filtered = finalVal.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const handleBulkPasteApply = () => {
        onDirty?.();
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
    const originalSerialized = (parsePanelSerials(customer?.panel_serial_no) || []).filter(Boolean).join('\n');
    const currentSerialized = panelSerials.filter(Boolean).join('\n');
    const isSerialsDirty = originalSerialized !== currentSerialized;

    const [showPrintModal, setShowPrintModal] = useState(false);

    // Integration By dropdown options
    const integrationByOptions = (meta['integration_by'] && meta['integration_by'].length > 0)
        ? meta['integration_by']
        : ['testuser 1', 'testuser 2', 'testuser 3', 'testuser 4', 'testuser 5'];

    // Automatically determine Roof vs Shed from Material Order specification
    const roofShedVal = (editData?.roof_shed || customer?.roof_shed || '').toUpperCase();
    const activeType = roofShedVal.includes('SHED') ? 'SHED' : 'ROOF';

    const getTemplateForType = getBomTemplateForType;

    const loadBOM = async () => {
        if (!customer?.id) return;
        try {
            const { bom: bomData, items } = await loadBomForCustomer({ ...customer, ...editData }, activeType);
            setPaperPreparedBy(bomData?.paper_prepared_by || '');
            setPaperPreparedDate(bomData?.paper_prepared_date || '');
            setMaterialLoadedBy(bomData?.material_loaded_by || '');
            setMaterialLoadedDate(bomData?.material_loaded_date || '');
            setBom(bomData);
            setBomItems(items);
        } catch (err) {
            console.error('loadBOM exception:', err);
        }
    };

    useEffect(() => {
        loadBOM();
    }, [customer?.id, editData?.roof_shed, customer?.roof_shed]);

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
        onDirty?.();
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
            } catch (e) { /* best-effort, ignore failure */ }
            return next;
        });
    };

    // Save BOM and Milestones together
    const saveBOM = async () => {
        const state = latestStateRef.current;
        const targetCust = state.customer || customer;
        if (!targetCust?.id) return true;

        setActionSaving(true);
        let hadWriteError = false;

        try {
            const currentType = state.activeType || activeType;
            const prepBy = state.paperPreparedBy || null;
            const prepDate = state.paperPreparedDate || null;
            const loadBy = state.materialLoadedBy || null;
            const loadDate = state.materialLoadedDate || null;
            let currentBomId = state.bom?.id;
            const items = state.bomItems || [];

            // 1. Check if a bom record exists for this customer if we don't have an ID
            if (!currentBomId) {
                const { data: existing } = await supabase
                    .from('bom')
                    .select('id')
                    .eq('admin_id', targetCust.id)
                    .maybeSingle();

                if (existing?.id) {
                    currentBomId = existing.id;
                }
            }

            // 2. Update or Insert the parent bom record
            if (currentBomId) {
                const { error: updateErr } = await supabase
                    .from('bom')
                    .update({
                        bom_type: currentType,
                        paper_prepared_by: prepBy,
                        paper_prepared_date: prepDate,
                        material_loaded_by: loadBy,
                        material_loaded_date: loadDate
                    })
                    .eq('id', currentBomId);

                if (updateErr) { console.warn('Supabase bom update error:', updateErr); hadWriteError = true; }

            } else {
                const { data: created, error: createErr } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: targetCust.id,
                        bom_type: currentType,
                        paper_prepared_by: prepBy,
                        paper_prepared_date: prepDate,
                        material_loaded_by: loadBy,
                        material_loaded_date: loadDate
                    })
                    .select()
                    .single();

                if (created?.id) {
                    currentBomId = created.id;
                    setBom(created);
                } else if (createErr) {
                    console.warn('Supabase bom create error:', createErr);
                    hadWriteError = true;
                }
            }

            // 3. Persist bom_items rows
            if (currentBomId) {
                const { error: delErr } = await supabase
                    .from('bom_items')
                    .delete()
                    .eq('bom_id', currentBomId);

                if (delErr) { console.warn('bom_items delete error:', delErr); hadWriteError = true; }

                const validItems = items.filter(item => item.product_name && item.product_name.trim() !== '');

                if (validItems.length > 0) {
                    const rowsToInsert = validItems.map((item) => ({
                        bom_id: currentBomId,
                        product_name: item.product_name,
                        quantity: item.quantity !== undefined && item.quantity !== null ? String(item.quantity) : '',
                        integration_by: item.integration_by || null,
                        note: item.note || null
                    }));

                    const { error: insertErr } = await supabase
                        .from('bom_items')
                        .insert(rowsToInsert);

                    if (insertErr) { console.warn('bom_items insert error:', insertErr); hadWriteError = true; }
                }
            }

            // 4. Save to localStorage backup
            try {
                const localBomData = {
                    bom: {
                        id: currentBomId || `bom-${targetCust.id}`,
                        admin_id: targetCust.id,
                        bom_type: currentType,
                        paper_prepared_by: prepBy,
                        paper_prepared_date: prepDate,
                        material_loaded_by: loadBy,
                        material_loaded_date: loadDate
                    },
                    items: items
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

            return !hadWriteError;

        } catch (err) {
            console.error('saveBOM exception:', err);
            return false;
        } finally {
            setActionSaving(false);
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

    return (
        <div className="space-y-3.5 animate-in fade-in duration-300">
            {/* Top Toolbar / Action Bar */}
            <div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Material Integration & BOM</h4>
                    <p className="text-[11px] text-stone-500 font-medium">BOM configuration, loading milestones and equipment checklist.</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {activeType} BOM
                    </span>
                    {bom && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            Saved
                        </span>
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
                    isEditable={isEditable} 
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
                            </h4>
                        </div>
                    </div>

                    {/* Action buttons on top right */}
                    <div className="flex items-center gap-1.5">
                        {isEditable && (
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

                {/* Bulk Paste Box */}
                {isEditable && showBulkPaste && (
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
                {isEditable ? (
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
                                    <input
                                        type="text"
                                        value={serial}
                                        onChange={(e) => handlePanelSerialChange(idx, e.target.value)}
                                        className="flex-1 bg-transparent text-xs font-mono font-semibold text-stone-800 focus:outline-none placeholder:text-stone-300 min-w-0"
                                        placeholder={`Serial ${idx + 1}`}
                                    />
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
                                        onClick={() => copySingleSerial(serial, idx)}
                                        className="group flex items-center justify-between bg-stone-50 hover:bg-amber-50/60 border border-stone-200/70 hover:border-amber-300/80 rounded-xl px-2.5 py-1.5 transition cursor-pointer"
                                        title="Click to copy serial"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-stone-500 group-hover:text-amber-700 bg-stone-200/50 group-hover:bg-amber-100/60 w-6 text-center py-0.5 rounded">
                                                {idx + 1}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-stone-700 group-hover:text-stone-900 truncate">
                                                {serial}
                                            </span>
                                        </div>
                                        <div className="text-stone-300 group-hover:text-amber-600 transition flex-shrink-0 ml-1">
                                            {copiedIdx === idx ? (
                                                <Check size={12} className="text-emerald-600" />
                                            ) : (
                                                <Copy size={11} className="opacity-0 group-hover:opacity-100 transition" />
                                            )}
                                        </div>
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
                    isEditable={isEditable} 
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />

                {isEditingMilestones ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared By <span className="text-red-500">*</span></label>
                            <select
                                value={paperPreparedBy}
                                onChange={(e) => { setPaperPreparedBy(e.target.value); onDirty?.(); }}
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
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={paperPreparedDate}
                                onChange={(e) => { setPaperPreparedDate(e.target.value); onDirty?.(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded By <span className="text-red-500">*</span></label>
                            <select
                                value={materialLoadedBy}
                                onChange={(e) => { setMaterialLoadedBy(e.target.value); onDirty?.(); }}
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
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded Date <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                value={materialLoadedDate}
                                onChange={(e) => { setMaterialLoadedDate(e.target.value); onDirty?.(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-50/70 p-2.5 rounded-xl border border-stone-200/60">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared By <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{paperPreparedBy || "–"}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared Date <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{paperPreparedDate || "–"}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded By <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{materialLoadedBy || "–"}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded Date <span className="text-red-500">*</span></label>
                            <p className="text-xs font-bold text-stone-700">{materialLoadedDate || "–"}</p>
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
                    isEditable={isEditable} 
                    editingSection={editingSection} 
                    setEditingSection={setEditingSection} 
                />

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
                                    <th className="px-3 py-2 text-left w-12">#</th>
                                    <th className="px-3 py-2 text-left">Product Name</th>
                                    <th className="px-3 py-2 text-left w-24">Qty</th>
                                    <th className="px-3 py-2 text-left w-20">UOM</th>
                                    <th className="px-3 py-2 text-left w-44">Integration By</th>
                                    <th className="px-3 py-2 text-left">Note</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-150 bg-white text-stone-700">
                                {bomItems.map((item, idx) => (
                                    <tr
                                        key={item.id || `${item.product_name}-${idx}`}
                                        className="hover:bg-stone-50/50"
                                    >
                                        <td className="px-3 py-2 text-stone-400 font-bold">
                                            {idx + 1}
                                        </td>

                                        <td className="px-3 py-2 font-semibold text-stone-800">
                                            {item.product_name || '–'}
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
                    bom={bom}
                    bomItems={bomItems}
                    activeType={activeType}
                    onClose={() => setShowPrintModal(false)}
                />
            )}
        </div>
    );
}

