// ─── CustomerDetailModal.jsx ──────────────────────────────────────────────────
// Full customer detail: 4-tab layout (Overview, Finance & Bank, Checklist,
// Notes & History). Section-level editing, payments array editor, generic
// history entry editor, financial tag toggle, and system activity timeline.
//
// CLIENT CUSTOMISATION:
//   • Sections and fields: edit the <section> blocks in the Overview/Finance tabs
//   • Checklist template: edit DEFAULT_PROJECT_CHECKLIST in models.jsx
//   • Stage/tag options: edit constants.js
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import {
    X, Edit3, Trash2, Save, Send, AlertTriangle, CheckSquare,
    User, Zap, IndianRupee, Building2, FolderOpen, MapPin,
    LayoutDashboard, History, Plus, ShieldCheck, Lock, Unlock, ClipboardList, Banknote, Tag, Mail, PauseCircle, Check,
    Eye, Search, Image as ImageIcon, MessageSquare
} from 'lucide-react';
import { PRIMARY_STAGES, SUBSIDY_TAGS, SUBSIDY_TAG_COLORS, LOAN_TAGS, LOAN_TAG_COLORS, ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE } from '../constants';
import { logActivity, formatLogDate, formatINR, toIndianCommas, formatInputValue, parseIndianNumber } from '../utils';
import { supabase } from '../supabase';
import HistoryEntryEditor from './HistoryEntryEditor';
import { AgreementPreview } from './agreement/AgreementPreview';
import { Page1 } from './agreement/Page1';
import { FileText, Printer } from 'lucide-react';
import { uploadDocument, getCustomerDocuments, getDownloadUrl, getViewUrl, deleteDocument, updateDocumentRemark } from '../utils';

// ─── DOC_TYPE_LABELS: Human readable names for document categories ───────────
const DOC_TYPE_LABELS = {
    adhaar_card_front: 'Aadhaar Card (Front)',
    adhaar_card_back: 'Aadhaar Card (Back)',
    pan_card: 'PAN Card',
    light_bill: 'Electricity / Light Bill',
    index_2: 'Index-2 Copy',
    bank_details: 'Bank Passbook / Cheque',
    house_geo_tag_photo: 'House Photo',
    extra_docs: 'Extra Documents',
    geo_tag_image: 'Geo Tag Photo',
    sfdc_photo: 'SFDC Photo',
    file_status: 'File Status Doc',
    dcr_certificate: 'DCR Certificate',
    signature_pic: 'Customer Signature',
    signature: 'Customer Signature',
    firstPartySignature: 'Customer Signature',
    customer_signature: 'Customer Signature',
    stamp: 'Vendor Stamp',
    stamp_pic: 'Vendor Stamp',
    vendor_stamp: 'Vendor Stamp',
    secondPartyStamp: 'Vendor Stamp',
    pm_surya_gpae_stamp: 'PM Surya GPAE Stamp',
    surya_gpae_stamp: 'PM Surya GPAE Stamp',
    gpae_stamp: 'PM Surya GPAE Stamp',
    meter_installation_photo: 'Meter Installation Photo',
    meter_photo: 'Meter Installation Photo',
    warranty_card: 'Warranty Card',
    insurance_status: 'Insurance Document',
    feasibilty_document: 'Feasibility Document',
    feasibility_document: 'Feasibility Document',
    subsidy_token_photo: 'Subsidy Token Photo'
};

const getDocTypeLabel = (type) => {
    if (!type) return 'Client Attachment';
    if (DOC_TYPE_LABELS[type]) return DOC_TYPE_LABELS[type];
    return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

import LeadsTab from './modal-tabs/LeadsTab';
import RegistrationTab from './modal-tabs/RegistrationTab';
import LoanTab from './modal-tabs/LoanTab';
import CashTab from './modal-tabs/CashTab';
import MaterialOrderTab from './modal-tabs/MaterialOrderTab';
import MaterialIntegrationTab from './modal-tabs/MaterialIntegrationTab';
import HoldProcurementTab from './modal-tabs/HoldProcurementTab';
import MaterialDeliveryTab from './modal-tabs/MaterialDeliveryTab';
import InstallationStatusTab from './modal-tabs/InstallationStatusTab';
import GeoTagPhotoTab from './modal-tabs/GeoTagPhotoTab';
import DiscomSubmissionTab from './modal-tabs/DiscomSubmissionTab';
import MeterInstallationTab from './modal-tabs/MeterInstallationTab';
import DiscomInspectionTab from './modal-tabs/DiscomInspectionTab';
import SubsidyStatusTab from './modal-tabs/SubsidyStatusTab';
import FinalReviewTab from './modal-tabs/FinalReviewTab';
import HistoryTab from './modal-tabs/HistoryTab';
import { FilePreviewModal } from './modal-tabs/shared';

// ─── formatMoney: uses centralized Indian comma system from utils ─────────────
const fmt = formatINR;

// ─── formatDateTime: helper to format date as "04 Aug, 11:01 PM" ──────────────
const formatDateTime = (date) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = date.getDate().toString().padStart(2, '0');
    const m = months[date.getMonth()];
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = hours.toString().padStart(2, '0');
    return `${d} ${m}, ${h}:${minutes} ${ampm}`;
};

// ─── formatDateToDDMMYYYY: formats "YYYY-MM-DD" to "DD/MM/YYYY" ──────────────
const formatDateToDDMMYYYY = (dateStr) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
};

// ─── getStageRemarkFromData: robust helper to extract remark ─────────────────
const getStageRemarkFromData = (stagesRemarksObj, stageName) => {
    if (!stagesRemarksObj) return '';
    if (typeof stagesRemarksObj === 'object') {
        return stagesRemarksObj[stageName] || '';
    }
    if (typeof stagesRemarksObj === 'string') {
        try {
            const parsed = JSON.parse(stagesRemarksObj);
            if (typeof parsed === 'object' && parsed) {
                return parsed[stageName] || '';
            }
            return parsed || '';
        } catch (e) {
            return stagesRemarksObj;
        }
    }
    return '';
};

