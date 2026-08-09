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
import { PRIMARY_STAGES, SUBSIDY_TAGS, SUBSIDY_TAG_COLORS } from '../constants';
import { logActivity, formatLogDate, formatINR, toIndianCommas, formatInputValue, parseIndianNumber } from '../utils';
import { supabase } from '../supabase';
import HistoryEntryEditor from './HistoryEntryEditor';

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

// ─── CustomerDetailModal ──────────────────────────────────────────────────────
export default function CustomerDetailModal({ customer, onClose, onUpdate, onDelete, user, meta, channel_partners = [], defaultTab }) {
    const [activeTab, setActiveTab] = useState(() => {
        if (defaultTab) return defaultTab;
        const regStages = ['REGISTRATION', 'LOAN', 'MATERIAL PROCUREMENT', 'HOLD PROCUREMENT'];
        const checklistStages = [
            'MATERIAL DELIVERY', 'INSTALLATION STATUS', 'GEO TAG PHOTO',
            'DISCOM SUBMISSION', 'METER INSTALLATION', 'DISCOM INSPECTION',
            'SUBSIDY STATUS', 'FINAL REVIEW', 'COMPLETED'
        ];
        if (regStages.includes(customer?.stage)) {
            return 'registration';
        }
        if (checklistStages.includes(customer?.stage)) {
            return 'checklist';
        }
        return 'overview';
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



    const [draftStatus, setDraftStatus] = useState('Approved');
    const [draftDate, setDraftDate] = useState('');
    const [draftRemark, setDraftRemark] = useState('');
    const [isAddingEntry, setIsAddingEntry] = useState(false);

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

    const handleSaveStageRemark = async () => {
        const currentRemark = getStageRemarkFromData(editData.stages_remarks, editData.stage);
        const originalRemark = getStageRemarkFromData(customer.stages_remarks, editData.stage);
        
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
                [editData.stage]: currentRemark
            };

            // Append the remark update to internal_remarks
            let updatedInternalRemarks = editData.internal_remarks || '';
            const formattedTime = formatDateTime(new Date());
            const appendText = `${editData.stage} (${formattedTime}): ${currentRemark.trim() || 'Remark cleared'}`;
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
                `${customer.customer_name}: Stage remark update for ${editData.stage} - "${currentRemark}"`,
                '',
                customer.id
            );
            fetchLogs();
        }
    };

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
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

    const SectionHeader = ({ title, id, icon: Icon }) => (
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
            <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Icon size={12} /> {title}
            </h3>
            {!isFrozen && (
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
                <div className="flex bg-stone-900 px-6 gap-6 border-t border-white/5 flex-shrink-0">
                    {[
                        { id: 'overview',     label: 'Overview',                icon: LayoutDashboard },
                        { id: 'registration', label: 'Registration',            icon: ClipboardList },
                        { id: 'checklist',    label: 'Installation & Progress', icon: CheckSquare },
                        { id: 'subsidy',      label: 'Subsidy Tracking',        icon: Tag },
                        { id: 'history',      label: 'Notes & History',         icon: History },
                    ].map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setEditingSection(null); }}
                            className={`flex items-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${activeTab === tab.id ? 'text-amber-400 border-amber-400' : 'text-stone-500 border-transparent hover:text-stone-300'}`}>
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
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Stage select */}
                            <div className={`p-4 rounded-2xl border shadow-sm ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-100'}`}>
                                <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Primary Stage</label>
                                {isFrozen ? (
                                    <div className="w-full p-2.5 bg-stone-100 border border-stone-200 rounded-xl font-bold text-stone-500 flex items-center gap-2">
                                        <Lock className="w-3.5 h-3.5" />
                                        <span>{PRIMARY_STAGES.find(s => s.id === editData.stage)?.label || editData.stage}</span>
                                    </div>
                                ) : (
                                    <select value={editData.stage} onChange={async (e) => {
                                        const newStage = e.target.value;
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

                                        setEditData(prev => ({
                                            ...prev,
                                            stage: newStage,
                                            stages_remarks: updatedRemarks
                                        }));

                                        await onUpdate(customer.id, {
                                            stage: newStage,
                                            stages_remarks: updatedRemarks
                                        });

                                        await logActivity(user.id, 'stage_change', `${customer.customer_name}: STAGE: ${oldStage} → ${newStage}`, '', customer.id);
                                        fetchLogs();
                                    }} className="w-full p-2.5 bg-white border border-stone-200 rounded-xl font-bold text-stone-700 outline-none">
                                        {PRIMARY_STAGES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                                    </select>
                                )}
                            </div>
                            {/* Stage Remark */}
                            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Stage Remark (Current Stage)</label>
                                    {isFrozen ? (
                                        <div className="text-xs text-stone-500 font-medium italic min-h-[36px] bg-stone-50 p-2 rounded-lg">
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
                                                onClick={handleSaveStageRemark}
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
                        </>
                    )}

                    {/* ── OVERVIEW ── */}
                    {activeTab === 'overview' && (
                        <div className="space-y-6 animate-in fade-in duration-300">

                            {/* Customer Info */}
                            <section id="section-cus">
                                <SectionHeader title="Customer Info" id="cus" icon={User} />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <EditableDetailItem label="Customer Name" field="customer_name" value={editData.customer_name} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Phone Number" field="phone" value={editData.phone} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Email Address" field="email" value={editData.email} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Villages" field="villages" value={editData.villages} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Folder No" field="folder_no" value={editData.folder_no} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Channel Partner Name" field="channel_partner" value={editData.channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} channel_partners={channel_partners} isAdmin={isAdmin} />
                                    <EditableDetailItem label="Sub Channel Partner Name" field="sub_channel_partner" value={editData.sub_channel_partner} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="System Capacity (kWp)" field="system_capacity_kwp" value={editData.system_capacity_kwp} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="MODULE BRAND" field="module_brand" value={editData.module_brand} onChange={handleChange} options={meta['module_brand']} category="module_brand" isEditing={editingSection === 'cus'} user={user} />
                                    <EditableDetailItem label="MODULE WP" field="module_wp" value={editData.module_wp} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="PAYMENT TYPE" field="payment_type" value={editData.payment_type} onChange={handleChange} options={meta['payment_type']} category="payment_type" isEditing={editingSection === 'cus'} user={user} />
                                    <EditableDetailItem label="Sub Division" field="sub_divisions" value={editData.sub_divisions} onChange={handleChange} isEditing={editingSection === 'cus'} />
                                    <EditableDetailItem label="Consumer No" field="consumer_no" value={editData.consumer_no} onChange={handleChange} type="number" isEditing={editingSection === 'cus'} />


                                </div>
                            </section>

                        </div>
                    )}

                    {/* ── REGISTRATION ── */}
                    {activeTab === 'registration' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Registration & Bank Details */}
                            <section id="section-reg_details">
                                <SectionHeader title="Registration & Bank Details" id="reg_details" icon={Building2} />
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    <EditableDetailItem label="Registration date" field="registration_date" value={editData.registration_date} onChange={handleChange} type="date" isEditing={editingSection === 'reg_details'} />
                                    <EditableDetailItem label="Registration By" field="registration_by" value={editData.registration_by} onChange={handleChange} options={meta['registration_by']} category="registration_by" isEditing={editingSection === 'reg_details'} user={user} />
                                    <EditableDetailItem label="Loan Registration Date" field="loan_registration_date" value={editData.loan_registration_date} onChange={handleChange} type="date" isEditing={editingSection === 'reg_details'} />
                                    <EditableDetailItem label="Bank Name" field="bank_name" value={editData.bank_name} onChange={handleChange} isEditing={editingSection === 'reg_details'} />
                                    <EditableDetailItem label="Branch Name" field="branch_name" value={editData.branch_name} onChange={handleChange} options={meta['branch_name']} category="branch_name" isEditing={editingSection === 'reg_details'} user={user} />
                                </div>
                            </section>

                            {/* Registration Checklist */}
                            <section id="section-reg_checklist">
                                <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
                                    <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                                        <ClipboardList size={12} /> Registration Checklist
                                    </h3>
                                    {!isFrozen && isRegChecklistDirty && (
                                        <button onClick={handleSaveRegChecklist}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-lg text-[9px] font-bold transition-all shadow-md shadow-emerald-600/10">
                                            Save Checklist
                                        </button>
                                    )}
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                                    <div className="flex flex-col gap-2">
                                        {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                            <>
                                                <CheckboxRemarkItem label="Adhaar card" field="adhaar_card" value={editData.adhaar_card} onChange={handleChange} isEditing={!isFrozen} />
                                                <CheckboxRemarkItem label="Pan card" field="pan_card" value={editData.pan_card} onChange={handleChange} isEditing={!isFrozen} />
                                                <CheckboxRemarkItem label="Index 2" field="index_2" value={editData.index_2} onChange={handleChange} isEditing={!isFrozen} />
                                            </>
                                        )}
                                        <CheckboxRemarkItem label="Light Bill" field="light_bill" value={editData.light_bill} onChange={handleChange} isEditing={!isFrozen} />
                                        <CheckboxRemarkItem label="Bank details" field="bank_details" value={editData.bank_details} onChange={handleChange} isEditing={!isFrozen} />
                                        {editData.payment_type?.trim().toLowerCase() !== 'cash' && (
                                            <CheckboxRemarkItem label="Bank Passbook" field="bank_passbook" value={editData.bank_passbook} onChange={handleChange} isEditing={!isFrozen} />
                                        )}
                                    </div>
                                </div>
                            </section>

                        </div>
                    )}

                    {/* ── CHECKLIST ── */}
                    {activeTab === 'checklist' && (() => {
                        const OPERATIONAL_CHECKLIST = [
                            { key: 'stamp', label: 'Stamp' },
                            { key: 'file_status', label: 'File Status' },
                            { key: 'geb_inspection', label: 'GEB Inspection' },
                            { key: 'subsidy_redeem', label: 'Subsidy Redeem' },
                            { key: 'sfdc_photo', label: 'SFDC Photo' },
                            { key: 'warranty_card', label: 'Warranty Card' },
                            { key: 'insurance_status', label: 'Insurance Status' },
                        ];
                        const isOperationalChecklistDirty = OPERATIONAL_CHECKLIST.some(item => !!editData[item.key] !== !!customer[item.key]);
                        const checkedCount = OPERATIONAL_CHECKLIST.filter(item => !!editData[item.key]).length;

                        const handleSaveOperationalChecklist = async () => {
                            const patch = {};
                            const changes = [];
                            OPERATIONAL_CHECKLIST.forEach(item => {
                                const oldVal = !!customer[item.key];
                                const newVal = !!editData[item.key];
                                if (oldVal !== newVal) {
                                    patch[item.key] = newVal;
                                    changes.push(`${item.label}: ${oldVal ? 'Checked' : 'Unchecked'} → ${newVal ? 'Checked' : 'Unchecked'}`);
                                }
                            });

                            await onUpdate(customer.id, patch);
                            if (changes.length > 0) {
                                await logActivity(user.id, 'update', `${customer.customer_name}: Operational checklist update - ${changes.join(' | ')}`, '', customer.id);
                            }
                            fetchLogs();
                        };

                        return (
                            <div className="space-y-4 animate-in fade-in duration-300">
                                {/* Material Delivery  */}
                                <section id="section-equip_details">
                                    <SectionHeader title="Material Delivery " id="equip_details" icon={Zap} />
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                        <EditableDetailItem label="PANEL SERIAL NO." field="panel_serial_no" value={editData.panel_serial_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                        <EditableDetailItem label="INVERTER SERIAL NO." field="inverter_serial_no" value={editData.inverter_serial_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                        <EditableDetailItem label="INVOICE NO" field="invoice_no" value={editData.invoice_no} onChange={handleChange} isEditing={editingSection === 'equip_details'} />
                                    </div>
                                </section>

                                {/* Operational Progress */}
                                <section>
                                    <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-stone-100 shadow-sm mb-3">
                                        <div>
                                            <h3 className="text-sm font-bold text-stone-800">Operational Progress</h3>
                                            <p className="text-[9px] text-stone-400 font-bold uppercase mt-1">{checkedCount} / {OPERATIONAL_CHECKLIST.length} Milestones Cleared</p>
                                        </div>
                                        {isOperationalChecklistDirty && (
                                            <button onClick={handleSaveOperationalChecklist}
                                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10">
                                                Save Checklist
                                            </button>
                                        )}
                                    </div>
                                    <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm">
                                        <div className="flex flex-col gap-2">
                                            {OPERATIONAL_CHECKLIST.map(item => (
                                                <label key={item.key} className="flex items-start gap-3 cursor-pointer group p-1 hover:bg-stone-50 rounded-lg transition-colors">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={!!editData[item.key]} 
                                                        disabled={isFrozen} 
                                                        onChange={() => handleChange(item.key, !editData[item.key])} 
                                                        className="mt-0.5 rounded border-stone-300 text-amber-500 focus:ring-amber-500" 
                                                    />
                                                    <div className="flex-1">
                                                        <span className={`text-xs block ${editData[item.key] ? 'text-stone-400 line-through' : 'text-stone-700 font-semibold'}`}>{item.label}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            </div>
                        );
                    })()}

                    {/* ── SUBSIDY ── */}
                    {activeTab === 'subsidy' && (
                        <div className="space-y-4 animate-in fade-in duration-300">
                            {/* Subsidy Tag Selector */}
                            <section className="bg-white p-6 rounded-[24px] border border-stone-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between border-b border-stone-100 pb-2 mb-1">
                                    <label className="text-[10px] text-stone-400 font-bold uppercase tracking-wider block">Subsidy Tag Tracking</label>
                                    {!isFrozen && editData.subsidy_tag !== customer.subsidy_tag && (
                                        <button
                                            onClick={handleSaveSubsidyTag}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-md shadow-emerald-600/10"
                                        >
                                            Save Tag
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 w-full">
                                    {SUBSIDY_TAGS.map(tag => {
                                        const isSelected = editData.subsidy_tag === tag.id;
                                        const colors = SUBSIDY_TAG_COLORS[tag.id] || {};
                                        return (
                                            <button
                                                key={tag.id}
                                                disabled={isFrozen}
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

                                {/* Compact Timeline list */}
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

                                {/* Add Subsidy Option */}
                                {!isFrozen && (
                                    <div className="pt-2">
                                        {isAddingEntry ? (
                                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                                <div className="grid grid-cols-2 gap-2">
                                                    <div>
                                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Status</label>
                                                        <select
                                                            value={draftStatus}
                                                            onChange={e => setDraftStatus(e.target.value)}
                                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-amber-400"
                                                        >
                                                            {SUBSIDY_STATUS_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
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
                                                        onClick={() => {
                                                            setIsAddingEntry(false);
                                                            setDraftRemark('');
                                                            setDraftDate('');
                                                        }}
                                                        className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold bg-stone-200 hover:bg-stone-300 text-stone-600 transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
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
                                                            
                                                            setIsAddingEntry(false);
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
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setDraftStatus(SUBSIDY_STATUS_OPTIONS[0]);
                                                    setIsAddingEntry(true);
                                                }}
                                                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-stone-300 rounded-xl py-2.5 text-xs font-bold text-stone-500 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/10 transition-all"
                                            >
                                                <Plus className="w-3.5 h-3.5" /> Add Subsidy Entry
                                            </button>
                                        )}
                                    </div>
                                )}
                            </section>
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

                {/* Save bar */}
                {(editingSection || editData.payment_type !== customer.payment_type) && (
                    <div className="p-4 border-t border-stone-100 bg-white flex-shrink-0">
                        <button onClick={handleSave} disabled={saving}
                            className="w-full bg-stone-900 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-stone-800 transition-all">
                            {saving ? 'Saving Changes...' : <><Save size={16} /> Save Changes</>}
                        </button>
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
        </div>
    );
}
