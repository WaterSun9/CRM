import React, { useState, useEffect } from 'react';
import { ClipboardList, Save } from 'lucide-react';
import { supabase } from '../../supabase';
import { SectionHeader } from './shared';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE } from '../../constants';

export default function MaterialIntegrationTab({
    customer,
    editData,
    isEditable,
    user,
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
                // Update
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
                // Insert
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
                    sr_no: index + 1, // enforce clean sequential order
                    product_name: item.product_name,
                    make: item.make || null,
                    integration_by: item.integration_by || null,
                    note: item.note || null
                }));

                // 4. Insert BOM items
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

            // Log activity
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

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-6">
                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Bill of Materials (BOM)</h4>
                        <p className="text-xs text-stone-500 font-medium mt-0.5">Define equipment templates and track material loading milestones.</p>
                    </div>
                    {bom && (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                            BOM Saved
                        </span>
                    )}
                </div>

                {/* Section 1: Read-only Customer Info */}
                <div>
                    <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Customer & Site Reference</h5>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Party Name</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.customer_name || ""}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Mobile</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.phone_number || ""}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">kW</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.system_capacity_kwp || ""}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Dealer Name</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.channel_partner || ""}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">File No.</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.folder_no || ""}</p>
                        </div>
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Registration Date</label>
                            <p className="text-xs font-bold text-stone-700">{editData?.registration_date || ""}</p>
                        </div>
                    </div>
                </div>

                {/* Section 2: Procurement Milestones */}
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
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
                                >
                                    <Save size={12} /> Save
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">BOM Type</label>
                                <p className="text-xs font-bold text-stone-700">{bomType || ""}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared By</label>
                                <p className="text-xs font-bold text-stone-700">{paperPreparedBy || ""}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared Date</label>
                                <p className="text-xs font-bold text-stone-700">{paperPreparedDate || ""}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loading Date</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadingDate || ""}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded By</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadedBy || ""}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded Date</label>
                                <p className="text-xs font-bold text-stone-700">{materialLoadedDate || ""}</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Section 3: BOM Items List Table */}
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
                                        <th className="px-3 py-2 text-left w-36">Integration By</th>
                                        <th className="px-3 py-2 text-left">Note</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-200 bg-white font-medium text-stone-700">
                                    {bomItems.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-stone-50/40">
                                            <td className="px-3 py-1.5 text-stone-400 font-bold">{idx + 1}</td>
                                            <td className="px-3 py-1.5 font-semibold text-stone-700">
                                                {item.product_name || ''}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    value={item.make || ''}
                                                    onChange={(e) => handleItemFieldChange(idx, 'make', e.target.value)}
                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                    placeholder="Make..."
                                                />
                                            </td>
                                            <td className="px-3 py-1.5 text-stone-500 font-semibold">
                                                {item.uom || ''}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    value={item.integration_by || ''}
                                                    onChange={(e) => handleItemFieldChange(idx, 'integration_by', e.target.value)}
                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                    placeholder="Integration..."
                                                />
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <input
                                                    type="text"
                                                    value={item.note || ''}
                                                    onChange={(e) => handleItemFieldChange(idx, 'note', e.target.value)}
                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
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
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                                >
                                    <Save className="w-3.5 h-3.5" /> {bomSaving ? 'Saving BOM...' : 'Save'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
