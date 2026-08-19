import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Plus, Edit3, X, Paperclip, Eye, Upload, FileText, Image as ImageIcon, Download } from 'lucide-react';
import { formatINR, toIndianCommas, parseIndianNumber, formatInputValue } from '../../utils';

const fmt = formatINR;

export function getStageRemarkFromData(remarks, stageId) {
    if (!remarks) return '';
    if (typeof remarks === 'object') {
        return remarks[stageId] || '';
    }
    return '';
}

// ─── MetaSelect: standard select dropdown for metadata fields ─────────────────
export function MetaSelect({ label, field, value, onChange, options = [], isEditing }) {
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
export function StageRemarkSection({ stageId, editData, setEditData, isFrozen, onSave }) {
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
                        className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 placeholder:text-stone-400"
                    />
                </div>
            )}
        </section>
    );
}

// ─── DetailItem / EditableDetailItem ──────────────────────────────────────────
export function DetailItem({ label, value, isMoney = false, isEnergy = false }) {
    let displayVal = value;
    if (label && label.toLowerCase().includes('capacity') && value) {
        displayVal = toIndianCommas(value);
    }
    return (
        <div className="bg-stone-50 p-2.5 rounded-xl">
            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-0.5 font-bold">{label}</p>
            <p className={`text-sm font-semibold truncate ${isMoney ? 'text-emerald-600' : isEnergy ? 'text-amber-600' : 'text-stone-800'}`}>
                {isMoney ? fmt(value) : (displayVal || '–')}
            </p>
        </div>
    );
}

