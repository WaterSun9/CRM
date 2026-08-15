import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default function MeterInstallationTab({
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
    const meterData = editData.meter_installation || 'No';
    const isMeterDirty = editData.meter_installation !== customer.meter_installation || editData.installation_date !== customer.installation_date;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {isOffice && (
                <div className="p-3.5 bg-red-50 border border-red-100 text-red-800 rounded-2xl text-xs font-bold flex items-center gap-2 animate-in fade-in duration-300">
                    <AlertTriangle className="w-4.5 h-4.5 text-red-600 flex-shrink-0" />
                    <span>You do not have permission to edit this stage</span>
                </div>
            )}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest font-bold">Meter Installation</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Net meter installation status and verification dates.</p>
                    </div>
                    {isEditable && isMeterDirty && (
                        <button
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { 
                                    meter_installation: meterData,
                                    installation_date: editData.installation_date
                                });
                                await logActivity(
                                    user.id,
                                    'update',
                                    `${customer.customer_name}: Updated Meter Installation details (Status: ${meterData}, Installation Date: ${editData.installation_date || 'N/A'})`,
                                    '',
                                    customer.id
                                );
                                setSaving(false);
                                fetchLogs();
                            }}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0 disabled:opacity-55"
                        >
                            {saving ? 'Saving...' : 'Save Details'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-2 w-full pt-1">
                    {[
                        { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                        { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' }
                    ].map(tag => {
                        const isSelected = meterData === tag.id;
                        return (
                            <button
                                key={tag.id}
                                disabled={!isEditable}
                                onClick={() => {
                                    if (meterData === tag.id) return;
                                    const todayStr = new Date().toISOString().split('T')[0];
                                    setEditData(prev => {
                                        const newPayload = {
                                            ...prev,
                                            meter_installation: tag.id
                                        };
                                        if (tag.id === 'Yes' && !prev.installation_date) {
                                            newPayload.installation_date = todayStr;
                                        }
                                        return newPayload;
                                    });
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

                {/* Conditional Date Inputs */}
                {meterData === 'Yes' && (
                    <div className="pt-4 border-t border-stone-100 grid grid-cols-1 gap-4 animate-in slide-in-from-top-2 duration-300">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Installation Date</label>
                            <input
                                type="date"
                                disabled={!isEditable}
                                value={editData.installation_date || ''}
                                onChange={e => setEditData(prev => ({ ...prev, installation_date: e.target.value }))}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
