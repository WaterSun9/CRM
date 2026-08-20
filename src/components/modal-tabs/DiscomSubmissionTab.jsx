import React from 'react';
import { ClipboardList, Save, FileText, Printer } from 'lucide-react';
import { Page1 } from '../agreement/Page1';
import { CheckboxRemarkItem } from './shared';

const formatDateToDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

export default function DiscomSubmissionTab({
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
    onGenerateAgreement,
    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview,
    onUpdateRemark
}) {
    const submissionData = editData.discom_submission || {
        submitted_by: '',
        date: ''
    };

    const handleSubmissionFieldChange = (field, val) => {
        const updated = {
            ...submissionData,
            [field]: val
        };
        setEditData(prev => ({ ...prev, discom_submission: updated }));
    };

    const isSubmissionDirty = JSON.stringify(editData.discom_submission) !== JSON.stringify(customer.discom_submission);

    return (
        <div className="space-y-4 animate-in fade-in duration-300">
            {/* File & DCR Checklist Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-amber-500" /> Utility File Checklist
                </h4>
                <div className="flex flex-col gap-2">
                    <CheckboxRemarkItem label="File Status" field="file_status" value={editData.file_status} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} onUpdateRemark={onUpdateRemark} />
                    <CheckboxRemarkItem label="DCR Certificate" field="dcr_certificate" value={editData.dcr_certificate} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} onUpdateRemark={onUpdateRemark} />
                    <CheckboxRemarkItem label="Signature Photo" field="signature_pic" value={editData.signature_pic} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} onUpdateRemark={onUpdateRemark} />
                    <CheckboxRemarkItem label="Stamp" field="stamp" value={editData.stamp} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} onUpdateRemark={onUpdateRemark} />
                    <CheckboxRemarkItem label="PM Surya GPAE Stamp" field="pm_surya_gpae_stamp" value={editData.pm_surya_gpae_stamp} onChange={handleChange} isEditing={isEditable} documents={documents} onUpload={onFileUpload} onDelete={onFileDelete} onPreview={onFilePreview} onUpdateRemark={onUpdateRemark} />
                </div>
                {isEditable && (editData.file_status !== customer.file_status || editData.dcr_certificate !== customer.dcr_certificate || editData.signature_pic !== customer.signature_pic || editData.stamp !== customer.stamp || editData.pm_surya_gpae_stamp !== customer.pm_surya_gpae_stamp) && (
                    <div className="flex justify-end pt-2">
                        <button
                            type="button"
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { 
                                    file_status: editData.file_status,
                                    dcr_certificate: editData.dcr_certificate,
                                    signature_pic: editData.signature_pic,
                                    stamp: editData.stamp,
                                    pm_surya_gpae_stamp: editData.pm_surya_gpae_stamp
                                });
                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated Utility File Checklist (File Status: ${editData.file_status ? 'Uploaded' : 'Pending'}, DCR: ${editData.dcr_certificate ? 'Uploaded' : 'Pending'}, Signature: ${editData.signature_pic ? 'Uploaded' : 'Pending'}, Stamp: ${editData.stamp ? 'Uploaded' : 'Pending'}, GPAE Stamp: ${editData.pm_surya_gpae_stamp ? 'Uploaded' : 'Pending'})`, '', customer.id);
                                setSaving(false);
                                fetchLogs();
                            }}
                            disabled={saving}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <Save className="w-4 h-4" /> Save Checklist
                        </button>
                    </div>
                )}
            </div>

            {/* Discom Submission Details Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                    <div>
                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest font-bold">Discom Submission Details</h4>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Track paperwork submission handler and date.</p>
                    </div>
                    {isEditable && isSubmissionDirty && (
                        <button
                            onClick={async () => {
                                setSaving(true);
                                await onUpdate(customer.id, { discom_submission: submissionData });
                                await logActivity(
                                    user.id,
                                    'update',
                                    `${customer.customer_name}: Updated Discom Submission details (Submitted By: ${submissionData.submitted_by || 'N/A'}, Date: ${submissionData.date || 'N/A'})`,
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">File Submitted By</label>
                        <input
                            type="text"
                            disabled={!isEditable}
                            placeholder="Enter name..."
                            value={submissionData.submitted_by || ''}
                            onChange={e => handleSubmissionFieldChange('submitted_by', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Submission Date</label>
                        <input
                            type="date"
                            disabled={!isEditable}
                            value={submissionData.date || ''}
                            onChange={e => handleSubmissionFieldChange('date', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                </div>
            </div>

            {/* Agreement Generator Card */}
            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-4 h-4 text-blue-600" /> PM Surya Ghar Model Agreement
                    </h4>
                    <p className="text-xs text-stone-500 font-medium mt-1">
                        Generate and print the official model agreement pre-filled with this client's details.
                    </p>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Agreement Execution Date</label>
                            <input
                                type="date"
                                disabled={!isEditable}
                                value={editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0]}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setEditData(prev => {
                                        const prevObj = typeof prev.stages_remarks === 'object' && prev.stages_remarks ? prev.stages_remarks : {};
                                        return {
                                            ...prev,
                                            stages_remarks: {
                                                ...prevObj,
                                                discom_agreement_date: val
                                            }
                                        };
                                    });
                                }}
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                            />
                        </div>
                    </div>

                    {/* Inline Document Preview Box */}
                    <div className="border border-stone-150 rounded-[20px] bg-stone-50 p-4 shadow-inner">
                        <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-2">Live Document Preview (Page 1)</p>
                        <div className="w-full overflow-x-auto overflow-y-hidden max-h-[350px] border border-stone-200 rounded-xl bg-white flex justify-center py-4">
                            <div className="origin-top scale-[0.6] -my-24" style={{ width: '210mm', height: '297mm' }}>
                                <Page1
                                    data={{
                                        executionDate: formatDateToDDMMYYYY(editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0]),
                                        consumerName: editData.customer_name || '',
                                        consumerNo: editData.consumer_no || '',
                                        village: editData.villages || '',
                                        taluka: editData.villages || '',
                                        district: editData.sub_divisions || '',
                                        vendorName: 'Watersun Electrical Solutions Pvt Ltd',
                                        vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
                                        paymentTerms: 'Mutually Agreed Terms of Payment',
                                        showHighlights: true,
                                        highlightColor: '#fef08a'
                                    }}
                                    fontSizeClass="text-[14px]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 flex justify-start gap-3">
                        {/* Save Agreement Date button */}
                        {isEditable && editData.stages_remarks?.discom_agreement_date !== customer.stages_remarks?.discom_agreement_date && (
                            <button
                                type="button"
                                onClick={async () => {
                                    setSaving(true);
                                    const updatedRemarks = {
                                        ...(typeof editData.stages_remarks === 'object' && editData.stages_remarks ? editData.stages_remarks : {}),
                                        discom_agreement_date: editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0]
                                    };
                                    await onUpdate(customer.id, { stages_remarks: updatedRemarks });
                                    await logActivity(user.id, 'update', `${customer.customer_name}: Updated Agreement Execution Date`, '', customer.id);
                                    setSaving(false);
                                    fetchLogs();
                                }}
                                disabled={saving}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                            >
                                <Save className="w-4 h-4" /> Save Date
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={onGenerateAgreement}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 cursor-pointer"
                        >
                            <Printer className="w-4 h-4" /> Pop Open & Print Agreement
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
