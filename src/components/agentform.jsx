import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Users, CreditCard, Hash, Folder, Tag
} from 'lucide-react';
import { logActivity } from '../utils';
import { DEFAULT_LEAD_FORM } from '../models';

function Field({ label, required, error, children }) {
    return (
        <div className="mb-3">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {children}
            {error && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />{error}
                </p>
            )}
        </div>
    );
}

function SectionHeader({ icon, label }) {
    return (
        <div className="flex items-center gap-2 mb-3 mt-5">
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                {icon}
            </div>
            <span className="text-white font-semibold text-sm">{label}</span>
            <div className="flex-1 h-px bg-white/10" />
        </div>
    );
}

function SuccessScreen({ customerName, onAnother }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Lead Submitted!</h2>
            <p className="text-gray-400 text-sm mb-8">{customerName} has been successfully added as a new lead.</p>
            <button
                onClick={onAnother}
                className="w-full max-w-xs bg-white hover:bg-gray-100 text-gray-900 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform cursor-pointer"
            >
                Add Another Lead <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

function ChannelPartnerAutocomplete({ label, value, onChange, suggestions = [], required = false, errors = {} }) {
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

    const inputClass = `w-full px-4 py-3 bg-gray-900 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/55 transition-all ${errors.channel_partner ? 'border-red-500/50' : 'border-gray-800'}`;

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setShowSuggestions(true)}
                    className={`${inputClass} pl-10`}
                    placeholder="Search or Enter Channel Partner"
                />
                {showSuggestions && filtered.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-800 rounded-xl shadow-xl z-50 max-h-40 overflow-y-auto py-1">
                        {filtered.map(s => (
                            <button
                                key={s}
                                type="button"
                                onClick={() => handleSelect(s)}
                                className="w-full text-left px-4 py-2.5 text-xs hover:bg-gray-800 text-stone-200 font-medium transition-colors"
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

export default function AgentForm({ user, onLogout }) {
    const [form, setForm] = useState({ ...DEFAULT_LEAD_FORM });
    const [meta, setMeta] = useState({});
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(null);

    useEffect(() => {
        const fetchMetadata = async () => {
            const { data, error } = await supabase
                .from('metadata')
                .select('category, label');
            if (!error && data) {
                const grouped = {};
                data.forEach(({ category, label }) => {
                    if (!grouped[category]) grouped[category] = [];
                    grouped[category].push(label);
                });
                setMeta(grouped);
            }
        };
        fetchMetadata();
    }, []);

    const set = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.customer_name?.trim()) e.customer_name = 'Customer Name is required';
        if (!form.phone_number?.toString().trim()) e.phone_number = 'Phone Number is required';
        if (!form.channel_partner?.trim()) e.channel_partner = 'Channel Partner is required';
        if (!form.system_capacity_kwp) e.system_capacity_kwp = 'System Capacity is required';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }

        setSaving(true);

        try {
            const leadData = {
                ...form,
                application_done_by: user.name,
                created_at: new Date().toISOString()
            };

            // Clean up or format numeric values
            if (leadData.system_capacity_kwp) {
                leadData.system_capacity_kwp = Number(leadData.system_capacity_kwp);
            }
            if (leadData.module_wp) {
                leadData.module_wp = Number(leadData.module_wp);
            }

            // Map empty strings to null to avoid database numeric/type syntax errors
            const insertData = {};
            Object.keys(leadData).forEach(key => {
                if (leadData[key] === '') {
                    insertData[key] = null;
                } else {
                    insertData[key] = leadData[key];
                }
            });

            const { data: newCustomer, error } = await supabase
                .from('admin')
                .insert(insertData)
                .select()
                .single();

            if (error) throw error;

            await logActivity(
                user.id,
                'create',
                `Added new lead: ${form.customer_name}`,
                `Done by: ${user.name}`,
                newCustomer.id
            );

            setSubmitted({ customerName: form.customer_name.trim() });
            setForm({ ...DEFAULT_LEAD_FORM });
            setErrors({});
        } catch (err) {
            console.error('Submit error:', err);
            setErrors({ submit: err.message || 'Failed to submit. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    if (submitted) {
        return (
            <SuccessScreen
                customerName={submitted.customerName}
                onAnother={() => setSubmitted(null)}
            />
        );
    }

    const inputClass = (field) =>
        `w-full px-4 py-3 bg-gray-900 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500/50 transition-all ${field && errors[field] ? 'border-red-500/50' : 'border-gray-800'}`;

    const selectClass = (field, val) =>
        `${inputClass(field)} appearance-none ${!val && 'text-gray-500'}`;

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col">
            <div className="w-full max-w-md mx-auto flex flex-col min-h-screen">

                {/* Header */}
                <div className="px-4 pt-10 pb-3 flex items-center justify-between flex-shrink-0">
                    <h1 className="text-white font-bold text-lg">New Lead</h1>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <p className="text-white text-xs font-semibold">{user.name}</p>
                            <p className="text-gray-500 text-[10px]">{user.role || 'Agent'}</p>
                        </div>
                        <button
                            onClick={onLogout}
                            className="p-2 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/5 cursor-pointer"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto px-4 pb-28">

                    {/* SECTION 1: Customer Info */}
                    <SectionHeader icon={<User className="w-3.5 h-3.5 text-white" />} label="Customer Info" />

                    <Field label="Customer Name" required error={errors.customer_name}>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="text"
                                value={form.customer_name ?? ''}
                                onChange={e => set('customer_name', e.target.value)}
                                placeholder="Customer Name"
                                className={`${inputClass('customer_name')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="Customer Phone Number" required error={errors.phone_number}>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="number"
                                value={form.phone_number ?? ''}
                                onChange={e => set('phone_number', e.target.value)}
                                placeholder="Customer Phone Number"
                                className={`${inputClass('phone_number')} pl-10 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                            />
                        </div>
                    </Field>

                    <Field label="Email Address" error={errors.email_address}>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="text"
                                value={form.email_address ?? ''}
                                onChange={e => set('email_address', e.target.value)}
                                placeholder="Email Address"
                                className={`${inputClass('email_address')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="Village" error={errors.villages}>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="text"
                                value={form.villages ?? ''}
                                onChange={e => set('villages', e.target.value)}
                                placeholder="Village"
                                className={`${inputClass('villages')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="Sub Division" error={errors.sub_divisions}>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="text"
                                value={form.sub_divisions ?? ''}
                                onChange={e => set('sub_divisions', e.target.value)}
                                placeholder="Sub Division"
                                className={`${inputClass('sub_divisions')} pl-10`}
                            />
                        </div>
                    </Field>

                    {/* SECTION 2: Partner & Payment */}
                    <SectionHeader icon={<Users className="w-3.5 h-3.5 text-white" />} label="Partner & Payment" />

                    <Field label="Channel Partner Name" required error={errors.channel_partner}>
                        <ChannelPartnerAutocomplete
                            label="Channel Partner Name"
                            value={form.channel_partner ?? ''}
                            onChange={(val) => set('channel_partner', val)}
                            suggestions={meta['channel_partner'] || []}
                            required={true}
                            errors={errors}
                        />
                    </Field>

                    <Field label="Sub Channel Partner Name" error={errors.sub_channel_partner}>
                        <div className="relative">
                            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="text"
                                value={form.sub_channel_partner ?? ''}
                                onChange={e => set('sub_channel_partner', e.target.value)}
                                placeholder="Sub Channel Partner Name"
                                className={`${inputClass('sub_channel_partner')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="Payment Type" error={errors.payment_type}>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <select
                                value={form.payment_type ?? ''}
                                onChange={e => set('payment_type', e.target.value)}
                                className={`${selectClass('payment_type', form.payment_type)} pl-10`}
                            >
                                <option value="">Select Payment Type</option>
                                {(meta['payment_type'] || []).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </Field>

                    {/* SECTION 3: Project Details */}
                    <SectionHeader icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} label="Project Details" />

                    <Field label="System Capacity (kWp)" required error={errors.system_capacity_kwp}>
                        <div className="relative">
                            <Zap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="number"
                                value={form.system_capacity_kwp ?? ''}
                                onChange={e => set('system_capacity_kwp', e.target.value)}
                                placeholder="System Capacity (kWp)"
                                step="0.01"
                                className={`${inputClass('system_capacity_kwp')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="System Brand" error={errors.module_brand}>
                        <div className="relative">
                            <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <select
                                value={form.module_brand ?? ''}
                                onChange={e => set('module_brand', e.target.value)}
                                className={`${selectClass('module_brand', form.module_brand)} pl-10`}
                            >
                                <option value="">Select System Brand</option>
                                {(meta['module_brand'] || []).map(s => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </div>
                    </Field>

                    <Field label="Module Wp" error={errors.module_wp}>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="number"
                                value={form.module_wp ?? ''}
                                onChange={e => set('module_wp', e.target.value)}
                                placeholder="Module Wp"
                                className={`${inputClass('module_wp')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="Consumer No" error={errors.consumer_no}>
                        <div className="relative">
                            <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="number"
                                value={form.consumer_no ?? ''}
                                onChange={e => set('consumer_no', e.target.value)}
                                placeholder="Consumer No"
                                className={`${inputClass('consumer_no')} pl-10`}
                            />
                        </div>
                    </Field>

                    <Field label="File No" error={errors.folder_no}>
                        <div className="relative">
                            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input
                                type="number"
                                value={form.folder_no ?? ''}
                                onChange={e => set('folder_no', e.target.value)}
                                placeholder="File No"
                                className={`${inputClass('folder_no')} pl-10`}
                            />
                        </div>
                    </Field>

                    {errors.submit && (
                        <div className="mb-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-2 text-red-400 text-sm">
                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                            <span>{errors.submit}</span>
                        </div>
                    )}
                </div>

                {/* Fixed submit button */}
                <div className="fixed bottom-0 left-0 right-0 px-4 pb-8 pt-4 bg-gradient-to-t from-gray-950 via-gray-950/95 to-transparent pointer-events-none">
                    <div className="max-w-md mx-auto pointer-events-auto">
                        <button onClick={handleSubmit} disabled={saving}
                            className="w-full bg-white hover:bg-gray-100 text-gray-900 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer">
                            {saving
                                ? <><Loader2 className="w-5 h-5 animate-spin" /> Submitting...</>
                                : <>Submit Lead <ChevronRight className="w-5 h-5" /></>
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}