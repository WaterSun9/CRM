import React from 'react';
import { Camera, ClipboardList, ShieldAlert } from 'lucide-react';
import { CheckboxRemarkItem } from './shared';

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
    setSaving,
    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview
}) {
    // Vendor can edit geo tag, office can only view
    const isVendor = user?.userType === 'vendor' || user?.role === 'Vendors';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const canEditGeoTag = isVendor || (isAdmin && isEditable);

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
    };

    const isGeoTagDirty = editData.geo_tag_status !== customer.geo_tag_status || 
                          !!editData.geo_tag_image !== !!customer.geo_tag_image;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Vendor permission info banner if not vendor */}
            {!isVendor && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900">Vendor Controlled Stage</p>
                        <p className="text-[11px] text-amber-700 font-medium">
                            Geo Tag Photo specifications and photographs are configured directly by the Allotted Vendor. Office users have view-only access.
                        </p>
                    </div>
                </div>
            )}

            {/* Geo Tag Status Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="border-b border-stone-100 pb-2.5">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Geo Tag Photo</h4>
                    <p className="text-[11px] text-stone-500 font-medium mt-0.5">Has the geo-tagged photograph been uploaded?</p>
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
                                disabled={!canEditGeoTag}
                                onClick={() => {
                                    const newTag = editData.geo_tag_status === tag.id ? null : tag.id;
                                    setEditData(prev => ({ ...prev, geo_tag_status: newTag }));
                                }}
                                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full cursor-pointer ${
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

            {/* Geo Tag Image Upload Checklist */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-500" /> Geo Tag Checklist
                </h4>
                {!canEditGeoTag && (
                    <p className="text-[10px] text-stone-400 font-semibold italic">Only vendors can edit this section. You have view-only access.</p>
                )}
                <div className="flex flex-col gap-2">
                    <CheckboxRemarkItem 
                        label="Geo Tag Image Uploaded" 
                        field="geo_tag_image" 
                        value={editData.geo_tag_image} 
                        onChange={handleChange} 
                        isEditing={canEditGeoTag} 
                        documents={documents} 
                        onUpload={onFileUpload} 
                        onDelete={onFileDelete} 
                        onPreview={onFilePreview} 
                    />
                </div>

                {/* Always Visible Action Button at Bottom */}
                {canEditGeoTag && (
                    <div className="pt-3 border-t border-stone-100">
                        {editData.geo_tag_status === 'Proceed' && editData.geo_tag_image ? (
                            <button
                                type="button"
                                onClick={async () => {
                                    setSaving(true);
                                    await onUpdate(customer.id, { 
                                        geo_tag_status: 'Proceed',
                                        geo_tag_image: editData.geo_tag_image,
                                        stage: 'DISCOM SUBMISSION'
                                    });
                                    await logActivity(user.id, 'update', `${customer.customer_name}: Geo Tag Photo Proceeded and moved to Discom Submission`, '', customer.id);
                                    setSaving(false);
                                    fetchLogs();
                                }}
                                disabled={saving}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/15 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                <Camera size={15} /> {saving ? 'Advancing...' : 'Save & Move to Discom Submission'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={async () => {
                                    setSaving(true);
                                    await onUpdate(customer.id, { 
                                        geo_tag_status: editData.geo_tag_status,
                                        geo_tag_image: editData.geo_tag_image 
                                    });
                                    await logActivity(user.id, 'update', `${customer.customer_name}: Updated Geo Tag Photo Status to ${editData.geo_tag_status || 'None'}`, '', customer.id);
                                    setSaving(false);
                                    fetchLogs();
                                }}
                                disabled={saving}
                                className="w-full bg-stone-900 hover:bg-stone-850 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                            >
                                {saving ? 'Saving...' : 'Save Details'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
