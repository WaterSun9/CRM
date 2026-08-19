import React, { useState, useEffect, useRef } from 'react';
import { ClipboardList, Save, Printer, ShoppingBag, Layers, Zap, Ruler, IndianRupee, User, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader, EditableDetailItem } from './shared';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE } from '../../constants';
import { toIndianCommas } from '../../utils';

export default function MaterialIntegrationTab({
    customer,
    editData,
    isEditable,
    user,
    meta = {},
    logActivity,
    editingSection,
    setEditingSection
}) {
    const [bom, setBom] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [bomType, setBomType] = useState('');
    const [paperPreparedBy, setPaperPreparedBy] = useState('');
    const [paperPreparedDate, setPaperPreparedDate] = useState('');
    const [materialLoadingDate, setMaterialLoadingDate] = useState('');
    const [materialLoadedBy, setMaterialLoadedBy] = useState('');
    const [materialLoadedDate, setMaterialLoadedDate] = useState('');
    const [bomSaving, setBomSaving] = useState(false);
    const [showPrintModal, setShowPrintModal] = useState(false);

    // Integration By dropdown options
    const integrationByOptions = (meta['integration_by'] && meta['integration_by'].length > 0)
        ? meta['integration_by']
        : ['testuser 1', 'testuser 2', 'testuser 3', 'testuser 4', 'testuser 5'];

    const loadBOM = async () => {
        if (!customer?.id) return;
        try {
            const { data: bomData, error: bomError } = await supabase
                .from('bom')
                .select('*')
                .eq('admin_id', customer.id)
                .maybeSingle();

            if (bomError) {
                console.error('BOM fetch error:', bomError);
                return;
            }

            if (!bomData) {
                setBom(null);
                setBomItems([]);
                setBomType('');
                setPaperPreparedBy('');
                setPaperPreparedDate('');
                setMaterialLoadingDate('');
                setMaterialLoadedBy('');
                setMaterialLoadedDate('');
                return;
            }

            setBom(bomData);
            setBomType(bomData.bom_type === 'NONE' ? '' : (bomData.bom_type || ''));
            setPaperPreparedBy(bomData.paper_prepared_by || '');
            setPaperPreparedDate(bomData.paper_prepared_date || '');
            setMaterialLoadingDate(bomData.material_loading_date || '');
            setMaterialLoadedBy(bomData.material_loaded_by || '');
            setMaterialLoadedDate(bomData.material_loaded_date || '');

            const { data: itemData, error: itemError } = await supabase
                .from('bom_items')
                .select('*')
                .eq('bom_id', bomData.id)
                .order('sr_no', { ascending: true });

            if (itemError) {
                console.error('BOM items fetch error:', itemError);
                return;
            }

            const mergedItems = (itemData || []).map(dbItem => {
                const template = bomData.bom_type === 'ROOF' ? ROOF_BOM_TEMPLATE : SHED_BOM_TEMPLATE;
                const match = template.find(t => t.product_name === dbItem.product_name || t.sr_no === dbItem.sr_no);
                return {
                    ...dbItem,
                    uom: dbItem.uom || (match ? match.uom : '')
                };
            });
            setBomItems(mergedItems);
        } catch (err) {
            console.error('loadBOM exception:', err);
        }
    };

    useEffect(() => {
        loadBOM();
    }, [customer?.id]);

    const handleBomTypeChange = (type) => {
        setBomType(type);
        if (type === 'ROOF') {
            setBomItems(ROOF_BOM_TEMPLATE.map(t => ({ ...t })));
        } else if (type === 'SHED') {
            setBomItems(SHED_BOM_TEMPLATE.map(t => ({ ...t })));
        } else {
            setBomItems([]);
        }
    };

    const handleItemFieldChange = (index, field, value) => {
        setBomItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const saveBOM = async () => {
        if (!customer?.id) {
            alert("No customer selected");
            return;
        }

        setBomSaving(true);
        try {
            let bomData, bomError;

            // 1. Create or Update parent BOM
            if (bom?.id) {
                const { data, error } = await supabase
                    .from('bom')
                    .update({
                        bom_type: bomType || null,
                        material_loading_date: materialLoadingDate || null,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .eq('id', bom.id)
                    .select()
                    .single();
                
                bomData = data;
                bomError = error;
            } else {
                const { data, error } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: customer.id,
                        bom_type: bomType || null,
                        material_loading_date: materialLoadingDate || null,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .select()
                    .single();

                bomData = data;
                bomError = error;
            }

            if (bomError) {
                console.error("BOM save error:", bomError);
                alert("Failed to save BOM parent record: " + bomError.message);
                setBomSaving(false);
                return;
            }

            const currentBomId = bomData.id;

            // 2. Delete existing items associated with this BOM to avoid duplicates
            const { error: deleteError } = await supabase
                .from('bom_items')
                .delete()
                .eq('bom_id', currentBomId);

            if (deleteError) {
                console.error("BOM items delete error:", deleteError);
                alert("Failed to clear old BOM items: " + deleteError.message);
                setBomSaving(false);
                return;
            }

            // 3. Attach every item to the parent BOM
            if (bomType) {
                const itemsToInsert = bomItems.map((item, index) => ({
                    bom_id: currentBomId,
                    sr_no: index + 1,
                    product_name: item.product_name,
                    make: item.make || null,
                    integration_by: item.integration_by || null,
                    note: item.note || null
                }));

                if (itemsToInsert.length > 0) {
                    const { error: itemsError } = await supabase
                        .from('bom_items')
                        .insert(itemsToInsert);

                    if (itemsError) {
                        console.error("BOM items insertion error:", itemsError);
                        alert("BOM saved, but items failed to save: " + itemsError.message);
                        setBomSaving(false);
                        return;
                    }
                }
            }

            await logActivity(
                user.id,
                'update',
                `Saved ${bomType} BOM for ${customer.customer_name}`,
                '',
                customer.id
            );

            await loadBOM();
        } catch (err) {
            console.error("saveBOM exception:", err);
            alert("BOM save failed due to unexpected error.");
        } finally {
            setBomSaving(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Top Action & Status Bar */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-6">
                <div className="flex flex-wrap justify-between items-center gap-3 border-b border-stone-100 pb-3">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Bill of Materials (BOM) & Material Integration</h4>
                        <p className="text-xs text-stone-500 font-medium mt-0.5">Define equipment templates, integration assignments and print paper checklist.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {bom && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                BOM Saved
                            </span>
                        )}
                        <button
                            type="button"
                            onClick={() => setShowPrintModal(true)}
                            className="bg-stone-900 hover:bg-stone-800 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm cursor-pointer"
                        >
                            <Printer size={13} /> Print / Export PDF
                        </button>
                    </div>
                </div>

                {/* Section 1: Non-Editable Material Order Specifications */}
                <div>
                    <h5 className="text-[10px] font-bold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <ShoppingBag size={12} className="text-amber-500" /> Material Order Specifications (Channel Partner Configured)
                    </h5>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 bg-amber-50/40 p-4 rounded-xl border border-amber-200/60 text-xs">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <Layers size={10} className="text-amber-600" /> Roof / Shed
                            </label>
                            <p className="text-xs font-bold text-stone-800">{editData?.roof_shed || '–'}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <Zap size={10} className="text-amber-600" /> DC Cable
                            </label>
                            <p className="text-xs font-bold text-stone-800">{editData?.dc_cable ? `${editData.dc_cable} m` : '–'}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <Zap size={10} className="text-amber-600" /> AC Cable
                            </label>
                            <p className="text-xs font-bold text-stone-800">{editData?.ac_cable ? `${editData.ac_cable} m` : '–'}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <Ruler size={10} className="text-amber-600" /> Leg Height
                            </label>
                            <p className="text-xs font-bold text-stone-800">
                                {editData?.structure_front_leg_height && editData?.structure_rear_leg_height 
                                    ? `F: ${editData.structure_front_leg_height} ft / R: ${editData.structure_rear_leg_height} ft`
                                    : (editData?.structure_leg_height || '–')}
                            </p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                                <IndianRupee size={10} className="text-amber-600" /> Invoice Value
                            </label>
                            <p className="text-xs font-bold text-stone-800">{editData?.invoice_value ? `₹${toIndianCommas(editData.invoice_value)}` : '–'}</p>
                        </div>
                    </div>
                </div>

                {/* Section 2: Read-only Customer & Site Reference */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-1.5">
                        <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                            <User size={12} className="text-amber-500" /> Customer & Site Reference
                        </h5>
                        <span className="text-[9px] font-semibold text-stone-400 uppercase">View Only</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        <EditableDetailItem label="Payment Type" field="payment_type" value={customer?.payment_type || editData?.payment_type} isEditing={false} />
                    </div>
                </div>

                {/* Section 3: Procurement Milestones */}
                <div>
                    <SectionHeader title="Procurement Milestones" id="proc_milestones" icon={ClipboardList} isEditable={isEditable} editingSection={editingSection} setEditingSection={setEditingSection} />
                    {editingSection === 'proc_milestones' ? (
                        <div className="space-y-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">BOM Type</label>
                                    <select
                                        value={bomType}
                                        onChange={(e) => handleBomTypeChange(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold"
                                    >
                                        <option value="">Select Type...</option>
                                        <option value="ROOF">Roof</option>
                                        <option value="SHED">Shed</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared By</label>
                                    <input
                                        type="text"
                                        placeholder="Prepared by name..."
                                        value={paperPreparedBy}
                                        onChange={(e) => setPaperPreparedBy(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared Date</label>
                                    <input
                                        type="date"
                                        value={paperPreparedDate}
                                        onChange={(e) => setPaperPreparedDate(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loading Date</label>
                                    <input
                                        type="date"
                                        value={materialLoadingDate}
                                        onChange={(e) => setMaterialLoadingDate(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded By</label>
                                    <input
                                        type="text"
                                        placeholder="Loaded by name..."
                                        value={materialLoadedBy}
                                        onChange={(e) => setMaterialLoadedBy(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                    />
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded Date</label>
                                    <input
                                        type="date"
                                        value={materialLoadedDate}
                                        onChange={(e) => setMaterialLoadedDate(e.target.value)}
                                        disabled={!isEditable}
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await saveBOM();
                                        setEditingSection(null);
                                    }}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 cursor-pointer"
                                >
                                    <Save size={12} /> Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">BOM Type</label>
                                <p className="text-xs font-bold text-stone-700">{bomType || "–"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared By</label>
                                <p className="text-xs font-bold text-stone-700">{paperPreparedBy || "–"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared Date</label>
                                <p className="text-xs font-bold text-stone-700">{paperPreparedDate || "–"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loading Date</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadingDate || "–"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded By</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadedBy || "–"}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded Date</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadedDate || "–"}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 4: BOM Items List Table */}
                {bomType && (
                    <div className="space-y-3">
                        <SectionHeader title="BOM Items" id="bom_items" icon={ClipboardList} isEditable={isEditable} editingSection={editingSection} setEditingSection={setEditingSection} />
                        <div className="overflow-x-auto border border-stone-200 rounded-xl">
                            <table className="min-w-full divide-y divide-stone-200 text-xs">
                                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-bold text-[9px]">
                                    <tr>
                                        <th className="px-3 py-2 text-left w-12">Sr. No.</th>
                                        <th className="px-3 py-2 text-left">Product Name</th>
                                        <th className="px-3 py-2 text-left w-32">Make</th>
                                        <th className="px-3 py-2 text-left w-24">UOM</th>
                                        <th className="px-3 py-2 text-left w-44">Integration By</th>
                                        <th className="px-3 py-2 text-left">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200 bg-white font-medium text-stone-700">
                                    {bomItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-stone-50/40">
                                            <td className="px-3 py-2 text-stone-400 font-bold">{idx + 1}</td>
                                            <td className="px-3 py-2 font-semibold text-stone-700">
                                                {item.product_name || ''}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.make || ''}
                                                    onChange={(e) => handleItemFieldChange(idx, 'make', e.target.value)}
                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                    placeholder="Make..."
                                                />
                                            </td>
                                            <td className="px-3 py-2 text-stone-500 font-semibold">
                                                {item.uom || ''}
                                            </td>
                                            <td className="px-3 py-2">
                                                {editingSection === 'bom_items' && isEditable ? (
                                                    <select
                                                        value={item.integration_by || ''}
                                                        onChange={(e) => handleItemFieldChange(idx, 'integration_by', e.target.value)}
                                                        className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 font-medium text-stone-800"
                                                    >
                                                        <option value="">Select User...</option>
                                                        {integrationByOptions.map(opt => (
                                                            <option key={opt} value={opt}>{opt}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className={item.integration_by ? "px-2 py-0.5 bg-amber-50 text-amber-700 font-semibold rounded text-[11px] border border-amber-200/60" : "text-stone-400 italic text-[11px]"}>
                                                        {item.integration_by || '–'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <input
                                                    type="text"
                                                    value={item.note || ''}
                                                    onChange={(e) => handleItemFieldChange(idx, 'note', e.target.value)}
                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                    className="w-full bg-white border border-stone-200 rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                    placeholder="Notes..."
                                                />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {isEditable && editingSection === 'bom_items' && (
                            <div className="flex justify-end items-center pt-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        await saveBOM();
                                        setEditingSection(null);
                                    }}
                                    disabled={bomSaving}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed cursor-pointer"
                                >
                                    <Save className="w-3.5 h-3.5" /> {bomSaving ? 'Saving BOM...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Printable Document Body */}
                        <div className="flex-1 overflow-y-auto p-8 bg-white text-stone-900 print-document" id="printable-bom">
                            {/* Company Header */}
                            <div className="border-b-2 border-stone-900 pb-4 mb-6 text-center">
                                <h1 className="text-xl font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-xs font-semibold text-stone-600 mt-0.5">Solar PV Project Integration & Material Loading Checklist</p>
                                <div className="inline-block mt-2 px-3 py-1 bg-stone-100 border border-stone-300 rounded text-[11px] font-black uppercase tracking-widest text-stone-800">
                                    BILL OF MATERIALS (BOM) — {bomType ? `${bomType} TYPE` : 'GENERAL'}
                                </div>
                            </div>

                            {/* Section: Customer & Site Details */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Reference</h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Party Name:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.customer_name || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Contact Number:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.phone_number || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">System Capacity:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.system_capacity_kwp ? `${editData.system_capacity_kwp} kWp` : '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Dealer / Channel Partner:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.channel_partner || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">File / Folder No:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.folder_no || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Registration Date:</td>
                                            <td className="p-2 font-bold text-stone-900">{editData?.registration_date || '–'}</td>
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
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.roof_shed || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Structure Leg Height:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{editData?.structure_leg_height || '–'}</td>
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
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Paper Prepared By:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{paperPreparedBy || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Paper Prepared Date:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{paperPreparedDate || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Material Loaded By:</td>
                                            <td className="p-2 font-bold text-stone-900">{materialLoadedBy || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Material Loaded Date:</td>
                                            <td className="p-2 font-bold text-stone-900">{materialLoadedDate || materialLoadingDate || '–'}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section: BOM Items Table */}
                            <div className="mb-8">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">4. BOM Equipment Checklist</h3>
                                <table className="w-full text-xs border-collapse border border-stone-400">
                                    <thead>
                                        <tr className="bg-stone-100 text-stone-900 uppercase font-black text-[10px]">
                                            <th className="border border-stone-400 p-2 text-center w-10">#</th>
                                            <th className="border border-stone-400 p-2 text-left">Product Name</th>
                                            <th className="border border-stone-400 p-2 text-left w-28">Make</th>
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
                                                <td className="border border-stone-400 p-1.5 font-medium">{item.make || '–'}</td>
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
                        width: 100%;
                        margin: 0;
                        padding: 20px;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