// ─── MetaSelect: standard select dropdown for metadata fields ─────────────────
function MetaSelect({ label, field, value, onChange, options = [], isEditing }) {
    if (!isEditing) {
        return (
            <div className="bg-stone-50 p-3 rounded-xl">
                <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
                <p className="text-sm font-semibold truncate text-stone-800">{value || '–'}</p>
            </div>
        );
    }

    return (
        <div className="bg-stone-50 p-3 rounded-xl">
            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
            <select value={value || ''} onChange={e => onChange(field, e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300">
                <option value="">Select...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

// ─── StageRemarkSection ───────────────────────────────────────────────────────
function StageRemarkSection({ stageId, editData, setEditData, isFrozen, onSave }) {
    const [localSaved, setLocalSaved] = useState(true);
    const remark = getStageRemarkFromData(editData.stages_remarks, stageId);

    return (
        <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-1">
                <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Stage Remark ({stageId})</label>
                {!isFrozen && !localSaved && (
                    <button
                        onClick={async () => {
                            await onSave(stageId);
                            setLocalSaved(true);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10"
                    >
                        Save Remark
                    </button>
                )}
            </div>
            {isFrozen ? (
                <div className="text-xs text-stone-500 font-medium italic min-h-[36px] bg-stone-50 p-2.5 rounded-xl">
                    {remark || 'No remarks for this stage.'}
                </div>
            ) : (
                <div className="flex gap-2">
                    <input
                        type="text"
                        placeholder={`Add remark for ${stageId}...`}
                        value={remark}
                        onChange={e => {
                            const newVal = e.target.value;
                            setLocalSaved(false);
                            setEditData(prev => {
                                const prevObj = typeof prev.stages_remarks === 'object' && prev.stages_remarks ? prev.stages_remarks : {};
                                return {
                                    ...prev,
                                    stages_remarks: {
                                        ...prevObj,
                                        [stageId]: newVal
                                    }
                                };
                            });
                        }}
                        onKeyDown={async (e) => {
                            if (e.key === 'Enter') {
                                await onSave(stageId);
                                setLocalSaved(true);
                            }
                        }}
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                </div>
            )}
        </section>
    );
}

// ─── DetailItem / EditableDetailItem ──────────────────────────────────────────
function DetailItem({ label, value, isMoney = false, isEnergy = false }) {
    return (
        <div className="bg-stone-50 p-3 rounded-xl">
            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
            <p className={`text-sm font-semibold truncate ${isMoney ? 'text-emerald-600' : isEnergy ? 'text-amber-600' : 'text-stone-800'}`}>
                {isMoney ? fmt(value) : (value || '–')}
            </p>
        </div>
    );
}

// Autocomplete component for Channel Partner Name selector inside editing view
function ChannelPartnerAutocomplete({ label, value, onChange, suggestions = [], isAdmin = false }) {
    const [inputValue, setInputValue] = useState(value || '');
    const [showSuggestions, setShowSuggestions] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        setInputValue(value || '');
    }, [value]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (containerRef.current && !containerRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filtered = inputValue.trim()
        ? suggestions.filter(s => s.toLowerCase().includes(inputValue.trim().toLowerCase()))
        : suggestions;

    const handleSelect = (val) => {
        setInputValue(val);
        onChange(val);
        setShowSuggestions(false);
    };

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        onChange(val);
        setShowSuggestions(true);
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <input
                type="text"
                value={inputValue}
                onChange={handleInputChange}
                onFocus={() => setShowSuggestions(true)}
                className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300"
                placeholder={label}
            />
            {showSuggestions && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-100 rounded-lg shadow-xl z-50 max-h-40 overflow-y-auto py-1">
                    {filtered.map(s => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => handleSelect(s)}
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function EditableDetailItem({ label, field, value, onChange, type = 'text', isMoney = false, isEnergy = false, isEditing, options, category, meta, channel_partners = [], isAdmin = false, user }) {
    // Metadata-driven dropdown with add-new
    if (options && category) {
        return <MetaSelect label={label} field={field} value={value} onChange={onChange} options={options} isEditing={isEditing} />;
    }
    if (!isEditing) return <DetailItem label={label} value={value} isMoney={isMoney} isEnergy={isEnergy} />;

    if (field === 'channel_partner') {
        return (
            <div className="bg-stone-50 p-3 rounded-xl">
                <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
                <ChannelPartnerAutocomplete label={label} value={value} onChange={(val) => onChange(field, val)} suggestions={channel_partners} isAdmin={isAdmin} />
            </div>
        );
    }

    return (
        <div className="bg-stone-50 p-3 rounded-xl">
            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
            {options ? (
                <select value={value || ''} onChange={e => onChange(field, e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300">
                    <option value="">Select...</option>
                    {options.map(o => <option key={o}>{o}</option>)}
                </select>
            ) : isMoney ? (
                <input type="text" inputMode="decimal" value={value ? toIndianCommas(value) : ''}
                    onChange={e => onChange(field, parseIndianNumber(e.target.value))}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
            ) : (
                <input type={type} value={value || ''} onChange={e => onChange(field, e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
            )}
        </div>
    );
}

function CheckboxRemarkItem({ label, field, value, onChange, isEditing }) {
    const isUploaded = Boolean(value);

    return (
        <div className="py-1.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div 
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            isUploaded 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'bg-stone-100 border-stone-300 text-transparent'
                        }`}
                        title={isUploaded ? 'Uploaded' : 'Not Uploaded'}
                    >
                        {isUploaded && (
                            <svg className="w-2.5 h-2.5 stroke-[3] stroke-current" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        )}
                    </div>
                    <span className={`text-xs select-none ${isUploaded ? 'font-bold text-stone-900' : 'font-medium text-stone-600'}`}>
                        {label}
                    </span>
                    {isUploaded ? (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                            Uploaded
                        </span>
                    ) : (
                        <span className="text-[9px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded">
                            Not Uploaded
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

function DocGalleryRemarkRow({ doc, onUpdateRemark, isEditable }) {
    const [isEditing, setIsEditing] = useState(false);
    const [remarkVal, setRemarkVal] = useState(doc.remark || '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setRemarkVal(doc.remark || '');
    }, [doc.remark]);

    const handleSave = async () => {
        if (!onUpdateRemark) return;
        setSaving(true);
        await onUpdateRemark(doc.id, remarkVal);
        setSaving(false);
        setIsEditing(false);
    };

    if (isEditing) {
        return (
            <div className="pt-2 mt-1 border-t border-stone-200/60 flex items-center gap-1.5 animate-in fade-in">
                <input
                    type="text"
                    value={remarkVal}
                    placeholder="Remark for this document..."
                    onChange={e => setRemarkVal(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSave();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    autoFocus
                    className="flex-1 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                />
                <button
                    type="button"
                    disabled={saving}
                    onClick={handleSave}
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                >
                    {saving ? '...' : 'Save'}
                </button>
                <button
                    type="button"
                    onClick={() => setIsEditing(false)}
                    className="px-2 py-1 text-stone-400 hover:text-stone-600 text-xs font-medium cursor-pointer"
                >
                    Cancel
                </button>
            </div>
        );
    }

    if (doc.remark) {
        return (
            <div className="pt-2 mt-1 border-t border-stone-200/60 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 flex-1 bg-amber-50/80 px-2 py-1 rounded-lg border border-amber-200/60">
                    <MessageSquare size={11} className="text-amber-600 flex-shrink-0" />
                    <span className="text-[11px] text-amber-900 font-medium truncate" title={doc.remark}>
                        {doc.remark}
                    </span>
                </div>
                {isEditable && (
                    <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] font-bold text-stone-500 hover:text-stone-800 underline cursor-pointer flex-shrink-0"
                    >
                        Edit Remark
                    </button>
                )}
            </div>
        );
    }

    if (isEditable) {
        return (
            <div className="pt-1.5 mt-0.5 border-t border-dashed border-stone-200 flex justify-end">
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-[10px] text-stone-400 hover:text-stone-700 font-bold flex items-center gap-1 cursor-pointer transition"
                >
                    <MessageSquare size={10} />
                    <span>+ Add Remark</span>
                </button>
            </div>
        );
    }

    return null;
}

// ─── PaymentsEditor ───────────────────────────────────────────────────────────
// onChange(newPayments, totalReceived) — passes total up so parent can save it
function PaymentsEditor({ payments = [], onChange, isEditing }) {
    const handleChange = (idx, field, val) => {
        const next = payments.map((p, i) => i === idx ? { ...p, [field]: val } : p);
        const total = next.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        onChange(next, total);
    };
    const addPayment = () => {
        const next = [...payments, { no: payments.length + 1, amount: '', date: '' }];
        const total = next.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        onChange(next, total);
    };
    const removePayment = (idx) => {
        const next = payments.filter((_, i) => i !== idx);
        const total = next.reduce((s, p) => s + (Number(p.amount) || 0), 0);
        onChange(next, total);
    };

    const displayTotal = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

    if (!isEditing) return (
        <div className="space-y-2">
            {payments.length === 0 && <p className="text-xs text-stone-400 italic">No payments recorded</p>}
            {payments.map((p, i) => (
                <div key={i} className="bg-stone-50 p-3 rounded-xl flex justify-between items-center">
                    <div>
                        <p className="text-[9px] text-stone-400 font-bold uppercase">Payment {p.no || i + 1}</p>
                        <p className="text-sm font-semibold text-emerald-600">{formatINR(p.amount)}</p>
                    </div>
                    {p.date && <p className="text-xs text-stone-400">{p.date}</p>}
                </div>
            ))}
            {payments.length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 flex justify-between items-center border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Total Received</p>
                    <p className="text-sm font-bold text-emerald-700">{formatINR(displayTotal)}</p>
                </div>
            )}
        </div>
    );

    return (
        <div className="space-y-2">
            {payments.map((p, i) => (
                <div key={i} className="bg-stone-50 p-3 rounded-xl space-y-2 border border-stone-200">
                    <div className="flex items-center justify-between">
                        <p className="text-[9px] font-bold text-stone-400 uppercase">Payment {p.no || i + 1}</p>
                        <button onClick={() => removePayment(i)} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <input type="text" inputMode="decimal" placeholder="Amount (₹)" value={p.amount ? toIndianCommas(p.amount) : ''}
                            onChange={e => handleChange(i, 'amount', parseIndianNumber(e.target.value))}
                            className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                        <input type="date" value={p.date || ''}
                            onChange={e => handleChange(i, 'date', e.target.value)}
                            className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
                    </div>
                </div>
            ))}
            <button onClick={addPayment}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-stone-300 rounded-xl py-2 text-xs text-stone-500 hover:border-amber-400 hover:text-amber-600 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Payment
            </button>
            {payments.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-3 flex justify-between items-center border border-amber-100">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Auto Total (will save)</p>
                    <p className="text-sm font-bold text-amber-700">{formatINR(displayTotal)}</p>
                </div>
            )}
        </div>
    );
}

// ─── Subsidy status options ───────────────────────────────────────────────────
const SUBSIDY_STATUS_OPTIONS = ['Approved', 'Returned', 'Rejected', 'Redeemed', 'Received'];
const LOAN_STATUS_OPTIONS = ['Processed', 'Sanctioned', 'Rejected', 'Returned', '1st Payment', '2nd Payment'];

// ─── CustomerDetailModal ──────────────────────────────────────────────────────
export default function CustomerDetailModal({ customer, onClose, onUpdate, onDelete, user, meta, channel_partners = [], defaultTab }) {
    const [activeTab, setActiveTab] = useState(() => {
        if (defaultTab) return defaultTab;
        return customer?.stage || 'LEADS';
    });
    const [editingSection, setEditingSection] = useState(null);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [editData, setEditData] = useState({ ...customer });

    const handleEditDataChange = (updater) => {
        setIsFormDirty(true);
        setEditData(updater);
    };
    const [followUpText, setFollowUpText] = useState('');
    const [saving, setSaving] = useState(false);
    const [sendingInfo, setSendingInfo] = useState(false);
    const [infoSentStatus, setInfoSentStatus] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [showCompletedConfirm, setShowCompletedConfirm] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const [filePreview, setFilePreview] = useState({ doc: null, url: null });
    const isAdmin = user?.userType === 'admin';
    const isCompleted = customer.stage === 'COMPLETED';
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    // Frozen for ALL users when completed. Admin can temporarily unlock.
    const isFrozen = isCompleted && !(isAdmin && adminUnlocked);

    const isAgent = user?.userType === 'agent';
    const isSales = user?.userType === 'sales';
    const isOffice = user?.userType === 'sales' || user?.role === 'Office';

    const isDiscomOrMeterStage = editData.stage === 'DISCOM SUBMISSION' || editData.stage === 'METER INSTALLATION';

    const canUserEdit = (() => {
        if (isAdmin) return true;
        if (isAgent) {
            // Agent can edit if it's their client AND the customer is in DISCOM SUBMISSION or METER INSTALLATION stage
            const isMyClient = customer.channel_partner?.trim().toLowerCase() === user.name?.trim().toLowerCase();
            return isMyClient && isDiscomOrMeterStage;
        }
        if (isSales) {
            // Sales can edit if the customer is NOT in DISCOM SUBMISSION or METER INSTALLATION stage
            return !isDiscomOrMeterStage;
        }
        return false;
    })();

    const isOfficeFrozenTab = isOffice && (activeTab === 'METER INSTALLATION' || activeTab === 'DISCOM INSPECTION');
    const isEditable = !isFrozen && canUserEdit && !isOfficeFrozenTab;
    const saveBomRef = useRef(null);
    const [saved, setSaved] = useState(false);
    const [showAgreementPopup, setShowAgreementPopup] = useState(false);
    const [agreementData, setAgreementData] = useState({
        executionDate: '',
        consumerName: '',
        consumerNo: '',
        village: '',
        taluka: '',
        district: '',
        vendorName: 'Watersun Electrical Solutions Pvt Ltd',
        vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
        paymentTerms: 'Mutually Agreed Terms of Payment',
        firstPartySignature: '',
        secondPartyStamp: '',
        secondPartySignature: '',
        highlightColor: '#fef08a',
        showHighlights: true,
    });

    useEffect(() => {
        if (showAgreementPopup) {
            const rawDate = editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0];
            const formattedDate = formatDateToDDMMYYYY(rawDate);

            // Find signature and stamp documents
            const sigDoc = documents.find(d => 
                d.doc_type === 'signature_pic' || 
                d.doc_type === 'signature' || 
                d.doc_type === 'firstPartySignature' || 
                d.doc_type === 'customer_signature'
            );
            const stampDoc = documents.find(d => 
                d.doc_type === 'stamp' || 
                d.doc_type === 'stamp_pic' || 
                d.doc_type === 'vendor_stamp' || 
                d.doc_type === 'secondPartyStamp'
            );
            const gpaeStampDoc = documents.find(d => 
                d.doc_type === 'pm_surya_gpae_stamp' || 
                d.doc_type === 'surya_gpae_stamp' || 
                d.doc_type === 'gpae_stamp'
            );

            const initialSigUrl = sigDoc ? (urlCacheRef.current[sigDoc.storage_path] || '') : '';
            const initialStampUrl = stampDoc ? (urlCacheRef.current[stampDoc.storage_path] || '') : '';
            const initialGpaeStampUrl = gpaeStampDoc ? (urlCacheRef.current[gpaeStampDoc.storage_path] || '') : '';

            setAgreementData({
                executionDate: formattedDate,
                consumerName: editData.customer_name || '',
                consumerNo: editData.consumer_no || '',
                village: editData.villages || '',
                taluka: editData.villages || '',
                district: editData.sub_divisions || '',
                vendorName: 'Watersun Electrical Solutions Pvt Ltd',
                vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
                paymentTerms: 'Mutually Agreed Terms of Payment',
                firstPartySignature: initialSigUrl,
                secondPartyStamp: initialStampUrl,
                secondPartySignature: '',
                signatureUrl: initialSigUrl,
                stampUrl: initialStampUrl,
                gpaeStampUrl: initialGpaeStampUrl,
                highlightColor: '#fef08a',
                showHighlights: true,
            });

            // If not yet in cache, fetch and update state
            if (sigDoc && !initialSigUrl) {
                getViewUrl(sigDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[sigDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            firstPartySignature: url,
                            signatureUrl: url,
                        }));
                    }
                });
            }

            if (stampDoc && !initialStampUrl) {
                getViewUrl(stampDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[stampDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            secondPartyStamp: url,
                            stampUrl: url,
                        }));
                    }
                });
            }

            if (gpaeStampDoc && !initialGpaeStampUrl) {
                getViewUrl(gpaeStampDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[gpaeStampDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            gpaeStampUrl: url,
                        }));
                    }
                });
            }
        }
    }, [showAgreementPopup, editData, documents]);

    const handleGenerateAgreement = async () => {
        // Find signature, stamp and GPAE stamp documents
        const sigDoc = documents.find(d => 
            d.doc_type === 'signature_pic' || 
            d.doc_type === 'signature' || 
            d.doc_type === 'firstPartySignature' || 
            d.doc_type === 'customer_signature'
        );
        const stampDoc = documents.find(d => 
            d.doc_type === 'stamp' || 
            d.doc_type === 'stamp_pic' || 
            d.doc_type === 'vendor_stamp' || 
            d.doc_type === 'secondPartyStamp'
        );
        const gpaeStampDoc = documents.find(d => 
            d.doc_type === 'pm_surya_gpae_stamp' || 
            d.doc_type === 'surya_gpae_stamp' || 
            d.doc_type === 'gpae_stamp'
        );

        let sigUrl = sigDoc ? (urlCacheRef.current[sigDoc.storage_path] || await getViewUrl(sigDoc.storage_path)) : '';
        let stampUrl = stampDoc ? (urlCacheRef.current[stampDoc.storage_path] || await getViewUrl(stampDoc.storage_path)) : '';
        let gpaeStampUrl = gpaeStampDoc ? (urlCacheRef.current[gpaeStampDoc.storage_path] || await getViewUrl(gpaeStampDoc.storage_path)) : '';

        if (sigDoc && sigUrl) urlCacheRef.current[sigDoc.storage_path] = sigUrl;
        if (stampDoc && stampUrl) urlCacheRef.current[stampDoc.storage_path] = stampUrl;
        if (gpaeStampDoc && gpaeStampUrl) urlCacheRef.current[gpaeStampDoc.storage_path] = gpaeStampUrl;

        const rawDate = editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0];
        const formattedDate = formatDateToDDMMYYYY(rawDate);

        setAgreementData({
            executionDate: formattedDate,
            consumerName: editData.customer_name || '',
            consumerNo: editData.consumer_no || '',
            village: editData.villages || '',
            taluka: editData.villages || '',
            district: editData.sub_divisions || '',
            vendorName: 'Watersun Electrical Solutions Pvt Ltd',
            vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
            paymentTerms: 'Mutually Agreed Terms of Payment',
            firstPartySignature: sigUrl || '',
            secondPartyStamp: stampUrl || '',
            secondPartySignature: '',
            signatureUrl: sigUrl || '',
            stampUrl: stampUrl || '',
            gpaeStampUrl: gpaeStampUrl || '',
            highlightColor: '#fef08a',
            showHighlights: true,
        });

        setShowAgreementPopup(true);
    };
    const ACTION_COLORS = {
        create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700',
        delete: 'bg-rose-100 text-rose-700', stage_change: 'bg-amber-100 text-amber-700',
        note: 'bg-indigo-100 text-indigo-700',
    };

    const fetchLogs = async () => {
        const { data } = await supabase.from('activity_log').select('*, profiles(name)')
            .or(`new_value.eq.${customer.id},message.ilike.%${customer.customer_name}%`)
            .order('created_at', { ascending: false }).limit(25);
        if (data) setActivityLogs(data);
    };

    const urlCacheRef = useRef({});

    useEffect(() => {
        if (customer?.id) {
            getCustomerDocuments(customer.id).then(docs => {
                setDocuments(docs);
                // Pre-generate signed view URLs in the background for instant preview
                docs.forEach(doc => {
                    if (!urlCacheRef.current[doc.storage_path]) {
                        getViewUrl(doc.storage_path).then(url => {
                            if (url) urlCacheRef.current[doc.storage_path] = url;
                        });
                    }
                });
            });
        }
    }, [customer?.id]);

    const handleFileUpload = async (e, docType = null) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const newDoc = await uploadDocument(file, customer.id, docType);
        if (newDoc) {
            setDocuments(prev => [newDoc, ...prev]);
            // Pre-cache the new doc URL
            getViewUrl(newDoc.storage_path).then(url => {
                if (url) urlCacheRef.current[newDoc.storage_path] = url;
            });
            // Automatically mark checklist field as true and persist
            if (docType) {
                setEditData(prev => ({ ...prev, [docType]: true }));
                await onUpdate(customer.id, { [docType]: true });
            }
            await logActivity(
                user.id,
                'update',
                `${customer.customer_name}: Uploaded document (${file.name})`,
                '',
                customer.id
            );
            fetchLogs();
        }
        setUploading(false);
        e.target.value = '';
    };

    const handleDownloadDoc = async (doc) => {
        const url = await getDownloadUrl(doc.storage_path, doc.file_name);
        if (url) {
            const a = document.createElement('a');
            a.href = url;
            a.download = doc.file_name;
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handlePreviewDoc = async (doc) => {
        // Use cached URL if available (instant), otherwise fetch
        let url = urlCacheRef.current[doc.storage_path];
        if (!url) {
            url = await getViewUrl(doc.storage_path);
            if (url) urlCacheRef.current[doc.storage_path] = url;
        }
        if (url) setFilePreview({ doc, url });
    };

    const handleDeleteDoc = async (doc) => {
        await deleteDocument(doc.id, doc.storage_path);
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Deleted document (${doc.file_name})`,
            '',
            customer.id
        );
        fetchLogs();
    };

    const handleUpdateDocRemark = async (docId, newRemark) => {
        await updateDocumentRemark(docId, newRemark);
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, remark: newRemark } : d));
        const docObj = documents.find(d => d.id === docId);
        const fileName = docObj?.file_name || 'Document';
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Document remark update (${fileName}) - "${newRemark}"`,
            '',
            customer.id
        );
        fetchLogs();
    };

    const REG_CHECKLIST_FIELDS = [
        'adhaar_card_front',
        'adhaar_card_back',
        'pan_card',
        'light_bill',
        'index_2',
        'bank_details',
        'house_geo_tag_photo',
        'extra_docs',
    ];

    const isRegChecklistDirty = REG_CHECKLIST_FIELDS.some(field => {
        return !!editData[field] !== !!customer[field];
    });

    const handleSaveRegChecklist = async () => {
        const patch = {};
        const changes = [];
        REG_CHECKLIST_FIELDS.forEach(field => {
            const oldCheck = !!customer[field];
            const newCheck = !!editData[field];
            if (oldCheck !== newCheck) {
                patch[field] = newCheck;
                changes.push(`${field}: ${oldCheck ? 'Checked' : 'Unchecked'} → ${newCheck ? 'Checked' : 'Unchecked'}`);
            }
        });

        await onUpdate(customer.id, patch);
        if (changes.length > 0) {
            await logActivity(user.id, 'update', `${customer.customer_name}: Registration checklist update - ${changes.join(' | ')}`, '', customer.id);
        }
        fetchLogs();
    };

    const OPERATIONAL_CHECKLIST_FIELDS = [
        'warranty_card',
        'insurance_status',
    ];

    const isOperationalChecklistDirty = OPERATIONAL_CHECKLIST_FIELDS.some(field => {
        return !!editData[field] !== !!customer[field];
    });

    const handleSaveOperationalChecklist = async () => {
        const patch = {};
        const changes = [];
        OPERATIONAL_CHECKLIST_FIELDS.forEach(field => {
            const oldCheck = !!customer[field];
            const newCheck = !!editData[field];
            if (oldCheck !== newCheck) {
                patch[field] = newCheck;
                changes.push(`${field}: ${oldCheck ? 'Checked' : 'Unchecked'} → ${newCheck ? 'Checked' : 'Unchecked'}`);
            }
        });

        await onUpdate(customer.id, patch);
        if (changes.length > 0) {
            await logActivity(user.id, 'update', `${customer.customer_name}: Operational checklist update - ${changes.join(' | ')}`, '', customer.id);
        }
        fetchLogs();
    };

    useEffect(() => {
        setEditData({ ...customer });
        setIsFormDirty(false);
        fetchLogs();
    }, [customer?.id]);





    const handleToggleSubsidyTag = (tagId) => {
        const newTag = editData.subsidy_tag === tagId ? null : tagId;
        setEditData(prev => ({ ...prev, subsidy_tag: newTag }));
        if (newTag) {
            setDraftStatus(newTag);
        }
    };

    const handleSaveSubsidyTag = async () => {
        const newTag = editData.subsidy_tag;
        const entryDate = new Date().toISOString().split('T')[0];
        let updatedHistory = editData.subsidy_history || [];

        if (newTag) {
            const newEntry = {
                status: newTag,
                date: entryDate,
                remark: 'Status updated via tag selector',
                created_at: new Date().toISOString()
            };
            updatedHistory = [...updatedHistory, newEntry];
        }

        setEditData(prev => ({
            ...prev,
            subsidy_history: updatedHistory,
            subsidy_tag: newTag
        }));

        await onUpdate(customer.id, {
            subsidy_tag: newTag,
            subsidy_history: updatedHistory
        });

        const tagLabel = SUBSIDY_TAGS.find(t => t.id === newTag)?.label || newTag;
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Subsidy Tag saved to ${newTag ? tagLabel : 'None'} (logged to history)`,
            '',
            customer.id
        );

        fetchLogs();
    };

    const handleToggleLoanTag = (tagId) => {
        const newTag = editData.loan_tag === tagId ? null : tagId;
        setEditData(prev => ({ ...prev, loan_tag: newTag }));
        if (newTag) {
            setLoanDraftStatus(newTag);
        }
    };

    const handleSaveLoanTag = async () => {
        const newTag = editData.loan_tag;
        const entryDate = new Date().toISOString().split('T')[0];
        let updatedHistory = editData.loan_history || [];

        if (newTag) {
            const newEntry = {
                status: newTag,
                date: entryDate,
                remark: 'Status updated via tag selector',
                created_at: new Date().toISOString()
            };
            updatedHistory = [...updatedHistory, newEntry];
        }

        setEditData(prev => ({
            ...prev,
            loan_history: updatedHistory,
            loan_tag: newTag
        }));

        await onUpdate(customer.id, {
            loan_tag: newTag,
            loan_history: updatedHistory
        });

        const tagLabel = LOAN_TAGS.find(t => t.id === newTag)?.label || newTag;
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Loan Tag saved to ${newTag ? tagLabel : 'None'} (logged to history)`,
            '',
            customer.id
        );

        fetchLogs();
    };

    const handleToggleInstallationTag = (tagId) => {
        const newTag = editData.installation_status === tagId ? null : tagId;
        const todayStr = new Date().toISOString().split('T')[0];
        setEditData(prev => ({
            ...prev,
            installation_status: newTag,
            installation_date: (newTag === 'Proceed' || newTag === 'Yes') ? (prev.installation_date || todayStr) : prev.installation_date
        }));
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
        if (editData.installation_status === 'Proceed') {
            logMsg += ` (Date: ${editData.installation_date || 'N/A'}, Installed By: ${editData.installed_by || 'N/A'})`;
        }
        await logActivity(user.id, 'update', logMsg, '', customer.id);

        setSaving(false);
        fetchLogs();
    };

    const handleToggleHoldStatus = (status) => {
        const newStatus = editData.hold_procurement === status ? null : status;
        setEditData(prev => ({ ...prev, hold_procurement: newStatus }));
    };

    const handleSaveHoldStatus = async () => {
        const newStatus = editData.hold_procurement;
        setSaving(true);
        await onUpdate(customer.id, { hold_procurement: newStatus });
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Hold Procurement status saved to ${newStatus || 'None'}`,
            '',
            customer.id
        );
        setSaving(false);
        fetchLogs();
    };

    const handleSaveStageRemark = async (stageId) => {
        const targetStage = stageId || editData.stage;
        const currentRemark = getStageRemarkFromData(editData.stages_remarks, targetStage);
        const originalRemark = getStageRemarkFromData(customer.stages_remarks, targetStage);

        if (currentRemark !== originalRemark) {
            let prevObj = {};
            if (typeof customer.stages_remarks === 'object' && customer.stages_remarks) {
                prevObj = customer.stages_remarks;
            } else if (typeof customer.stages_remarks === 'string') {
                try {
                    const parsed = JSON.parse(customer.stages_remarks);
                    if (typeof parsed === 'object' && parsed) prevObj = parsed;
                } catch (ex) { }
            }
            const updatedRemarks = {
                ...prevObj,
                [targetStage]: currentRemark
            };

            // Append the remark update to internal_remarks
            let updatedInternalRemarks = editData.internal_remarks || '';
            const formattedTime = formatDateTime(new Date());
            const appendText = `${targetStage} (${formattedTime}): ${currentRemark.trim() || 'Remark cleared'}`;
            updatedInternalRemarks = updatedInternalRemarks
                ? `${updatedInternalRemarks}\n${appendText}`
                : appendText;

            setEditData(prev => ({
                ...prev,
                stages_remarks: updatedRemarks,
                internal_remarks: updatedInternalRemarks
            }));

            await onUpdate(customer.id, {
                stages_remarks: updatedRemarks,
                internal_remarks: updatedInternalRemarks
            });

            setIsSaved(true);
            await logActivity(
                user.id,
                'update',
                `${customer.customer_name}: Stage remark update for ${targetStage} - "${currentRemark}"`,
                '',
                customer.id
            );
            fetchLogs();
        }
    };

    const handleChange = (field, val) => {
        setIsFormDirty(true);
        setEditData(prev => {
            const next = { ...prev, [field]: val };
            if (field === 'module_wp' || field === 'no_of_modules') {
                const wp = parseFloat(String(field === 'module_wp' ? val : next.module_wp).replace(/,/g, ''));
                const count = parseFloat(String(field === 'no_of_modules' ? val : next.no_of_modules).replace(/,/g, ''));
                if (!isNaN(wp) && !isNaN(count) && wp > 0 && count > 0) {
                    const totalVal = Math.round(wp * count);
                    next.system_capacity_kwp = toIndianCommas(totalVal);
                }
            }
            return next;
        });
    };

    const hasNextStage = (() => {
        const currentIdx = PRIMARY_STAGES.findIndex(s => s.id === editData.stage);
        if (currentIdx === -1) return false;

        let nextIdx = currentIdx + 1;
        if (nextIdx >= PRIMARY_STAGES.length) return false;

        let nextStage = PRIMARY_STAGES[nextIdx];
        if (nextStage.id === 'LOAN' && editData.payment_type?.trim().toLowerCase() === 'cash') {
            nextIdx++;
        }
        if (nextStage.id === 'CASH' && editData.payment_type?.trim().toLowerCase() === 'loan') {
            nextIdx++;
        }
        if (nextIdx < PRIMARY_STAGES.length && PRIMARY_STAGES[nextIdx].id === 'HOLD PROCUREMENT') {
            nextIdx++;
        }

        return nextIdx < PRIMARY_STAGES.length;
    })();

    const nextStageId = (() => {
        const currentIdx = PRIMARY_STAGES.findIndex(s => s.id === editData.stage);
        if (currentIdx === -1) return null;

        let nextIdx = currentIdx + 1;
        if (nextIdx >= PRIMARY_STAGES.length) return null;

        let nextStage = PRIMARY_STAGES[nextIdx];
        if (nextStage.id === 'LOAN' && editData.payment_type?.trim().toLowerCase() === 'cash') {
            nextIdx++;
        }
        if (nextStage.id === 'CASH' && editData.payment_type?.trim().toLowerCase() === 'loan') {
            nextIdx++;
        }
        if (nextIdx < PRIMARY_STAGES.length && PRIMARY_STAGES[nextIdx].id === 'HOLD PROCUREMENT') {
            nextIdx++;
        }

        if (nextIdx < PRIMARY_STAGES.length) {
            return PRIMARY_STAGES[nextIdx].id;
        }
        return null;
    })();

    const nextStageLabel = nextStageId ? PRIMARY_STAGES.find(s => s.id === nextStageId)?.label : '';

    const isLeadFieldsFilled = !!(
        editData.customer_name?.trim() &&
        editData.phone_number?.toString().trim() &&
        (editData.email?.trim() || editData.email_address?.trim()) &&
        editData.consumer_no?.toString().trim() &&
        editData.villages?.trim() &&
        editData.channel_partner?.trim() &&
        editData.sub_channel_partner?.trim() &&
        editData.module_brand?.trim() &&
        editData.module_wp?.toString().trim() &&
        editData.no_of_modules?.toString().trim() &&
        editData.system_capacity_kwp &&
        editData.sub_divisions?.trim() &&
        editData.payment_type?.trim()
    );

    const hasFeasibilityDoc = documents.some(d => d.doc_type === 'feasibilty_document' || d.doc_type === 'feasibility_document') || !!editData.feasibilty_document;
    const hasSubsidyTokenDoc = documents.some(d => d.doc_type === 'subsidy_token_photo') || !!editData.subsidy_token_photo;
    const isRegistrationFieldsFilled = !!(
        editData.registration_date &&
        editData.registration_by?.trim() &&
        (editData.registration_no?.toString().trim() || editData.feasibility_no?.toString().trim()) &&
        editData.folder_no?.toString().trim()
    );
    const isRegistrationReady = isRegistrationFieldsFilled && hasFeasibilityDoc && hasSubsidyTokenDoc;

    const isMaterialOrderFilled = Boolean(
        editData.roof_shed &&
        editData.dc_cable && Number(parseIndianNumber(editData.dc_cable)) > 0 &&
        editData.ac_cable && Number(parseIndianNumber(editData.ac_cable)) > 0 &&
        (editData.structure_front_leg_height?.toString().trim() || editData.structure_leg_height?.toString().trim()) &&
        (editData.structure_rear_leg_height?.toString().trim() || editData.structure_leg_height?.toString().trim()) &&
        editData.invoice_value && Number(parseIndianNumber(editData.invoice_value)) > 0
    );

    const handleAdvanceStage = async (overrideNextStageId) => {
        const destStageId = overrideNextStageId || nextStageId;
        if (!destStageId) return;

        if (editData.stage === 'LEADS' && !isLeadFieldsFilled) {
            alert('Please fill all required Lead details (Customer Name, Phone, Email, Consumer No, Villages, Channel Partner, Sub Channel Partner, Module Brand, Module Wp, No of Modules, System Capacity, Sub Division, Payment Type) to advance to the next stage.');
            return;
        }

        if (editData.stage === 'REGISTRATION') {
            if (!isRegistrationFieldsFilled) {
                alert('Please fill all Registration details (Registration Date, Registration By, Feasibility No, File No) before advancing.');
                return;
            }
            if (!hasFeasibilityDoc || !hasSubsidyTokenDoc) {
                alert('Both Feasibility Document and Subsidy Token Photo must be uploaded to advance to the next stage.');
                return;
            }
        }

        if (editData.stage === 'MATERIAL ORDER' && !isMaterialOrderFilled) {
            alert('Please fill all mandatory Material Order specifications (Roof/Shed, DC Cable, AC Cable, Structure Front Leg Height, Structure Rear Leg Height, Invoice Value) to advance.');
            return;
        }

        setSaving(true);
        if (saveBomRef.current) {
            try {
                await saveBomRef.current();
            } catch (err) {
                console.error('Error saving BOM during stage advance:', err);
            }
        }

        const oldStage = editData.stage;
        let prevObj = {};
        if (typeof editData.stages_remarks === 'object' && editData.stages_remarks) {
            prevObj = editData.stages_remarks;
        } else if (typeof editData.stages_remarks === 'string') {
            try {
                const parsed = JSON.parse(editData.stages_remarks);
                if (typeof parsed === 'object' && parsed) prevObj = parsed;
            } catch (e) { }
        }
        const updatedRemarks = {
            ...prevObj,
            [oldStage]: ''
        };

        const updates = {
            ...editData,
            stage: destStageId,
            stages_remarks: updatedRemarks
        };

        if (updates.system_capacity_kwp !== undefined && updates.system_capacity_kwp !== null && updates.system_capacity_kwp !== '') {
            updates.system_capacity_kwp = parseIndianNumber(updates.system_capacity_kwp);
        }
        if (updates.module_wp !== undefined && updates.module_wp !== null && updates.module_wp !== '') {
            updates.module_wp = parseIndianNumber(updates.module_wp);
        }
        if (updates.no_of_modules !== undefined && updates.no_of_modules !== null && updates.no_of_modules !== '') {
            updates.no_of_modules = parseIndianNumber(updates.no_of_modules);
        }
        if (updates.invoice_value !== undefined && updates.invoice_value !== null && updates.invoice_value !== '') {
            updates.invoice_value = parseIndianNumber(updates.invoice_value);
        }
        if (updates.dc_cable !== undefined && updates.dc_cable !== null && updates.dc_cable !== '') {
            updates.dc_cable = parseIndianNumber(updates.dc_cable);
        }
        if (updates.ac_cable !== undefined && updates.ac_cable !== null && updates.ac_cable !== '') {
            updates.ac_cable = parseIndianNumber(updates.ac_cable);
        }

        if (destStageId === 'HOLD PROCUREMENT') {
            const prevHold = (typeof updates.hold_procurement === 'object' && updates.hold_procurement) ? updates.hold_procurement : {};
            updates.hold_procurement = {
                ...prevHold,
                previous_stage: oldStage !== 'HOLD PROCUREMENT' ? oldStage : (prevHold.previous_stage || 'LEADS'),
                hold_date: new Date().toISOString().split('T')[0]
            };
        }

        if (destStageId === 'METER INSTALLATION') {
            const currentMeter = updates.meter_installation || {};
            updates.meter_installation = {
                status: currentMeter.status || 'No',
                no_date: currentMeter.no_date || new Date().toISOString().split('T')[0],
                yes_date: currentMeter.yes_date || null
            };
        }

        if (destStageId === 'DISCOM INSPECTION') {
            if (!updates.discom_inspection) {
                updates.discom_inspection = 'No';
            }
        }

        if (updates.subsidy_history) {
            updates.subsidy_history = updates.subsidy_history.map(({ isNew, ...rest }) => rest);
        }
        if (updates.loan_history) {
            updates.loan_history = updates.loan_history.map(({ isNew, ...rest }) => rest);
        }

        let changeSummary = [];
        Object.keys(updates).forEach(key => {
            if (updates[key] !== customer[key] && key !== 'id' && key !== 'created_at' && key !== 'crn' && key !== 'updated_at' && key !== 'stage' && key !== 'stages_remarks' && typeof updates[key] !== 'object') {
                changeSummary.push(`${key.replace(/_/g, ' ').toUpperCase()}: ${customer[key] || 'None'} → ${updates[key] || 'None'}`);
            }
        });

        delete updates.id;
        delete updates.created_at;
        delete updates.crn;
        delete updates.updated_at;

        await onUpdate(customer.id, updates);

        await logActivity(user.id, 'stage_change', `${customer.customer_name}: STAGE: ${oldStage} → ${destStageId}`, '', customer.id);
        if (changeSummary.length > 0) {
            await logActivity(user.id, 'update', `${customer.customer_name}: ${changeSummary.join(' | ')}`, '', customer.id);
        }

        setEditingSection(null);
        setSaving(false);
        fetchLogs();
        setActiveTab(destStageId);
    };


    const handleSave = async () => {
        setSaving(true);
        if (saveBomRef.current) {
            try {
                await saveBomRef.current();
            } catch (err) {
                console.error('Error saving BOM during handleSave:', err);
            }
        }
        const updates = { ...editData };

        if (updates.system_capacity_kwp !== undefined && updates.system_capacity_kwp !== null && updates.system_capacity_kwp !== '') {
            updates.system_capacity_kwp = parseIndianNumber(updates.system_capacity_kwp);
        }
        if (updates.module_wp !== undefined && updates.module_wp !== null && updates.module_wp !== '') {
            updates.module_wp = parseIndianNumber(updates.module_wp);
        }
        if (updates.no_of_modules !== undefined && updates.no_of_modules !== null && updates.no_of_modules !== '') {
            updates.no_of_modules = parseIndianNumber(updates.no_of_modules);
        }
        if (updates.invoice_value !== undefined && updates.invoice_value !== null && updates.invoice_value !== '') {
            updates.invoice_value = parseIndianNumber(updates.invoice_value);
        }
        if (updates.dc_cable !== undefined && updates.dc_cable !== null && updates.dc_cable !== '') {
            updates.dc_cable = parseIndianNumber(updates.dc_cable);
        }
        if (updates.ac_cable !== undefined && updates.ac_cable !== null && updates.ac_cable !== '') {
            updates.ac_cable = parseIndianNumber(updates.ac_cable);
        }
        if (updates.vendor_quote !== undefined && updates.vendor_quote !== null && updates.vendor_quote !== '') {
            updates.vendor_quote = parseIndianNumber(updates.vendor_quote);
        } else if (updates.vendor_quote === '') {
            updates.vendor_quote = null;
        }

        let changeSummary = [];
        Object.keys(updates).forEach(key => {
            if (updates[key] !== customer[key] && key !== 'id' && key !== 'updated_at' && typeof updates[key] !== 'object') {
                changeSummary.push(`${key.replace(/_/g, ' ').toUpperCase()}: ${customer[key] || 'None'} → ${updates[key] || 'None'}`);
            }
        });

        if (updates.subsidy_history) {
            updates.subsidy_history = updates.subsidy_history.map(({ isNew, ...rest }) => rest);
        }
        if (updates.loan_history) {
            updates.loan_history = updates.loan_history.map(({ isNew, ...rest }) => rest);
        }

        // Compare subsidy_history
        const oldSubsidy = customer.subsidy_history || [];
        const newSubsidy = updates.subsidy_history || [];
        if (JSON.stringify(oldSubsidy) !== JSON.stringify(newSubsidy)) {
            const subChanges = [];
            if (newSubsidy.length === 0 && oldSubsidy.length > 0) {
                subChanges.push("Cleared all subsidy entries");
            } else {
                const maxLen = Math.max(oldSubsidy.length, newSubsidy.length);
                for (let i = 0; i < maxLen; i++) {
                    const oldItem = oldSubsidy[i];
                    const newItem = newSubsidy[i];
                    if (!oldItem && newItem) {
                        subChanges.push(`Added Entry ${i + 1} (${newItem.status}${newItem.date ? ` on ${newItem.date}` : ''}${newItem.remark ? `: ${newItem.remark}` : ''})`);
                    } else if (oldItem && !newItem) {
                        subChanges.push(`Removed Entry ${i + 1} (${oldItem.status})`);
                    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                        const diffs = [];
                        if (oldItem.status !== newItem.status) {
                            diffs.push(`status: "${oldItem.status}" → "${newItem.status}"`);
                        }
                        if (oldItem.date !== newItem.date) {
                            diffs.push(`date: "${oldItem.date || 'None'}" → "${newItem.date || 'None'}"`);
                        }
                        if (oldItem.remark !== newItem.remark) {
                            diffs.push(`remark: "${oldItem.remark || 'None'}" → "${newItem.remark || 'None'}"`);
                        }
                        if (diffs.length > 0) {
                            subChanges.push(`Updated Entry ${i + 1} (${diffs.join(', ')})`);
                        }
                    }
                }
            }
            if (subChanges.length > 0) {
                changeSummary.push(`SUBSIDY STATUS: ${subChanges.join(' | ')}`);
            }
        }

        // Compare loan_history
        const oldLoan = customer.loan_history || [];
        const newLoan = updates.loan_history || [];
        if (JSON.stringify(oldLoan) !== JSON.stringify(newLoan)) {
            const loanChanges = [];
            if (newLoan.length === 0 && oldLoan.length > 0) {
                loanChanges.push("Cleared all loan entries");
            } else {
                const maxLen = Math.max(oldLoan.length, newLoan.length);
                for (let i = 0; i < maxLen; i++) {
                    const oldItem = oldLoan[i];
                    const newItem = newLoan[i];
                    if (!oldItem && newItem) {
                        loanChanges.push(`Added Entry ${i + 1} (${newItem.status}${newItem.date ? ` on ${newItem.date}` : ''}${newItem.remark ? `: ${newItem.remark}` : ''})`);
                    } else if (oldItem && !newItem) {
                        loanChanges.push(`Removed Entry ${i + 1} (${oldItem.status})`);
                    } else if (JSON.stringify(oldItem) !== JSON.stringify(newItem)) {
                        const diffs = [];
                        if (oldItem.status !== newItem.status) {
                            diffs.push(`status: "${oldItem.status}" → "${newItem.status}"`);
                        }
                        if (oldItem.date !== newItem.date) {
                            diffs.push(`date: "${oldItem.date || 'None'}" → "${newItem.date || 'None'}"`);
                        }
                        if (oldItem.remark !== newItem.remark) {
                            diffs.push(`remark: "${oldItem.remark || 'None'}" → "${newItem.remark || 'None'}"`);
                        }
                        if (diffs.length > 0) {
                            loanChanges.push(`Updated Entry ${i + 1} (${diffs.join(', ')})`);
                        }
                    }
                }
            }
            if (loanChanges.length > 0) {
                changeSummary.push(`LOAN STATUS: ${loanChanges.join(' | ')}`);
            }
        }

        const stageChanged = editData.stage !== customer.stage;
        delete updates.id; delete updates.created_at; delete updates.crn;
        await onUpdate(customer.id, updates);
        if (changeSummary.length > 0) await logActivity(user.id, 'update', `${customer.customer_name}: ${changeSummary.join(' | ')}`, '', customer.id);

        setEditingSection(null);
        setSaving(false);
        setIsFormDirty(false);
        setSaved(true);
        fetchLogs();
        if (stageChanged) {
            setActiveTab(editData.stage);
        }
    };

    const handleAddNote = async () => {
        if (!followUpText.trim()) return;
        const updatedNotes = [...(editData.follow_ups || []), { text: followUpText, author: user.name, date: new Date().toISOString() }];
        await onUpdate(customer.id, { follow_ups: updatedNotes });
        await logActivity(user.id, 'note', `Note Added: ${followUpText}`, '', customer.id);
        setEditData(prev => ({ ...prev, follow_ups: updatedNotes }));
        setFollowUpText('');
        fetchLogs();
    };

    const handleSoftDelete = async () => {
        const deletedAt = new Date().toISOString();
        await logActivity(user.id, 'delete', `Soft-deleted: ${customer.customer_name}`, '', customer.id);
        await onDelete(customer.id, deletedAt);   // pass timestamp for soft-delete
        onClose();
    };

    const isDirty = (() => {
        if (!customer || !editData) return false;
        
        const ignoreKeys = new Set(['id', 'created_at', 'updated_at', 'crn']);
        for (const key of Object.keys(editData)) {
            if (ignoreKeys.has(key)) continue;
            let val1 = editData[key];
            let val2 = customer[key];
            
            // Handle booleans vs null/undefined (e.g. false vs null, checklist items)
            if (typeof val1 === 'boolean' || typeof val2 === 'boolean') {
                if (Boolean(val1) !== Boolean(val2)) return true;
                continue;
            }

            // Normalize empty / null / undefined values
            const isVal1Empty = val1 === undefined || val1 === null || val1 === '';
            const isVal2Empty = val2 === undefined || val2 === null || val2 === '';
            if (isVal1Empty && isVal2Empty) continue;

            if (typeof val1 === 'object' || typeof val2 === 'object') {
                if (JSON.stringify(val1 ?? null) !== JSON.stringify(val2 ?? null)) return true;
            } else {
                const str1 = val1 !== undefined && val1 !== null ? String(val1).trim() : '';
                const str2 = val2 !== undefined && val2 !== null ? String(val2).trim() : '';
                if (str1 !== str2) return true;
            }
        }
        return false;
    })();

    const SectionHeader = ({ title, id, icon: Icon }) => (
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
            <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Icon size={12} /> {title}
            </h3>
            {isEditable && (
                <button onClick={() => {
                    const isOpening = editingSection !== id;
                    setEditingSection(isOpening ? id : null);
                    if (isOpening) {
                        setTimeout(() => {
                            const el = document.getElementById(`section-${id}`);
                            if (el) {
                                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }
                        }, 150);
                    }
                }} className="text-stone-400 hover:text-amber-600 transition-colors">
                    {editingSection === id ? <X size={14} /> : <Edit3 size={12} />}
                </button>
            )}
        </div>
    );

    return (
        <div className="fixed inset-0 bg-stone-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-5xl h-[94vh] overflow-hidden flex flex-col border border-stone-100">

                {/* Header */}
                <div className="bg-stone-900 px-6 py-5 flex justify-between items-center flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-xl font-bold text-white">{customer.customer_name}</h2>
                            {/* <span className="text-[9px] bg-white/10 text-stone-400 px-2 py-0.5 rounded font-bold uppercase tracking-widest">{customer.crn || 'NO-CRN'}</span> */}
                            {isCompleted && (
                                <span className={`flex items-center gap-1 text-[9px] px-2 py-0.5 rounded font-bold uppercase tracking-widest ${isFrozen ? 'bg-stone-700 text-stone-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                    {isFrozen ? <><Lock size={9} /> Frozen</> : <><Unlock size={9} /> Unlocked</>}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            {customer.location_link && (
                                <a href={customer.location_link} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1.5 bg-blue-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20">
                                    <MapPin size={10} /> VIEW MAPS
                                </a>
                            )}
                            {customer.google_docs && (
                                <a href={customer.google_docs} target="_blank" rel="noreferrer"
                                    className="flex items-center gap-1.5 bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
                                    <FolderOpen size={10} /> GOOGLE DRIVE
                                </a>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {/* Admin unlock/lock toggle for completed cards */}
                        {isCompleted && isAdmin && (
                            <button onClick={() => { setAdminUnlocked(prev => !prev); setEditingSection(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${adminUnlocked ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/30' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
                                {adminUnlocked ? <><Lock size={12} /> Re-lock</> : <><Unlock size={12} /> Unlock to Edit</>}
                            </button>
                        )}
                        {isAdmin && <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-white/30 hover:text-red-400"><Trash2 size={18} /></button>}
                        <button onClick={onClose} className="p-2 text-white/30 hover:text-white"><X size={24} /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-stone-900 px-6 gap-6 border-t border-white/5 flex-shrink-0 overflow-x-auto scrollbar-none whitespace-nowrap">
                    {[
                        ...PRIMARY_STAGES.filter(s => {
                            if (s.id === 'LOAN' && editData.payment_type?.trim().toLowerCase() === 'cash') return false;
                            if (s.id === 'CASH' && editData.payment_type?.trim().toLowerCase() === 'loan') return false;
                            if (s.id === 'COMPLETED') return false;
                            return true;
                        }).map(s => ({ id: s.id, label: s.label, icon: s.icon })),
                        { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen },
                        { id: 'history', label: 'Notes & History', icon: History },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditingSection(null); }}
                            className={`flex items-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 flex-shrink-0 ${activeTab === tab.id ? 'text-amber-400 border-amber-400' : 'text-stone-500 border-transparent hover:text-stone-300'}`}>
                            <tab.icon size={12} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#FCFBFA]">

                    {/* Frozen banner for completed cards */}
                    {isCompleted && isFrozen && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6 border bg-stone-100 border-stone-200">
                            <Lock className="w-4 h-4 text-stone-500 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-stone-600">This project is completed & frozen</p>
                                <p className="text-[10px] text-stone-400">{isAdmin ? 'Click "Unlock to Edit" in the header to make changes' : 'Only an admin can unlock this record for editing'}</p>
                            </div>
                        </div>
                    )}
                    {isCompleted && !isFrozen && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl mb-6 border bg-amber-50 border-amber-200">
                            <Unlock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-700">Admin edit mode — Record unlocked</p>
                                <p className="text-[10px] text-amber-500">Click "Re-lock" when done to freeze the record again</p>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'history' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Primary Stage Info */}
                            <div className={`p-4 rounded-2xl border shadow-sm ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-100'} flex flex-col justify-between`}>
                                <div>
                                    <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Primary Stage</label>
                                    <div className="flex items-center gap-3 min-h-[38px]">
                                        <div className="text-xs text-stone-850 font-bold px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-xl flex items-center gap-1.5">
                                            {PRIMARY_STAGES.find(s => s.id === editData.stage)?.label || editData.stage}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stage Remark */}
                            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Stage Remark (Current Stage)</label>
                                    {!isEditable ? (
                                        <div className="text-xs text-stone-500 font-medium italic min-h-[38px] bg-stone-50 p-2 rounded-lg">
                                            {(typeof editData.stages_remarks === 'object' && editData.stages_remarks ? editData.stages_remarks[editData.stage] : '') || 'No remarks for this stage.'}
                                        </div>
                                    ) : (
                                        (() => {
                                            const curRemark = getStageRemarkFromData(editData.stages_remarks, editData.stage);
                                            const origRemark = getStageRemarkFromData(customer.stages_remarks, customer.stage);
                                            const isRemarkDirty = (curRemark || '').trim() !== (origRemark || '').trim();

                                            return (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Add remark for current stage..."
                                                        value={curRemark}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
                                                            setEditData(prev => {
                                                                const prevObj = typeof prev.stages_remarks === 'object' && prev.stages_remarks ? prev.stages_remarks : {};
                                                                return {
                                                                    ...prev,
                                                                    stages_remarks: {
                                                                        ...prevObj,
                                                                        [prev.stage]: newVal
                                                                    }
                                                                };
                                                            });
                                                        }}
                                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveStageRemark()}
                                                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                                                    />
                                                    <button
                                                        onClick={() => handleSaveStageRemark()}
                                                        disabled={!isRemarkDirty}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                                            !isRemarkDirty
                                                                ? 'bg-emerald-600 text-white cursor-default'
                                                                : 'bg-stone-900 text-white hover:bg-stone-800 cursor-pointer'
                                                        }`}
                                                    >
                                                        {!isRemarkDirty ? 'Saved' : 'Save'}
                                                    </button>
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── LEADS ── */}
                    {activeTab === 'LEADS' && (
                        <LeadsTab
                            customer={customer}
                            editData={editData}
                            isEditable={isEditable}
                            handleChange={handleChange}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            channel_partners={channel_partners}
                            isAdmin={isAdmin}
                            meta={meta}
                            user={user}
                            isRegChecklistDirty={isRegChecklistDirty}
                            handleSaveRegChecklist={handleSaveRegChecklist}
                            documents={documents}
                            uploading={uploading}
                            onFileUpload={handleFileUpload}
                            onViewDocument={handlePreviewDoc}
                            onDeleteDocument={handleDeleteDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── REGISTRATION ── */}
                    {activeTab === 'REGISTRATION' && (
                        <RegistrationTab
                            customer={customer}
                            editData={editData}
                            isEditable={isEditable}
                            handleChange={handleChange}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            meta={meta}
                            user={user}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            saving={saving}
                            setSaving={setSaving}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── LOAN ── */}
                    {activeTab === 'LOAN' && (
                        <LoanTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── CASH ── */}
                    {activeTab === 'CASH' && (
                        <CashTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            saving={saving}
                            setSaving={setSaving}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── MATERIAL ORDER ── */}
                    {activeTab === 'MATERIAL ORDER' && (
                        <MaterialOrderTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            handleChange={handleChange}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            meta={meta}
                            saving={saving}
                            setSaving={setSaving}
                        />
                    )}

                    {/* ── MATERIAL INTEGRATION ── */}
                    {activeTab === 'MATERIAL INTEGRATION' && (
                        <MaterialIntegrationTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            user={user}
                            meta={meta}
                            logActivity={logActivity}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            onUpdate={onUpdate}
                            handleAdvanceStage={handleAdvanceStage}
                            saving={saving}
                            setSaving={setSaving}
                            saveBomRef={saveBomRef}
                        />
                    )}

                    {/* ── HOLD PROCUREMENT ── */}
                    {activeTab === 'HOLD PROCUREMENT' && (
                        <HoldProcurementTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            saving={saving}
                            setSaving={setSaving}
                        />
                    )}

                    {/* ── MATERIAL DELIVERY ── */}
                    {activeTab === 'MATERIAL DELIVERY' && (
                        <MaterialDeliveryTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            meta={meta}
                            handleChange={handleChange}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                        />
                    )}

                    {/* ── INSTALLATION STATUS ── */}
                    {activeTab === 'INSTALLATION STATUS' && (
                        <InstallationStatusTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            isAdmin={isAdmin}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            handleChange={handleChange}
                            saving={saving}
                            setSaving={setSaving}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── GEO TAG PHOTO ── */}
                    {activeTab === 'GEO TAG PHOTO' && (
                        <GeoTagPhotoTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            saving={saving}
                            setSaving={setSaving}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── DISCOM SUBMISSION ── */}
                    {activeTab === 'DISCOM SUBMISSION' && (
                        <DiscomSubmissionTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            handleChange={handleChange}
                            saving={saving}
                            setSaving={setSaving}
                            onGenerateAgreement={handleGenerateAgreement}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── METER INSTALLATION ── */}
                    {activeTab === 'METER INSTALLATION' && (
                        <MeterInstallationTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            isOffice={isOffice}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── DISCOM INSPECTION ── */}
                    {activeTab === 'DISCOM INSPECTION' && (
                        <DiscomInspectionTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            isOffice={isOffice}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── SUBSIDY STATUS ── */}
                    {activeTab === 'SUBSIDY STATUS' && (
                        <SubsidyStatusTab
                            customer={customer}
                            editData={editData}
                            setEditData={handleEditDataChange}
                            isEditable={isEditable}
                            onUpdate={onUpdate}
                            logActivity={logActivity}
                            fetchLogs={fetchLogs}
                            user={user}
                        />
                    )}

                    {/* ── FINAL REVIEW ── */}
                    {activeTab === 'FINAL REVIEW' && (
                        <FinalReviewTab
                            editData={editData}
                            setEditData={handleEditDataChange}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            isOperationalChecklistDirty={isOperationalChecklistDirty}
                            handleSaveOperationalChecklist={handleSaveOperationalChecklist}
                            documents={documents}
                            onFileUpload={handleFileUpload}
                            onFileDelete={handleDeleteDoc}
                            onFilePreview={handlePreviewDoc}
                            onUpdateRemark={handleUpdateDocRemark}
                        />
                    )}



                    {/* ── DOCUMENTS ── */}
                    {activeTab === 'DOCUMENTS' && (() => {
                        const filteredDocs = documents.filter(doc => {
                            if (!docSearchQuery.trim()) return true;
                            const q = docSearchQuery.toLowerCase();
                            const docLabel = getDocTypeLabel(doc.doc_type).toLowerCase();
                            const fileName = (doc.file_name || '').toLowerCase();
                            const remarkText = (doc.remark || '').toLowerCase();
                            return fileName.includes(q) || docLabel.includes(q) || remarkText.includes(q);
                        });

                        return (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                                                <FolderOpen size={18} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">
                                                        Client Documents & Attachments
                                                    </h3>
                                                    <span className="bg-stone-100 text-stone-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                                                        {documents.length} {documents.length === 1 ? 'file' : 'files'}
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-stone-400 font-medium mt-0.5">
                                                    All uploaded identity proofs, site photos, utility documents, stamps, certificates, and remarks.
                                                </p>
                                            </div>
                                        </div>

                                        {isEditable && (
                                            <label className="bg-stone-900 hover:bg-stone-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto">
                                                <Plus size={14} />
                                                <span>{uploading ? 'Uploading...' : 'Upload File'}</span>
                                                <input
                                                    type="file"
                                                    onChange={handleFileUpload}
                                                    disabled={uploading}
                                                    className="hidden"
                                                />
                                            </label>
                                        )}
                                    </div>

                                    {/* Search Filter */}
                                    {documents.length > 0 && (
                                        <div className="relative">
                                            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                                            <input
                                                type="text"
                                                placeholder="Search documents by name, category, or remark..."
                                                value={docSearchQuery}
                                                onChange={e => setDocSearchQuery(e.target.value)}
                                                className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs font-medium text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                    )}

                                    {documents.length === 0 ? (
                                        <div className="text-center py-12 bg-stone-50 rounded-2xl border border-dashed border-stone-200">
                                            <FolderOpen size={36} className="mx-auto text-stone-300 mb-2" />
                                            <p className="text-xs font-bold text-stone-600">No documents uploaded yet</p>
                                            <p className="text-[11px] text-stone-400 mt-1">Upload client KYC, photos, or utility documents to see them listed here.</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            {filteredDocs.map(doc => {
                                                const isPdf = doc.file_name?.toLowerCase().endsWith('.pdf') || doc.file_type === 'application/pdf';
                                                const isImage = doc.file_type?.startsWith('image/') || /\.(jpg|jpeg|png|webp|gif|svg)$/i.test(doc.file_name || '');
                                                const docLabel = getDocTypeLabel(doc.doc_type);

                                                return (
                                                    <div key={doc.id} className="bg-stone-50/70 hover:bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 flex flex-col justify-between gap-2.5 transition-all hover:shadow-xs">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                <div className={`p-2.5 rounded-xl flex-shrink-0 ${isPdf ? 'bg-red-50 text-red-600' : isImage ? 'bg-blue-50 text-blue-600' : 'bg-stone-200 text-stone-600'}`}>
                                                                    {isPdf ? <FileText size={18} /> : isImage ? <ImageIcon size={18} /> : <FileText size={18} />}
                                                                </div>
                                                                <div className="min-w-0 flex-1">
                                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-white text-stone-700 border border-stone-200">
                                                                            {docLabel}
                                                                        </span>
                                                                        {doc.created_at && (
                                                                            <span className="text-[10px] text-stone-400 font-medium">
                                                                                · {formatDateToDDMMYYYY(doc.created_at.split('T')[0])}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="text-xs font-bold text-stone-800 truncate mt-1" title={doc.file_name}>
                                                                        {doc.file_name}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-1.5 flex-shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handlePreviewDoc(doc)}
                                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-stone-100 text-stone-700 border border-stone-200 shadow-xs flex items-center gap-1.5 cursor-pointer transition"
                                                                >
                                                                    <Eye size={13} className="text-stone-500" />
                                                                    <span>View</span>
                                                                </button>
                                                                {isEditable && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleDeleteDoc(doc)}
                                                                        className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                                                        title="Delete Document"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Document Remark Section */}
                                                        <DocGalleryRemarkRow doc={doc} onUpdateRemark={handleUpdateDocRemark} isEditable={isEditable} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </section>
                            </div>
                        );
                    })()}

                    {/* ── NOTES & HISTORY ── */}
                    {activeTab === 'history' && (
                        <HistoryTab
                            editData={editData}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            followUpText={followUpText}
                            setFollowUpText={setFollowUpText}
                            handleAddNote={handleAddNote}
                            activityLogs={activityLogs}
                        />
                    )}

                    {isEditable && activeTab !== 'HOLD PROCUREMENT' && activeTab !== 'DOCUMENTS' && activeTab !== 'history' && customer.stage !== 'COMPLETED' && (
                        <div className="mt-8 pt-4 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/60">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg flex-shrink-0">
                                    <PauseCircle size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-700">Need to pause or hold this project?</p>
                                    <p className="text-[11px] text-stone-500 font-medium">Place the project on hold with an audit note.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab('HOLD PROCUREMENT')}
                                className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
                            >
                                Move to Hold Procurement
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer bar - 50/50 split buttons at customer card */}
                {isEditable && activeTab !== 'HOLD PROCUREMENT' && (
                    <div className="p-4 border-t border-stone-100 bg-white flex-shrink-0 flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50 ${
                                isFormDirty
                                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                        >
                            {saving ? (
                                'Saving...'
                            ) : isFormDirty ? (
                                <>
                                    <Save size={14} />
                                    <span>Save</span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} className="text-white" />
                                    <span>Saved</span>
                                </>
                            )}
                        </button>

                        {hasNextStage && (
                            <button
                                onClick={() => {
                                    if (nextStageId === 'COMPLETED') {
                                        setShowCompletedConfirm(true);
                                    } else {
                                        handleAdvanceStage();
                                    }
                                }}
                                disabled={saving || (
                                    (editData.stage === 'LEADS' && !isLeadFieldsFilled) ||
                                    (editData.stage === 'REGISTRATION' && !isRegistrationReady) ||
                                    (editData.stage === 'MATERIAL ORDER' && !isMaterialOrderFilled) ||
                                    (editData.stage === 'GEO TAG PHOTO' && (editData.geo_tag_status !== 'Proceed' || !editData.geo_tag_image)) ||
                                    (editData.stage === 'METER INSTALLATION' && (editData.meter_installation !== 'Yes' || !editData.meter_installation_photo)) ||
                                    (editData.stage === 'DISCOM INSPECTION' && editData.discom_inspection !== 'Yes') ||
                                    (editData.stage === 'INSTALLATION STATUS' && editData.installation_status !== 'Proceed')
                                )}
                                className="flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving & Moving...' : `Save & Move to ${nextStageLabel}`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Soft-delete confirm */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-full"><AlertTriangle className="w-5 h-5 text-red-600" /></div>
                            <h3 className="font-bold text-stone-800">Move to Trash?</h3>
                        </div>
                        <p className="text-sm text-stone-600 mb-5">
                            <strong>{customer.customer_name}</strong> will be moved to Trash. You can recover it later from the Trash view.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
                            <button onClick={handleSoftDelete} className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2">
                                <Trash2 className="w-4 h-4" /> Move to Trash
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Move-to-Completed lock confirm */}
            {showCompletedConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-full"><Lock className="w-5 h-5 text-amber-600" /></div>
                            <h3 className="font-bold text-stone-800">Mark as Completed?</h3>
                        </div>
                        <p className="text-sm text-stone-600 mb-5">
                            Moving <strong>{customer.customer_name}</strong> to Completed will lock this record. Only an admin will be able to unlock it for further edits. Do you want to proceed?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCompletedConfirm(false)} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
                            <button
                                onClick={() => {
                                    setShowCompletedConfirm(false);
                                    handleAdvanceStage();
                                }}
                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Lock className="w-4 h-4" /> Proceed & Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PM Surya Ghar Agreement Popup Modal */}
            {showAgreementPopup && (
                <AgreementPreview
                    data={agreementData}
                    onChange={setAgreementData}
                    onClose={() => setShowAgreementPopup(false)}
                />
            )}

            {/* File Preview Modal */}
            {filePreview.doc && (
                <FilePreviewModal
                    file={filePreview.doc}
                    fileUrl={filePreview.url}
                    onClose={() => setFilePreview({ doc: null, url: null })}
                    onDownload={() => handleDownloadDoc(filePreview.doc)}
                />
            )}
        </div>
    );
}