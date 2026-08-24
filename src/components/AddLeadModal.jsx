import { leadSchema } from '../utils/validation';
// src/components/AddLeadModal.jsx  —  Watersun Electrical Solutions Pvt Ltd
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { 
    X, Plus, User, ClipboardList, Paperclip, Eye, Trash2, 
    Upload, FileText, Image as ImageIcon, Loader2, Banknote, AlertTriangle
} from 'lucide-react';
import { DEFAULT_LEAD_FORM } from '../models';
import { FilePreviewModal } from './modal-tabs/shared';
import { toIndianCommas } from '../utils';

// Dropdown component for metadata fields (clean single outline)
function AddLeadMetaSelect({ label, field, value, onChange, options = [] }) {
    return (
        <div className="space-y-1">
            <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">{label}</label>
            <select
                value={value || ''}
                onChange={e => onChange(field, e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
            >
                <option value="">Select {label}...</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

// Autocomplete component for Channel Partner Name selector (clean single outline)
function ChannelPartnerAutocomplete({ label, value, onChange, suggestions = [], required = false, isAdmin = false }) {
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
        <div className="space-y-1 relative" ref={containerRef}>
            <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                {label} {required && <span className="text-red-500 font-bold">*</span>}
            </label>
            <div className="relative">
                <input name="channel_partner" id="channel_partner"
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                    placeholder={`Enter ${label}...`}
                />
                {showSuggestions && filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-100 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto py-1">
                        {filtered.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => handleSelect(s)}
                                className="w-full text-left px-3.5 py-2 text-xs hover:bg-stone-50 text-stone-700 font-medium transition-colors"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Interactive checklist row with file upload / replace / delete / view
function AddLeadChecklistItem({ label, field, checked, onToggle, pendingFile, onFileAttach, onFileRemove, onPreview }) {
    const fileInputRef = useRef(null);

    // Unchecked by default; checked only when a file is attached
    const isUploaded = Boolean(pendingFile);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        onFileAttach(field, file);
        if (onToggle) onToggle(field, true);
        e.target.value = '';
    };

    const handleRemove = () => {
        onFileRemove(field);
        if (onToggle) onToggle(field, false);
    };

    return (
        <div className="py-2.5 border-b border-stone-100 last:border-0 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    {/* Non-editable check indicator box driven solely by attached file */}
                    <div 
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${
                            isUploaded 
                                ? 'bg-emerald-500 border-emerald-500 text-white' 
                                : 'bg-stone-100 border-stone-300 text-transparent'
                        }`}
                        title={isUploaded ? 'File Attached' : 'Attach file to verify'}
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
                            Attached
                        </span>
                    ) : (
                        <span className="text-[9px] font-bold text-stone-400 bg-stone-100 px-1.5 py-0.2 rounded">
                            Not Attached
                        </span>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileChange}
                    className="hidden"
                />

                {!pendingFile ? (
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-stone-500 hover:text-amber-600 px-2.5 py-1 rounded-lg border border-dashed border-stone-200 hover:border-amber-300 hover:bg-amber-50/50 transition-all cursor-pointer"
                    >
                        <Paperclip size={11} /> Attach File / Photo
                    </button>
                ) : null}
            </div>

            {pendingFile && (
                <div className="flex items-center justify-between gap-1.5 bg-amber-50/80 border border-amber-200/80 rounded-xl px-2.5 py-1.5 ml-6">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Paperclip size={11} className="text-amber-600 flex-shrink-0" />
                        <span className="text-[10px] text-amber-900 font-semibold truncate">
                            {pendingFile.name}
                        </span>
                    </div>
                    <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                        <button
                            type="button"
                            onClick={() => onPreview(pendingFile)}
                            className="text-[9px] font-bold text-amber-700 hover:text-amber-900 px-1.5 py-0.5 rounded hover:bg-amber-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="View preview & download"
                        >
                            <Eye size={10} /> View
                        </button>
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[9px] font-bold text-blue-600 hover:text-blue-800 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Change file"
                        >
                            <Upload size={10} /> Change
                        </button>
                        <button
                            type="button"
                            onClick={handleRemove}
                            className="text-[9px] font-bold text-red-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors flex items-center gap-0.5 cursor-pointer"
                            title="Remove file"
                        >
                            <Trash2 size={10} /> Delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AddLeadModal({ isOpen, onClose, onSave, meta = {}, channel_partners = [], user }) {
    const [formData, setFormData] = useState({ ...DEFAULT_LEAD_FORM });
    const [pendingFiles, setPendingFiles] = useState({}); // { [doc_type]: File }
    const [previewDoc, setPreviewDoc] = useState(null); // { doc, url }
    const [saving, setSaving] = useState(false);
    const [validationErrors, setValidationErrors] = useState([]);

    const isAgent = user?.userType === 'agent' || user?.role === 'Channel Partners';
    const isAgent2 = user?.userType === 'agent2' || user?.role === 'Channel Partner (Agent 2)' || user?.role === 'Sub Agent';
    const isChannelPartnerOffice = user?.userType === 'channel_partner_office' || user?.userType === 'channel_partner_office_manager' || user?.role === 'Channel Partner Office' || user?.role === 'Channel Partner Office Manager';
    const partnerName = (user?.channel_partner || user?.name || '').trim();

    useEffect(() => {
        if (isOpen) {
            const defaults = { ...DEFAULT_LEAD_FORM };
            if (isAgent2) {
                defaults.channel_partner = user?.channel_partner || partnerName || '';
                defaults.sub_channel_partner = user?.name || '';
            } else if (isAgent || isChannelPartnerOffice) {
                defaults.channel_partner = partnerName || '';
            }
            setFormData(defaults);
            setPendingFiles({});
            setSaving(false);
        }
    }, [isOpen, user, isAgent, isAgent2, isChannelPartnerOffice, partnerName]);

    if (!isOpen) return null;

    const handleChange = (field, value) => {
        setValidationErrors([]);
        let processedValue = value;
        if (field === 'phone_number') {
            const clean = String(value).replace(/[^0-9]/g, '');
            processedValue = clean.length === 11 && clean.startsWith('0') ? clean.slice(1) : clean.slice(0, 10);
        }
        setFormData(prev => {
            const next = { ...prev, [field]: processedValue };
            if (field === 'module_wp' || field === 'no_of_modules') {
                const wp = parseFloat(String(field === 'module_wp' ? processedValue : next.module_wp).replace(/,/g, ''));
                const count = parseFloat(String(field === 'no_of_modules' ? processedValue : next.no_of_modules).replace(/,/g, ''));
                if (!isNaN(wp) && !isNaN(count) && wp > 0 && count > 0) {
                    const totalVal = Math.round(wp * count);
                    next.system_capacity_kwp = toIndianCommas(totalVal);
                }
            }
            return next;
        });
    };

    const handleFileAttach = (docType, file) => {
        setPendingFiles(prev => ({ ...prev, [docType]: file }));
    };

    const handleFileRemove = (docType) => {
        setPendingFiles(prev => {
            const next = { ...prev };
            delete next[docType];
            return next;
        });
    };

    const handlePreviewFile = (file) => {
        const url = URL.createObjectURL(file);
        setPreviewDoc({
            doc: {
                file_name: file.name,
                file_type: file.type,
            },
            url
        });
    };

    const handleClosePreview = () => {
        if (previewDoc?.url) URL.revokeObjectURL(previewDoc.url);
        setPreviewDoc(null);
    };

    const handleSave = async (e) => {
        if (e) e.preventDefault();
        if (saving) return; // Prevent double-submission from fast clicking
        
        const finalData = {
            ...formData,
            channel_partner: isAgent2 ? (user?.channel_partner || partnerName || '') : ((isAgent || isChannelPartnerOffice) ? partnerName : (formData.channel_partner || '').trim()),
            sub_channel_partner: isAgent2 ? user?.name : (formData.sub_channel_partner || '').trim() || null
        };

        // Ensure string fields are strings to pass Zod schema
        ['customer_name', 'phone_number', 'email_address', 'consumer_no', 'villages', 'channel_partner', 'module_brand', 'module_wp', 'no_of_modules', 'system_capacity_kwp', 'sub_divisions'].forEach(key => {
            if (finalData[key] !== undefined && finalData[key] !== null) {
                finalData[key] = String(finalData[key]);
            }
        });

        const result = leadSchema.safeParse(finalData);
        if (!result.success) {
            setValidationErrors(result.error.issues.map(err => err.message));
            // Scroll to top
            const bodyEl = document.querySelector('.modal-body');
            if (bodyEl) bodyEl.scrollTop = 0;
            return;
        }

        // Apply validated data
        const validatedData = result.data;

        // Package attached files as list of { file, doc_type }
        const filesToUpload = Object.entries(pendingFiles).map(([doc_type, file]) => ({
            file,
            doc_type
        }));

        setSaving(true);
        try {
            await onSave(validatedData, filesToUpload);
            onClose();
        } catch (err) {
            console.error('Error in onSave:', err);
            alert('Failed to save lead: ' + (err.message || err));
        } finally {
            setSaving(false);
        }
    };

    const moduleWpOptions = (meta['module_wp'] && meta['module_wp'].length > 0)
        ? meta['module_wp']
        : ['540', '545', '550', '570', '575', '580', '585', '590', '600', '610', '615', '620'];

    const handleAttachDummyDocs = () => {
        const randId = Math.floor(1000 + Math.random() * 9000);
        const createDummyFile = (docName) => {
            const blob = new Blob([`%PDF-1.4 Mock sample document for ${docName} (${randId})`], { type: 'application/pdf' });
            return new File([blob], `${docName}_${randId}.pdf`, { type: 'application/pdf' });
        };

        const mockFiles = {
            adhaar_card_front: createDummyFile('adhaar_card_front'),
            adhaar_card_back: createDummyFile('adhaar_card_back'),
            pan_card: createDummyFile('pan_card'),
            index_2: createDummyFile('index_2'),
            light_bill: createDummyFile('light_bill'),
            bank_details: createDummyFile('bank_details'),
            house_geo_tag_photo: createDummyFile('house_geo_tag_photo'),
        };

        setPendingFiles(prev => ({ ...prev, ...mockFiles }));
        setFormData(prev => ({
            ...prev,
            adhaar_card_front: true,
            adhaar_card_back: true,
            pan_card: true,
            index_2: true,
            light_bill: true,
            bank_details: true,
            house_geo_tag_photo: true,
        }));
    };

    const handleFillTestData = () => {
        const randId = Math.floor(1000 + Math.random() * 9000);
        const demoBrand = meta['module_brand']?.[0] || 'Adani';
        const demoCp = channel_partners?.[0] || 'Watersun Direct';
        const demoWp = moduleWpOptions[0] || '540';
        const demoModules = 20;
        const demoKwp = toIndianCommas(Number(demoWp) * demoModules);

        setFormData(prev => ({
            ...prev,
            customer_name: `Test Lead ${randId}`,
            phone_number: `98765${randId}`,
            email_address: `testlead${randId}@gmail.com`,
            consumer_no: `100200${randId}`,
            villages: `Test Village ${randId}`,
            sub_divisions: `Test Division`,
            channel_partner: (isAgent || isChannelPartnerOffice) ? partnerName : demoCp,
            sub_channel_partner: `Direct Sub Partner`,
            module_brand: demoBrand,
            module_wp: String(demoWp),
            no_of_modules: String(demoModules),
            system_capacity_kwp: demoKwp,
            payment_type: 'CASH',
            adhaar_card_front: true,
            adhaar_card_back: true,
            pan_card: true,
            light_bill: true,
            bank_details: true,
            house_geo_tag_photo: true,
        }));

        handleAttachDummyDocs();
        setValidationErrors([]);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3 sm:p-4">
            <div className="bg-white rounded-[28px] shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-white sticky top-0 z-10">
                    <div>
                        <h2 className="text-base font-black text-stone-900 uppercase tracking-wider flex items-center gap-2">
                            <Plus size={18} className="text-amber-500" /> Add New Lead
                        </h2>
                        <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                            Register a new customer lead with complete details and document attachments.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleFillTestData}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-3 py-1.5 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shadow-sm transition-all cursor-pointer hover:scale-105 active:scale-95"
                            title="Autofill all fields and attach mock documents"
                        >
                            ✨ Autofill Test Lead & Files
                        </button>
                        <button 
                            onClick={onClose} 
                            className="p-2 hover:bg-stone-100 text-stone-400 hover:text-stone-700 rounded-xl transition cursor-pointer"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Scrollable Body */}
                <div className="flex-1 overflow-y-auto p-5 space-y-5 modal-body">
                    {validationErrors.length > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex flex-col gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="flex items-center gap-2 text-red-800 font-bold text-xs uppercase tracking-wide">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                Please fix the following errors
                            </div>
                            <ul className="list-disc pl-5 text-xs text-red-750 font-medium space-y-1">
                                {validationErrors.map((err, idx) => {
                                    const msg = typeof err === 'string'
                                        ? err
                                        : (err?.message || (err?.text ? (err?.label ? `${err.label}: ${err.text}` : err.text) : JSON.stringify(err)));
                                    return <li key={idx}>{msg}</li>;
                                })}
                            </ul>
                        </div>
                    )}
                    {/* Section 1: Customer Info (Strictly Line-by-Line) */}
                    <section>
                        <div className="flex items-center gap-2 mb-3 pb-1.5 border-b border-stone-100">
                            <User size={13} className="text-amber-500" />
                            <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                Customer Info
                            </h3>
                        </div>

                        <div className="space-y-3">
                            {/* Customer Name */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Customer Name <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.customer_name || ''}
                                    onChange={e => handleChange('customer_name', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="Enter full name"
                                    required
                                />
                            </div>

                            {/* Phone Number */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Phone Number <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="tel"
                                    maxLength={10}
                                    value={formData.phone_number || ''}
                                    onChange={e => handleChange('phone_number', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="e.g. 9876543210 (10 digits)"
                                    required
                                />
                            </div>

                            {/* Email Address */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Email Address <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={formData.email_address || ''}
                                    onChange={e => handleChange('email_address', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="name@example.com"
                                    required
                                />
                            </div>

                            {/* Consumer No */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Consumer No <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="number"
                                    value={formData.consumer_no || ''}
                                    onChange={e => handleChange('consumer_no', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="Consumer number"
                                    required
                                />
                            </div>

                            {/* Villages */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Villages / Address <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.villages || ''}
                                    onChange={e => handleChange('villages', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="Village or address"
                                    required
                                />
                            </div>

                            {/* Sub Division */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Sub Division <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.sub_divisions || ''}
                                    onChange={e => handleChange('sub_divisions', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="Sub division"
                                    required
                                />
                            </div>

                            {/* Agents and Channel Partner Office users are always assigned to themselves. */}
                            {(isAgent || isChannelPartnerOffice) ? (
                                <div className="space-y-1">
                                    <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                        Channel Partner Name <span className="text-red-500 font-bold">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={partnerName}
                                        disabled
                                        className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-bold text-stone-700 cursor-not-allowed"
                                    /> 
                                </div>
                            ) : (
                                <ChannelPartnerAutocomplete
                                    label="Channel Partner Name"
                                    value={formData.channel_partner}
                                    onChange={val => handleChange('channel_partner', val)}
                                    suggestions={channel_partners}
                                    required={true}
                                    isAdmin={user?.userType === 'admin'}
                                />
                            )}

                            {/* Optional for every user, including channel partners. */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    Sub Channel Partner Name <span className="normal-case text-stone-400 font-medium">(optional)</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.sub_channel_partner || ''}
                                    onChange={e => handleChange('sub_channel_partner', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="Sub channel partner (optional)"
                                />
                            </div>

                            {/* MODULE BRAND */}
                            <div className="space-y-1">
                                 <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                     MODULE BRAND <span className="text-red-500 font-bold">*</span>
                                 </label>
                                 <select
                                     value={formData.module_brand || ''}
                                     onChange={e => handleChange('module_brand', e.target.value)}
                                     className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                     required
                                 >
                                     <option value="">Select MODULE BRAND...</option>
                                     {(meta['module_brand'] || []).map(o => <option key={o} value={o}>{o}</option>)}
                                 </select>
                            </div>

                            {/* MODULE WP */}
                            <div className="space-y-1">
                                 <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                     MODULE WP <span className="text-red-500 font-bold">*</span>
                                 </label>
                                 <select
                                     value={formData.module_wp || ''}
                                     onChange={e => handleChange('module_wp', e.target.value)}
                                     className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                     required
                                 >
                                     <option value="">Select MODULE WP...</option>
                                     {moduleWpOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                 </select>
                            </div>

                            {/* No of Modules */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    No of Modules <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    value={formData.no_of_modules || ''}
                                    onChange={e => handleChange('no_of_modules', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="e.g. 10"
                                    required
                                />
                            </div>

                            {/* System Capacity */}
                            <div className="space-y-1">
                                <label className="text-[10px] text-stone-500 uppercase tracking-wide font-bold block">
                                    System Capacity <span className="text-red-500 font-bold">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={formData.system_capacity_kwp || ''}
                                    onChange={e => handleChange('system_capacity_kwp', e.target.value)}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
                                    placeholder="e.g. 10,800"
                                    required
                                />
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Document Checklist (Strictly Line-by-Line) */}
                    <section>
                        <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-stone-100">
                            <div className="flex items-center gap-2">
                                <ClipboardList size={13} className="text-amber-500" />
                                <h3 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">
                                    Document Checklist
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={handleAttachDummyDocs}
                                className="text-[9px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                title="Attach mock test documents for all checklist items"
                            >
                                ⚡ Auto-Attach Test Files
                            </button>
                        </div>

                        <div className="space-y-3">
                            {/* Payment Type Selection at the top */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                                    Payment Type Selection <span className="text-red-500 font-bold">*</span>
                                </label>
                                <select
                                    value={formData.payment_type || ''}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        handleChange('payment_type', val);
                                    }}
                                    className="w-full bg-white border border-stone-200 rounded-xl px-3.5 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 font-semibold text-stone-800 transition-all"
                                    required
                                >
                                    <option value="">Select Payment Type...</option>
                                    {(meta['payment_type'] || ['CASH', 'LOAN']).map((opt) => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Checklist items only visible if payment_type is selected */}
                            {formData.payment_type ? (
                                <div className="space-y-1 divide-y divide-stone-100">
                                    {formData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                        <>
                                            <AddLeadChecklistItem
                                                label="Aadhar Card Front"
                                                field="adhaar_card_front"
                                                checked={formData.adhaar_card_front}
                                                onToggle={handleChange}
                                                pendingFile={pendingFiles['adhaar_card_front']}
                                                onFileAttach={handleFileAttach}
                                                onFileRemove={handleFileRemove}
                                                onPreview={handlePreviewFile}
                                            />
                                            <AddLeadChecklistItem
                                                label="Aadhar Card Back"
                                                field="adhaar_card_back"
                                                checked={formData.adhaar_card_back}
                                                onToggle={handleChange}
                                                pendingFile={pendingFiles['adhaar_card_back']}
                                                onFileAttach={handleFileAttach}
                                                onFileRemove={handleFileRemove}
                                                onPreview={handlePreviewFile}
                                            />
                                            <AddLeadChecklistItem
                                                label="PAN Card"
                                                field="pan_card"
                                                checked={formData.pan_card}
                                                onToggle={handleChange}
                                                pendingFile={pendingFiles['pan_card']}
                                                onFileAttach={handleFileAttach}
                                                onFileRemove={handleFileRemove}
                                                onPreview={handlePreviewFile}
                                            />
                                            <AddLeadChecklistItem
                                                label="Index 2"
                                                field="index_2"
                                                checked={formData.index_2}
                                                onToggle={handleChange}
                                                pendingFile={pendingFiles['index_2']}
                                                onFileAttach={handleFileAttach}
                                                onFileRemove={handleFileRemove}
                                                onPreview={handlePreviewFile}
                                            />
                                        </>
                                    )}

                                    <AddLeadChecklistItem
                                        label="Light Bill"
                                        field="light_bill"
                                        checked={formData.light_bill}
                                        onToggle={handleChange}
                                        pendingFile={pendingFiles['light_bill']}
                                        onFileAttach={handleFileAttach}
                                        onFileRemove={handleFileRemove}
                                        onPreview={handlePreviewFile}
                                    />

                                    <AddLeadChecklistItem
                                        label="Bank Details"
                                        field="bank_details"
                                        checked={formData.bank_details}
                                        onToggle={handleChange}
                                        pendingFile={pendingFiles['bank_details']}
                                        onFileAttach={handleFileAttach}
                                        onFileRemove={handleFileRemove}
                                        onPreview={handlePreviewFile}
                                    />

                                    <AddLeadChecklistItem
                                        label="House Geo Tag Photo"
                                        field="house_geo_tag_photo"
                                        checked={formData.house_geo_tag_photo}
                                        onToggle={handleChange}
                                        pendingFile={pendingFiles['house_geo_tag_photo']}
                                        onFileAttach={handleFileAttach}
                                        onFileRemove={handleFileRemove}
                                        onPreview={handlePreviewFile}
                                    />

                                    <AddLeadChecklistItem
                                        label="Extra Documents"
                                        field="extra_docs"
                                        checked={formData.extra_docs}
                                        onToggle={handleChange}
                                        pendingFile={pendingFiles['extra_docs']}
                                        onFileAttach={handleFileAttach}
                                        onFileRemove={handleFileRemove}
                                        onPreview={handlePreviewFile}
                                    />
                                </div>
                            ) : (
                                <p className="text-xs text-stone-400 italic py-2">
                                    Please select a Payment Type above to display the Document Checklist.
                                </p>
                            )}
                        </div>
                    </section>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-stone-100 bg-white sticky bottom-0 z-10">
                    <button 
                        type="button"
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2.5 text-xs font-bold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button 
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="px-5 py-2.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-xl transition shadow-md shadow-amber-500/10 cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                Saving Lead & Uploading Files...
                            </>
                        ) : (
                            <>
                                <Plus className="w-3.5 h-3.5" />
                                Add Lead
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* File Preview Modal */}
            {previewDoc && (
                <FilePreviewModal
                    file={previewDoc.doc}
                    fileUrl={previewDoc.url}
                    onClose={handleClosePreview}
                    onDownload={() => {
                        const a = document.createElement('a');
                        a.href = previewDoc.url;
                        a.download = previewDoc.doc.file_name;
                        a.target = '_blank';
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    }}
                />
            )}
        </div>
    );
}
