import React from 'react';
import { ClipboardList } from 'lucide-react';
import { SectionHeader, EditableDetailItem, CheckboxRemarkItem } from './shared';

export default function RegistrationTab({
    editData,
    handleChange,
    editingSection,
    setEditingSection,
    meta,
    user,
    isEditable,
    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Registration Details */}
            <section id="section-reg_details">
                <SectionHeader title="Registration Details" id="reg_details" icon={ClipboardList} isEditable={isEditable} editingSection={editingSection} setEditingSection={setEditingSection} />
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <EditableDetailItem label="Registration date" field="registration_date" value={editData.registration_date} onChange={handleChange} type="date" isEditing={editingSection === 'reg_details'} />
                    <EditableDetailItem label="Registration By" field="registration_by" value={editData.registration_by} onChange={handleChange} options={meta['registration_by']} category="registration_by" isEditing={editingSection === 'reg_details'} user={user} />
                    <EditableDetailItem label="Registration No" field="registration_no" value={editData.registration_no} onChange={handleChange} isEditing={editingSection === 'reg_details'} />
                </div>

                <div className="mt-4 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-3">
                    <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                        <ClipboardList size={12} /> Registration Checklists
                    </h4>
                    <div className="flex flex-col gap-2">
                        <CheckboxRemarkItem
                            label="Feasibility Document Checked"
                            field="feasibilty_document"
                            value={editData.feasibilty_document}
                            onChange={handleChange}
                            isEditing={editingSection === 'reg_details'}
                            documents={documents}
                            onUpload={onFileUpload}
                            onDelete={onFileDelete}
                            onPreview={onFilePreview}
                        />
                        <CheckboxRemarkItem
                            label="Subsidy Token Photo Checked"
                            field="subsidy_token_photo"
                            value={editData.subsidy_token_photo}
                            onChange={handleChange}
                            isEditing={editingSection === 'reg_details'}
                            documents={documents}
                            onUpload={onFileUpload}
                            onDelete={onFileDelete}
                            onPreview={onFilePreview}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
