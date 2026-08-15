import React from 'react';
import { User, ClipboardList } from 'lucide-react';
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
    handleSaveRegChecklist
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Customer Info */}
            <section id="section-cus">
                <SectionHeader title="Customer Info" id="cus" icon={User} isEditable={isEditable} editingSection={editingSection} setEditingSection={setEditingSection} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <EditableDetailItem label="Customer Name" field="customer_name" value={editData.customer_name} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Phone Number" field="phone_number" value={editData.phone_number} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Email Address" field="email" value={editData.email} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Villages" field="villages" value={editData.villages} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Folder No" field="folder_no" value={editData.folder_no} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={editData.channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} channel_partners={channel_partners} isAdmin={isAdmin} />
                    <EditableDetailItem label="Sub Channel Partner Name" field="sub_channel_partner" value={editData.sub_channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={editData.system_capacity_kwp} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={editData.module_brand} onChange={handleChange} options={meta['module_brand']} category="module_brand" isEditing={editingSection === 'cus'} user={user} />
                    <EditableDetailItem label="MODULE WP" field="module_wp" value={editData.module_wp} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={editData.sub_divisions} onChange={handleChange} isEditing={editingSection === 'cus'} />
                    <EditableDetailItem label="Consumer No" field="consumer_no" value={editData.consumer_no} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />

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
                                    <CheckboxRemarkItem label="Adhaar card" field="adhaar_card" value={editData.adhaar_card} onChange={handleChange} isEditing={isEditable} />
                                    <CheckboxRemarkItem label="Pan card" field="pan_card" value={editData.pan_card} onChange={handleChange} isEditing={isEditable} />
                                    <CheckboxRemarkItem label="Index 2" field="index_2" value={editData.index_2} onChange={handleChange} isEditing={isEditable} />
                                </>
                            )}
                            <CheckboxRemarkItem label="Light Bill" field="light_bill" value={editData.light_bill} onChange={handleChange} isEditing={isEditable} />
                            <CheckboxRemarkItem label="Bank details" field="bank_details" value={editData.bank_details} onChange={handleChange} isEditing={isEditable} />
                            {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                <CheckboxRemarkItem label="Bank Passbook" field="bank_passbook" value={editData.bank_passbook} onChange={handleChange} isEditing={isEditable} />
                            )}
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
