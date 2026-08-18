import React from 'react';
import { ShoppingBag, Zap, Ruler, IndianRupee, Layers, Save, CheckCircle2, ShieldAlert } from 'lucide-react';
import { toIndianCommas, parseIndianNumber } from '../../utils';

export default function MaterialOrderTab({
    customer,
    editData,
    setEditData,
    isEditable,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    meta = {},
    saving,
    setSaving
}) {
    // Channel Partner / Agent can edit; Office / other roles have view-only access
    const isAgent = user?.userType === 'agent' || user?.role === 'Channel Partners';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const canEdit = isAgent || (isAdmin && isEditable);

    const roofShedOptions = ['Roof', 'Shed'];

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
    };

    const isDirty = (
        (editData.roof_shed || '') !== (customer.roof_shed || '') ||
        (editData.dc_cable || '') !== (customer.dc_cable || '') ||
        (editData.ac_cable || '') !== (customer.ac_cable || '') ||
        (editData.structure_leg_height || '') !== (customer.structure_leg_height || '') ||
        (editData.invoice_value || '') !== (customer.invoice_value || '')
    );

    const handleSaveOrder = async (nextStage = null) => {
        setSaving(true);
        const updates = {
            roof_shed: editData.roof_shed || null,
            dc_cable: editData.dc_cable ? Number(editData.dc_cable) : null,
            ac_cable: editData.ac_cable ? Number(editData.ac_cable) : null,
            structure_leg_height: editData.structure_leg_height || null,
            invoice_value: editData.invoice_value ? Number(editData.invoice_value) : null
        };

        if (nextStage) {
            updates.stage = nextStage;
        }

        await onUpdate(customer.id, updates);

        let logMsg = `${customer.customer_name}: Updated Material Order details (Roof Shed: ${updates.roof_shed || 'N/A'}, DC Cable: ${updates.dc_cable || 0}m, AC Cable: ${updates.ac_cable || 0}m, Leg Height: ${updates.structure_leg_height || 'N/A'}, Invoice Value: ₹${updates.invoice_value || 0})`;
        if (nextStage) {
            logMsg += ` and moved stage to ${nextStage}`;
        }
        await logActivity(user.id, 'update', logMsg, '', customer.id);

        setSaving(false);
        fetchLogs();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Role permission info banner if not agent */}
            {!isAgent && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900">Channel Partner Controlled Stage</p>
                        <p className="text-[11px] text-amber-700 font-medium">
                            Material Order specifications are configured directly by the Channel Partner. Office users have view-only access.
                        </p>
                    </div>
                </div>
            )}

            {/* Material Order Form Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <ShoppingBag size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-stone-800 uppercase tracking-widest">Material Order Specifications</h4>
                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">Shed type, cable requirements, structure height & invoice estimation.</p>
                        </div>
                    </div>

                    {canEdit && isDirty && (
                        <button
                            type="button"
                            onClick={() => handleSaveOrder(null)}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <Save size={13} /> {saving ? 'Saving...' : 'Save Order Details'}
                        </button>
                    )}
                </div>

                {/* 5 Form Fields Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Roof / Shed Dropdown */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers size={12} className="text-amber-500" /> Roof / Shed
                        </label>
                        <select
                            disabled={!canEdit}
                            value={editData.roof_shed || ''}
                            onChange={(e) => handleChange('roof_shed', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                        >
                            <option value="">Select Roof / Shed...</option>
                            {roofShedOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. DC Cable (Numeric, unit: meter) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Zap size={12} className="text-amber-500" /> DC Cable (Meters)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={!canEdit}
                                placeholder="e.g. 50"
                                value={editData.dc_cable ?? ''}
                                onChange={(e) => handleChange('dc_cable', e.target.value)}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed pr-10"
                            />
                            <span className="absolute right-3.5 top-2.5 text-[11px] font-bold text-stone-400 select-none">
                                m
                            </span>
                        </div>
                    </div>

                    {/* 3. AC Cable (Numeric, unit: meter) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Zap size={12} className="text-amber-500" /> AC Cable (Meters)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                min="0"
                                step="any"
                                disabled={!canEdit}
                                placeholder="e.g. 30"
                                value={editData.ac_cable ?? ''}
                                onChange={(e) => handleChange('ac_cable', e.target.value)}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed pr-10"
                            />
                            <span className="absolute right-3.5 top-2.5 text-[11px] font-bold text-stone-400 select-none">
                                m
                            </span>
                        </div>
                    </div>

                    {/* 4. Structure Leg Height (Text) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                            <Ruler size={12} className="text-amber-500" /> Structure Leg Height
                        </label>
                        <input
                            type="text"
                            disabled={!canEdit}
                            placeholder="e.g. 4 ft, 6 ft, 8 ft..."
                            value={editData.structure_leg_height || ''}
                            onChange={(e) => handleChange('structure_leg_height', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* 5. Invoice Value (Numeric Currency) */}
                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                            <IndianRupee size={12} className="text-amber-500" /> Invoice Value (₹)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-[11px] font-bold text-stone-400 select-none">
                                ₹
                            </span>
                            <input
                                type="text"
                                inputMode="decimal"
                                disabled={!canEdit}
                                placeholder="Enter invoice amount..."
                                value={editData.invoice_value ? toIndianCommas(editData.invoice_value) : ''}
                                onChange={(e) => handleChange('invoice_value', parseIndianNumber(e.target.value))}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Direct Stage Advancement Action (when in MATERIAL ORDER stage) */}
                {canEdit && customer.stage === 'MATERIAL ORDER' && (
                    <div className="pt-4 border-t border-stone-100 flex justify-end">
                        <button
                            type="button"
                            onClick={() => handleSaveOrder('MATERIAL INTEGRATION')}
                            disabled={saving}
                            className="bg-amber-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/10 flex items-center gap-2 disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                        >
                            <CheckCircle2 size={15} /> Save & Move to Material Integration
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
