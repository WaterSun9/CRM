import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Users, CreditCard, Hash, Folder, Tag, ChevronLeft, Plus, Search, ChevronDown, ChevronUp, ClipboardList, Banknote, ShieldAlert
} from 'lucide-react';
import { logActivity } from '../utils';
import { DEFAULT_LEAD_FORM } from '../models';
import { PRIMARY_STAGES } from '../constants';

export default function AgentPortal({ user, onLogout }) {
    const [view, setView] = useState('menu'); // 'menu', 'add_lead', 'my_customers'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Customer search & accordion states
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStages, setExpandedStages] = useState({
        'LEADS': true,
        'METER INSTALLATION': true
    });
    
    // Customer details view
    const [selectedCust, setSelectedCust] = useState(null);

    // Form states
    const getInitialFormState = () => {
        const initialForm = { ...DEFAULT_LEAD_FORM };
        if (user?.userType === 'agent' || user?.role === 'Channel Partners') {
            initialForm.channel_partner = user.name || '';
        }
        return initialForm;
    };
    const [form, setForm] = useState(getInitialFormState);
    const [meta, setMeta] = useState({});
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [submitted, setSubmitted] = useState(null);

    // Load agent's customers & metadata
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('admin')
                .select('*')
                .eq('channel_partner', user.name)
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (!error && data) {
                setCustomers(data);
            }
        } catch (err) {
            console.error('Error fetching customers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.name) {
            fetchCustomers();
        }
    }, [user]);

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

    // Form submission
    const handleFormChange = (field, val) => {
        setForm(prev => ({ ...prev, [field]: val }));
        if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
    };

    const validateForm = () => {
        const e = {};
        if (!form.customer_name?.trim()) e.customer_name = 'Customer Name is required';
        if (!form.phone_number?.toString().trim()) e.phone_number = 'Phone Number is required';
        if (!form.system_capacity_kwp) e.system_capacity_kwp = 'System Capacity is required';
        return e;
    };

    const handleSubmitLead = async () => {
        const e = validateForm();
        if (Object.keys(e).length > 0) { setErrors(e); return; }

        setSaving(true);
        try {
            const leadData = {
                ...form,
                channel_partner: user.name,
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
                `Done by Agent: ${user.name}`,
                newCustomer.id
            );

            setSubmitted({ customerName: form.customer_name.trim() });
            setForm(getInitialFormState());
            setErrors({});
            fetchCustomers(); // Refresh list
        } catch (err) {
            console.error('Submit error:', err);
            setErrors({ submit: err.message || 'Failed to submit. Please try again.' });
        } finally {
            setSaving(false);
        }
    };

    // Filter customers
    const filteredCustomers = customers.filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            c.customer_name?.toLowerCase().includes(q) ||
            c.phone_number?.toString().includes(q) ||
            c.consumer_no?.toString().includes(q)
        );
    });

    // Group by stage
    const getCustomersByStage = (stageId) => {
        return filteredCustomers.filter(c => c.stage === stageId);
    };

    const toggleStage = (stageId) => {
        setExpandedStages(prev => ({ ...prev, [stageId]: !prev[stageId] }));
    };

    return (
        <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
            {/* Top Bar */}
            <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10">
                        <Zap className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                        <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase">Watersun</h1>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest -mt-0.5">Agent Portal</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-600 truncate max-w-[120px]">{user.name}</span>
                    <button
                        onClick={onLogout}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-xl hover:bg-stone-50"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Menu View */}
            {view === 'menu' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-5 animate-in fade-in duration-300">
                    {/* Welcome Banner */}
                    <div className="bg-gradient-to-br from-stone-900 to-stone-800 text-white p-6 rounded-[24px] shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                            <Zap className="w-40 h-40" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-amber-400 font-bold">Welcome Back</p>
                        <h2 className="text-xl font-bold mt-1">{user.name}</h2>
                        <p className="text-xs text-stone-300 mt-2 font-medium">Manage your leads and track installation statuses.</p>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Total Leads</p>
                            <p className="text-lg font-black text-stone-850 mt-1">{customers.length}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Installations</p>
                            <p className="text-lg font-black text-amber-600 mt-1">
                                {customers.filter(c => c.stage === 'METER INSTALLATION' || c.stage === 'INSTALLATION STATUS').length}
                            </p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm text-center">
                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Completed</p>
                            <p className="text-lg font-black text-emerald-600 mt-1">
                                {customers.filter(c => c.stage === 'COMPLETED').length}
                            </p>
                        </div>
                    </div>

                    {/* Portal Menu Actions */}
                    <div className="space-y-3">
                        <button
                            onClick={() => { setView('add_lead'); setSubmitted(null); }}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white p-5 rounded-[24px] shadow-md shadow-amber-500/10 flex items-center justify-between transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Add New Customer</h3>
                                    <p className="text-[10px] text-amber-100 font-medium mt-0.5">Register a lead in CRM pipeline</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-amber-100" />
                        </button>

                        <button
                            onClick={() => setView('my_customers')}
                            className="w-full bg-white hover:bg-stone-50 text-stone-800 border border-stone-100 p-5 rounded-[24px] shadow-sm flex items-center justify-between transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-10 h-10 bg-stone-100 rounded-xl flex items-center justify-center">
                                    <Users className="w-5 h-5 text-stone-600" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">View My Customers</h3>
                                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider mt-0.5">
                                        Track {customers.length} lead{customers.length === 1 ? '' : 's'}
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-stone-400" />
                        </button>
                    </div>
                </main>
            )}

            {/* Add Lead Form View */}
            {view === 'add_lead' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full animate-in slide-in-from-right duration-300">
                    <button
                        onClick={() => setView('menu')}
                        className="mb-4 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 font-bold"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                    </button>

                    {submitted ? (
                        <div className="bg-white border border-stone-100 p-6 rounded-[24px] shadow-sm text-center py-10">
                            <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500 shadow-inner">
                                <CheckCircle2 className="w-8 h-8" />
                            </div>
                            <h3 className="text-base font-bold text-stone-900">Lead Submitted!</h3>
                            <p className="text-xs text-stone-400 font-medium mt-1">
                                {submitted.customerName} has been successfully added.
                            </p>
                            <div className="flex flex-col gap-2 mt-6">
                                <button
                                    onClick={() => setSubmitted(null)}
                                    className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    Add Another Lead
                                </button>
                                <button
                                    onClick={() => setView('my_customers')}
                                    className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs py-3 rounded-xl transition-all active:scale-[0.98]"
                                >
                                    View Customer Directory
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border border-stone-100 p-5 rounded-[24px] shadow-sm space-y-4">
                            <div>
                                <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">New Customer Details</h2>
                                <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Please provide accurate pipeline details.</p>
                            </div>

                            <div className="space-y-3.5">
                                {/* Customer Name */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Customer Name *</label>
                                    <div className="relative">
                                        <User className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={form.customer_name || ''}
                                            onChange={e => handleFormChange('customer_name', e.target.value)}
                                            placeholder="Enter customer name"
                                            className={`pl-9 pr-3 py-2 bg-stone-50 border rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium ${errors.customer_name ? 'border-red-300 bg-red-50/10' : 'border-stone-200'}`}
                                        />
                                    </div>
                                    {errors.customer_name && <p className="text-[9px] text-red-500 font-semibold mt-0.5">{errors.customer_name}</p>}
                                </div>

                                {/* Phone */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Phone Number *</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            value={form.phone_number || ''}
                                            onChange={e => handleFormChange('phone_number', e.target.value)}
                                            placeholder="Enter phone number"
                                            className={`pl-9 pr-3 py-2 bg-stone-50 border rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium ${errors.phone_number ? 'border-red-300 bg-red-50/10' : 'border-stone-200'}`}
                                        />
                                    </div>
                                    {errors.phone_number && <p className="text-[9px] text-red-500 font-semibold mt-0.5">{errors.phone_number}</p>}
                                </div>

                                {/* Email */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Email Address</label>
                                    <div className="relative">
                                        <Mail className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="email"
                                            value={form.email || ''}
                                            onChange={e => handleFormChange('email', e.target.value)}
                                            placeholder="Enter email address"
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Villages */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Village / Address</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="text"
                                            value={form.villages || ''}
                                            onChange={e => handleFormChange('villages', e.target.value)}
                                            placeholder="Enter village or address"
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Capacity */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">System Capacity (kWp) *</label>
                                    <div className="relative">
                                        <Zap className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={form.system_capacity_kwp || ''}
                                            onChange={e => handleFormChange('system_capacity_kwp', e.target.value)}
                                            placeholder="Enter capacity (e.g. 5)"
                                            className={`pl-9 pr-3 py-2 bg-stone-50 border rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium ${errors.system_capacity_kwp ? 'border-red-300 bg-red-50/10' : 'border-stone-200'}`}
                                        />
                                    </div>
                                    {errors.system_capacity_kwp && <p className="text-[9px] text-red-500 font-semibold mt-0.5">{errors.system_capacity_kwp}</p>}
                                </div>

                                {/* Brand */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Module Brand</label>
                                    <div className="relative">
                                        <Tag className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <select
                                            value={form.module_brand || ''}
                                            onChange={e => handleFormChange('module_brand', e.target.value)}
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-stone-700"
                                        >
                                            <option value="">Select Brand...</option>
                                            {(meta['module_brand'] || []).map(b => (
                                                <option key={b} value={b}>{b}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Module Wp */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Module Wp</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            value={form.module_wp || ''}
                                            onChange={e => handleFormChange('module_wp', e.target.value)}
                                            placeholder="Enter Wp (e.g. 540)"
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Consumer No */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">Consumer Number</label>
                                    <div className="relative">
                                        <Hash className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            value={form.consumer_no || ''}
                                            onChange={e => handleFormChange('consumer_no', e.target.value)}
                                            placeholder="Enter consumer number"
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                        />
                                    </div>
                                </div>

                                {/* Folder No */}
                                <div>
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider mb-1">File Number</label>
                                    <div className="relative">
                                        <Folder className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                        <input
                                            type="number"
                                            value={form.folder_no || ''}
                                            onChange={e => handleFormChange('folder_no', e.target.value)}
                                            placeholder="Enter file/folder number"
                                            className="pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {errors.submit && (
                                <div className="p-3 bg-red-50 border border-red-100 text-red-500 rounded-xl text-[10px] font-bold flex items-start gap-1.5 mt-2 animate-in fade-in duration-200">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{errors.submit}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSubmitLead}
                                disabled={saving}
                                className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50 mt-4 transition-all active:scale-[0.98]"
                            >
                                {saving ? (
                                    <><Loader2 className="w-4 h-4 animate-spin" /> Submitting Lead...</>
                                ) : (
                                    <>Submit Lead <ChevronRight className="w-4.5 h-4.5" /></>
                                )}
                            </button>
                        </div>
                    )}
                </main>
            )}

            {/* My Customers / Directory View */}
            {view === 'my_customers' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full animate-in slide-in-from-right duration-300">
                    <button
                        onClick={() => { setView('menu'); setSelectedCust(null); }}
                        className="mb-4 flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 font-bold"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                    </button>

                    <div className="space-y-4">
                        {/* Search and Header */}
                        <div>
                            <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">My Customers</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Directory of leads registered under {user.name}.</p>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, or consumer #..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                            />
                        </div>

                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
                            </div>
                        ) : filteredCustomers.length === 0 ? (
                            <div className="bg-white border border-stone-100 p-8 rounded-[24px] text-center text-stone-400">
                                <Users className="w-10 h-10 mx-auto mb-2 text-stone-200" />
                                <p className="text-xs font-semibold">No customers found</p>
                                <p className="text-[10px] text-stone-400 mt-0.5">Try searching for a different name or add a new lead.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {PRIMARY_STAGES.map(stage => {
                                    const stageCustomers = getCustomersByStage(stage.id);
                                    if (stageCustomers.length === 0 && !searchQuery.trim()) return null; // hide empty stages if no active search
                                    const expanded = !!expandedStages[stage.id];

                                    return (
                                        <div key={stage.id} className="bg-white border border-stone-100 rounded-[20px] shadow-sm overflow-hidden">
                                            {/* Stage Accordion Header */}
                                            <button
                                                onClick={() => toggleStage(stage.id)}
                                                className="w-full px-4 py-3 flex items-center justify-between bg-stone-50/50 hover:bg-stone-50 border-b border-stone-100 text-left transition-colors"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-6 rounded-full bg-amber-500" />
                                                    <div>
                                                        <h3 className="text-xs font-bold text-stone-850 uppercase tracking-wide">{stage.label}</h3>
                                                        <p className="text-[8px] text-stone-400 font-bold uppercase tracking-widest mt-0.5">
                                                            {stageCustomers.length} Customer{stageCustomers.length === 1 ? '' : 's'}
                                                        </p>
                                                    </div>
                                                </div>
                                                {expanded ? <ChevronUp className="w-4 h-4 text-stone-400" /> : <ChevronDown className="w-4 h-4 text-stone-400" />}
                                            </button>

                                            {/* Stage Accordion Content */}
                                            {expanded && (
                                                <div className="p-3 space-y-2.5 divide-y divide-stone-50">
                                                    {stageCustomers.length === 0 ? (
                                                        <p className="text-[10px] text-stone-400 italic py-2 text-center">No leads in this stage match search criteria.</p>
                                                    ) : (
                                                        stageCustomers.map((cust, idx) => (
                                                            <div
                                                                key={cust.id}
                                                                className={`pt-2.5 first:pt-0 flex flex-col gap-2`}
                                                            >
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <div>
                                                                        <h4 className="text-xs font-bold text-stone-900">{cust.customer_name}</h4>
                                                                        <p className="text-[10px] text-stone-500 font-medium mt-0.5">{cust.phone_number} · {cust.system_capacity_kwp} kWp</p>
                                                                    </div>
                                                                    <button
                                                                        onClick={() => setSelectedCust(cust)}
                                                                        className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 text-[9px] font-bold rounded-lg transition-all"
                                                                    >
                                                                        Details
                                                                    </button>
                                                                </div>

                                                                {/* Status / Tracking Tags */}
                                                                <div className="flex flex-wrap gap-1">
                                                                    {/* Meter status */}
                                                                    {cust.stage === 'METER INSTALLATION' && (
                                                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-0.5">
                                                                            <Hash className="w-2 h-2" /> Meter: {cust.meter_installation ? 'Complete' : 'Pending'}
                                                                        </span>
                                                                    )}
                                                                    {/* Subsidy Tag */}
                                                                    {cust.subsidy_tag && (
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                            Subsidy: {cust.subsidy_tag}
                                                                        </span>
                                                                    )}
                                                                    {/* Loan status */}
                                                                    {cust.payment_type === 'LOAN' ? (
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                                                                            Loan: {cust.loan_tag || 'Pending'}
                                                                        </span>
                                                                    ) : cust.payment_type === 'CASH' ? (
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-100">
                                                                            Cash Payment
                                                                        </span>
                                                                    ) : null}
                                                                    {/* Installation Tag */}
                                                                    {cust.installation_status && (
                                                                        <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100">
                                                                            Install: {cust.installation_status}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            )}

            {/* Read-Only Details Dialog Card */}
            {selectedCust && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                        {/* Detail Header */}
                        <div className="p-5 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                            <div>
                                <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest">Customer Profile</p>
                                <h3 className="text-sm font-black text-stone-900 uppercase mt-0.5">{selectedCust.customer_name}</h3>
                            </div>
                            <button
                                onClick={() => setSelectedCust(null)}
                                className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors font-bold text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Tags overview */}
                            <div className="flex flex-wrap gap-1.5">
                                <span className="text-[8px] font-black tracking-widest uppercase px-2 py-0.5 bg-stone-900 text-white rounded">
                                    Stage: {PRIMARY_STAGES.find(s => s.id === selectedCust.stage)?.label || selectedCust.stage}
                                </span>
                                {selectedCust.payment_type && (
                                    <span className="text-[8px] font-black tracking-widest uppercase px-2 py-0.5 bg-amber-500 text-white rounded">
                                        PAYMENT: {selectedCust.payment_type}
                                    </span>
                                )}
                            </div>

                            {/* Section: Profile Info */}
                            <div className="bg-stone-50 p-4 rounded-2xl space-y-2 border border-stone-100">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-1 flex items-center gap-1.5"><User size={10} /> Profile Details</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Phone Number</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.phone_number || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Email Address</p>
                                        <p className="font-semibold text-stone-800 mt-0.5 truncate">{selectedCust.email || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Village / Address</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.villages || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">File / Folder No</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.folder_no || '–'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Capacity / Solar Brand */}
                            <div className="bg-stone-50 p-4 rounded-2xl space-y-2 border border-stone-100">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-1 flex items-center gap-1.5"><Zap size={10} /> Solar System</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">System Capacity (kWp)</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.system_capacity_kwp || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Module Brand</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.module_brand || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Module Wp</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.module_wp || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Consumer Number</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.consumer_no || '–'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Tracking Tags */}
                            <div className="bg-stone-50 p-4 rounded-2xl space-y-2 border border-stone-100">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-1 flex items-center gap-1.5"><ClipboardList size={10} /> Pipeline Tracking</h4>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Subsidy Tag</p>
                                        <p className="font-semibold text-stone-850 mt-0.5">{selectedCust.subsidy_tag || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Loan Status Tag</p>
                                        <p className="font-semibold text-stone-850 mt-0.5">{selectedCust.loan_tag || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Installation Tag</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.installation_status || '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-[8px] font-bold text-stone-400 uppercase">Meter Installation</p>
                                        <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.meter_installation ? 'Complete' : 'Pending'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
