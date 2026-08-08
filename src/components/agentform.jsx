import { useState } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle
} from 'lucide-react';
import { toIndianCommas, parseIndianNumber } from '../utils';

const BRANCHES = ['Srikalahasti', 'Tirupati', 'Tada', 'Puttur', 'Nagari', 'Pichatur'];
const PROJECT_TYPES = ['On-Grid', 'Off-Grid', 'Hybrid'];



function Field({ label, required, error, children }) {
    return (
        <div className="mb-3">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                {label}{required && <span className="text-red-400 ml-0.5">*</span>}
            </label>
            {children}
            {error && (
                <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
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

function SuccessScreen({ customerName, quotationNumber, onAnother }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-950 px-6 text-center">
            <div className="w-20 h-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Lead Submitted!</h2>
            <p className="text-gray-400 text-sm mb-1">{customerName}</p>
            <p className="text-xs text-gray-600 font-mono mb-8">{quotationNumber}</p>
            <button
                onClick={onAnother}
                className="w-full max-w-xs bg-white text-gray-900 py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
                Add Another Lead <ChevronRight className="w-4 h-4" />
            </button>
        </div>
    );
}

export default function AgentForm({ user, onLogout }) {
    const empty = {
        customer_name: '', phone: '', email: '', location: '',
        company_branch: '', capacity_kwp: '', project_type: 'On-Grid',
        poc: '',
    };

    const [form, setForm] = useState(empty);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(null);

    const set = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validate = () => {
        const e = {};
        if (!form.customer_name.trim()) e.customer_name = 'Name is required';
        if (!form.phone.trim()) e.phone = 'Phone is required';
        if (!form.location.trim()) e.location = 'Location is required';
        if (!form.company_branch) e.company_branch = 'Branch is required';
        if (!form.capacity_kwp) e.capacity_kwp = 'Capacity is required';
        return e;
    };

    const handleSubmit = async () => {
        const e = validate();
        if (Object.keys(e).length > 0) { setErrors(e); return; }

        setSaving(true);

        try {
            const { error } = await supabase.from('admin').insert({
                customer_name: form.customer_name.trim(),
                phone_number: form.phone.trim(),
                email_address: form.email.trim() || null,
                location: form.location.trim(),
                company_branch: form.company_branch,
                system_capacity_kwp: form.capacity_kwp ? Number(form.capacity_kwp) : null,
                project_type: form.project_type,
                channel_partner: form.poc || user.name,
                application_done_by: user.name,
                stage: 'LEADS',
                payments: [],
                follow_ups: [],
                project_checklist: [],
            });

            if (error) throw error;

            await supabase.from('activity_log').insert({
                user_id: user.id,
                action: 'create',
                message: `Added new lead ${form.customer_name.trim()}`,
                new_value: `${form.capacity_kwp} kWp ${form.project_type} • ${form.company_branch}`,
            });

            setSubmitted({ customerName: form.customer_name.trim(), quotationNumber: '' });
            setForm(empty);
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
                quotationNumber={submitted.quotationNumber}
                onAnother={() => setSubmitted(null)}
            />
        );
    }

    const inputClass = (field) =>
        `w-full px-4 py-3 bg-gray-900 border rounded-xl text-white text-sm placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-white/30 transition-all ${field && errors[field] ? 'border-red-500/50' : 'border-gray-800'}`;

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
                            className="p-2 text-gray-600 hover:text-gray-400 transition-colors rounded-lg hover:bg-white/5"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Scrollable form */}
                <div className="flex-1 overflow-y-auto px-4 pb-28">

                    <SectionHeader icon={<User className="w-3.5 h-3.5 text-white" />} label="Customer Info" />

                    <Field label="Full Name" required error={errors.customer_name}>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input type="text" value={form.customer_name} onChange={e => set('customer_name', e.target.value)}
                                placeholder="Customer full name" className={`${inputClass('customer_name')} pl-10`} />
                        </div>
                    </Field>

                    <Field label="Phone" required error={errors.phone}>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)}
                                placeholder="+91 XXXXX XXXXX" className={`${inputClass('phone')} pl-10`} />
                        </div>
                    </Field>

                    <Field label="Email">
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                                placeholder="email@example.com (optional)" className={`${inputClass(null)} pl-10`} />
                        </div>
                    </Field>

                    <Field label="Location" required error={errors.location}>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <input type="text" value={form.location} onChange={e => set('location', e.target.value)}
                                placeholder="Site location / village" className={`${inputClass('location')} pl-10`} />
                        </div>
                    </Field>

                    <Field label="Branch" required error={errors.company_branch}>
                        <div className="relative">
                            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 pointer-events-none" />
                            <select value={form.company_branch} onChange={e => set('company_branch', e.target.value)}
                                className={`${inputClass('company_branch')} pl-10 appearance-none ${!form.company_branch && 'text-gray-600'}`}>
                                <option value="">Select branch...</option>
                                {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                            </select>
                        </div>
                    </Field>

                    <Field label="POC (Point of Contact)">
                        <input type="text" value={form.poc} onChange={e => set('poc', e.target.value)}
                            placeholder="Contact person name" className={inputClass('poc')} />
                    </Field>

                    <SectionHeader icon={<Zap className="w-3.5 h-3.5 text-amber-400" />} label="Project Details" />

                    <Field label="Capacity (kWp)" required error={errors.capacity_kwp}>
                        <input type="number" value={form.capacity_kwp} onChange={e => set('capacity_kwp', e.target.value)}
                            placeholder="e.g. 5" min="0" step="0.5" className={inputClass('capacity_kwp')} />
                    </Field>

                    <Field label="System Type">
                        <div className="grid grid-cols-3 gap-2">
                            {PROJECT_TYPES.map(t => (
                                <button key={t} type="button" onClick={() => set('project_type', t)}
                                    className={`py-2.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                                        form.project_type === t
                                            ? 'bg-white text-gray-900 border-white'
                                            : 'bg-gray-900 text-gray-500 border-gray-800'
                                    }`}>
                                    {t}
                                </button>
                            ))}
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
                            className="w-full bg-white hover:bg-gray-100 text-gray-900 py-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all active:scale-[0.98]">
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