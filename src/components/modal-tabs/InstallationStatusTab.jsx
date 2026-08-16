import React from 'react';
import { ClipboardList, Save } from 'lucide-react';
import { CheckboxRemarkItem } from './shared';

export default function InstallationStatusTab({
    customer,
    editData,
    setEditData,
    isEditable,
    onUpdate,
    logActivity,
    fetchLogs,
    user,
    handleChange,
    saving,
    setSaving,
    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview
}) {
    const handleToggleInstallationTag = (tagId) => {
        const newTag = editData.installation_status === tagId ? null : tagId;
        setEditData(prev => ({ ...prev, installation_status: newTag }));
    };

    const handleSaveInstallationDetails = async () => {
        setSaving(true);
        const updates = {
            installation_status: editData.installation_status,
            installation_date: editData.installation_date || null,
            installed_by: editData.installed_by || null
        };
        await onUpdate(customer.id, updates);
        
        let logMsg = `${customer.customer_name}: Updated Installation Status to ${editData.installation_status}`;
        if (editData.installation_status === 'Yes') {
            logMsg += ` (Date: ${editData.installation_date || 'N/A'}, Installed By: ${editData.installed_by || 'N/A'})`;
        }
        await logActivity(user.id, 'update', logMsg, '', customer.id);
        
        setSaving(false);
        fetchLogs();
    };

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* SFDC Photo Checklist Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-500" /> SFDC Photo Checklist
                </h4>
                <div className="flex flex-col gap-2">
                    <CheckboxRemarkItem label="SFDC Photo Checked" field="sfdc_photo" value={editData.sfdc_photo} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} />
                </div>
                {isEditable && editData.sfdc_photo !== customer.sfdc_photo && (
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { sfdc_photo: editData.sfdc_photo });
                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated SFDC Photo status to ${editData.sfdc_photo ? 'Checked' : 'Unchecked'}`, '', customer.id);
                                setSaving(false);
                                fetchLogs();
                            }}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" /> Save SFDC Photo
                        </button>
                    </div>
                )}
            </div>

            {/* Main Tag Selector Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Installation Status</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Has the physical installation been completed?</p>
                    </div>
                    {isEditable && (
                        (editData.installation_status !== customer.installation_status) ||
                        (editData.installation_date !== customer.installation_date) ||
                        (editData.installed_by !== customer.installed_by)
                    ) && (
                        <button
                            onClick={handleSaveInstallationDetails}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0 disabled:opacity-55"
                        >
                            {saving ? 'Saving...' : 'Save Details'}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-3 gap-2 w-full pt-1">
                    {[
                        { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                        { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                        { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                    ].map(tag => {
                        const isSelected = editData.installation_status === tag.id;
                        return (
                            <button
                                key={tag.id}
                                disabled={!isEditable}
                                onClick={() => handleToggleInstallationTag(tag.id)}
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

                {/* Installation Details Form — Only visible when status is Yes */}
                {editData.installation_status === 'Yes' && (
                    <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
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
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Installed By (Person in Charge)</label>
                            <input
                                type="text"
                                disabled={!isEditable}
                                placeholder="Enter name..."
                                value={editData.installed_by || ''}
                                onChange={e => setEditData(prev => ({ ...prev, installed_by: e.target.value }))}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
