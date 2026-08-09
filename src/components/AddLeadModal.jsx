// src/components/AddLeadModal.jsx  —  Watersun Electrical Solutions Pvt Ltd
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef } from 'react';
import { X, Plus } from 'lucide-react';
import { supabase } from '../supabase';
import { DEFAULT_LEAD_FORM } from '../models';
import { logActivity } from '../utils';

function AddLeadMetaSelect({ label, field, value, onChange, options = [] }) {
    return (
        <div>
            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">{label}</label>
            <select value={value || ''} onChange={e => onChange(field, e.target.value)}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:border-amber-400 outline-none transition">
                <option value="">Select {label}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        </div>
    );
}

// Autocomplete component for Channel Partner Name selector
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
        <div className="relative w-full" ref={containerRef}>
            <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                {label} {required && <span className="text-red-500 font-bold">*</span>}
            </label>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:border-amber-400 outline-none transition"
                    placeholder={label}
                />
                {showSuggestions && filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-stone-100 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto py-1">
                        {filtered.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => handleSelect(s)}
                                className="w-full text-left px-3 py-2 text-xs hover:bg-stone-50 text-stone-700 font-medium transition-colors"
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

export default function AddLeadModal({ isOpen, onClose, onSave, meta = {}, channel_partners = [], user }) {
    const [formData, setFormData] = useState({ ...DEFAULT_LEAD_FORM });

    useEffect(() => {
        if (isOpen) setFormData({ ...DEFAULT_LEAD_FORM });
    }, [isOpen]);

    if (!isOpen) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        if (!formData.customer_name?.trim()) return alert('Customer Name is required');
        if (!formData.phone_number?.toString().trim()) return alert('Customer Phone Number is required');
        if (!formData.channel_partner?.trim()) return alert('Channel Partner Name is required');
        if (!formData.system_capacity_kwp) return alert('System Capacity is required');

        onSave(formData);
        onClose();
    };

    // Explicit order list of fields to display
    const formFields = [
        { label: 'Customer Name', field: 'customer_name', type: 'text', required: true },
        { label: 'Customer Phone Number', field: 'phone_number', type: 'number', required: true },
        { label: 'Email Address', field: 'email_address', type: 'text', required: false },
        { label: 'Sub Channel Partner Name', field: 'sub_channel_partner', type: 'text', required: false },
        { label: 'Channel Partner Name', field: 'channel_partner', type: 'text', required: true },
        { label: 'Consumer No', field: 'consumer_no', type: 'number', required: false },
        { label: 'System Capacity (kWp)', field: 'system_capacity_kwp', type: 'number', required: true },
        { label: 'System Brand', field: 'module_brand', type: 'select', category: 'module_brand', required: false },
        { label: 'Module Wp', field: 'module_wp', type: 'number', required: false },
        { label: 'Village', field: 'villages', type: 'text', required: false },
        { label: 'Sub Division', field: 'sub_divisions', type: 'text', required: false },
        { label: 'File No', field: 'folder_no', type: 'number', required: false },
        { label: 'Payment Type', field: 'payment_type', type: 'select', category: 'payment_type', required: false },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto mx-4">
                <div className="flex items-center justify-between p-5 border-b border-stone-100 sticky top-0 bg-white z-10 rounded-t-2xl">
                    <h2 className="text-base font-black text-stone-800">Add New Lead</h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-stone-100 rounded-lg transition cursor-pointer">
                        <X className="w-4 h-4 text-stone-400" />
                    </button>
                </div>

                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {formFields.map(({ label, field, type, required, category }) => {
                            if (type === 'select') {
                                return (
                                    <div key={field}>
                                        <AddLeadMetaSelect
                                            label={label}
                                            field={field}
                                            value={formData[field]}
                                            onChange={handleChange}
                                            options={meta[category] || []}
                                        />
                                    </div>
                                );
                            }

                             if (field === 'channel_partner') {
                                 return (
                                     <div key={field}>
                                          <ChannelPartnerAutocomplete
                                              label={label}
                                              value={formData[field]}
                                              onChange={(val) => handleChange(field, val)}
                                              suggestions={channel_partners}
                                              required={required}
                                              isAdmin={user?.userType === 'admin'}
                                          />
                                     </div>
                                 );
                             }

                            return (
                                <div key={field}>
                                    <label className="block text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-1">
                                        {label} {required && <span className="text-red-500 font-bold">*</span>}
                                    </label>
                                    <input
                                        type={type}
                                        value={formData[field] ?? ''}
                                        onChange={e => handleChange(field, e.target.value)}
                                        className="w-full px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:border-amber-400 outline-none transition"
                                        placeholder={label}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="flex gap-2 p-5 border-t border-stone-100 sticky bottom-0 bg-white rounded-b-2xl">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 text-xs font-bold text-stone-500 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer">
                        Cancel
                    </button>
                    <button onClick={handleSave}
                        className="flex-1 py-2.5 text-xs font-black text-white bg-amber-500 hover:bg-amber-400 rounded-xl transition cursor-pointer flex items-center justify-center gap-1.5">
                        <Plus className="w-3.5 h-3.5" /> Add Lead
                    </button>
                </div>
            </div>
        </div>
    );
}
