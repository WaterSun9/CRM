import React from 'react';
import { User, ClipboardList, Upload, Eye, Trash2 } from 'lucide-react';
import { SectionHeader, EditableDetailItem, CheckboxRemarkItem } from './shared';

// ─── DocumentChecklistItem ─────────────────────────────────────────────────
// Checkbox row + attach file + list of attached files (view/delete) for one
// checklist field. `field` doubles as the doc_type tag on the documents table.
function DocumentChecklistItem({
    label,
    field,
    value,
    onChange,
    isEditing,
    documents = [],
    uploading,
    onFileUpload,
    onViewDocument,
    onDeleteDocument,
}) {
    const attached = documents.filter(d => d.doc_type === field);

    return (
        <div className="py-2 flex flex-col gap-2 border-b border-stone-50 last:border-b-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2.5">
                    {isEditing ? (
                        <input
                            type="checkbox"
                            id={field}
                            checked={!!value}
                            onChange={e => onChange(field, e.target.checked)}
                            className="w-4 h-4 text-amber-500 border-stone-300 rounded focus:ring-amber-500 cursor-pointer"
                        />
                    ) : (
                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${value ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-100 border-stone-300 text-transparent'}`}>
                            {value && <svg className="w-2.5 h-2.5 stroke-[3] stroke-current" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                        </div>
                    )}
                    <label htmlFor={field} className={`text-xs font-semibold cursor-pointer select-none ${!isEditing && value ? 'text-stone-400 line-through' : 'text-stone-700'}`}>
                        {label}
                    </label>
                </div>

                {isEditing && (
                    <label className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-700 cursor-pointer">
                        <Upload size={12} />
                        {uploading ? 'Uploading...' : 'Attach File'}
                        <input
                            type="file"
                            className="hidden"
                            disabled={uploading}
                            onChange={(e) => onFileUpload(e, field)}
                        />
                    </label>
                )}
            </div>

            {attached.length > 0 && (
                <div className="ml-6 flex flex-col gap-1">
                    {attached.map(doc => (
                        <div key={doc.id} className="flex items-center justify-between gap-2 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                            <span className="text-[11px] text-stone-600 font-medium truncate">{doc.file_name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                    onClick={() => onViewDocument(doc)}
                                    className="p-1 text-stone-400 hover:text-amber-600 transition-colors"
                                    title="View"
                                >
                                    <Eye size={13} />
                                </button>
                                {isEditing && (
                                    <button
                                        onClick={() => onDeleteDocument(doc)}
                                        className="p-1 text-stone-400 hover:text-red-500 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

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
    documents,
    uploading,
    onFileUpload,
    onViewDocument,
    onDeleteDocument,
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
                        <div className="flex flex-col">
                            {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                <>
                                    <DocumentChecklistItem
                                        label="Adhaar card" field="adhaar_card" value={editData.adhaar_card}
                                        onChange={handleChange} isEditing={isEditable}
                                        documents={documents} uploading={uploading}
                                        onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                                    />
                                    <DocumentChecklistItem
                                        label="Pan card" field="pan_card" value={editData.pan_card}
                                        onChange={handleChange} isEditing={isEditable}
                                        documents={documents} uploading={uploading}
                                        onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                                    />
                                    <DocumentChecklistItem
                                        label="Index 2" field="index_2" value={editData.index_2}
                                        onChange={handleChange} isEditing={isEditable}
                                        documents={documents} uploading={uploading}
                                        onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                                    />
                                </>
                            )}
                            <DocumentChecklistItem
                                label="Light Bill" field="light_bill" value={editData.light_bill}
                                onChange={handleChange} isEditing={isEditable}
                                documents={documents} uploading={uploading}
                                onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                            />
                            <DocumentChecklistItem
                                label="Bank details" field="bank_details" value={editData.bank_details}
                                onChange={handleChange} isEditing={isEditable}
                                documents={documents} uploading={uploading}
                                onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                            />
                            {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                <DocumentChecklistItem
                                    label="Bank Passbook" field="bank_passbook" value={editData.bank_passbook}
                                    onChange={handleChange} isEditing={isEditable}
                                    documents={documents} uploading={uploading}
                                    onFileUpload={onFileUpload} onViewDocument={onViewDocument} onDeleteDocument={onDeleteDocument}
                                />
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