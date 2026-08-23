import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Save, Printer, ShoppingBag, User, Clock } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE, COMMON_BOM_ITEMS } from '../../constants';
import { toIndianCommas } from '../../utils';

export default function MaterialIntegrationTab({
    customer,
    editData,
    setEditData,
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

    const handleFillMilestones = async () => {
        const today = new Date().toISOString().split('T')[0];
        setPaperPreparedBy('Ramesh Sharma');
        setPaperPreparedDate(today);
        setMaterialLoadedBy('Suresh Patel');
        setMaterialLoadedDate(today);
        onDirty?.();

        setActionSaving(true);
        try {
            let currentBomId = bom?.id;
            if (currentBomId) {
                const { error } = await supabase
                    .from('bom')
                    .update({
                        bom_type: activeType,
                        paper_prepared_by: 'Ramesh Sharma',
                        paper_prepared_date: today,
                        material_loaded_by: 'Suresh Patel',
                        material_loaded_date: today
                    })
                    .eq('id', currentBomId);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: customer.id,
                        bom_type: activeType,
                        paper_prepared_by: 'Ramesh Sharma',
                        paper_prepared_date: today,
                        material_loaded_by: 'Suresh Patel',
                        material_loaded_date: today
                    })
                    .select()
                    .single();
                if (error) throw error;
                setBom(data);
            }
            if (logActivity && user?.id) {
                await logActivity(
                    user.id,
                    'update',
                    `Auto-filled procurement milestones for ${customer.customer_name}`,
                    '',
                    customer.id
                );
            }
            await loadBOM();
        } catch (err) {
            console.error('handleFillMilestones error:', err);
        } finally {
            setActionSaving(false);
        }
    };
    const [showPrintModal, setShowPrintModal] = useState(false);
    const printableBomRef = useRef(null);

    // Integration By dropdown options
    const integrationByOptions = (meta['integration_by'] && meta['integration_by'].length > 0)
        ? meta['integration_by']
        : ['testuser 1', 'testuser 2', 'testuser 3', 'testuser 4', 'testuser 5'];

    // Automatically determine Roof vs Shed from Material Order specification
    const roofShedVal = (editData?.roof_shed || customer?.roof_shed || '').toUpperCase();
    const activeType = roofShedVal.includes('SHED') ? 'SHED' : 'ROOF';

    // Helper to get active template
    const getTemplateForType = (type) => {
        if (type === 'SHED') return SHED_BOM_TEMPLATE;
        return ROOF_BOM_TEMPLATE;
    };

    const loadBOM = async () => {
        if (!customer?.id) return;

        try {
            const { data: bomData, error: bomError } = await supabase
                .from('bom')
                .select('*')
                .eq('admin_id', customer.id)
                .maybeSingle();

            if (bomError) throw bomError;

            if (!bomData) {
                setBom(null);
                setPaperPreparedBy('');
                setPaperPreparedDate('');
                setMaterialLoadedBy('');
                setMaterialLoadedDate('');

                const template = getTemplateForType(activeType);
                setBomItems(template.map(item => ({
                    ...item,
                    integration_by: '',
                    note: ''
                })));
                return;
            }

            setPaperPreparedBy(bomData.paper_prepared_by || '');
            setPaperPreparedDate(bomData.paper_prepared_date || '');
            setMaterialLoadedBy(bomData.material_loaded_by || '');
            setMaterialLoadedDate(bomData.material_loaded_date || '');

            const { data: itemData, error: itemError } = await supabase
                .from('bom_items')
                .select('*')
                .eq('bom_id', bomData.id)
                .order('created_at', { ascending: true });

            if (itemError) throw itemError;

            const template = getTemplateForType(activeType);
            const savedItems = itemData || [];

            const mergedItems = template.map(templateItem => {
                const savedItem = savedItems.find(
                    dbItem => dbItem.product_name === templateItem.product_name ||
                        (templateItem.product_name === 'Solar Panel' && (dbItem.product_name === 'SOLAR PV MODULES' || dbItem.product_name === 'Solar Panel')) ||
                        (templateItem.product_name === 'Inverter' && (dbItem.product_name === 'GRID TIED INVERTER' || dbItem.product_name === 'Inverter'))
                );

                return {
                    ...templateItem,
                    id: savedItem?.id || null,
                    integration_by: savedItem?.integration_by || '',
                    note: savedItem?.note || '',
                    quantity:
                        savedItem?.quantity !== null &&
                        savedItem?.quantity !== undefined &&
                        savedItem?.quantity !== ''
                            ? savedItem.quantity
                            : templateItem.quantity,
                };
            });

            setBom(bomData);
            setBomItems(mergedItems);

        } catch (err) {
            console.error('loadBOM exception:', err);
        }
    };

    useEffect(() => {
        loadBOM();
    }, [customer?.id, editData?.roof_shed, customer?.roof_shed]);

    const handleItemFieldChange = (index, field, value) => {
        onDirty?.();
        setBomItems(prev =>
            prev.map((item, i) => {
                if (i !== index) return item;

                if (
                    field === 'quantity' &&
                    !item.quantity_editable
                ) {
                    return item;
                }

                return {
                    ...item,
                    [field]: value,
                };
            })
        );
    };

    // Save only Milestones
    const saveMilestones = async () => {
        if (!customer?.id) return;
        setActionSaving(true);
        try {
            if (bom?.id) {
                const { error } = await supabase
                    .from('bom')
                    .update({
                        bom_type: activeType,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .eq('id', bom.id);

                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: customer.id,
                        bom_type: activeType,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .select()
                    .single();

                if (error) throw error;
                setBom(data);
            }

            if (logActivity && user?.id) {
                await logActivity(
                    user.id,
                    'update',
                    `Updated procurement milestones for ${customer.customer_name}`,
                    '',
                    customer.id
                );
            }

            await loadBOM();
            setEditingSection(null);
            setErrorMessage(null);
        } catch (err) {
            console.error('saveMilestones exception:', err);
            setErrorMessage('Failed to save milestones: ' + err.message);
        } finally {
            setActionSaving(false);
        }
    };

    // Save BOM Items table
    const saveBOM = async () => {
        if (!customer?.id) return;

        setActionSaving(true);

        try {
            let currentBomId = bom?.id;

            if (currentBomId) {
                const { error } = await supabase
                    .from('bom')
                    .update({
                        bom_type: activeType,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .eq('id', currentBomId);

                if (error) throw error;

            } else {
                const { data, error } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: customer.id,
                        bom_type: activeType,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .select()
                    .single();

                if (error) throw error;

                currentBomId = data.id;
                setBom(data);
            }

            const { error: deleteError } = await supabase
                .from('bom_items')
                .delete()
                .eq('bom_id', currentBomId);

            if (deleteError) throw deleteError;

            // Filter out empty rows
            const validItems = bomItems.filter(item => item.item_name && item.item_name.trim() !== '');

            if (validItems.length > 0) {
                const rowsToInsert = validItems.map((item, index) => ({
                    bom_id: currentBomId,
                    item_name: item.item_name,
                    specification: item.specification || null,
                    rating: item.rating || null,
                    quantity: Number(item.quantity) || 1,
                    unit: item.unit || 'Nos',
                    remark: item.remark || null,
                    item_order: index + 1
                }));

                const { error: insertError } = await supabase
                    .from('bom_items')
                    .insert(rowsToInsert);

                if (insertError) throw insertError;
            }

            if (logActivity && user?.id) {
                await logActivity(
                    user.id,
                    'update',
                    `Saved BOM items for ${customer.customer_name}`,
                    '',
                    customer.id
                );
            }

            await loadBOM();
            setEditingSection(null);
            setErrorMessage(null);
            return true;

        } catch (err) {
            console.error('saveBOM exception:', err);
            setErrorMessage('Failed to save BOM items: ' + err.message);
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
    // Keep the parent stage action connected to the latest local milestone and
    // BOM values, rather than the values present when this tab first mounted.
    }, [saveBomRef, bom, bomItems, paperPreparedBy, paperPreparedDate, materialLoadedBy, materialLoadedDate, activeType]);

    const handlePrint = () => {
        const documentBody = printableBomRef.current;
        if (!documentBody) return;

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(element => element.outerHTML)
            .join('');
        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('aria-hidden', 'true');
        printFrame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;';
        const removeFrame = () => setTimeout(() => printFrame.remove(), 250);
        printFrame.onload = () => {
            const printWindow = printFrame.contentWindow;
            if (!printWindow) return removeFrame();
            printWindow.onafterprint = removeFrame;
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 100);
        };
        printFrame.srcdoc = `<!doctype html><html><head><title>BOM — ${customer?.customer_name || 'Customer'}</title>${styles}<style>@page { size: A4 portrait; margin: 12mm; } body { margin: 0; color: #1c1917; background: #fff; } #printable-bom { position: static !important; width: auto !important; border: 1px solid #a8a29e; padding: 12mm !important; overflow: visible !important; }</style></head><body><main id="printable-bom">${documentBody.innerHTML}</main></body></html>`;
        document.body.appendChild(printFrame);
    };

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

            {/* 2. Customer Lead Details (View-Only Reference - Exactly matching Material Order tab) */}
            <section id="section-lead_details" className="pt-1.5 border-t border-stone-100">
                <div className="flex items-center justify-between mb-2 border-b border-stone-100 pb-1">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <User size={12} className="text-amber-500" /> Customer Lead Details (Reference)
                    </h3>
                    <span className="text-[9px] font-semibold text-stone-400 uppercase">View Only</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    <EditableDetailItem label="Customer Name" field="customer_name" value={customer?.customer_name || editData?.customer_name} isEditing={false} />
                    <EditableDetailItem label="Phone Number" field="phone_number" value={customer?.phone_number || editData?.phone_number} isEditing={false} />
                    <EditableDetailItem label="Email Address" field="email" value={customer?.email_address || customer?.email || editData?.email_address || editData?.email} isEditing={false} />
                    <EditableDetailItem label="Consumer No" field="consumer_no" value={customer?.consumer_no || editData?.consumer_no} isEditing={false} />
                    <EditableDetailItem label="Villages" field="villages" value={customer?.villages || editData?.villages} isEditing={false} />
                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={customer?.sub_divisions || editData?.sub_divisions} isEditing={false} />
                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={customer?.channel_partner || editData?.channel_partner} isEditing={false} />
                    <EditableDetailItem label="Sub Channel Partner Name" field="sub_channel_partner" value={customer?.sub_channel_partner || editData?.sub_channel_partner} isEditing={false} />
                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={customer?.module_brand || editData?.module_brand} isEditing={false} />
                    <EditableDetailItem label="MODULE WP" field="module_wp" value={customer?.module_wp || editData?.module_wp} isEditing={false} />
                    <EditableDetailItem label="No of Modules" field="no_of_modules" value={customer?.no_of_modules || editData?.no_of_modules} isEditing={false} />
                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={customer?.system_capacity_kwp || editData?.system_capacity_kwp} isEditing={false} />
                </div>
            </section>

            {/* 3. Procurement & Loading Milestones (Own Edit Pencil) */}
            <section id="section-procurement_milestones" className="pt-1.5 border-t border-stone-100">
                <div className="flex justify-between items-center">
                    <div className="flex-1">
                        <SectionHeader 
                            title="Procurement & Loading Milestones" 
                            id="procurement_milestones" 
                            icon={Clock} 
                            isEditable={isEditable} 
                            editingSection={editingSection} 
                            setEditingSection={setEditingSection} 
                        />
                    </div>
                </div>

                {isEditingMilestones ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-stone-50 p-2.5 rounded-xl border border-stone-200">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared By <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                placeholder="Prepared by name..."
                                value={paperPreparedBy}
                                onChange={(e) => { setPaperPreparedBy(e.target.value); onDirty?.(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
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
                            <input
                                type="text"
                                placeholder="Loaded by name..."
                                value={materialLoadedBy}
                                onChange={(e) => { setMaterialLoadedBy(e.target.value); onDirty?.(); }}
                                disabled={!isEditable}
                                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                            />
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
                    <div className="overflow-x-auto border border-stone-200 rounded-xl">
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
                            <tbody className="divide-y divide-stone-200 bg-white font-medium text-stone-700">
                                {bomItems.map((item, idx) => (
                                    <tr
                                        key={item.id || `${item.product_name}-${idx}`}
                                        className="hover:bg-stone-50/40"
                                    >
                                        <td className="px-3 py-2 text-stone-400 font-bold">
                                            {idx + 1}
                                        </td>

                                        <td className="px-3 py-2 font-semibold text-stone-700">
                                            {item.product_name || ''}
                                        </td>

                                        <td className="px-3 py-2">
                                            {item.quantity_editable ? (
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
                                                    className="w-20 bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 font-semibold"
                                                    placeholder="Qty..."
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-stone-700">
                                                    {item.quantity || '–'}
                                                </span>
                                            )}
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
                <div className="fixed inset-0 z-[999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Header bar */}
                        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={18} className="text-amber-400" />
                                <h3 className="text-sm font-black uppercase tracking-wider">Print Preview — Material Integration & BOM</h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrint}
                                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <Printer size={14} /> Print Document
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowPrintModal(false)}
                                    className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        {/* Printable Document Body */}
                        <div ref={printableBomRef} className="flex-1 overflow-y-auto p-8 bg-white text-stone-900 print-document" id="printable-bom">
                            {/* Company Header */}
                            <div className="border-b-2 border-stone-900 pb-4 mb-6 text-center">
                                <h1 className="text-xl font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-xs font-semibold text-stone-600 mt-0.5">Solar PV Project Integration & Material Loading Checklist</p>
                                <div className="inline-block mt-2 px-3 py-1 bg-stone-100 border border-stone-300 rounded text-[11px] font-black uppercase tracking-widest text-stone-800">
                                    BILL OF MATERIALS (BOM) — {activeType} TYPE
                                </div>
                            </div>

                            {/* Section: Customer & Site Details */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Reference</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Party Name:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.customer_name || customer?.customer_name || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Contact Number:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.phone_number || customer?.phone_number || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">System Capacity:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.system_capacity_kwp ? `${editData.system_capacity_kwp} kWp` : '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Dealer / Channel Partner:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.channel_partner || customer?.channel_partner || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">File / Folder No:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.folder_no || customer?.folder_no || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Registration Date:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.registration_date || customer?.registration_date || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: Material Order Specifications */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">2. Material Order Specifications</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Roof / Shed:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.roof_shed || customer?.roof_shed || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Structure Leg Height:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">
                                                {editData?.structure_front_leg_height || customer?.structure_front_leg_height
                                                    ? `Front: ${editData?.structure_front_leg_height || customer?.structure_front_leg_height} ft / Rear: ${editData?.structure_rear_leg_height || customer?.structure_rear_leg_height || '–'} ft`
                                                    : '–'}
                                            </td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">DC Cable Length:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.dc_cable ? `${editData.dc_cable} Meters` : '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">AC Cable Length:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.ac_cable ? `${editData.ac_cable} Meters` : '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Estimated Invoice Value:</td>
                                            <td colSpan={3} className="p-2 font-bold text-stone-900">{editData?.invoice_value ? `₹ ${toIndianCommas(editData.invoice_value)}` : '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: Procurement Milestones */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">3. Procurement & Loading Milestones</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Paper Prepared By:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{paperPreparedBy || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Paper Prepared Date:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{paperPreparedDate || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Material Loaded By:</td>
                                            <td className="p-2 font-bold text-stone-900">{materialLoadedBy || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Material Loaded Date:</td>
                                            <td className="p-2 font-bold text-stone-900">{materialLoadedDate || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: BOM Items Table */}
                            <div className="mb-8">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">4. BOM Equipment Checklist ({activeType})</h3>
                                <table className="w-full text-xs border-collapse border border-stone-400">
                                    <thead>
                                        <tr className="bg-stone-100 text-stone-900 uppercase font-black text-[10px]">
                                            <th className="border border-stone-400 p-2 text-center w-10">#</th>
                                            <th className="border border-stone-400 p-2 text-left">Product Name</th>
                                            <th className="border border-stone-400 p-2 text-center w-16">Qty</th>
                                            <th className="border border-stone-400 p-2 text-center w-16">UOM</th>
                                            <th className="border border-stone-400 p-2 text-left w-32">Integration By</th>
                                            <th className="border border-stone-400 p-2 text-left">Note / Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bomItems.map((item, idx) => (
                                            <tr key={idx} className="border-b border-stone-300">
                                                <td className="border border-stone-400 p-1.5 text-center font-bold">{idx + 1}</td>
                                                <td className="border border-stone-400 p-1.5 font-bold text-stone-900">{item.product_name || '–'}</td>
                                                <td className="border border-stone-400 p-1.5 text-center font-bold">{item.quantity || '–'}</td>
                                                <td className="border border-stone-400 p-1.5 text-center font-semibold">{item.uom || '–'}</td>
                                                <td className="border border-stone-400 p-1.5 font-medium">{item.integration_by || '–'}</td>
                                                <td className="border border-stone-400 p-1.5 text-stone-600">{item.note || '–'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Signatures Footer */}
                            <div className="grid grid-cols-3 gap-6 pt-10 text-center border-t border-stone-300 text-xs">
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5 font-bold text-stone-700">
                                        {paperPreparedBy ? `${paperPreparedBy}` : ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Prepared By</p>
                                </div>
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5 font-bold text-stone-700">
                                        {materialLoadedBy ? `${materialLoadedBy}` : ''}
                                    </div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Loaded By</p>
                                </div>
                                <div>
                                    <div className="border-b border-stone-400 pb-8 mb-1.5"></div>
                                    <p className="font-black uppercase text-[10px] text-stone-900">Authorized / Received By</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Print Specific CSS */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 6mm;
                    }
                    body * {
                        visibility: hidden;
                    }
                    #printable-bom, #printable-bom * {
                        visibility: visible;
                    }
                    #printable-bom {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 198mm;
                        box-sizing: border-box;
                        margin: 0;
                        padding: 0;
                        background: #ffffff !important;
                        color: #000000 !important;
                        font-size: 6.5pt;
                        line-height: 1.08;
                    }
                    #printable-bom .mb-6 { margin-bottom: 2.5mm !important; }
                    #printable-bom .mb-8 { margin-bottom: 2.5mm !important; }
                    #printable-bom .pb-4 { padding-bottom: 2mm !important; }
                    #printable-bom .pt-10 { padding-top: 4mm !important; }
                    #printable-bom h1 { font-size: 12pt !important; }
                    #printable-bom h3 { font-size: 7pt !important; margin-bottom: 1mm !important; }
                    #printable-bom p { line-height: 1.08 !important; }
                    #printable-bom table {
                        table-layout: fixed;
                        font-size: 6.5pt !important;
                        line-height: 1.05 !important;
                        break-inside: avoid;
                    }
                    #printable-bom th,
                    #printable-bom td {
                        padding: 1.25px 3px !important;
                        line-height: 1.05 !important;
                        vertical-align: middle;
                    }
                    #printable-bom tbody tr {
                        break-inside: avoid;
                    }
                    /* Long notes must not expand a BOM row and force a second sheet. */
                    #printable-bom table:last-of-type td {
                        white-space: nowrap;
                        overflow: hidden;
                        text-overflow: ellipsis;
                    }
                    #printable-bom .grid { gap: 4mm !important; }
                    #printable-bom .pb-8 { padding-bottom: 5mm !important; }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