// Autocomplete component for Channel Partner Name selector inside editing view
export function ChannelPartnerAutocomplete({ label, value, onChange, suggestions = [], isAdmin = false }) {
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

export function EditableDetailItem({ label, field, value, onChange, type = 'text', isMoney = false, isEnergy = false, isEditing, options, category, channel_partners = [], isAdmin = false }) {
    if (options && category) {
        return <MetaSelect label={label} field={field} value={value} onChange={onChange} options={options} isEditing={isEditing} />;
    }
    if (!isEditing) return <DetailItem label={label} value={value} isMoney={isMoney} isEnergy={isEnergy} />;

    if (field === 'channel_partner') {
        return (
            <div className="bg-stone-50 p-2.5 rounded-xl">
                <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
                <ChannelPartnerAutocomplete label={label} value={value} onChange={(val) => onChange(field, val)} suggestions={channel_partners} isAdmin={isAdmin} />
            </div>
        );
    }

    return (
        <div className="bg-stone-50 p-2.5 rounded-xl">
            <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1 font-bold">{label}</p>
            {options ? (
                <select value={value || ''} onChange={e => onChange(field, e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300">
                    <option value="">Select...</option>
                    {options.map(o => <option key={o}>{o}</option>)}
                </select>
            ) : isMoney || field === 'invoice_value' ? (
                <input type="text" inputMode="decimal" value={value ? formatInputValue(value) : ''}
                    onChange={e => onChange(field, formatInputValue(e.target.value))}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
            ) : (
                <input type={type} value={value || ''} onChange={e => onChange(field, e.target.value)}
                    className="w-full bg-white border border-stone-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-300" />
            )}
        </div>
    );
}

// ─── FilePreviewModal ─────────────────────────────────────────────────────────
export function FilePreviewModal({ file, fileUrl, onClose, onDownload }) {
    if (!file) return null;
    const isImage = file.file_type?.startsWith('image/');
    const isPdf = file.file_type === 'application/pdf';

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between p-4 border-b border-stone-100">
                    <div className="flex items-center gap-2 min-w-0">
                        {isImage ? <ImageIcon size={16} className="text-stone-400 flex-shrink-0" /> : <FileText size={16} className="text-stone-400 flex-shrink-0" />}
                        <p className="text-sm font-bold text-stone-800 truncate">{file.file_name}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={onDownload}
                            className="flex items-center gap-1.5 bg-stone-900 hover:bg-stone-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors"
                        >
                            <Download size={12} /> Download
                        </button>
                        <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition-colors">
                            <X size={16} className="text-stone-400" />
                        </button>
                    </div>
                </div>
                <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-stone-50">
                    {isImage && fileUrl && (
                        <img src={fileUrl} alt={file.file_name} className="max-w-full max-h-[65vh] object-contain rounded-lg shadow-sm" />
                    )}
                    {isPdf && fileUrl && (
                        <iframe src={fileUrl} title={file.file_name} className="w-full h-[65vh] rounded-lg border border-stone-200" />
                    )}
                    {!isImage && !isPdf && (
                        <div className="flex flex-col items-center gap-3 py-12 text-stone-400">
                            <FileText size={48} className="text-stone-300" />
                            <p className="text-sm font-semibold">Preview not available</p>
                            <p className="text-xs">Click Download to view this file</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── CheckboxRemarkItem ───────────────────────────────────────────────────────
export function CheckboxRemarkItem({ label, field, value, onChange, isEditing, documents = [], onUpload, onDelete, onPreview }) {
    const fieldDocs = documents.filter(d => d.doc_type === field);
    const fileInputRef = React.useRef(null);
    const [replacingDocId, setReplacingDocId] = React.useState(null);

    const handleUploadClick = (existingDocId = null) => {
        setReplacingDocId(existingDocId);
        fileInputRef.current?.click();
    };

    const handleFileSelected = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (replacingDocId && onDelete) {
            const oldDoc = fieldDocs.find(d => d.id === replacingDocId);
            if (oldDoc) await onDelete(oldDoc);
        }
        if (onUpload) await onUpload(e, field);
        // Automatically check the checkbox when a file is uploaded
        if (onChange) {
            onChange(field, true);
        }
        setReplacingDocId(null);
    };

    if (!isEditing) {
        return (
            <div className="py-1.5">
                <div className="flex items-start gap-3 group">
                    <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all ${value ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-stone-100 border-stone-300 text-transparent'}`}>
                        {value && <svg className="w-2.5 h-2.5 stroke-[3] stroke-current" fill="none" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <span className={`text-xs block ${value ? 'text-stone-400 line-through' : 'text-stone-700 font-semibold'}`}>{label}</span>
                    </div>
                </div>
                {fieldDocs.length > 0 && (
                    <div className="ml-7 mt-1.5 space-y-1">
                        {fieldDocs.map(doc => (
                            <div key={doc.id} className="flex items-center gap-2 bg-stone-50 border border-stone-100 rounded-lg px-2.5 py-1.5">
                                <Paperclip size={11} className="text-stone-400 flex-shrink-0" />
                                <span className="text-[10px] text-stone-600 font-medium truncate flex-1">{doc.file_name}</span>
                                {onPreview && (
                                    <button onClick={() => onPreview(doc)} className="text-[9px] font-bold text-amber-600 hover:text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors">View</button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="py-1.5">
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

            <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                onChange={handleFileSelected}
                className="hidden"
            />

            <div className="ml-7 mt-1.5 space-y-1.5">
                {fieldDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5">
                        <Paperclip size={11} className="text-stone-400 flex-shrink-0" />
                        <span className="text-[10px] text-stone-600 font-medium truncate flex-1">{doc.file_name}</span>
                        <div className="flex items-center gap-1 flex-shrink-0">
                            {onPreview && (
                                <button onClick={() => onPreview(doc)} className="text-[9px] font-bold text-amber-600 hover:text-amber-700 px-1.5 py-0.5 rounded hover:bg-amber-50 transition-colors flex items-center gap-0.5">
                                    <Eye size={10} /> View
                                </button>
                            )}
                            <button onClick={() => handleUploadClick(doc.id)} className="text-[9px] font-bold text-blue-600 hover:text-blue-700 px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors flex items-center gap-0.5">
                                <Upload size={10} /> Change
                            </button>
                            {onDelete && (
                                <button onClick={() => onDelete(doc)} className="text-[9px] font-bold text-red-500 hover:text-red-600 px-1.5 py-0.5 rounded hover:bg-red-50 transition-colors flex items-center gap-0.5">
                                    <Trash2 size={10} /> Remove
                                </button>
                            )}
                        </div>
                    </div>
                ))}
                {fieldDocs.length === 0 && onUpload && (
                    <button
                        onClick={() => handleUploadClick()}
                        className="flex items-center gap-1.5 text-[10px] font-bold text-stone-400 hover:text-amber-600 px-2 py-1 rounded-lg border border-dashed border-stone-200 hover:border-amber-300 hover:bg-amber-50/30 transition-all"
                    >
                        <Paperclip size={11} /> Attach File
                    </button>
                )}
            </div>
        </div>
    );
}

// ─── PaymentsEditor ───────────────────────────────────────────────────────────
export function PaymentsEditor({ payments = [], onChange, isEditing }) {
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
                        <p className="text-sm font-semibold text-emerald-600">{fmt(p.amount)}</p>
                    </div>
                    {p.date && <p className="text-xs text-stone-400">{p.date}</p>}
                </div>
            ))}
            {payments.length > 0 && (
                <div className="bg-emerald-50 rounded-xl p-3 flex justify-between items-center border border-emerald-100">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">Total Received</p>
                    <p className="text-sm font-bold text-emerald-700">{fmt(displayTotal)}</p>
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
                    <p className="text-sm font-bold text-amber-700">{fmt(displayTotal)}</p>
                </div>
            )}
        </div>
    );
}

// ─── SectionHeader: simple section headers with edit toggle buttons ───────────
export function SectionHeader({ title, id, icon: Icon, isEditable, editingSection, setEditingSection }) {
    return (
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
            <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Icon size={12} /> {title}
            </h3>
            {isEditable && (
                <button onClick={() => {
                    const isOpening = editingSection !== id;
                    if (setEditingSection) {
                        setEditingSection(isOpening ? id : null);
                    }
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
}
