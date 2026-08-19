import React, { useState } from 'react';
import { ShoppingBag, Zap, Ruler, IndianRupee, Layers, Save, CheckCircle2, ShieldAlert, AlertCircle } from 'lucide-react';
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
    const isAgent = user?.userType === 'agent' || user?.role === 'Channel Partners' || user?.userType === 'dealer' || user?.role === 'Dealers';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const canEdit = isAgent || (isAdmin && isEditable);

    const [validationError, setValidationError] = useState('');
    const [savedSuccess, setSavedSuccess] = useState(false);

    const roofShedOptions = ['Roof', 'Shed'];

    const handleChange = (field, val) => {
        setValidationError('');
        setEditData(prev => ({ ...prev, [field]: val }));
    };

    const validateFields = () => {
        if (!editData.roof_shed) return 'Please select Roof / Shed type.';
        if (!editData.dc_cable || Number(editData.dc_cable) <= 0) return 'Please enter DC Cable length (meters).';
        if (!editData.ac_cable || Number(editData.ac_cable) <= 0) return 'Please enter AC Cable length (meters).';
        if (!editData.structure_leg_height || !String(editData.structure_leg_height).trim()) return 'Please enter Structure Leg Height.';
        if (!editData.invoice_value || Number(editData.invoice_value) <= 0) return 'Please enter Invoice Value (₹).';
        return null;
    };

    const handleSaveOrder = async (nextStage = null) => {
        const error = validateFields();
        if (error) {
            setValidationError(error);
            return;
        }

        setSaving(true);
        const updates = {
            roof_shed: editData.roof_shed,
            dc_cable: Number(editData.dc_cable),
            ac_cable: Number(editData.ac_cable),
            structure_leg_height: String(editData.structure_leg_height).trim(),
            invoice_value: Number(editData.invoice_value)
        };

        if (nextStage) {
            updates.stage = nextStage;
        }

        await onUpdate(customer.id, updates);

        let logMsg = `${customer.customer_name}: Updated Material Order details (Roof/Shed: ${updates.roof_shed}, DC Cable: ${updates.dc_cable}m, AC Cable: ${updates.ac_cable}m, Leg Height: ${updates.structure_leg_height}, Invoice Value: ₹${updates.invoice_value})`;
        if (nextStage) {
            logMsg += ` and moved stage to ${nextStage}`;
        }
        if (logActivity && user?.id) {
            await logActivity(user.id, 'update', logMsg, '', customer.id);
        }

        setSaving(false);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 3000);
        if (fetchLogs) fetchLogs();
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
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
            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                            <ShoppingBag size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-stone-850 uppercase tracking-wider">Material Order Specifications</h4>
                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">All 5 fields below are compulsory for material order processing.</p>
                        </div>
                    </div>

                    {savedSuccess && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 animate-in fade-in">
                            <CheckCircle2 size={13} /> Saved!
                        </span>
                    )}
                </div>

                {/* Validation Alert */}
                {validationError && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 animate-in fade-in">
                        <AlertCircle size={15} className="flex-shrink-0 text-red-500" />
                        <span>{validationError}</span>
                    </div>
                )}

                {/* 5 Form Fields Line-by-Line (Full width, easy to fill) */}
                <div className="space-y-3.5">
                    {/* 1. Roof / Shed Dropdown */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Layers size={13} className="text-amber-500" /> Roof / Shed <span className="text-red-500 font-black">*</span>
                        </label>
                        <select
                            disabled={!canEdit}
                            value={editData.roof_shed || ''}
                            onChange={(e) => handleChange('roof_shed', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                        >
                            <option value="">Select Roof / Shed...</option>
                            {roofShedOptions.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                            ))}
                        </select>
                    </div>

                    {/* 2. DC Cable (Numeric, unit: meter) */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-500" /> DC Cable (Meters) <span className="text-red-500 font-black">*</span>
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
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed pr-10"
                            />
                            <span className="absolute right-3.5 top-2.5 text-[11px] font-bold text-stone-400 select-none">
                                m
                            </span>
                        </div>
                    </div>

                    {/* 3. AC Cable (Numeric, unit: meter) */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-500" /> AC Cable (Meters) <span className="text-red-500 font-black">*</span>
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
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed pr-10"
                            />
                            <span className="absolute right-3.5 top-2.5 text-[11px] font-bold text-stone-400 select-none">
                                m
                            </span>
                        </div>
                    </div>

                    {/* 4. Structure Leg Height (Text) */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                            <Ruler size={13} className="text-amber-500" /> Structure Leg Height <span className="text-red-500 font-black">*</span>
                        </label>
                        <input
                            type="text"
                            disabled={!canEdit}
                            placeholder="e.g. 4 ft, 6 ft, 8 ft..."
                            value={editData.structure_leg_height || ''}
                            onChange={(e) => handleChange('structure_leg_height', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                        />
                    </div>

                    {/* 5. Invoice Value (Numeric Currency) */}
                    <div className="space-y-1">
                        <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide flex items-center gap-1.5">
                            <IndianRupee size={13} className="text-amber-500" /> Invoice Value (₹) <span className="text-red-500 font-black">*</span>
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
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-8 pr-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-all disabled:bg-stone-100 disabled:text-stone-500 disabled:cursor-not-allowed"
                            />
                        </div>
                    </div>
                </div>

                {/* Always Visible Action Button */}
                {canEdit && (
                    <div className="pt-3 border-t border-stone-100">
                        <button
                            type="button"
                            onClick={() => handleSaveOrder('MATERIAL INTEGRATION')}
                            disabled={saving}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-500/15 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <CheckCircle2 size={15} /> {saving ? 'Advancing...' : 'Save & Move to Material Integration'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
