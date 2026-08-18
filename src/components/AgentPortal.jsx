import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Users, CreditCard, Hash, Folder, Tag, ChevronLeft, Plus, Search, 
    ChevronDown, ChevronUp, ClipboardList, Banknote, ShieldAlert, Paperclip, Eye, Download, X
} from 'lucide-react';
import { logActivity } from '../utils';
import { DEFAULT_LEAD_FORM } from '../models';
import { PRIMARY_STAGES } from '../constants';
import AddLeadModal from './AddLeadModal';
import { FilePreviewModal } from './modal-tabs/shared';
import { uploadDocument, getCustomerDocuments, getDownloadUrl, getViewUrl } from '../utils';

export default function AgentPortal({ user, onLogout }) {
    const [view, setView] = useState('menu'); // 'menu', 'my_customers'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddLead, setShowAddLead] = useState(false);
    
    // Customer search & accordion states — only LEADS expanded by default
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStages, setExpandedStages] = useState({
        'LEADS': true
    });
    
    // Customer details view (read-only)
    const [selectedCust, setSelectedCust] = useState(null);
    const [custDocs, setCustDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);

    // Metadata
    const [meta, setMeta] = useState({});

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

    // Load documents when a customer profile is opened
    useEffect(() => {
        if (selectedCust?.id) {
            setLoadingDocs(true);
            getCustomerDocuments(selectedCust.id)
                .then(docs => setCustDocs(docs || []))
                .finally(() => setLoadingDocs(false));
        } else {
            setCustDocs([]);
        }
    }, [selectedCust?.id]);

    // Submit new lead from AddLeadModal
    const handleSubmitLead = async (formData, attachedFiles = []) => {
        const leadData = {
            ...formData,
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

        if (error) {
            console.error('Submit error:', error);
            throw error;
        }

        // Upload attached files to storage & documents table
        if (attachedFiles && attachedFiles.length > 0) {
            for (const item of attachedFiles) {
                if (item.file) {
                    try {
                        await uploadDocument(item.file, newCustomer.id, item.doc_type);
                    } catch (uploadErr) {
                        console.error('Failed to upload file for lead:', uploadErr);
                    }
                }
            }
        }

        await logActivity(
            user.id,
            'create',
            `Added new lead: ${formData.customer_name}`,
            `Done by Agent: ${user.name}`,
            newCustomer.id
        );

        setShowAddLead(false);
        fetchCustomers(); // Refresh list
        return newCustomer;
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

    const handlePreviewFile = async (doc) => {
        const url = await getViewUrl(doc.storage_path);
        if (url) setPreviewDoc({ doc, url });
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

    return (
        <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
            {/* Top Bar */}
            <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10">
                        <Sun className="w-4 h-4 fill-white" />
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
                            <Sun className="w-40 h-40" />
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
                            onClick={() => setShowAddLead(true)}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white p-5 rounded-[24px] shadow-md shadow-amber-500/10 flex items-center justify-between transition-all active:scale-[0.98]"
                        >
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                                    <Plus className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Add New Customer</h3>
                                    <p className="text-[10px] text-amber-100 font-medium mt-0.5">Register a lead in CRM pipeline with documents</p>
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
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">My Customers</h2>
                                <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Directory of leads registered under {user.name}.</p>
                            </div>
                            <button
                                onClick={() => setShowAddLead(true)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition"
                            >
                                <Plus size={14} /> Add Lead
                            </button>
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
                                                <div className="p-3 space-y-3 divide-y divide-stone-100">
                                                    {stageCustomers.length === 0 ? (
                                                        <p className="text-[10px] text-stone-400 italic py-2 text-center">No leads in this stage match search criteria.</p>
                                                    ) : (
                                                        stageCustomers.map((cust) => (
                                                            <div
                                                                key={cust.id}
                                                                className="pt-3 first:pt-0 space-y-2"
                                                            >
                                                                {/* Line 1: Name and Details Button */}
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <h4 className="text-xs font-black text-stone-900 leading-snug">{cust.customer_name}</h4>
                                                                    <button
                                                                        onClick={() => setSelectedCust(cust)}
                                                                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[10px] font-bold rounded-lg transition-all flex-shrink-0"
                                                                    >
                                                                        Details
                                                                    </button>
                                                                </div>

                                                                {/* Line 2: Phone & Capacity */}
                                                                <div className="flex items-center gap-2 text-[11px] text-stone-600 font-medium">
                                                                    <span className="flex items-center gap-1">
                                                                        <Phone size={11} className="text-stone-400" /> {cust.phone_number || '–'}
                                                                    </span>
                                                                    <span className="text-stone-300">•</span>
                                                                    <span className="font-bold text-amber-600 flex items-center gap-0.5">
                                                                        <Zap size={11} /> {cust.system_capacity_kwp ? `${cust.system_capacity_kwp} kWp` : '–'}
                                                                    </span>
                                                                </div>

                                                                {/* Line 3: Village / Address (if exists) */}
                                                                {cust.villages && (
                                                                    <div className="flex items-start gap-1 text-[10px] text-stone-500 font-medium">
                                                                        <MapPin size={10} className="text-stone-400 mt-0.5 flex-shrink-0" />
                                                                        <span className="break-words">{cust.villages}</span>
                                                                    </div>
                                                                )}

                                                                {/* Line 4: Status / Tracking Tags */}
                                                                <div className="flex flex-wrap gap-1 pt-0.5">
                                                                    {/* Meter status */}
                                                                    {cust.stage === 'METER INSTALLATION' && (
                                                                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-stone-900 text-white flex items-center gap-0.5">
                                                                            <Hash className="w-2 h-2" /> Meter: {cust.meter_installation?.status === 'Yes' ? 'Complete' : 'Pending'}
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

            {/* Unified Add Lead Modal */}
            {showAddLead && (
                <AddLeadModal
                    isOpen={showAddLead}
                    onClose={() => setShowAddLead(false)}
                    onSave={handleSubmitLead}
                    meta={meta}
                    channel_partners={[]}
                    user={user}
                />
            )}

            {/* Read-Only Customer Profile Modal (Optimized Line-by-Line for Mobile) */}
            {selectedCust && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                        {/* Detail Header */}
                        <div className="px-5 py-4 border-b border-stone-100 bg-stone-50/50 flex justify-between items-center">
                            <div>
                                <p className="text-[8px] font-black uppercase text-amber-600 tracking-widest">Customer Profile (Read-Only)</p>
                                <h3 className="text-sm font-black text-stone-900 uppercase mt-0.5">{selectedCust.customer_name}</h3>
                            </div>
                            <button
                                onClick={() => setSelectedCust(null)}
                                className="w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors font-bold text-xs"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        {/* Detail Body (Pure Line-by-Line Flow) */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

                            {/* Section: Profile Info (Line-by-Line) */}
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/60">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                    <User size={10} /> Profile Details
                                </h4>
                                <div className="divide-y divide-stone-200/50 text-xs">
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span>
                                    </div>
                                    <div className="flex items-start justify-between py-2 gap-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide flex-shrink-0">Email</span>
                                        <span className="font-semibold text-stone-900 break-all text-right">{selectedCust.email_address || selectedCust.email || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer Number</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span>
                                    </div>
                                    <div className="flex items-start justify-between py-2 gap-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide flex-shrink-0">Village / Address</span>
                                        <span className="font-semibold text-stone-900 text-right break-words">{selectedCust.villages || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Folder No</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.folder_no || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Channel Partner</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.sub_channel_partner || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Division</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.sub_divisions || '–'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Capacity / Solar Brand (Line-by-Line) */}
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/60">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                    <Zap size={10} /> Solar System
                                </h4>
                                <div className="divide-y divide-stone-200/50 text-xs">
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module Brand</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.module_brand || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module Wp</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.module_wp ? `${selectedCust.module_wp} Wp` : '–'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Pipeline Tracking (Line-by-Line) */}
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/60">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                    <ClipboardList size={10} /> Pipeline Tracking
                                </h4>
                                <div className="divide-y divide-stone-200/50 text-xs">
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Tag</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.subsidy_tag || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Loan Status Tag</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.loan_tag || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Tag</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.installation_status || '–'}</span>
                                    </div>
                                    <div className="flex items-center justify-between py-2">
                                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Meter Installation</span>
                                        <span className="font-semibold text-stone-900">{selectedCust.meter_installation?.status === 'Yes' ? 'Complete' : 'Pending'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Document Checklist (Line-by-Line) */}
                            {selectedCust.payment_type && (
                                <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/60">
                                    <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <ClipboardList size={10} /> Document Checklist ({selectedCust.payment_type})
                                    </h4>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        {selectedCust.payment_type.trim().toLowerCase() !== 'cash' && (
                                            <>
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="font-semibold text-stone-800">Aadhaar Card</span>
                                                    <span className={selectedCust.adhaar_card ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                        {selectedCust.adhaar_card ? '✓ Verified' : '✗ Missing'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="font-semibold text-stone-800">PAN Card</span>
                                                    <span className={selectedCust.pan_card ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                        {selectedCust.pan_card ? '✓ Verified' : '✗ Missing'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="font-semibold text-stone-800">Index 2</span>
                                                    <span className={selectedCust.index_2 ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                        {selectedCust.index_2 ? '✓ Verified' : '✗ Missing'}
                                                    </span>
                                                </div>
                                            </>
                                        )}
                                        <div className="flex items-center justify-between py-2">
                                            <span className="font-semibold text-stone-800">Light Bill</span>
                                            <span className={selectedCust.light_bill ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                {selectedCust.light_bill ? '✓ Verified' : '✗ Missing'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="font-semibold text-stone-800">Bank Details</span>
                                            <span className={selectedCust.bank_details ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                {selectedCust.bank_details ? '✓ Verified' : '✗ Missing'}
                                            </span>
                                        </div>
                                        {selectedCust.payment_type.trim().toLowerCase() !== 'cash' && (
                                            <div className="flex items-center justify-between py-2">
                                                <span className="font-semibold text-stone-800">Bank Passbook</span>
                                                <span className={selectedCust.bank_passbook ? 'px-2 py-0.5 bg-emerald-100 text-emerald-700 font-bold rounded text-[10px]' : 'px-2 py-0.5 bg-stone-100 text-stone-400 font-bold rounded text-[10px]'}>
                                                    {selectedCust.bank_passbook ? '✓ Verified' : '✗ Missing'}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Section: Uploaded Customer Documents (Line-by-Line) */}
                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/60">
                                <h4 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-2 flex items-center gap-1.5">
                                    <Paperclip size={10} /> Attached Documents ({custDocs.length})
                                </h4>
                                {loadingDocs ? (
                                    <div className="py-3 flex justify-center">
                                        <Loader2 size={16} className="text-amber-500 animate-spin" />
                                    </div>
                                ) : custDocs.length === 0 ? (
                                    <p className="text-[10px] text-stone-400 italic py-1">No uploaded documents found for this customer.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {custDocs.map(doc => (
                                            <div key={doc.id} className="flex items-center justify-between bg-white border border-stone-200/80 rounded-xl px-3 py-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                                    <Paperclip size={12} className="text-stone-400 flex-shrink-0" />
                                                    <span className="text-[11px] font-semibold text-stone-800 truncate">{doc.file_name}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => handlePreviewFile(doc)}
                                                        className="text-[10px] font-bold text-amber-600 hover:text-amber-700 px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 transition-colors flex items-center gap-1"
                                                    >
                                                        <Eye size={11} /> View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDownloadDoc(doc)}
                                                        className="text-[10px] font-bold text-stone-700 hover:text-stone-900 px-2 py-1 rounded-lg bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-1"
                                                    >
                                                        <Download size={11} /> Download
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <FilePreviewModal
                    file={previewDoc.doc}
                    fileUrl={previewDoc.url}
                    onClose={() => setPreviewDoc(null)}
                    onDownload={() => handleDownloadDoc(previewDoc.doc)}
                />
            )}
        </div>
    );
}


