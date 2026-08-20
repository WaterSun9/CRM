import React from 'react';
import { ClipboardList, Paperclip, Edit3, X } from 'lucide-react';
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
    onFilePreview,
    onUpdateRemark
}) {
    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Registration Details */}
            <section id="section-reg_details">
                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-2">
                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                        <ClipboardList size={12} className="text-amber-500" /> Registration Details
                    </h3>
                    <div className="flex items-center gap-2.5">
                        {isEditable && (
                            <button 
                                type="button"
                                onClick={() => {
                                    const isOpening = editingSection !== 'reg_details';
                                    if (setEditingSection) {
                                        setEditingSection(isOpening ? 'reg_details' : null);
                                    }
                                    if (isOpening) {
                                        setTimeout(() => {
                                            const el = document.getElementById('section-reg_details');
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }, 150);
                                    }
                                }} 
                                className="text-stone-400 hover:text-amber-600 transition-colors p-1 cursor-pointer"
                            >
                                {editingSection === 'reg_details' ? <X size={14} /> : <Edit3 size={13} />}
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    <EditableDetailItem 
                        label="Registration date" 
                        field="registration_date" 
                        value={editData.registration_date} 
                        onChange={handleChange} 
                        type="date" 
                        isEditing={editingSection === 'reg_details'} 
                    />
                    <EditableDetailItem 
                        label="Registration By" 
                        field="registration_by" 
                        value={editData.registration_by} 
                        onChange={handleChange} 
                        options={meta['registration_by']} 
                        category="registration_by" 
                        isEditing={editingSection === 'reg_details'} 
                        user={user} 
                    />
                    <EditableDetailItem 
                        label="Feasibility No" 
                        field="registration_no" 
                        value={editData.registration_no || editData.feasibility_no} 
                        onChange={handleChange} 
                        isEditing={editingSection === 'reg_details'} 
                    />
                    <EditableDetailItem 
                        label="File No" 
                        field="folder_no" 
                        value={editData.folder_no} 
                        onChange={handleChange} 
                        type="number" 
                        isEditing={editingSection === 'reg_details'} 
                    />
                </div>

                {/* Registration Checklists & Uploads - Interactive outside pencil edit mode */}
                <div className="mt-5 bg-white p-4 rounded-2xl border border-stone-100 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                        <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Paperclip size={12} className="text-amber-500" /> Registration Documents & Checklists
                        </h4>
                        <span className="text-[9px] font-bold text-amber-600 uppercase bg-amber-50 px-2 py-0.5 rounded">
                            Documents or Checkboxes Required
                        </span>
                    </div>

                    <div className="flex flex-col gap-2">
                        <CheckboxRemarkItem
                            label="Feasibility Document"
                            field="feasibilty_document"
                            value={editData.feasibilty_document}
                            onChange={handleChange}
                            isEditing={isEditable}
                            documents={documents}
                            onUpload={onFileUpload}
                            onDelete={onFileDelete}
                            onPreview={onFilePreview}
                            onUpdateRemark={onUpdateRemark}
                        />
                        <CheckboxRemarkItem
                            label="Subsidy Token Photo"
                            field="subsidy_token_photo"
                            value={editData.subsidy_token_photo}
                            onChange={handleChange}
                            isEditing={isEditable}
                            documents={documents}
                            onUpload={onFileUpload}
                            onDelete={onFileDelete}
                            onPreview={onFilePreview}
                            onUpdateRemark={onUpdateRemark}
                        />
                    </div>
                </div>
            </section>
        </div>
    );
}
