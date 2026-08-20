import React from 'react';
import { User, ClipboardList, Sparkles, Edit3, X } from 'lucide-react';
import { SectionHeader, EditableDetailItem, CheckboxRemarkItem } from './shared';

export default function LeadsTab({
    editData,
    handleChange,
    editingSection,
    setEditingSection,
    channel_partners,
    isAdmin,
    user,
    meta,
    isEditable,
    isRegChecklistDirty,
    handleSaveRegChecklist,
    documents = [],
    uploading,
    onFileUpload,
    onViewDocument,
    onDeleteDocument,
    onUpdateRemark,
}) {
    const handleFillTestData = () => {
        const randId = Math.floor(1000 + Math.random() * 9000);
        const demoBrand = meta['module_brand']?.[0] || 'Adani';
        const demoCp = channel_partners?.[0] || 'Watersun Direct';
        const demoWp = '540';
        const demoModules = '10';

        handleChange('customer_name', editData.customer_name || `Test Lead ${randId}`);
        handleChange('phone_number', editData.phone_number || `98765${randId}`);
        handleChange('email', editData.email || editData.email_address || `testlead${randId}@gmail.com`);
        handleChange('consumer_no', editData.consumer_no || `100200${randId}`);
        handleChange('villages', editData.villages || `Test Village ${randId}`);
        handleChange('sub_divisions', editData.sub_divisions || `Test Division`);
        if (!editData.channel_partner) handleChange('channel_partner', demoCp);
        if (!editData.sub_channel_partner) handleChange('sub_channel_partner', 'Direct Sub Partner');
        if (!editData.module_brand) handleChange('module_brand', demoBrand);
        handleChange('module_wp', editData.module_wp || demoWp);
        handleChange('no_of_modules', editData.no_of_modules || demoModules);
        if (!editData.payment_type) handleChange('payment_type', 'CASH');
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Customer Info */}
            <section id="section-cus">
                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-2">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <User size={12} className="text-amber-500" /> Customer Info
                    </h3>
                    <div className="flex items-center gap-2.5">
                        {isEditable && editingSection === 'cus' && (
                            <button
                                type="button"
                                onClick={handleFillTestData}
                                title="Auto-fill sample test data for empty fields"
                                className="bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 px-2 py-0.5 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                                <Sparkles size={11} className="text-amber-500" /> Fill Test Values
                            </button>
                        )}
                        {isEditable && (
                            <button 
                                type="button"
                                onClick={() => {
                                    const isOpening = editingSection !== 'cus';
                                    if (setEditingSection) {
                                        setEditingSection(isOpening ? 'cus' : null);
                                    }
                                    if (isOpening) {
                                        setTimeout(() => {
                                            const el = document.getElementById('section-cus');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }, 150);
                                    }
                                }} 
                                className="text-stone-400 hover:text-amber-600 transition-colors p-1 cursor-pointer"
                            >
                                {editingSection === 'cus' ? <X size={14} /> : <Edit3 size={13} />}
                            </button>
                        )}
                    </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <EditableDetailItem label="Customer Name" field="customer_name" value={editData.customer_name} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Phone Number" field="phone_number" value={editData.phone_number} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Email Address" field="email" value={editData.email || editData.email_address} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Consumer No" field="consumer_no" value={editData.consumer_no} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Villages" field="villages" value={editData.villages} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={editData.sub_divisions} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={editData.channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} channel_partners={channel_partners} isAdmin={isAdmin} />
                    <EditableDetailItem label="Sub Channel Partner Name" field="sub_channel_partner" value={editData.sub_channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={editData.module_brand} onChange={handleChange} options={meta['module_brand']} category="module_brand" isEditing={editingSection === 'cus'} user={user} />
                    <EditableDetailItem label="MODULE WP" field="module_wp" value={editData.module_wp} onChange={handleChange} options={meta['module_wp'] && meta['module_wp'].length > 0 ? meta['module_wp'] : ['540', '545', '550', '570', '575', '580', '585', '590', '600', '610', '615', '620']} category="module_wp" isEditing={editingSection === 'cus'} user={user} />
                    <EditableDetailItem label="No of Modules" field="no_of_modules" value={editData.no_of_modules} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={editData.system_capacity_kwp} onChange={handleChange} isEditing={editingSection === 'cus'} />
                </div>
            </section>

            {/* Document Checklist */}
            <section id="section-reg_checklist">
                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList size={12} /> Document Checklist
                    </h3>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-4">
                    {/* Payment Type Selection at the top */}
                    <div className="pb-3 border-b border-stone-100">
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Payment Type Selection</label>
                        {isEditable ? (
                            <select
                                value={editData.payment_type || ''}
                                onChange={(e) => handleChange('payment_type', e.target.value)}
                                className="w-full md:w-1/3 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700"
                            >
                                <option value="">Select Payment Type...</option>
                                {(meta['payment_type'] || []).map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        ) : (
                            <p className="text-xs font-bold text-stone-700">{editData.payment_type || "Not Specified"}</p>
                        )}
                    </div>

                    {/* Checklist items only visible if payment_type is selected */}
                    {editData.payment_type ? (
                        <div className="flex flex-col gap-2">
                            {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                <>
                                    <CheckboxRemarkItem label="Aadhar Card Front" field="adhaar_card_front" value={editData.adhaar_card_front} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                                    <CheckboxRemarkItem label="Aadhar Card Back" field="adhaar_card_back" value={editData.adhaar_card_back} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                                    <CheckboxRemarkItem label="PAN Card" field="pan_card" value={editData.pan_card} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                                    <CheckboxRemarkItem label="Vera Pavti / aakarni" field="index_2" value={editData.index_2} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                                </>
                            )}
                            <CheckboxRemarkItem label="Light Bill" field="light_bill" value={editData.light_bill} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                            <CheckboxRemarkItem label="Bank Details" field="bank_details" value={editData.bank_details} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                            <CheckboxRemarkItem label="House Geo Tag Photo" field="house_geo_tag_photo" value={editData.house_geo_tag_photo} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                            <CheckboxRemarkItem label="Extra Documents" field="extra_docs" value={editData.extra_docs} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onDeleteDocument} onPreview={onViewDocument} onUpdateRemark={onUpdateRemark} />
                        </div>
                    ) : (
                        <p className="text-xs text-stone-400 italic">Please select a Payment Type above to display the Document Checklist.</p>
                    )}

                    {isEditable && isRegChecklistDirty && (
                        <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
                            <button onClick={handleSaveRegChecklist}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10">
                                Save Checklist
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}