import React from 'react';

export default function GeoTagPhotoTab({
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
    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Geo Tag Photo</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Has the geo-tagged photograph been uploaded?</p>
                    </div>
                    {isEditable && editData.geo_tag_status !== customer.geo_tag_status && (
                        <button
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { geo_tag_status: editData.geo_tag_status });
                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated Geo Tag Photo Status to ${editData.geo_tag_status || 'None'}`, '', customer.id);
                                setSaving(false);
                                fetchLogs();
                            }}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0 disabled:opacity-55"
                        >
                            {saving ? 'Saving...' : 'Save Tag'}
                        </button>
                    )}
                </div>
                <div className="grid grid-cols-4 gap-2 w-full pt-1">
                    {[
                        { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                        { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                        { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' },
                        { id: 'Proceed', label: 'Proceed', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10', dotClass: 'bg-white' }
                    ].map(tag => {
                        const isSelected = editData.geo_tag_status === tag.id;
                        return (
                            <button
                                key={tag.id}
                                disabled={!isEditable}
                                onClick={() => {
                                    const newTag = editData.geo_tag_status === tag.id ? null : tag.id;
                                    setEditData(prev => ({ ...prev, geo_tag_status: newTag }));
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
