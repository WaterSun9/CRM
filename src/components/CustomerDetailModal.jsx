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
    LayoutDashboard, History, Plus, ShieldCheck, Lock, Unlock, ClipboardList, Banknote, Tag,
} from 'lucide-react';
import { PRIMARY_STAGES, SUBSIDY_TAGS, SUBSIDY_TAG_COLORS, LOAN_TAGS, LOAN_TAG_COLORS, ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE } from '../constants';
import { logActivity, formatLogDate, formatINR, toIndianCommas, formatInputValue, parseIndianNumber } from '../utils';
import { supabase } from '../supabase';
import HistoryEntryEditor from './HistoryEntryEditor';
import { AgreementPreview } from './agreement/AgreementPreview';
import { Page1 } from './agreement/Page1';
import { FileText, Printer } from 'lucide-react';

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

// ─── CheckboxRemarkItem ───────────────────────────────────────────────────────
function CheckboxRemarkItem({ label, field, value, onChange, isEditing }) {
    if (!isEditing) {
        return (
            <div className="py-1.5 flex items-start gap-3 group">
                <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${value ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-100 border-stone-300 text-transparent'}`}>
                    {value && <svg className="w-2.5 h-2.5 stroke-[3] stroke-current" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                </div>
                <div className="flex-1 min-w-0">
                    <span className={`text-xs block ${value ? 'text-stone-400 line-through' : 'text-stone-700 font-semibold'}`}>{label}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="py-1.5 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <input
                        type="checkbox"
                        id={field}
                        checked={!!value}
                        onChange={e => onChange(field, e.target.checked)}
                        className="w-4 h-4 text-amber-500 border-stone-300 rounded focus:ring-amber-500 cursor-pointer"
                    />
                    <label htmlFor={field} className="text-xs font-semibold text-stone-700 cursor-pointer select-none">
                        {label}
                    </label>
                </div>
            </div>
        </div>
    );
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
    const [isSaved, setIsSaved] = useState(false);
    const [editData, setEditData] = useState({ ...customer });
    const [followUpText, setFollowUpText] = useState('');
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const isAdmin = user?.userType === 'admin';
    const isCompleted = customer.stage === 'COMPLETED';
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    // Frozen for ALL users when completed. Admin can temporarily unlock.
    const isFrozen = isCompleted && !(isAdmin && adminUnlocked);

    const isAgent = user?.userType === 'agent';
    const isSales = user?.userType === 'sales';

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

    const isEditable = !isFrozen && canUserEdit;



    const [draftStatus, setDraftStatus] = useState('Approved');
    const [draftDate, setDraftDate] = useState('');
    const [draftRemark, setDraftRemark] = useState('');
    const [isAddingEntry, setIsAddingEntry] = useState(false);

    const [loanDraftStatus, setLoanDraftStatus] = useState('Sanctioned');
    const [loanDraftDate, setLoanDraftDate] = useState('');
    const [loanDraftRemark, setLoanDraftRemark] = useState('');
    const [isAddingLoanEntry, setIsAddingLoanEntry] = useState(false);

    const [vendors, setVendors] = useState([]);
    useEffect(() => {
        const fetchVendorsList = async () => {
            try {
                const { data } = await supabase.from('vendors').select('name').order('name');
                if (data) setVendors(data.map(v => v.name));
            } catch (e) {
                console.error('Error fetching vendors in modal:', e);
            }
        };
        fetchVendorsList();
    }, []);

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
                firstPartySignature: '',
                secondPartyStamp: '',
                secondPartySignature: '',
                highlightColor: '#fef08a',
                showHighlights: true,
            });
        }
    }, [showAgreementPopup, editData]);

    const [installationDraftStatus, setInstallationDraftStatus] = useState('Pending');
    const [installationDraftDate, setInstallationDraftDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [installationDraftRemark, setInstallationDraftRemark] = useState('');

    // ─── BOM States & Handlers ──────────────────────────────────────────────────
    const [bom, setBom] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [bomType, setBomType] = useState('');
    const [paperPreparedBy, setPaperPreparedBy] = useState('');
    const [paperPreparedDate, setPaperPreparedDate] = useState('');
    const [materialLoadingDate, setMaterialLoadingDate] = useState('');
    const [materialLoadedBy, setMaterialLoadedBy] = useState('');
    const [materialLoadedDate, setMaterialLoadedDate] = useState('');
    const [bomSaving, setBomSaving] = useState(false);

    const loadBOM = async () => {
        if (!customer?.id) return;
        try {
            const { data: bomData, error: bomError } = await supabase
                .from('bom')
                .select('*')
                .eq('admin_id', customer.id)
                .maybeSingle();

            if (bomError) {
                console.error('BOM fetch error:', bomError);
                return;
            }

            if (!bomData) {
                setBom(null);
                setBomItems([]);
                setBomType('');
                setPaperPreparedBy('');
                setPaperPreparedDate('');
                setMaterialLoadingDate('');
                setMaterialLoadedBy('');
                setMaterialLoadedDate('');
                return;
            }

            setBom(bomData);
            setBomType(bomData.bom_type === 'NONE' ? '' : (bomData.bom_type || ''));
            setPaperPreparedBy(bomData.paper_prepared_by || '');
            setPaperPreparedDate(bomData.paper_prepared_date || '');
            setMaterialLoadingDate(bomData.material_loading_date || '');
            setMaterialLoadedBy(bomData.material_loaded_by || '');
            setMaterialLoadedDate(bomData.material_loaded_date || '');

            const { data: itemData, error: itemError } = await supabase
                .from('bom_items')
                .select('*')
                .eq('bom_id', bomData.id)
                .order('sr_no', { ascending: true });

            if (itemError) {
                console.error('BOM items fetch error:', itemError);
                return;
            }

            const mergedItems = (itemData || []).map(dbItem => {
                const template = bomData.bom_type === 'ROOF' ? ROOF_BOM_TEMPLATE : SHED_BOM_TEMPLATE;
                const match = template.find(t => t.product_name === dbItem.product_name || t.sr_no === dbItem.sr_no);
                return {
                    ...dbItem,
                    uom: dbItem.uom || (match ? match.uom : '')
                };
            });
            setBomItems(mergedItems);
        } catch (err) {
            console.error('loadBOM exception:', err);
        }
    };

    useEffect(() => {
        if (activeTab === 'MATERIAL INTEGRATION') {
            loadBOM();
        }
    }, [activeTab, customer?.id]);

    const handleBomTypeChange = (type) => {
        setBomType(type);
        if (type === 'ROOF') {
            setBomItems(ROOF_BOM_TEMPLATE.map(t => ({ ...t })));
        } else if (type === 'SHED') {
            setBomItems(SHED_BOM_TEMPLATE.map(t => ({ ...t })));
        } else {
            setBomItems([]);
        }
    };

    const addBomItem = () => {
        setBomItems(prev => [
            ...prev,
            { sr_no: prev.length + 1, product_name: '', uom: '', make: '', integration_by: '', note: '' }
        ]);
    };

    const removeBomItem = (index) => {
        setBomItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemFieldChange = (index, field, value) => {
        setBomItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const saveBOM = async () => {
        if (!customer?.id) {
            alert("No customer selected");
            return;
        }

        setBomSaving(true);
        try {
            let bomData, bomError;

            // 1. Create or Update parent BOM
            if (bom?.id) {
                // Update
                const { data, error } = await supabase
                    .from('bom')
                    .update({
                        bom_type: bomType || null,
                        material_loading_date: materialLoadingDate || null,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .eq('id', bom.id)
                    .select()
                    .single();
                
                bomData = data;
                bomError = error;
            } else {
                // Insert
                const { data, error } = await supabase
                    .from('bom')
                    .insert({
                        admin_id: customer.id,
                        bom_type: bomType || null,
                        material_loading_date: materialLoadingDate || null,
                        paper_prepared_by: paperPreparedBy || null,
                        paper_prepared_date: paperPreparedDate || null,
                        material_loaded_by: materialLoadedBy || null,
                        material_loaded_date: materialLoadedDate || null
                    })
                    .select()
                    .single();

                bomData = data;
                bomError = error;
            }

            if (bomError) {
                console.error("BOM save error:", bomError);
                alert("Failed to save BOM parent record: " + bomError.message);
                setBomSaving(false);
                return;
            }

            const currentBomId = bomData.id;

            // 2. Delete existing items associated with this BOM to avoid duplicates
            const { error: deleteError } = await supabase
                .from('bom_items')
                .delete()
                .eq('bom_id', currentBomId);

            if (deleteError) {
                console.error("BOM items delete error:", deleteError);
                alert("Failed to clear old BOM items: " + deleteError.message);
                setBomSaving(false);
                return;
            }

            // 3. Attach every item to the parent BOM
            if (bomType) {
                const itemsToInsert = bomItems.map((item, index) => ({
                    bom_id: currentBomId,
                    sr_no: index + 1, // enforce clean sequential order
                    product_name: item.product_name,
                    make: item.make || null,
                    integration_by: item.integration_by || null,
                    note: item.note || null
                }));

                // 4. Insert BOM items
                if (itemsToInsert.length > 0) {
                    const { error: itemsError } = await supabase
                        .from('bom_items')
                        .insert(itemsToInsert);

                    if (itemsError) {
                        console.error("BOM items insertion error:", itemsError);
                        alert("BOM saved, but items failed to save: " + itemsError.message);
                        setBomSaving(false);
                        return;
                    }
                }
            }

            // Log activity
            await logActivity(
                user.id,
                'update',
                `Saved ${bomType} BOM for ${customer.customer_name}`,
                '',
                customer.id
            );

            await loadBOM();
        } catch (err) {
            console.error("saveBOM exception:", err);
            alert("BOM save failed due to unexpected error.");
        } finally {
            setBomSaving(false);
        }
    };

    const parsePanelSerials = (raw) => {
        if (!raw) return [''];
        if (typeof raw !== 'string') return [String(raw)];
        
        // Try parsing as JSON first
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
        } catch (e) { }

        // Split by newline if present
        if (raw.includes('\n')) {
            return raw.split('\n').map(s => s.trim()).filter(Boolean);
        }
        // Split by comma if present
        if (raw.includes(',')) {
            return raw.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [raw.trim()];
    };

    const [panelSerials, setPanelSerials] = useState(() => parsePanelSerials(customer?.panel_serial_no));

    useEffect(() => {
        setPanelSerials(parsePanelSerials(customer?.panel_serial_no));
    }, [customer?.panel_serial_no]);

    const handlePanelSerialChange = (idx, val) => {
        const next = [...panelSerials];
        next[idx] = val;
        setPanelSerials(next);
        const filtered = next.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
    };

    const addPanelSerial = () => {
        const next = [...panelSerials, ''];
        setPanelSerials(next);
    };

    const removePanelSerial = (idx) => {
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
        const filtered = finalVal.filter(Boolean);
        const serialized = filtered.length > 0 ? filtered.join('\n') : '';
        setEditData(prev => ({ ...prev, panel_serial_no: serialized }));
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

    const REG_CHECKLIST_FIELDS = [
        'adhaar_card',
        'pan_card',
        'index_2',
        'light_bill',
        'bank_details',
        'bank_passbook',
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
        setEditData(prev => {
            if (prev.id !== customer.id) {
                return { ...customer };
            }
            return {
                ...customer,
                stages_remarks: prev.stages_remarks
            };
        });
        fetchLogs();
    }, [customer]);

    useEffect(() => {
        const dbRemark = getStageRemarkFromData(customer.stages_remarks, editData.stage);
        const currentRemark = getStageRemarkFromData(editData.stages_remarks, editData.stage);

        if (dbRemark && currentRemark === dbRemark) {
            setIsSaved(true);
        } else {
            setIsSaved(false);
        }
    }, [editData.stage, customer]);





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
        setEditData(prev => ({ ...prev, installation_status: newTag }));
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
        if (editData.installation_status === 'Yes') {
            logMsg += ` (Date: ${editData.installation_date || 'N/A'}, Installed By: ${editData.installed_by || 'N/A'})`;
        }
        await logActivity(user.id, 'update', logMsg, '', customer.id);
        
        setSaving(false);
        fetchLogs();
    };

    const handleToggleHoldStatus = (status) => {
        const newStatus = editData.hold_procurment === status ? null : status;
        setEditData(prev => ({ ...prev, hold_procurment: newStatus }));
    };

    const handleSaveHoldStatus = async () => {
        const newStatus = editData.hold_procurment;
        setSaving(true);
        await onUpdate(customer.id, { hold_procurment: newStatus });
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
        setEditData(prev => ({ ...prev, [field]: val }));
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
        
        if (nextIdx < PRIMARY_STAGES.length) {
            return PRIMARY_STAGES[nextIdx].id;
        }
        return null;
    })();

    const nextStageLabel = nextStageId ? PRIMARY_STAGES.find(s => s.id === nextStageId)?.label : '';

    const isLeadFieldsFilled = !!(
        editData.customer_name?.trim() &&
        editData.phone_number?.toString().trim() &&
        editData.channel_partner?.trim() &&
        editData.system_capacity_kwp
    );

    const handleAdvanceStage = async (overrideNextStageId) => {
        const destStageId = overrideNextStageId || nextStageId;
        if (!destStageId) return;
        
        setSaving(true);
        
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

        if (destStageId === 'METER INSTALLATION') {
            const currentMeter = updates.meter_installation || {};
            updates.meter_installation = {
                status: currentMeter.status || 'No',
                no_date: currentMeter.no_date || new Date().toISOString().split('T')[0],
                yes_date: currentMeter.yes_date || null
            };
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

    const handleGenerateAgreement = () => {
        setShowAgreementPopup(true);
    };

    const handleSave = async () => {
        setSaving(true);
        const updates = { ...editData };
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

        delete updates.id; delete updates.created_at; delete updates.crn;
        await onUpdate(customer.id, updates);
        if (changeSummary.length > 0) await logActivity(user.id, 'update', `${customer.customer_name}: ${changeSummary.join(' | ')}`, '', customer.id);
        setEditingSection(null);
        setSaving(false);
        fetchLogs();
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
        if (editingSection) return true;
        if (editData.payment_type !== customer.payment_type) return true;
        if (editData.installation_status !== customer.installation_status) return true;
        if (editData.geo_tag_status !== customer.geo_tag_status) return true;
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
                        ...PRIMARY_STAGES.map(s => ({ id: s.id, label: s.label, icon: s.icon })),
                        { id: 'history',      label: 'Notes & History',         icon: History },
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
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="Add remark for current stage..."
                                                value={getStageRemarkFromData(editData.stages_remarks, editData.stage)}
                                                onChange={e => {
                                                    const newVal = e.target.value;
                                                    setIsSaved(false);
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
                                                disabled={isSaved}
                                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${isSaved ? 'bg-emerald-600 text-white cursor-default' : 'bg-stone-900 text-white hover:bg-stone-800'}`}
                                            >
                                                {isSaved ? 'Saved' : 'Save'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {/* ── LEADS ── */}
                    {activeTab === 'LEADS' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Customer Info */}
                            <section id="section-cus">
                                <SectionHeader title="Customer Info" id="cus" icon={User} />
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
                                    <EditableDetailItem label="Vendor Allotment" field="vendor" value={editData.vendor} onChange={handleChange} options={vendors} isEditing={editingSection === 'cus'} />
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
                    )}

                    {/* ── REGISTRATION ── */}
                    {activeTab === 'REGISTRATION' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            {/* Registration Details */}
                            <section id="section-reg_details">
                                <SectionHeader title="Registration Details" id="reg_details" icon={ClipboardList} />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <EditableDetailItem label="Registration date" field="registration_date" value={editData.registration_date} onChange={handleChange} type="date" isEditing={editingSection === 'reg_details'} />
                                    <EditableDetailItem label="Registration By" field="registration_by" value={editData.registration_by} onChange={handleChange} options={meta['registration_by']} category="registration_by" isEditing={editingSection === 'reg_details'} user={user} />
                                    <EditableDetailItem label="Registration No" field="registration_no" value={editData.registration_no} onChange={handleChange} isEditing={editingSection === 'reg_details'} />
                                </div>
                            </section>
                        </div>
                    )}


                    {/* ── LOAN ── */}
                    {activeTab === 'LOAN' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {editData.payment_type?.trim().toLowerCase() !== 'loan' ? (
                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center text-xs font-semibold text-amber-700">
                                    This customer's payment type is "{editData.payment_type || 'not specified'}" (not Loan). Loan tracking is not applicable.
                                </div>
                            ) : (
                                <>
                                    {/* Loan Tag Selector */}
                                    <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                        <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-1">
                                            <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Loan Tag Tracking</label>
                                            {isEditable && editData.loan_tag !== customer.loan_tag && (
                                                <button
                                                    onClick={handleSaveLoanTag}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10"
                                                >
                                                    Save Tag
                                                </button>
                                            )}
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
                                            {LOAN_TAGS.map(tag => {
                                                const isSelected = editData.loan_tag === tag.id;
                                                const colors = LOAN_TAG_COLORS[tag.id] || {};
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        disabled={!isEditable}
                                                        onClick={() => handleToggleLoanTag(tag.id)}
                                                        className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
                                                            isSelected
                                                                ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm shadow-stone-900/5`
                                                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                                        }`}
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${isSelected ? colors.dot : 'bg-stone-300'}`} />
                                                        {tag.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </section>

                                    {/* Loan History Timeline */}
                                    <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-2 mb-2 border-b border-stone-100 pb-2">
                                            <History size={16} className="text-stone-400" />
                                            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Loan Status Timeline</h3>
                                        </div>

                                        {(!editData.loan_history || editData.loan_history.length === 0) ? (
                                            <p className="text-xs text-stone-400 italic">No loan history recorded</p>
                                        ) : (
                                            <div className="relative border-l border-stone-200 ml-3 pl-5 space-y-4">
                                                {(editData.loan_history || []).map((e, idx) => {
                                                    const pillColors = {
                                                        Sanctioned: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
                                                        Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400' },
                                                        Returned: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
                                                        '1st Payment': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
                                                        '2nd Payment': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
                                                    };
                                                    const colors = pillColors[e.status] || { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200', dot: 'bg-stone-400' };
                                                    return (
                                                        <div key={idx} className="relative">
                                                            <span className={`absolute -left-[25.5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${colors.dot}`} />
                                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                                        {e.status}
                                                                    </span>
                                                                    {e.remark && <span className="text-xs text-stone-600 font-medium">{e.remark}</span>}
                                                                </div>
                                                                {e.date && <span className="text-[10px] text-stone-400 font-semibold">{e.date}</span>}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Add Loan Entry */}
                                        {isEditable && (
                                            <div className="pt-2">
                                                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <div>
                                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Status</label>
                                                            <select
                                                                value={loanDraftStatus}
                                                                onChange={e => setLoanDraftStatus(e.target.value)}
                                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                            >
                                                                {LOAN_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Date</label>
                                                            <input
                                                                type="date"
                                                                value={loanDraftDate}
                                                                onChange={e => setLoanDraftDate(e.target.value)}
                                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Remark</label>
                                                        <input
                                                            type="text"
                                                            placeholder="Remark details..."
                                                            value={loanDraftRemark}
                                                            onChange={e => setLoanDraftRemark(e.target.value)}
                                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                        />
                                                    </div>
                                                    <div className="flex justify-end gap-2 pt-1.5">
                                                        <button
                                                            onClick={async () => {
                                                                const entryDate = loanDraftDate || new Date().toISOString().split('T')[0];
                                                                const newEntry = {
                                                                    status: loanDraftStatus,
                                                                    date: entryDate,
                                                                    remark: loanDraftRemark,
                                                                    created_at: new Date().toISOString()
                                                                };
                                                                const updatedHistory = [...(editData.loan_history || []), newEntry];
                                                                
                                                                setEditData(prev => ({ 
                                                                    ...prev, 
                                                                    loan_history: updatedHistory,
                                                                    loan_tag: loanDraftStatus
                                                                }));
                                                                await onUpdate(customer.id, { 
                                                                    loan_history: updatedHistory,
                                                                    loan_tag: loanDraftStatus
                                                                });
                                                                
                                                                await logActivity(
                                                                    user.id,
                                                                    'update',
                                                                    `${customer.customer_name}: Added loan entry (${loanDraftStatus} on ${entryDate}${loanDraftRemark ? `: ${loanDraftRemark}` : ''})`,
                                                                    '',
                                                                    customer.id
                                                                );
                                                                
                                                                setLoanDraftRemark('');
                                                                setLoanDraftDate('');
                                                                fetchLogs();
                                                            }}
                                                            className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 transition-colors"
                                                        >
                                                            Add Entry
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </section>
                                </>
                            )}

                        </div>
                    )}

                    {/* ── CASH ── */}
                    {activeTab === 'CASH' && (() => {
                        const cashDetails = editData.cash_details || {
                            total_amount: 0,
                            payments: [
                                { name: '1st Payment', amount: 0, type: 'Cash', date: '', transaction_id: '' },
                                { name: '2nd Payment', amount: 0, type: 'Cash', date: '', transaction_id: '' },
                                { name: '3rd Payment', amount: 0, type: 'Cash', date: '', transaction_id: '' },
                            ]
                        };

                        const handleCashFieldChange = (field, val) => {
                            const updatedDetails = {
                                ...cashDetails,
                                [field]: val
                            };
                            setEditData(prev => ({ ...prev, cash_details: updatedDetails }));
                        };

                        const handleCashPaymentChange = (idx, field, val) => {
                            const newPayments = cashDetails.payments.map((p, i) => 
                                i === idx ? { ...p, [field]: val } : p
                            );
                            const updatedDetails = {
                                ...cashDetails,
                                payments: newPayments
                            };
                            setEditData(prev => ({ ...prev, cash_details: updatedDetails }));
                        };

                        const totalReceived = cashDetails.payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
                        const leftToReceive = (Number(cashDetails.total_amount) || 0) - totalReceived;

                        const isCashDetailsDirty = JSON.stringify(editData.cash_details) !== JSON.stringify(customer.cash_details);

                        return (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                    <div className="border-b border-stone-100 pb-3">
                                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                                            <Banknote className="w-4 h-4 text-emerald-600" /> Cash Payment Tracker
                                        </h4>
                                        <p className="text-xs text-stone-500 font-medium mt-1">Manage deal valuation, payment modes, and balance reconciliation.</p>
                                    </div>

                                    {/* Total Deal Amount input */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Total Deal Amount (₹)</label>
                                            <input
                                                type="text"
                                                inputMode="decimal"
                                                disabled={!isEditable}
                                                placeholder="Total Amount"
                                                value={cashDetails.total_amount ? toIndianCommas(cashDetails.total_amount) : ''}
                                                onChange={(e) => handleCashFieldChange('total_amount', parseIndianNumber(e.target.value))}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Payments Cards (1st, 2nd, 3rd Payment) */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                                        {cashDetails.payments.map((p, idx) => (
                                            <div key={idx} className="bg-stone-50 p-4 rounded-2xl border border-stone-150 space-y-3">
                                                <div className="flex justify-between items-center border-b border-stone-200 pb-1.5">
                                                    <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">{p.name || `Payment ${idx + 1}`}</span>
                                                </div>

                                                <div className="space-y-2">
                                                    <div>
                                                        <label className="text-[8px] font-bold text-stone-400 uppercase block mb-0.5">Amount (₹)</label>
                                                        <input
                                                            type="text"
                                                            inputMode="decimal"
                                                            disabled={!isEditable}
                                                            placeholder="0"
                                                            value={p.amount ? toIndianCommas(p.amount) : ''}
                                                            onChange={(e) => handleCashPaymentChange(idx, 'amount', parseIndianNumber(e.target.value))}
                                                            className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[8px] font-bold text-stone-400 uppercase block mb-0.5">Payment Type</label>
                                                        <select
                                                            disabled={!isEditable}
                                                            value={p.type || 'Cash'}
                                                            onChange={(e) => handleCashPaymentChange(idx, 'type', e.target.value)}
                                                            className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100"
                                                        >
                                                            <option value="Cash">Cash</option>
                                                            <option value="Online">Online</option>
                                                            <option value="DD">DD</option>
                                                            <option value="Cheque">Cheque</option>
                                                        </select>
                                                    </div>

                                                    <div>
                                                        <label className="text-[8px] font-bold text-stone-400 uppercase block mb-0.5">Date</label>
                                                        <input
                                                            type="date"
                                                            disabled={!isEditable}
                                                            value={p.date || ''}
                                                            onChange={(e) => handleCashPaymentChange(idx, 'date', e.target.value)}
                                                            className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="text-[8px] font-bold text-stone-400 uppercase block mb-0.5">Transaction ID</label>
                                                        <input
                                                            type="text"
                                                            disabled={!isEditable}
                                                            placeholder="Txn ID / Ref"
                                                            value={p.transaction_id || ''}
                                                            onChange={(e) => handleCashPaymentChange(idx, 'transaction_id', e.target.value)}
                                                            className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-medium text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Reconciliation Card */}
                                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-3">
                                        <div className="flex flex-col sm:flex-row gap-6">
                                            <div>
                                                <p className="text-[9px] font-bold text-emerald-800 uppercase tracking-wide">Total Received</p>
                                                <p className="text-base font-bold text-emerald-800">{formatINR(totalReceived)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[9px] font-bold text-stone-500 uppercase tracking-wide">Left to Receive</p>
                                                <p className={`text-base font-bold ${leftToReceive <= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {formatINR(Math.max(0, leftToReceive))}
                                                </p>
                                            </div>
                                        </div>

                                        {isEditable && isCashDetailsDirty && (
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setSaving(true);
                                                    await onUpdate(customer.id, { cash_details: cashDetails });
                                                    await logActivity(user.id, 'update', `${customer.customer_name}: Updated Cash Payment ledger details`, '', customer.id);
                                                    setSaving(false);
                                                    fetchLogs();
                                                }}
                                                disabled={saving}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition disabled:bg-stone-300 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                                            >
                                                <Save className="w-4 h-4" /> Save Payments
                                            </button>
                                        )}
                                    </div>

                                </div>
                            </div>
                        );
                    })()}

                    {/* ── MATERIAL INTEGRATION ── */}
                    {activeTab === 'MATERIAL INTEGRATION' && (
                        <div className="space-y-6 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-6">
                                <div className="flex justify-between items-center border-b border-stone-100 pb-3">
                                    <div>
                                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest font-bold">Bill of Materials (BOM)</h4>
                                        <p className="text-xs text-stone-500 font-medium mt-0.5">Define equipment templates and track material loading milestones.</p>
                                    </div>
                                    {bom && (
                                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                                            BOM Saved
                                        </span>
                                    )}
                                </div>

                                {/* Section 1: Read-only Customer Info */}
                                <div>
                                    <h5 className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-2">Customer & Site Reference</h5>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Party Name</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.customer_name || ""}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Mobile</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.phone_number || ""}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">kW</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.system_capacity_kwp || ""}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Dealer Name</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.channel_partner || ""}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">File No.</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.folder_no || ""}</p>
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Registration Date</label>
                                            <p className="text-xs font-bold text-stone-700">{editData?.registration_date || ""}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Section 2: Procurement Milestones */}
                                <div>
                                    <SectionHeader title="Procurement Milestones" id="proc_milestones" icon={ClipboardList} />
                                    {editingSection === 'proc_milestones' ? (
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">BOM Type</label>
                                                    <select
                                                        value={bomType}
                                                        onChange={(e) => handleBomTypeChange(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold"
                                                    >
                                                        <option value="">Select Type...</option>
                                                        <option value="ROOF">Roof</option>
                                                        <option value="SHED">Shed</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared By</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Prepared by name..."
                                                        value={paperPreparedBy}
                                                        onChange={(e) => setPaperPreparedBy(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Paper Prepared Date</label>
                                                    <input
                                                        type="date"
                                                        value={paperPreparedDate}
                                                        onChange={(e) => setPaperPreparedDate(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loading Date</label>
                                                    <input
                                                        type="date"
                                                        value={materialLoadingDate}
                                                        onChange={(e) => setMaterialLoadingDate(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded By</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Loaded by name..."
                                                        value={materialLoadedBy}
                                                        onChange={(e) => setMaterialLoadedBy(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Material Loaded Date</label>
                                                    <input
                                                        type="date"
                                                        value={materialLoadedDate}
                                                        onChange={(e) => setMaterialLoadedDate(e.target.value)}
                                                        disabled={!isEditable}
                                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-amber-400 font-semibold disabled:bg-stone-100/50"
                                                    />
                                                </div>
                                            </div>
                                            <div className="flex justify-end">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await saveBOM();
                                                        setEditingSection(null);
                                                    }}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5"
                                                >
                                                    <Save size={12} /> Save
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-stone-50 p-4 rounded-xl border border-stone-200">
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">BOM Type</label>
                                                <p className="text-xs font-bold text-stone-700">{bomType || ""}</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared By</label>
                                                <p className="text-xs font-bold text-stone-700">{paperPreparedBy || ""}</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Paper Prepared Date</label>
                                                <p className="text-xs font-bold text-stone-700">{paperPreparedDate || ""}</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loading Date</label>
                                                <p className="text-xs font-bold text-stone-700">{materialLoadingDate || ""}</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded By</label>
                                                <p className="text-xs font-bold text-stone-700">{materialLoadedBy || ""}</p>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-0.5">Material Loaded Date</label>
                                                <p className="text-xs font-bold text-stone-700">{materialLoadedDate || ""}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Section 3: BOM Items List Table */}
                                {bomType && (
                                    <div className="space-y-3">
                                        <SectionHeader title="BOM Items" id="bom_items" icon={ClipboardList} />
                                        <div className="overflow-x-auto border border-stone-200 rounded-xl">
                                            <table className="min-w-full divide-y divide-stone-200 text-xs">
                                                <thead className="bg-stone-50 text-stone-500 uppercase tracking-wider font-bold text-[9px]">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left w-12">Sr. No.</th>
                                                        <th className="px-3 py-2 text-left">Product Name</th>
                                                        <th className="px-3 py-2 text-left w-32">Make</th>
                                                        <th className="px-3 py-2 text-left w-24">UOM</th>
                                                        <th className="px-3 py-2 text-left w-36">Integration By</th>
                                                        <th className="px-3 py-2 text-left">Note</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-stone-200 bg-white font-medium text-stone-700">
                                                    {bomItems.map((item, idx) => (
                                                        <tr key={idx} className="hover:bg-stone-50/40">
                                                            <td className="px-3 py-1.5 text-stone-400 font-bold">{idx + 1}</td>
                                                            <td className="px-3 py-1.5 font-semibold text-stone-700">
                                                                {item.product_name || ''}
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={item.make || ''}
                                                                    onChange={(e) => handleItemFieldChange(idx, 'make', e.target.value)}
                                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                                    placeholder="Make..."
                                                                />
                                                            </td>
                                                            <td className="px-3 py-1.5 text-stone-500 font-semibold">
                                                                {item.uom || ''}
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={item.integration_by || ''}
                                                                    onChange={(e) => handleItemFieldChange(idx, 'integration_by', e.target.value)}
                                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                                    placeholder="Integration..."
                                                                />
                                                            </td>
                                                            <td className="px-3 py-1.5">
                                                                <input
                                                                    type="text"
                                                                    value={item.note || ''}
                                                                    onChange={(e) => handleItemFieldChange(idx, 'note', e.target.value)}
                                                                    disabled={!isEditable || editingSection !== 'bom_items'}
                                                                    className="w-full bg-white border border-stone-200 rounded px-1.5 py-0.5 text-xs outline-none focus:ring-1 focus:ring-amber-300 disabled:bg-stone-50 disabled:border-transparent"
                                                                    placeholder="Notes..."
                                                                />
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        {isEditable && editingSection === 'bom_items' && (
                                            <div className="flex justify-end items-center pt-2">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        await saveBOM();
                                                        setEditingSection(null);
                                                    }}
                                                    disabled={bomSaving}
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                                                >
                                                    <Save className="w-3.5 h-3.5" /> {bomSaving ? 'Saving BOM...' : 'Save'}
                                                </button>
                                            </div>
                                        )}

                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── HOLD PROCUREMENT ── */}
                    {activeTab === 'HOLD PROCUREMENT' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                                    <div>
                                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Hold Procurement</h4>
                                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Procurement hold status details.</p>
                                    </div>
                                    {isEditable && editData.hold_procurment !== customer.hold_procurment && (
                                        <button
                                            onClick={handleSaveHoldStatus}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0"
                                        >
                                            Save Status
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-3 gap-2 w-full pt-1">
                                    {[
                                        { id: 'Project Win', label: 'Project Win', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                                        { id: 'Project Lost', label: 'Project Lost', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                                        { id: 'Project Return', label: 'Project Return', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                                    ].map(tag => {
                                        const isSelected = editData.hold_procurment === tag.id;
                                        return (
                                            <button
                                                key={tag.id}
                                                disabled={!isEditable}
                                                onClick={() => handleToggleHoldStatus(tag.id)}
                                                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
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
                    )}

                    {/* ── MATERIAL DELIVERY ── */}
                    {activeTab === 'MATERIAL DELIVERY' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Material Delivery Fields */}
                            <section id="section-equip_details">
                                <SectionHeader title="Material Delivery Details" id="equip_details" icon={Zap} />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {editingSection === 'equip_details' ? (
                                        <div className="bg-stone-50 p-3 rounded-xl col-span-2 md:col-span-1 space-y-2">
                                            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">PANEL SERIAL NO.</p>
                                            <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                                                {panelSerials.map((serial, idx) => (
                                                    <div key={idx} className="flex items-center gap-1.5">
                                                        <input
                                                            type="text"
                                                            value={serial}
                                                            onChange={(e) => handlePanelSerialChange(idx, e.target.value)}
                                                            className="flex-1 bg-white border border-stone-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300"
                                                            placeholder={`Serial No #${idx + 1}`}
                                                        />
                                                        {panelSerials.length > 1 && (
                                                            <button
                                                                onClick={() => removePanelSerial(idx)}
                                                                className="text-red-400 hover:text-red-600 p-1"
                                                                type="button"
                                                            >
                                                                <Trash2 size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            <button
                                                onClick={addPanelSerial}
                                                className="flex items-center gap-1 text-amber-600 hover:text-amber-700 text-[10px] font-bold mt-1"
                                                type="button"
                                            >
                                                <Plus size={12} /> Add Serial No
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="bg-stone-50 p-3 rounded-xl col-span-2 md:col-span-1">
                                            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">PANEL SERIAL NO.</p>
                                            <div className="flex flex-col gap-1 mt-1">
                                                {panelSerials.filter(Boolean).length === 0 ? (
                                                    <span className="text-xs text-stone-400 italic">No serials entered</span>
                                                ) : (
                                                    panelSerials.filter(Boolean).map((serial, idx) => (
                                                        <div key={idx} className="text-xs text-stone-700 font-semibold">
                                                            {serial}
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    <EditableDetailItem label="INVERTER SERIAL NO." field="inverter_serial_no" value={editData.inverter_serial_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                    <EditableDetailItem label="INVOICE NO" field="invoice_no" value={editData.invoice_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                    <EditableDetailItem label="DRIVER NAME" field="driver_name" value={editData.driver_name} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                    <EditableDetailItem label="DRIVER PHONE NUMBER" field="driver_phone_number" value={editData.driver_phone_number} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                </div>
                            </section>
                        </div>
                    )}

                    {/* ── INSTALLATION STATUS ── */}
                    {activeTab === 'INSTALLATION STATUS' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* SFDC Photo Checklist Card */}
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-amber-500" /> SFDC Photo Checklist
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <CheckboxRemarkItem label="SFDC Photo Checked" field="sfdc_photo" value={editData.sfdc_photo} onChange={handleChange} isEditing={isEditable} />
                                </div>
                                {isEditable && editData.sfdc_photo !== customer.sfdc_photo && (
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setSaving(true);
                                                await onUpdate(customer.id, { sfdc_photo: editData.sfdc_photo });
                                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated SFDC Photo status to ${editData.sfdc_photo ? 'Checked' : 'Unchecked'}`, '', customer.id);
                                                setSaving(false);
                                                fetchLogs();
                                            }}
                                            disabled={saving}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-4 h-4" /> Save SFDC Photo
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Main Tag Selector Card */}
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                                    <div>
                                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Installation Status</h4>
                                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Has the physical installation been completed?</p>
                                    </div>
                                    {isEditable && (
                                        (editData.installation_status !== customer.installation_status) ||
                                        (editData.installation_date !== customer.installation_date) ||
                                        (editData.installed_by !== customer.installed_by)
                                    ) && (
                                        <button
                                            onClick={handleSaveInstallationDetails}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0"
                                        >
                                            Save Details
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-2 w-full pt-1">
                                    {[
                                        { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                                        { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                                        { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                                    ].map(tag => {
                                        const isSelected = editData.installation_status === tag.id;
                                        return (
                                            <button
                                                key={tag.id}
                                                disabled={!isEditable}
                                                onClick={() => handleToggleInstallationTag(tag.id)}
                                                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
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

                                {/* Installation Details Form — Only visible when status is Yes */}
                                {editData.installation_status === 'Yes' && (
                                    <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Installation Date</label>
                                            <input
                                                type="date"
                                                disabled={!isEditable}
                                                value={editData.installation_date || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, installation_date: e.target.value }))}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Installed By (Person in Charge)</label>
                                            <input
                                                type="text"
                                                disabled={!isEditable}
                                                placeholder="Enter name..."
                                                value={editData.installed_by || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, installed_by: e.target.value }))}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── GEO TAG PHOTO ── */}
                    {activeTab === 'GEO TAG PHOTO' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                                    <div>
                                        <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Geo Tag Photo</h4>
                                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">Has the geo-tagged photograph been uploaded?</p>
                                    </div>
                                    {isEditable && editData.geo_tag_status !== customer.geo_tag_status && (
                                        <button
                                            onClick={async () => {
                                                setSaving(true);
                                                await onUpdate(customer.id, { geo_tag_status: editData.geo_tag_status });
                                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated Geo Tag Photo Status to ${editData.geo_tag_status || 'None'}`, '', customer.id);
                                                setSaving(false);
                                                fetchLogs();
                                            }}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0"
                                        >
                                            Save Tag
                                        </button>
                                    )}
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
                                                disabled={!isEditable}
                                                onClick={() => {
                                                    const newTag = editData.geo_tag_status === tag.id ? null : tag.id;
                                                    setEditData(prev => ({ ...prev, geo_tag_status: newTag }));
                                                }}
                                                className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
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
                    )}

                    {/* ── DISCOM SUBMISSION ── */}
                    {activeTab === 'DISCOM SUBMISSION' && (
                        <div className="space-y-4 animate-in fade-in duration-300">

                            {/* File & DCR Checklist Card */}
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-2">
                                    <ClipboardList className="w-4 h-4 text-amber-500" /> Utility File Checklist
                                </h4>
                                <div className="flex flex-col gap-2">
                                    <CheckboxRemarkItem label="File Status Checked" field="file_status" value={editData.file_status} onChange={handleChange} isEditing={isEditable} />
                                    <CheckboxRemarkItem label="DCR Certificate Checked" field="dcr_certificate" value={editData.dcr_certificate} onChange={handleChange} isEditing={isEditable} />
                                </div>
                                {isEditable && (editData.file_status !== customer.file_status || editData.dcr_certificate !== customer.dcr_certificate) && (
                                    <div className="flex justify-end pt-2">
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                setSaving(true);
                                                await onUpdate(customer.id, { 
                                                    file_status: editData.file_status,
                                                    dcr_certificate: editData.dcr_certificate
                                                });
                                                await logActivity(user.id, 'update', `${customer.customer_name}: Updated Utility File Checklist (File Status: ${editData.file_status ? 'Checked' : 'Unchecked'}, DCR Certificate: ${editData.dcr_certificate ? 'Checked' : 'Unchecked'})`, '', customer.id);
                                                setSaving(false);
                                                fetchLogs();
                                            }}
                                            disabled={saving}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/10 flex items-center gap-1.5 disabled:bg-stone-300 disabled:cursor-not-allowed"
                                        >
                                            <Save className="w-4 h-4" /> Save Checklist
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Discom Submission Details Card */}
                            {(() => {
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
                                    <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4 animate-in fade-in duration-300">
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
                                                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0"
                                                >
                                                    Save Details
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
                                );
                            })()}

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
                                            onClick={handleGenerateAgreement}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/10 flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Printer className="w-4 h-4" /> Pop Open & Print Agreement
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── METER INSTALLATION ── */}
                    {activeTab === 'METER INSTALLATION' && (() => {
                        const meterData = editData.meter_installation || {
                            status: 'No',
                            no_date: '',
                            yes_date: ''
                        };

                        const handleMeterFieldChange = (field, val) => {
                            const updated = {
                                ...meterData,
                                [field]: val
                            };
                            setEditData(prev => ({ ...prev, meter_installation: updated }));
                        };

                        const isMeterDirty = JSON.stringify(editData.meter_installation) !== JSON.stringify(customer.meter_installation);

                        return (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                    <div className="flex items-center justify-between border-b border-stone-100 pb-2.5">
                                        <div>
                                            <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest font-bold">Meter Installation</h4>
                                            <p className="text-[11px] text-stone-500 font-medium mt-0.5">Net meter installation status and verification dates.</p>
                                        </div>
                                        {isEditable && isMeterDirty && (
                                            <button
                                                onClick={async () => {
                                                    setSaving(true);
                                                    await onUpdate(customer.id, { meter_installation: meterData });
                                                    await logActivity(
                                                        user.id,
                                                        'update',
                                                        `${customer.customer_name}: Updated Meter Installation details (Status: ${meterData.status}, No Date: ${meterData.no_date || 'N/A'}, Yes Date: ${meterData.yes_date || 'N/A'})`,
                                                        '',
                                                        customer.id
                                                    );
                                                    setSaving(false);
                                                    fetchLogs();
                                                }}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10 flex-shrink-0"
                                            >
                                                Save Details
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                                        {[
                                            { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                                            { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' }
                                        ].map(tag => {
                                            const isSelected = meterData.status === tag.id;
                                            return (
                                                <button
                                                    key={tag.id}
                                                    disabled={!isEditable}
                                                    onClick={() => {
                                                        if (meterData.status === tag.id) return;
                                                        const todayStr = new Date().toISOString().split('T')[0];
                                                        const updated = {
                                                            ...meterData,
                                                            status: tag.id
                                                        };
                                                        if (tag.id === 'Yes') {
                                                            updated.yes_date = todayStr;
                                                        } else {
                                                            updated.no_date = todayStr;
                                                        }
                                                        setEditData(prev => ({ ...prev, meter_installation: updated }));
                                                    }}
                                                    className={`px-3 py-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
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

                                    {/* Conditional Date Inputs */}
                                    <div className="pt-4 border-t border-stone-100 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2 duration-300">
                                        <div>
                                            <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">"No" Date (Initial Stage Move)</label>
                                            <input
                                                type="date"
                                                disabled={!isEditable}
                                                value={meterData.no_date || ''}
                                                onChange={e => handleMeterFieldChange('no_date', e.target.value)}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                            />
                                        </div>

                                        {(meterData.status === 'Yes') && (
                                            <div className="animate-in slide-in-from-left-2 duration-300">
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">"Yes" Date (Completion Date)</label>
                                                <input
                                                    type="date"
                                                    disabled={!isEditable}
                                                    value={meterData.yes_date || ''}
                                                    onChange={e => handleMeterFieldChange('yes_date', e.target.value)}
                                                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* ── DISCOM INSPECTION ── */}
                    {activeTab === 'DISCOM INSPECTION' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm">
                                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Discom Inspection</h4>
                                <p className="text-xs text-stone-500 font-medium mt-1">Utility official inspection schedules and updates.</p>
                            </div>
                        </div>
                    )}

                    {/* ── SUBSIDY STATUS ── */}
                    {activeTab === 'SUBSIDY STATUS' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Subsidy Tag Selector */}
                            <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-1">
                                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Subsidy Tag Tracking</label>
                                    {isEditable && editData.subsidy_tag !== customer.subsidy_tag && (
                                        <button
                                            onClick={handleSaveSubsidyTag}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10"
                                        >
                                            Save Tag
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full">
                                    {SUBSIDY_TAGS.map(tag => {
                                        const isSelected = editData.subsidy_tag === tag.id;
                                        const colors = SUBSIDY_TAG_COLORS[tag.id] || {};
                                        return (
                                            <button
                                                key={tag.id}
                                                disabled={!isEditable}
                                                onClick={() => handleToggleSubsidyTag(tag.id)}
                                                className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 w-full ${
                                                    isSelected
                                                        ? `${colors.bg} ${colors.text} ${colors.border} shadow-sm shadow-stone-900/5`
                                                        : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                                }`}
                                            >
                                                <span className={`w-2 h-2 rounded-full ${isSelected ? colors.dot : 'bg-stone-300'}`} />
                                                {tag.label}
                                            </button>
                                        );
                                    })}
                                </div>
                             </section>

                            {/* Subsidy History Timeline */}
                            <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center gap-2 mb-2 border-b border-stone-100 pb-2">
                                    <History size={16} className="text-stone-400" />
                                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Subsidy Status Timeline</h3>
                                </div>

                                {(!editData.subsidy_history || editData.subsidy_history.length === 0) ? (
                                    <p className="text-xs text-stone-400 italic">No subsidy history recorded</p>
                                ) : (
                                    <div className="relative border-l border-stone-200 ml-3 pl-5 space-y-4">
                                        {(editData.subsidy_history || []).map((e, idx) => {
                                            const pillColors = {
                                                Approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-400' },
                                                Returned: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-400' },
                                                Rejected: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', dot: 'bg-rose-400' },
                                                Redeemed: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-400' },
                                                Received: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-400' },
                                            };
                                            const colors = pillColors[e.status] || { bg: 'bg-stone-50', text: 'text-stone-600', border: 'border-stone-200', dot: 'bg-stone-400' };
                                            return (
                                                <div key={idx} className="relative">
                                                    <span className={`absolute -left-[25.5px] top-1.5 w-2 h-2 rounded-full ring-4 ring-white ${colors.dot}`} />
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
                                                                {e.status}
                                                            </span>
                                                            {e.remark && <span className="text-xs text-stone-600 font-medium">{e.remark}</span>}
                                                        </div>
                                                        {e.date && <span className="text-[10px] text-stone-400 font-semibold">{e.date}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Add Subsidy Entry */}
                                {isEditable && (
                                    <div className="pt-2">
                                        <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Status</label>
                                                    <select
                                                        value={draftStatus}
                                                        onChange={e => setDraftStatus(e.target.value)}
                                                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                    >
                                                        <option value="Approved">Approved</option>
                                                        <option value="Returned">Returned</option>
                                                        <option value="Rejected">Rejected</option>
                                                        <option value="Redeemed">Redeemed</option>
                                                        <option value="Received">Received</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Date</label>
                                                    <input
                                                        type="date"
                                                        value={draftDate}
                                                        onChange={e => setDraftDate(e.target.value)}
                                                        className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Remark</label>
                                                <input
                                                    type="text"
                                                    placeholder="Remark details..."
                                                    value={draftRemark}
                                                    onChange={e => setDraftRemark(e.target.value)}
                                                    className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                />
                                            </div>
                                            <div className="flex justify-end gap-2 pt-1.5">
                                                <button
                                                    onClick={async () => {
                                                        const entryDate = draftDate || new Date().toISOString().split('T')[0];
                                                        const newEntry = {
                                                            status: draftStatus,
                                                            date: entryDate,
                                                            remark: draftRemark,
                                                            created_at: new Date().toISOString()
                                                        };
                                                        const updatedHistory = [...(editData.subsidy_history || []), newEntry];
                                                        
                                                        setEditData(prev => ({ 
                                                            ...prev, 
                                                            subsidy_history: updatedHistory,
                                                            subsidy_tag: draftStatus
                                                        }));
                                                        await onUpdate(customer.id, { 
                                                            subsidy_history: updatedHistory,
                                                            subsidy_tag: draftStatus
                                                        });
                                                        
                                                        await logActivity(
                                                            user.id,
                                                            'update',
                                                            `${customer.customer_name}: Added subsidy entry (${draftStatus} on ${entryDate}${draftRemark ? `: ${draftRemark}` : ''})`,
                                                            '',
                                                            customer.id
                                                        );
                                                        
                                                        setDraftRemark('');
                                                        setDraftDate('');
                                                        fetchLogs();
                                                    }}
                                                    className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/10 transition-colors"
                                                >
                                                    Add Entry
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </section>
                        </div>
                    )}

                    {/* ── FINAL REVIEW ── */}
                    {activeTab === 'FINAL REVIEW' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Checklist Milestones */}
                            <section>
                                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm mb-3">
                                    <div>
                                        <h3 className="text-sm font-bold text-stone-800">Operational Checklist Milestones</h3>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col gap-2">
                                        <CheckboxRemarkItem label="Warranty Card Checked" field="warranty_card" value={editData.warranty_card} onChange={handleChange} isEditing={isEditable} />
                                        <CheckboxRemarkItem label="Insurance Status Checked" field="insurance_status" value={editData.insurance_status} onChange={handleChange} isEditing={isEditable} />
                                    </div>
                                    {isEditable && isOperationalChecklistDirty && (
                                        <div className="mt-4 pt-3 border-t border-stone-100 flex justify-end">
                                            <button onClick={handleSaveOperationalChecklist}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10">
                                                Save Checklist
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </section>
                        </div>
                    )}

                    {/* ── COMPLETED ── */}
                    {activeTab === 'COMPLETED' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            <div className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-2">
                                <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Project Completion</h4>
                                <p className="text-xs text-stone-500 font-medium">This project has reached final completion.</p>
                            </div>
                        </div>
                    )}

                    {/* ── NOTES & HISTORY ── */}
                    {activeTab === 'history' && (
                        <div className="space-y-8 animate-in fade-in duration-300">
                            <section id="section-rem">
                                <SectionHeader title="Internal Remarks (Staff Only)" id="rem" icon={ShieldCheck} />
                                {editingSection === 'rem' ? (
                                    <textarea value={editData.internal_remarks || ''} onChange={e => handleChange('internal_remarks', e.target.value)}
                                        className="w-full p-4 border rounded-2xl text-xs bg-stone-50 focus:ring-1 focus:ring-amber-400 outline-none" rows={4}
                                        placeholder="Sensitive notes visible only to internal staff..." />
                                ) : (
                                    <div className="bg-stone-100/50 p-4 rounded-2xl border border-stone-200 text-xs text-stone-600 italic whitespace-pre-line">
                                        {editData.internal_remarks || 'No internal remarks recorded yet.'}
                                    </div>
                                )}
                            </section>

                            <section>
                                <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-6">Activity Notes</h3>
                                <div className="space-y-3 mb-6 max-h-[300px] overflow-y-auto pr-2">
                                    {(editData.follow_ups || []).slice().reverse().map((f, i) => (
                                        <div key={i} className="bg-white p-3.5 rounded-xl border border-stone-100 shadow-sm">
                                            <p className="text-xs text-stone-800 leading-relaxed">{f.text}</p>
                                            <div className="flex justify-between mt-2.5 text-[8px] text-stone-400 font-bold uppercase">
                                                <span>{f.author}</span><span>{formatLogDate(f.date)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2">
                                    <input value={followUpText} onChange={e => setFollowUpText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && handleAddNote()}
                                        placeholder="Share an update with the team..."
                                        className="flex-1 px-4 py-3 bg-white border border-stone-200 rounded-xl text-xs outline-none focus:ring-1 focus:ring-amber-400" />
                                    <button onClick={handleAddNote} className="bg-stone-900 text-white px-6 rounded-xl hover:bg-stone-800 transition-all">
                                        <Send size={16} />
                                    </button>
                                </div>
                            </section>

                            <section>
                                <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest mb-6">Detailed System History</h3>
                                <div className="space-y-4">
                                    {activityLogs.length > 0 ? activityLogs.map((log, i) => (
                                        <div key={i} className="relative pl-6 pb-4 border-l border-stone-100 last:border-0">
                                            <div className="absolute -left-[4.5px] top-0 w-2 h-2 rounded-full bg-white border-2 border-amber-500 shadow-sm" />
                                            <div className="bg-white p-3 rounded-xl border border-stone-100 shadow-sm -mt-1.5 hover:border-amber-200 transition-colors">
                                                <div className="flex justify-between items-start mb-1.5">
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ${ACTION_COLORS[log.action] || 'bg-stone-100 text-stone-600'}`}>{log.action}</span>
                                                    <span className="text-[8px] text-stone-400 font-bold">{formatLogDate(log.created_at)}</span>
                                                </div>
                                                <div className="text-xs text-stone-700 font-medium whitespace-pre-wrap leading-relaxed">
                                                    {log.message.includes('|') ? (
                                                        <div className="space-y-1">
                                                            {log.message.split('|').map((line, idx) => (
                                                                <div key={idx} className="flex items-center gap-1"><span className="text-stone-400">↳</span> {line.trim()}</div>
                                                            ))}
                                                        </div>
                                                    ) : log.message}
                                                </div>
                                                <p className="text-[8px] text-stone-400 font-bold uppercase mt-2 border-t border-stone-50 pt-1.5">User: {log.profiles?.name || 'System'}</p>
                                            </div>
                                        </div>
                                    )) : <p className="text-[8px] text-stone-400 italic">No timeline entries found.</p>}
                                </div>
                            </section>
                        </div>
                    )}
                </div>

                {/* Footer bar */}
                {(isDirty || (hasNextStage && isEditable && activeTab === customer.stage)) && (
                    <div className="p-4 border-t border-stone-100 bg-white flex-shrink-0 flex gap-3">
                        {/* Save Changes button (if editing / changed) */}
                        {isDirty && (
                            <button onClick={handleSave} disabled={saving}
                                className="flex-1 bg-stone-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all text-xs">
                                {saving ? 'Saving...' : <><Save size={14} /> Save</>}
                            </button>
                        )}
                        {/* Save & Move to Next Stage button (if not frozen & has next stage) */}
                        {hasNextStage && isEditable && activeTab === customer.stage && (
                            editData.stage === 'MATERIAL INTEGRATION' ? (
                                <>
                                    <button
                                        onClick={() => handleAdvanceStage('HOLD PROCUREMENT')}
                                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs shadow-md shadow-amber-500/10"
                                    >
                                        Move to Hold
                                    </button>
                                    <button
                                        onClick={() => handleAdvanceStage('MATERIAL DELIVERY')}
                                        className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs shadow-md shadow-blue-600/10"
                                    >
                                        Move to Material Delivery
                                    </button>
                                </>
                            ) : editData.stage === 'HOLD PROCUREMENT' ? (
                                (editData.hold_procurment === 'Project Win' || editData.hold_procurment === 'Project Return') && (
                                    <button
                                        onClick={() => handleAdvanceStage('MATERIAL DELIVERY')}
                                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs shadow-md shadow-amber-500/10"
                                    >
                                        Save & Move to Material Delivery
                                    </button>
                                )
                            ) : editData.stage === 'GEO TAG PHOTO' ? (
                                editData.geo_tag_status === 'Proceed' && (
                                    <button
                                        onClick={() => handleAdvanceStage()}
                                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs shadow-md shadow-amber-500/10"
                                    >
                                        Save & Move to {nextStageLabel}
                                    </button>
                                )
                            ) : editData.stage === 'METER INSTALLATION' ? (
                                editData.meter_installation?.status === 'Yes' && (
                                    <button
                                        onClick={() => handleAdvanceStage()}
                                        className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs shadow-md shadow-amber-500/10"
                                    >
                                        Save & Move to {nextStageLabel}
                                    </button>
                                )
                            ) : (
                                <button
                                    disabled={editData.stage === 'LEADS' && !isLeadFieldsFilled}
                                    onClick={() => handleAdvanceStage()}
                                    className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs ${
                                        (editData.stage === 'LEADS' && !isLeadFieldsFilled)
                                            ? 'bg-stone-100 text-stone-400 cursor-not-allowed border border-stone-200'
                                            : 'bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10'
                                    }`}
                                    title={editData.stage === 'LEADS' && !isLeadFieldsFilled ? 'Please fill all required Lead fields (Name, Phone, Channel Partner, Capacity)' : `Advance to ${nextStageLabel}`}
                                >
                                    Save & Move to {nextStageLabel}
                                </button>
                            )
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

            {/* PM Surya Ghar Agreement Popup Modal */}
            {showAgreementPopup && (
                <AgreementPreview
                    data={agreementData}
                    onChange={setAgreementData}
                    onClose={() => setShowAgreementPopup(false)}
                />
            )}
        </div>
    );
}
