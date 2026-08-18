import React from 'react';
import { ShieldAlert, ClipboardCheck } from 'lucide-react';

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
    const isVendor = user?.userType === 'vendor' || user?.role === 'Vendors';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const canEditInspection = isVendor || (isAdmin && isEditable);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Vendor permission info banner if not vendor */}
            {!isVendor && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900">Vendor Controlled Stage</p>
                        <p className="text-[11px] text-amber-700 font-medium">
                            Discom Inspection verification reports are configured directly by the Allotted Vendor. Office users have view-only access.
                        </p>
                    </div>
                </div>
            )}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest font-bold">Discom Inspection</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Utility official inspection schedules and updates.</p>
                    </div>
                    {canEditInspection && editData.discom_inspection !== customer.discom_inspection && (
                        <button
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { discom_inspection: editData.discom_inspection || 'No' });
                                await logActivity(
                                    user.id,
                                    'update',
                                    `${customer.customer_name}: Updated Discom Inspection to ${editData.discom_inspection || 'No'}`,
                                    '',
                                    customer.id
                                );
                                setSaving(false);
                                fetchLogs();
                            }}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0 disabled:opacity-55"
                        >
                            {saving ? 'Saving...' : 'Save Status'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full pt-1">
                    {[
                        { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                        { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' }
                    ].map(tag => {
                        const isSelected = editData.discom_inspection === tag.id || (!editData.discom_inspection && tag.id === 'No');
                        return (
                            <button
                                key={tag.id}
                                disabled={!canEditInspection}
                                onClick={() => {
                                    setEditData(prev => ({ ...prev, discom_inspection: tag.id }));
                                }}
                                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
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
        </div>
    );
}
