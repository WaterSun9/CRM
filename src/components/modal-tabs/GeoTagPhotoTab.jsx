import React, { useEffect } from 'react';
import { Camera, ClipboardList, ShieldAlert, MapPin } from 'lucide-react';
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
    onFilePreview,
    onUpdateRemark
}) {
    // Vendor can edit geo tag, office can only view, Channel Partner Office & Admin have full edit
    const isVendor = user?.userType === 'vendor' || user?.role === 'Vendors';
    const isAdmin = user?.userType === 'admin' || user?.role === 'Super Admin' || user?.role === 'Admin';
    const isChannelPartnerOffice = user?.userType === 'channel_partner_office' || user?.role === 'Channel Partner Office';
    const canEditGeoTag = isVendor || ((isAdmin || isChannelPartnerOffice) && isEditable);

    // Ensure a default Geo Tag status of 'No' for new records (only on mount)
    const initializedRef = React.useRef(false);
    useEffect(() => {
        if (!initializedRef.current && !editData.geo_tag_status) {
            initializedRef.current = true;
            setEditData(prev => ({ ...prev, geo_tag_status: 'No' }));
        }
    }, []);

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
    };

    const isGeoTagDirty = editData.geo_tag_status !== customer.geo_tag_status || 
                          !!editData.geo_tag_image !== !!customer.geo_tag_image;

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* Vendor permission info banner if not vendor and not admin/channel partner office */}
            {!canEditGeoTag && (
                <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-4 flex items-center gap-3">
                    <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <div>
                        <p className="text-xs font-bold text-amber-900">Vendor Controlled Stage</p>
                        <p className="text-[11px] text-amber-700 font-medium">
                            Geo Tag Photo verification and status are configured directly by the Vendor. Office users have view-only access.
                        </p>
                    </div>
                </div>
            )}

            {/* Geo Tag Status Tag Selector */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2.5 border-b border-stone-100 pb-3">
                    <div className="p-2 bg-blue-50 rounded-xl text-blue-600">
                        <MapPin size={18} />
                    </div>
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Geo Tag Photo Status <span className="text-red-500">*</span></h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Verify site geo-tagging and site readiness.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-3 gap-2 w-full">
                        {[
                            { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                            { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' },
                            { id: 'Proceed', label: 'Proceed', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' }
                        ].map(tag => {
                            const isSelected = editData.geo_tag_status === tag.id;
                            return (
                                <button
                                    key={tag.id}
                                    type="button"
                                    disabled={!canEditGeoTag}
                                    onClick={() => {
                                        setEditData(prev => ({ ...prev, geo_tag_status: tag.id }));
                                    }}
                                    className={`py-3 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full cursor-pointer ${
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

            {/* Checklist Section */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-amber-500" /> Geo Tag Photo Checklist
                    </h4>
                    <span className="text-[9px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">
                        Image Upload Mandatory
                    </span>
                </div>
                {!canEditGeoTag && (
                    <p className="text-[10px] text-stone-400 font-semibold italic">Only vendors can edit this section. You have view-only access.</p>
                )}
                <div className="flex flex-col gap-2">
                    <CheckboxRemarkItem 
                        label="Geo Tag Image Uploaded *" 
                        field="geo_tag_image" 
                        value={editData.geo_tag_image} 
                        onChange={handleChange} 
                        isEditing={canEditGeoTag} 
                        documents={documents} 
                        onUpload={onFileUpload} 
                        onDelete={onFileDelete} 
                        onPreview={onFilePreview} 
                        onUpdateRemark={onUpdateRemark}
                    />
                </div>

                {/* Mandatory Image Note if Proceed is chosen without an image */}
                {editData.geo_tag_status === 'Proceed' && !editData.geo_tag_image && (
                    <div className="pt-2 border-t border-stone-100">
                        <p className="text-[11px] font-bold text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-center">
                            ⚠️ Geo Tag photograph must be uploaded before you can Save & Move to Discom Submission.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
