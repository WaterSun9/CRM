import React from 'react';

export default function HoldProcurementTab({
    customer,
    editData,
    setEditData,
    isEditable,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    saving,
    setSaving
}) {
    const handleToggleHoldStatus = (status) => {
        const newStatus = editData.hold_procurement === status ? null : status;
        setEditData(prev => ({ ...prev, hold_procurement: newStatus }));
    };

    const handleSaveHoldStatus = async () => {
        const newStatus = editData.hold_procurement;
        setSaving(true);
        await onUpdate(customer.id, { hold_procurement: newStatus });
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Hold Procurement status saved to ${newStatus || 'None'}`,
            '',
            customer.id
        );
        setSaving(false);
        fetchLogs();
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Hold Procurement</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Procurement hold status details.</p>
                    </div>
                    {isEditable && editData.hold_procurement !== customer.hold_procurement && (
                        <button
                            onClick={handleSaveHoldStatus}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0 disabled:opacity-55"
                        >
                            {saving ? 'Saving...' : 'Save Status'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-3 gap-2 w-full pt-1">
                    {[
                        { id: 'Project Win', label: 'Project Win', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                        { id: 'Project Lost', label: 'Project Lost', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                        { id: 'Project Return Win', label: 'Project Return Win', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                    ].map(tag => {
                        const isSelected = editData.hold_procurement === tag.id;
                        return (
                            <button
                                key={tag.id}
                                disabled={!isEditable}
                                onClick={() => handleToggleHoldStatus(tag.id)}
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
