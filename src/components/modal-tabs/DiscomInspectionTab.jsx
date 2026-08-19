import React, { useState } from 'react';
import { ShieldAlert, ClipboardCheck, Save, CheckCircle2 } from 'lucide-react';

export default function DiscomInspectionTab({
    customer,
    editData,
    setEditData,
    isEditable,
    isOffice,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    saving,
    setSaving
}) {
    const isAgent = user?.userType === 'agent' || user?.role === 'Channel Partners' || user?.userType === 'dealer' || user?.role === 'Dealers';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const canEditInspection = isAgent || (isAdmin && isEditable);

    const [savedSuccess, setSavedSuccess] = useState(false);

    const inspectionData = editData.discom_inspection || 'No';

    const handleSave = async (nextStage = null) => {
        setSaving(true);
        const updates = { discom_inspection: inspectionData };

        if (nextStage) {
            updates.stage = nextStage;
        }

        await onUpdate(customer.id, updates);

        let logMsg = `${customer.customer_name}: Updated Discom Inspection to ${inspectionData}`;
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
            {/* Channel Partner permission info banner if not agent */}
            {!isAgent && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900">Channel Partner Controlled Stage</p>
                        <p className="text-[11px] text-amber-700 font-medium">
                            Discom Inspection verification reports are configured directly by the Channel Partner. Office users have view-only access.
                        </p>
                    </div>
                </div>
            )}

            <div className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                            <ClipboardCheck size={18} />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-stone-850 uppercase tracking-wider">Discom Inspection</h4>
                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">Utility official inspection schedules and joint verification status.</p>
                        </div>
                    </div>

                    {savedSuccess && (
                        <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1 animate-in fade-in">
                            <CheckCircle2 size={13} /> Saved!
                        </span>
                    )}
                </div>

                <div className="space-y-2">
                    <label className="text-[11px] font-bold text-stone-700 uppercase tracking-wide block">
                        Inspection Status <span className="text-red-500 font-black">*</span>
                    </label>

                    <div className="grid grid-cols-2 gap-2 w-full">
                        {[
                            { id: 'No', label: 'No / Pending', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                            { id: 'Yes', label: 'Yes / Completed', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' }
                        ].map(tag => {
                            const isSelected = inspectionData === tag.id;
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    disabled={!canEditInspection}
                                    onClick={() => {
                                        setEditData(prev => ({ ...prev, discom_inspection: tag.id }));
                                    }}
                                    className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full cursor-pointer ${
                                        isSelected
                                            ? tag.activeClass
                                            : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                    }`}
                                >
                                    <span className={`w-2 h-2 rounded-full ${isSelected ? tag.dotClass : 'bg-stone-300'}`} />
                                    {tag.label}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Always Visible Action Button */}
                {canEditInspection && (
                    <div className="pt-3 border-t border-stone-100">
                        <button
                            type="button"
                            onClick={() => handleSave(inspectionData === 'Yes' ? 'SUBSIDY STATUS' : null)}
                            disabled={saving}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/15 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                        >
                            <CheckCircle2 size={15} /> {saving ? 'Advancing...' : (inspectionData === 'Yes' ? 'Save & Move to Subsidy Status' : 'Save Details')}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
