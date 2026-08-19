import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Users, CreditCard, Hash, Folder, Tag, ChevronLeft, Plus, Search, 
    ChevronDown, ChevronUp, ClipboardList, Banknote, ShieldAlert, Paperclip, Eye, Download, X,
    ShoppingBag, Ruler, IndianRupee, Layers, Save, ClipboardCheck, Upload,
    Package, PauseCircle, Truck, Wrench, Camera, Send
} from 'lucide-react';
import { logActivity, toIndianCommas, parseIndianNumber, uploadDocument, getCustomerDocuments, getDownloadUrl, getViewUrl, deleteDocument } from '../utils';
import { DEFAULT_LEAD_FORM } from '../models';
import { PRIMARY_STAGES } from '../constants';
import AddLeadModal from './AddLeadModal';
import { FilePreviewModal, CheckboxRemarkItem } from './modal-tabs/shared';
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

export default function AgentPortal({ user, onLogout }) {
    const [view, setView] = useState('menu'); // 'menu', 'my_customers', 'workdesk'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddLead, setShowAddLead] = useState(false);
    
    // Customer search & accordion states — only LEADS expanded by default
    const [searchQuery, setSearchQuery] = useState('');
    const [expandedStages, setExpandedStages] = useState({
        'LEADS': true
    });
    
    // Customer details view
    const [selectedCust, setSelectedCust] = useState(null);
    const [editData, setEditData] = useState({});
    const [saving, setSaving] = useState(false);
    const [custDocs, setCustDocs] = useState([]);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [activeDealerTab, setActiveDealerTab] = useState('ORDER'); // 'ORDER', 'METER', 'INSPECTION', 'PROFILE'
    const [editingSection, setEditingSection] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [uploadDocType, setUploadDocType] = useState('adhaar_card_front');
    const fileInputRef = useRef(null);

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
    };

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

    // Load documents and sync customer data when a customer profile is opened
    useEffect(() => {
        if (selectedCust?.id) {
            setLoadingDocs(true);
            getCustomerDocuments(selectedCust.id)
                .then(docs => setCustDocs(docs || []))
                .finally(() => setLoadingDocs(false));

            setEditData({ ...selectedCust });

            if (selectedCust.stage === 'MATERIAL ORDER') {
                setActiveDealerTab('ORDER');
            } else if (selectedCust.stage === 'METER INSTALLATION') {
                setActiveDealerTab('METER');
            } else if (selectedCust.stage === 'DISCOM INSPECTION') {
                setActiveDealerTab('INSPECTION');
            } else {
                setActiveDealerTab('LEAD_INFO');
            }
        } else {
            setCustDocs([]);
            setEditData({});
        }
    }, [selectedCust?.id]);

    const handleUpdateCustomer = async (id, updates) => {
        setSaving(true);
        try {
            const { error } = await supabase
                .from('admin')
                .update(updates)
                .eq('id', id);

            if (error) throw error;

            setSelectedCust(prev => ({ ...prev, ...updates }));
            setEditData(prev => ({ ...prev, ...updates }));
            fetchCustomers();
        } catch (err) {
            console.error('Update failed:', err);
            alert('Failed to update: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

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

    const handleUploadDocForCustomer = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCust?.id) return;
        setUploadingDoc(true);
        try {
            await uploadDocument(file, selectedCust.id, uploadDocType);
            const updatedDocs = await getCustomerDocuments(selectedCust.id);
            setCustDocs(updatedDocs || []);
            alert('Document uploaded successfully!');
        } catch (err) {
            console.error('Upload failed:', err);
            alert('Upload failed: ' + err.message);
        } finally {
            setUploadingDoc(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDoc = async (doc) => {
        if (!window.confirm(`Delete ${doc.file_name}?`)) return;
        try {
            await deleteDocument(doc.id, doc.storage_path);
            const updatedDocs = await getCustomerDocuments(selectedCust.id);
            setCustDocs(updatedDocs || []);
        } catch (err) {
            console.error('Delete failed:', err);
            alert('Delete failed: ' + err.message);
        }
    };

    const [activeWorkdeskTab, setActiveWorkdeskTab] = useState('MATERIAL_ORDER'); // 'MATERIAL_ORDER', 'METER_INSTALLATION', 'DISCOM_INSPECTION'

    const handleSelectCustomerForStage = (cust, stageTab) => {
        setSelectedCust(cust);
        if (stageTab === 'MATERIAL_ORDER') {
            setActiveDealerTab('ORDER');
        } else if (stageTab === 'METER_INSTALLATION') {
            setActiveDealerTab('METER');
        } else if (stageTab === 'DISCOM_INSPECTION') {
            setActiveDealerTab('INSPECTION');
        }
    };

    // Filter customers for workdesk
    const getWorkdeskCustomers = (stageTab) => {
        const stageMap = {
            'MATERIAL_ORDER': 'MATERIAL ORDER',
            'METER_INSTALLATION': 'METER INSTALLATION',
            'DISCOM_INSPECTION': 'DISCOM INSPECTION'
        };
        const targetStage = stageMap[stageTab];
        return filteredCustomers.filter(c => c.stage === targetStage);
    };

    const materialOrderCount = customers.filter(c => c.stage === 'MATERIAL ORDER').length;
    const meterPendingCount = customers.filter(c => c.stage === 'METER INSTALLATION').length;
    const inspPendingCount = customers.filter(c => c.stage === 'DISCOM INSPECTION').length;

    const renderStatusBadge = (val, defaultVal = 'Pending') => {
        const status = val || defaultVal;
        const sLower = String(status).toLowerCase();
        const isYesOrDone = ['yes', 'completed', 'sanctioned', 'approved', 'received', 'redeemed', 'delivered', 'integrated', 'submitted'].includes(sLower);
        const isNoOrRejected = ['no', 'rejected', 'returned'].includes(sLower);

        let colorClasses = 'bg-amber-50 text-amber-800 border-amber-200';
        if (isYesOrDone) {
            colorClasses = 'bg-emerald-50 text-emerald-800 border-emerald-200';
        } else if (isNoOrRejected) {
            colorClasses = 'bg-rose-50 text-rose-800 border-rose-200';
        }

        return (
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${colorClasses}`}>
                {status}
            </span>
        );
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
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest -mt-0.5">Channel Partner Portal</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-stone-600 truncate max-w-[120px]">{user.name}</span>
                    <button
                        onClick={onLogout}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-xl hover:bg-stone-50 cursor-pointer"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Menu View (Clean Action Cards) */}
            {view === 'menu' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in fade-in duration-300">
                    {/* Welcome Banner - Warm Amber */}
                    <div className="bg-gradient-to-br from-amber-500 via-amber-500 to-amber-600 text-white p-5 rounded-[28px] shadow-lg shadow-amber-500/15 relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                            <Sun className="w-40 h-40" />
                        </div>
                        <p className="text-[10px] uppercase tracking-widest text-amber-100 font-bold">Welcome Back</p>
                        <h2 className="text-xl font-bold mt-0.5">{user.name}</h2>
                        <p className="text-xs text-amber-50/90 mt-1 font-medium">Manage leads, track CRM stages, and configure assigned installations.</p>
                    </div>

                    {/* Action Cards */}
                    <div className="space-y-3">
                        {/* ── Add New Customer ── */}
                        <button
                            onClick={() => setShowAddLead(true)}
                            className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white p-4.5 rounded-[24px] shadow-md shadow-amber-500/15 flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-11 h-11 bg-white/20 rounded-2xl flex items-center justify-center">
                                    <Plus className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm">Add New Customer</h3>
                                    <p className="text-[11px] text-amber-100 font-medium mt-0.5">Register a new lead into CRM with details & documents</p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-amber-100 flex-shrink-0" />
                        </button>

                        {/* ── Track Leads (All Stages Directory) ── */}
                        <button
                            onClick={() => setView('my_customers')}
                            className="w-full bg-white hover:bg-stone-50/80 text-stone-850 border border-stone-200/80 p-4.5 rounded-[24px] shadow-xs flex items-center justify-between transition-all active:scale-[0.98] cursor-pointer"
                        >
                            <div className="flex items-center gap-3.5 text-left">
                                <div className="w-11 h-11 bg-stone-100 rounded-2xl flex items-center justify-center text-stone-700">
                                    <Users className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-stone-900">Track Leads</h3>
                                    <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                                        View all {customers.length} lead{customers.length === 1 ? '' : 's'} across pipeline stages with full details
                                    </p>
                                </div>
                            </div>
                            <ChevronRight className="w-5 h-5 text-stone-400 flex-shrink-0" />
                        </button>

                        {/* ── Stage Operations Workdesk ── */}
                        <div className="bg-white border border-stone-200/90 rounded-[28px] p-5 shadow-xs space-y-3.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                                        <Layers size={16} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm text-stone-900">Stage Operations</h3>
                                        <p className="text-[10px] text-stone-400 font-medium">Quick stage desk for assigned dealer tasks</p>
                                    </div>
                                </div>
                                <span className="text-[10px] text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60">
                                    {materialOrderCount + meterPendingCount + inspPendingCount} Actionable
                                </span>
                            </div>

                            {/* 3 Clickable Stage Cards with Gentle Colors */}
                            <div className="grid grid-cols-3 gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveWorkdeskTab('MATERIAL_ORDER');
                                        setView('workdesk');
                                    }}
                                    className="bg-amber-50/60 hover:bg-amber-100/70 border border-amber-200/70 p-3.5 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.97]"
                                >
                                    <ShoppingBag size={18} className="text-amber-600" />
                                    <span className="text-[10px] font-bold text-amber-950">Material Order</span>
                                    <span className="text-[10px] font-black text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded-md">
                                        {materialOrderCount}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveWorkdeskTab('METER_INSTALLATION');
                                        setView('workdesk');
                                    }}
                                    className="bg-blue-50/60 hover:bg-blue-100/70 border border-blue-200/70 p-3.5 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.97]"
                                >
                                    <Zap size={18} className="text-blue-600" />
                                    <span className="text-[10px] font-bold text-blue-950">Meter Inst.</span>
                                    <span className="text-[10px] font-black text-blue-800 bg-blue-200/60 px-2 py-0.5 rounded-md">
                                        {meterPendingCount}
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setActiveWorkdeskTab('DISCOM_INSPECTION');
                                        setView('workdesk');
                                    }}
                                    className="bg-emerald-50/60 hover:bg-emerald-100/70 border border-emerald-200/70 p-3.5 rounded-2xl text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.97]"
                                >
                                    <ClipboardCheck size={18} className="text-emerald-600" />
                                    <span className="text-[10px] font-bold text-emerald-950">Inspection</span>
                                    <span className="text-[10px] font-black text-emerald-800 bg-emerald-200/60 px-2 py-0.5 rounded-md">
                                        {inspPendingCount}
                                    </span>
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            )}

            {/* Stage Workdesk View (Vendor-style Top Filter Cards & Customer List) */}
            {view === 'workdesk' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full animate-in slide-in-from-right duration-300 space-y-4">
                    <button
                        onClick={() => setView('menu')}
                        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 font-bold cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                    </button>

                    <div>
                        <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">Stage Operations Workdesk</h2>
                        <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Filter and edit assigned leads across the 3 operational stages.</p>
                    </div>

                    {/* Top Stage Filter Cards (Gentle Pastel Style) */}
                    <div className="grid grid-cols-3 gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveWorkdeskTab('MATERIAL_ORDER')}
                            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                activeWorkdeskTab === 'MATERIAL_ORDER'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <ShoppingBag size={16} />
                            <span className="text-[10px] font-bold">Material Order</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'MATERIAL_ORDER' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {materialOrderCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveWorkdeskTab('METER_INSTALLATION')}
                            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                activeWorkdeskTab === 'METER_INSTALLATION'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <Zap size={16} />
                            <span className="text-[10px] font-bold">Meter Inst.</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'METER_INSTALLATION' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700'
                            }`}>
                                {meterPendingCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveWorkdeskTab('DISCOM_INSPECTION')}
                            className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                                activeWorkdeskTab === 'DISCOM_INSPECTION'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <ClipboardCheck size={16} />
                            <span className="text-[10px] font-bold">Inspection</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'DISCOM_INSPECTION' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                            }`}>
                                {inspPendingCount}
                            </span>
                        </button>
                    </div>

                    {/* Search in Workdesk */}
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search by name, phone, consumer no..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-2.5 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer"
                                title="Clear search"
                            >
                                <X size={13} />
                            </button>
                        )}
                    </div>

                    {/* Customer Cards for Selected Stage */}
                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="w-7 h-7 text-amber-500 animate-spin" />
                        </div>
                    ) : getWorkdeskCustomers(activeWorkdeskTab).length === 0 ? (
                        <div className="bg-white border border-stone-150 p-8 rounded-2xl text-center text-stone-400">
                            <Users className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                            <p className="text-xs font-bold text-stone-600">No leads in this stage matching your search.</p>
                            <p className="text-[10px] text-stone-400 mt-1">Leads assigned to you in this stage will appear here.</p>
                        </div>
                    ) : (
                        <div className="space-y-2.5">
                            {getWorkdeskCustomers(activeWorkdeskTab).map((cust) => (
                                <div
                                    key={cust.id}
                                    onClick={() => handleSelectCustomerForStage(cust, activeWorkdeskTab)}
                                    className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-xs hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] space-y-2.5"
                                >
                                    <div className="flex justify-between items-start gap-2">
                                        <div>
                                            <h4 className="text-xs font-black text-stone-900 group-hover:text-amber-600 transition-colors">
                                                {cust.customer_name}
                                            </h4>
                                            <div className="flex items-center gap-2 text-[11px] text-stone-500 mt-1">
                                                <span className="flex items-center gap-1 font-semibold">
                                                    <Phone size={10} className="text-stone-400" /> {cust.phone_number || '–'}
                                                </span>
                                                {cust.consumer_no && (
                                                    <>
                                                        <span className="text-stone-300">•</span>
                                                        <span className="text-[10px] font-bold text-stone-600">
                                                            #{cust.consumer_no}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            className="px-2.5 py-1 bg-amber-50 group-hover:bg-amber-500 group-hover:text-white text-amber-700 text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                                        >
                                            Edit <ChevronRight size={12} />
                                        </button>
                                    </div>

                                    {/* Capacity and stage info */}
                                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-stone-100 text-stone-500">
                                        <span className="font-bold text-stone-800 flex items-center gap-1">
                                            <Zap size={11} className="text-amber-500" />
                                            {cust.system_capacity_kwp ? `${cust.system_capacity_kwp} kWp` : '–'}
                                        </span>
                                        {activeWorkdeskTab === 'MATERIAL_ORDER' && (
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">
                                                {cust.roof_shed ? `Configured: ${cust.roof_shed}` : 'Pending specs'}
                                            </span>
                                        )}
                                        {activeWorkdeskTab === 'METER_INSTALLATION' && (
                                            <span className={`font-bold px-2 py-0.5 rounded ${
                                                cust.meter_installation === 'Yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                                            }`}>
                                                {cust.meter_installation === 'Yes' ? 'Meter Done' : 'Meter Pending'}
                                            </span>
                                        )}
                                        {activeWorkdeskTab === 'DISCOM_INSPECTION' && (
                                            <span className={`font-bold px-2 py-0.5 rounded ${
                                                cust.discom_inspection === 'Yes' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'
                                            }`}>
                                                {cust.discom_inspection === 'Yes' ? 'Inspection Done' : 'Report Pending'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </main>
            )}

            {/* Track Leads / All My Customers View (Rich Cards with All Info) */}
            {view === 'my_customers' && (
                <main className="flex-1 p-4 max-w-md mx-auto w-full animate-in slide-in-from-right duration-300 space-y-4">
                    <button
                        onClick={() => { setView('menu'); setSelectedCust(null); }}
                        className="flex items-center gap-1 text-xs text-stone-500 hover:text-stone-700 font-bold cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" /> Back to Dashboard
                    </button>

                    <div className="space-y-4">
                        {/* Search and Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">Track All Leads</h2>
                                <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Directory of all leads registered under {user.name}.</p>
                            </div>
                            <button
                                onClick={() => setShowAddLead(true)}
                                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer"
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
                                    const isExpanded = !!expandedStages[stage.id];
                                    const StageIcon = stage.icon || Users;

                                    return (
                                        <div key={stage.id} className="bg-white border border-stone-150 rounded-[20px] shadow-2xs overflow-hidden">
                                            {/* Stage Accordion Header */}
                                            <button
                                                onClick={() => toggleStage(stage.id)}
                                                className="w-full px-4 py-3.5 flex items-center justify-between hover:bg-stone-50/50 transition-colors text-left cursor-pointer"
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                                                        stageCustomers.length > 0 ? 'bg-amber-50 text-amber-600' : 'bg-stone-100 text-stone-400'
                                                    }`}>
                                                        <StageIcon size={14} />
                                                    </div>
                                                    <div>
                                                        <span className="text-xs font-black text-stone-850 uppercase tracking-wide">
                                                            {stage.label}
                                                        </span>
                                                        <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-600">
                                                            {stageCustomers.length}
                                                        </span>
                                                    </div>
                                                </div>
                                                {isExpanded ? (
                                                    <ChevronUp size={16} className="text-stone-400" />
                                                ) : (
                                                    <ChevronDown size={16} className="text-stone-400" />
                                                )}
                                            </button>

                                            {/* Stage Content - Rich Client Info Cards */}
                                            {isExpanded && (
                                                <div className="px-3 pb-3 pt-1 space-y-2.5">
                                                    {stageCustomers.length === 0 ? (
                                                        <p className="text-[11px] text-stone-400 font-medium py-3 italic text-center">
                                                            No customers in this stage.
                                                        </p>
                                                    ) : (
                                                        stageCustomers.map((cust) => (
                                                            <div
                                                                key={cust.id}
                                                                onClick={() => setSelectedCust(cust)}
                                                                className="p-3.5 bg-stone-50/70 hover:bg-amber-50/40 rounded-2xl border border-stone-200/70 transition-all cursor-pointer space-y-2 group"
                                                            >
                                                                {/* Line 1: Name and Details Button */}
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <h4 className="text-xs font-black text-stone-900 group-hover:text-amber-600 transition-colors leading-snug">
                                                                        {cust.customer_name}
                                                                    </h4>
                                                                    <span className="px-2.5 py-1 bg-white border border-stone-200 text-stone-700 text-[10px] font-bold rounded-lg shadow-2xs group-hover:border-amber-400 group-hover:text-amber-600 transition flex items-center gap-1 flex-shrink-0">
                                                                        Details <ChevronRight size={11} />
                                                                    </span>
                                                                </div>

                                                                {/* Line 2: Phone & Village/Address */}
                                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-600">
                                                                    <span className="flex items-center gap-1 font-medium">
                                                                        <Phone size={11} className="text-stone-400" /> {cust.phone_number || '–'}
                                                                    </span>
                                                                    {cust.villages && (
                                                                        <>
                                                                            <span className="text-stone-300">•</span>
                                                                            <span className="flex items-center gap-1 font-medium truncate max-w-[150px]">
                                                                                <MapPin size={11} className="text-stone-400" /> {cust.villages}
                                                                            </span>
                                                                        </>
                                                                    )}
                                                                </div>

                                                                {/* Line 3: Consumer #, Capacity, Module Brand, Payment */}
                                                                <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-stone-500 pt-0.5">
                                                                    {cust.consumer_no && (
                                                                        <span className="bg-stone-200/70 text-stone-700 font-bold px-1.5 py-0.5 rounded text-[9px]">
                                                                            #{cust.consumer_no}
                                                                        </span>
                                                                    )}
                                                                    {cust.system_capacity_kwp && (
                                                                        <span className="flex items-center gap-0.5 font-bold text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded text-[9px]">
                                                                            <Zap size={10} /> {cust.system_capacity_kwp} kWp
                                                                        </span>
                                                                    )}
                                                                    {cust.module_brand && (
                                                                        <span className="font-semibold text-stone-600 text-[9px] bg-stone-100 px-1.5 py-0.5 rounded">
                                                                            {cust.module_brand}
                                                                        </span>
                                                                    )}
                                                                    {cust.payment_type && (
                                                                        <span className="bg-stone-100 border border-stone-200 text-stone-600 font-bold px-1.5 py-0.5 rounded uppercase text-[9px]">
                                                                            {cust.payment_type}
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

            {/* Customer Details & Dealer Actions Modal */}
            {selectedCust && (
                <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="w-full sm:max-w-lg bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col animate-in slide-in-from-bottom-5 duration-300">
                        {/* Detail Header - Name, Phone Number & Consumer No on Top */}
                        <div className="px-5 py-4 border-b border-stone-150 bg-stone-50/90 flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-[8px] font-black uppercase text-amber-600 tracking-widest bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded">
                                        Channel Partner Workdesk
                                    </span>
                                    <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-amber-500 text-white tracking-wider">
                                        {PRIMARY_STAGES.find(s => s.id === selectedCust.stage)?.label || selectedCust.stage}
                                    </span>
                                </div>
                                <h3 className="text-base font-black text-stone-900 uppercase leading-tight pt-0.5">
                                    {selectedCust.customer_name}
                                </h3>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-stone-600 font-semibold pt-0.5">
                                    <span className="flex items-center gap-1">
                                        <Phone size={12} className="text-stone-400" /> {selectedCust.phone_number || '–'}
                                    </span>
                                    {selectedCust.consumer_no && (
                                        <>
                                            <span className="text-stone-300">•</span>
                                            <span className="bg-stone-200/70 text-stone-800 font-bold px-1.5 py-0.5 rounded text-[10px]">
                                                #{selectedCust.consumer_no}
                                            </span>
                                        </>
                                    )}
                                    {selectedCust.villages && (
                                        <>
                                            <span className="text-stone-300">•</span>
                                            <span className="flex items-center gap-1 text-stone-500 font-medium truncate max-w-[150px]">
                                                <MapPin size={11} className="text-stone-400" /> {selectedCust.villages}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedCust(null)}
                                className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors font-bold text-xs cursor-pointer flex-shrink-0 ml-3"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-4">
                            {/* ─── STAGE SECTION (Render active stage component in phone format) ─── */}
                            {selectedCust.stage === 'LEADS' && (
                                <div className="space-y-4">
                                    {/* Lead Information Card (Line by Line Non-Editable) */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <User size={11} /> Lead Information
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Customer Name</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.customer_name || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email Address</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.email || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Villages</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.villages || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Division</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_divisions || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Channel Partner</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Channel Partner</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module Brand</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_brand || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module WP</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_wp || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">No of Modules</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.no_of_modules || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Payment Type</span>
                                                <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded text-[10px] uppercase">
                                                    {selectedCust.payment_type || '–'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Attached Documents Checklist (Upload / View / Change) */}
                                    <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-2xs space-y-3">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Paperclip size={11} className="text-amber-500" /> Attached Documents & Uploads
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <CheckboxRemarkItem
                                                label="Aadhar Card Front"
                                                field="adhaar_card_front"
                                                value={editData.adhaar_card_front}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Aadhar Card Back"
                                                field="adhaar_card_back"
                                                value={editData.adhaar_card_back}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="PAN Card"
                                                field="pan_card"
                                                value={editData.pan_card}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Light Bill"
                                                field="light_bill"
                                                value={editData.light_bill}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Index 2"
                                                field="index_2"
                                                value={editData.index_2}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Bank Details"
                                                field="bank_details"
                                                value={editData.bank_details}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="House Geo Tag Photo"
                                                field="house_geo_tag_photo"
                                                value={editData.house_geo_tag_photo}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Extra Documents"
                                                field="extra_docs"
                                                value={editData.extra_docs}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'REGISTRATION' && (
                                <div className="space-y-4">
                                    {/* Registration Details Card (Line by Line Non-Editable) */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <ClipboardList size={11} /> Registration Details
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Registration Date</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_date || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Registration By</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_by || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Feasibility No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_no || selectedCust.feasibility_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.folder_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Feasibility Document</span>
                                                {renderStatusBadge(selectedCust.feasibilty_document ? 'Completed' : 'Pending', 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Token Photo</span>
                                                {renderStatusBadge(selectedCust.subsidy_token_photo ? 'Completed' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Registration Documents Checklist (Upload / View / Change) */}
                                    <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-2xs space-y-3">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Paperclip size={11} className="text-amber-500" /> Registration Documents & Uploads
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <CheckboxRemarkItem
                                                label="Feasibility Document"
                                                field="feasibilty_document"
                                                value={editData.feasibilty_document}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                            <CheckboxRemarkItem
                                                label="Subsidy Token Photo"
                                                field="subsidy_token_photo"
                                                value={editData.subsidy_token_photo}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'LOAN' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Banknote size={11} /> Loan Information
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Payment Type Selection</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.payment_type || 'Loan'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Loan Tag Tracking</span>
                                            {renderStatusBadge(selectedCust.loan_tag, 'Pending')}
                                        </div>
                                        {selectedCust.loan_history && selectedCust.loan_history.length > 0 ? (
                                            <div className="pt-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1.5">Loan Status Timeline</span>
                                                <div className="space-y-1.5 pl-2 border-l-2 border-amber-300">
                                                    {selectedCust.loan_history.map((h, i) => (
                                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-amber-900">{h.status} {h.remark ? `(${h.remark})` : ''}</span>
                                                            <span className="text-stone-400 text-[10px]">{h.date}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Loan Status Timeline</span>
                                                <span className="text-stone-400 italic">No loan history recorded</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'CASH' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Banknote size={11} /> Cash Tracking
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Payment Type Selection</span>
                                            <span className="font-semibold text-stone-900 uppercase">{selectedCust.payment_type || 'Cash'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Total Amount</span>
                                            <span className="font-semibold text-stone-900">
                                                {selectedCust.cash_details?.total_amount ? `₹${toIndianCommas(selectedCust.cash_details.total_amount)}` : '–'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">1st Payment</span>
                                            <span className="font-semibold text-stone-900">
                                                {selectedCust.cash_details?.payments?.[0]?.amount ? `₹${toIndianCommas(selectedCust.cash_details.payments[0].amount)}${selectedCust.cash_details.payments[0].date ? ` (${selectedCust.cash_details.payments[0].date})` : ''}` : '–'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">2nd Payment</span>
                                            <span className="font-semibold text-stone-900">
                                                {selectedCust.cash_details?.payments?.[1]?.amount ? `₹${toIndianCommas(selectedCust.cash_details.payments[1].amount)}${selectedCust.cash_details.payments[1].date ? ` (${selectedCust.cash_details.payments[1].date})` : ''}` : '–'}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">3rd Payment</span>
                                            <span className="font-semibold text-stone-900">
                                                {selectedCust.cash_details?.payments?.[2]?.amount ? `₹${toIndianCommas(selectedCust.cash_details.payments[2].amount)}${selectedCust.cash_details.payments[2].date ? ` (${selectedCust.cash_details.payments[2].date})` : ''}` : '–'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'MATERIAL ORDER' && (
                                <div className="space-y-4">
                                    {/* Non-Editable Leads Details Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <User size={11} /> Customer Lead Details
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Customer Name</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.customer_name || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email Address</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.email_address || selectedCust.email || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Villages / Address</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.villages || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Division</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_divisions || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Channel Partner</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Channel Partner</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module Brand</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_brand || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Module Wp</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_wp || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">No of Modules</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.no_of_modules || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Payment Type</span>
                                                <span className="font-bold text-amber-700 bg-amber-100/70 px-2 py-0.5 rounded text-[10px] uppercase">
                                                    {selectedCust.payment_type || '–'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Material Order Form Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-3">
                                        <div className="border-b border-stone-150 pb-2 mb-1">
                                            <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                                <Package size={11} /> Material Order Details
                                            </h5>
                                        </div>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Roof / Shed</span>
                                                <select
                                                    value={editData.roof_shed || selectedCust.roof_shed || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, roof_shed: e.target.value }))}
                                                    className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                >
                                                    <option value="">Select Roof / Shed</option>
                                                    <option value="Roof">Roof</option>
                                                    <option value="Shed">Shed</option>
                                                </select>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DC Cable (Mtrs)</span>
                                                <input
                                                    type="number"
                                                    value={editData.dc_cable ?? selectedCust.dc_cable ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, dc_cable: e.target.value }))}
                                                    placeholder="Meters"
                                                    className="w-28 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">AC Cable (Mtrs)</span>
                                                <input
                                                    type="number"
                                                    value={editData.ac_cable ?? selectedCust.ac_cable ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, ac_cable: e.target.value }))}
                                                    placeholder="Meters"
                                                    className="w-28 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Structure Leg Height</span>
                                                <input
                                                    type="text"
                                                    value={editData.structure_leg_height || selectedCust.structure_leg_height || ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, structure_leg_height: e.target.value }))}
                                                    placeholder="e.g. 1 Meter"
                                                    className="w-28 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                                <input
                                                    type="number"
                                                    value={editData.invoice_value ?? selectedCust.invoice_value ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, invoice_value: e.target.value }))}
                                                    placeholder="₹ Amount"
                                                    className="w-32 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-stone-200/60">
                                            <button
                                                onClick={async () => {
                                                    setSaving(true);
                                                    await handleUpdateCustomer(selectedCust.id, {
                                                        roof_shed: editData.roof_shed || selectedCust.roof_shed,
                                                        dc_cable: editData.dc_cable !== undefined ? editData.dc_cable : selectedCust.dc_cable,
                                                        ac_cable: editData.ac_cable !== undefined ? editData.ac_cable : selectedCust.ac_cable,
                                                        structure_leg_height: editData.structure_leg_height || selectedCust.structure_leg_height,
                                                        invoice_value: editData.invoice_value !== undefined ? editData.invoice_value : selectedCust.invoice_value,
                                                        stage: 'MATERIAL INTEGRATION'
                                                    });
                                                    setSaving(false);
                                                }}
                                                disabled={saving}
                                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                <CheckCircle2 size={14} /> {saving ? 'Advancing...' : 'Save & Move to Material Integration'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'MATERIAL INTEGRATION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Package size={11} /> Material Integration Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Roof / Shed</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.roof_shed || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DC Cable (Mtrs)</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.dc_cable ? `${selectedCust.dc_cable} M` : '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">AC Cable (Mtrs)</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.ac_cable ? `${selectedCust.ac_cable} M` : '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Structure Leg Height</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.structure_leg_height || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_value ? `₹${toIndianCommas(selectedCust.invoice_value)}` : '–'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'HOLD PROCUREMENT' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <PauseCircle size={11} /> Hold Procurement Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Hold Procurement</span>
                                            {renderStatusBadge(selectedCust.hold_procurement, 'Pending')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'MATERIAL DELIVERY' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Truck size={11} /> Material Delivery Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Vendor Allotment</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.vendor || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">INVERTER SERIAL NO.</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.inverter_serial_no || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">INVOICE NO</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_no || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DRIVER NAME</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.driver_name || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DRIVER PHONE NUMBER</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.driver_phone_number || '–'}</span>
                                        </div>
                                        {selectedCust.panel_serial_no && (
                                            <div className="py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1">Panel Serial Numbers</span>
                                                <p className="font-semibold text-stone-900 whitespace-pre-line text-[11px] bg-white p-2 rounded-xl border border-stone-200">{selectedCust.panel_serial_no}</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(selectedCust.stage === 'INSTALLATION STATUS' || selectedCust.stage === 'MATERIAL INSTALLATION') && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Wrench size={11} /> Installation Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">SFDC Photo Checked</span>
                                            {renderStatusBadge(selectedCust.sfdc_photo ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Status</span>
                                            {renderStatusBadge(selectedCust.installation_status, 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Date</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.installation_date || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installed By (Person in Charge)</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.installed_by || '–'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'GEO TAG PHOTO' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Camera size={11} /> Geo Tag Photo Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Geo Tag Photo</span>
                                            {renderStatusBadge(selectedCust.geo_tag_status, 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Geo Tag Image Uploaded</span>
                                            {renderStatusBadge(selectedCust.geo_tag_image ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'DISCOM SUBMISSION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Send size={11} /> Discom Submission Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File Status Checked</span>
                                            {renderStatusBadge(selectedCust.file_status ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DCR Certificate Checked</span>
                                            {renderStatusBadge(selectedCust.dcr_certificate ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Signature Photo Checked</span>
                                            {renderStatusBadge(selectedCust.signature_pic ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stamp Checked</span>
                                            {renderStatusBadge(selectedCust.stamp ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File Submitted By</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.discom_submission?.submitted_by || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Submission Date</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.discom_submission?.date || '–'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'METER INSTALLATION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-3">
                                    <div className="border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Zap size={11} /> Meter Installation Details
                                        </h5>
                                    </div>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Meter Installation</span>
                                            <div className="flex items-center gap-1.5">
                                                {['Yes', 'No', 'Pending'].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setEditData(prev => ({ ...prev, meter_installation: val }))}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                                            (editData.meter_installation || selectedCust.meter_installation) === val
                                                                ? (val === 'Yes' ? 'bg-emerald-600 text-white border-emerald-600' : val === 'No' ? 'bg-rose-600 text-white border-rose-600' : 'bg-amber-500 text-white border-amber-500')
                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Date</span>
                                            <input
                                                type="date"
                                                value={editData.installation_date || selectedCust.installation_date || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, installation_date: e.target.value }))}
                                                className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-stone-200/60">
                                        <button
                                            onClick={async () => {
                                                setSaving(true);
                                                const currentMeter = editData.meter_installation || selectedCust.meter_installation || 'No';
                                                const updates = {
                                                    meter_installation: currentMeter,
                                                    installation_date: editData.installation_date || selectedCust.installation_date
                                                };
                                                if (currentMeter === 'Yes') {
                                                    updates.stage = 'DISCOM INSPECTION';
                                                }
                                                await handleUpdateCustomer(selectedCust.id, updates);
                                                setSaving(false);
                                            }}
                                            disabled={saving}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <CheckCircle2 size={14} /> {saving ? 'Advancing...' : ((editData.meter_installation || selectedCust.meter_installation) === 'Yes' ? 'Save & Move to Discom Inspection' : 'Save Details')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'DISCOM INSPECTION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-3">
                                    <div className="border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <ClipboardCheck size={11} /> Discom Inspection Details
                                        </h5>
                                    </div>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Discom Inspection</span>
                                            <div className="flex items-center gap-1.5">
                                                {['Yes', 'No', 'Pending'].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setEditData(prev => ({ ...prev, discom_inspection: val }))}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                                            (editData.discom_inspection || selectedCust.discom_inspection) === val
                                                                ? (val === 'Yes' ? 'bg-emerald-600 text-white border-emerald-600' : val === 'No' ? 'bg-rose-600 text-white border-rose-600' : 'bg-amber-500 text-white border-amber-500')
                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-stone-200/60">
                                        <button
                                            onClick={async () => {
                                                setSaving(true);
                                                const currentInsp = editData.discom_inspection || selectedCust.discom_inspection || 'No';
                                                const updates = {
                                                    discom_inspection: currentInsp
                                                };
                                                if (currentInsp === 'Yes') {
                                                    updates.stage = 'SUBSIDY STATUS';
                                                }
                                                await handleUpdateCustomer(selectedCust.id, updates);
                                                setSaving(false);
                                            }}
                                            disabled={saving}
                                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                        >
                                            <CheckCircle2 size={14} /> {saving ? 'Advancing...' : ((editData.discom_inspection || selectedCust.discom_inspection) === 'Yes' ? 'Save & Move to Subsidy Status' : 'Save Details')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'SUBSIDY STATUS' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Tag size={11} /> Subsidy Status Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Tag</span>
                                            {renderStatusBadge(selectedCust.subsidy_tag, 'Pending')}
                                        </div>
                                        {selectedCust.subsidy_history && selectedCust.subsidy_history.length > 0 ? (
                                            <div className="pt-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide block mb-1.5">Subsidy Status Timeline</span>
                                                <div className="space-y-1.5 pl-2 border-l-2 border-amber-300">
                                                    {selectedCust.subsidy_history.map((h, i) => (
                                                        <div key={i} className="flex items-center justify-between text-[11px]">
                                                            <span className="font-bold text-amber-900">{h.status} {h.remark ? `(${h.remark})` : ''}</span>
                                                            <span className="text-stone-400 text-[10px]">{h.date}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Status Timeline</span>
                                                <span className="text-stone-400 italic">No subsidy history recorded</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(selectedCust.stage === 'FINAL REVIEW' || selectedCust.stage === 'COMMISSIONING') && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <ClipboardCheck size={11} /> Operational Checklist Milestones
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Warranty Card Checked</span>
                                            {renderStatusBadge(selectedCust.warranty_card ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Insurance Status Checked</span>
                                            {renderStatusBadge(selectedCust.insurance_status ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {selectedCust.stage === 'COMPLETED' && (
                                <div className="space-y-4">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
                                        <h4 className="text-sm font-black text-emerald-800 uppercase tracking-wide">Project Completed & Commissioned</h4>
                                        <p className="text-xs text-emerald-700 font-semibold mt-0.5">Below is the complete project lifecycle record (read-only).</p>
                                    </div>

                                    {/* 1. Customer Info Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <User size={11} /> 1. Customer Info
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Customer Name</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.customer_name || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email Address</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.email || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Villages</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.villages || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Channel Partner Name</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Channel Partner Name</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_channel_partner || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity (kWp)</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">MODULE BRAND</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_brand || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">MODULE WP</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.module_wp || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Sub Division</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.sub_divisions || '–'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Registration Details Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <ClipboardList size={11} /> 2. Registration Details
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Registration date</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_date || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Registration By</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_by || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Feasibility No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.registration_no || selectedCust.feasibility_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File No</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.folder_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Feasibility Document</span>
                                                {renderStatusBadge(selectedCust.feasibilty_document ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Token Photo</span>
                                                {renderStatusBadge(selectedCust.subsidy_token_photo ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Payment & Financial Details Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Banknote size={11} /> 3. Payment & Financial Tracking
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Payment Type Selection</span>
                                                <span className="font-semibold text-stone-900 uppercase">{selectedCust.payment_type || '–'}</span>
                                            </div>
                                            {selectedCust.payment_type?.trim().toLowerCase() === 'loan' ? (
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Loan Tag Tracking</span>
                                                    {renderStatusBadge(selectedCust.loan_tag, 'Pending')}
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Total Amount</span>
                                                    <span className="font-semibold text-stone-900">
                                                        {selectedCust.cash_details?.total_amount ? `₹${toIndianCommas(selectedCust.cash_details.total_amount)}` : '–'}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 4. Material Order & Delivery Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Truck size={11} /> 4. Material Order & Delivery Details
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Vendor Allotment</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.vendor || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">INVERTER SERIAL NO.</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.inverter_serial_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">INVOICE NO</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.invoice_no || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DRIVER NAME</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.driver_name || '–'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 5. Installation & Geo Tag Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Wrench size={11} /> 5. Installation & Geo Tag
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Status</span>
                                                {renderStatusBadge(selectedCust.installation_status, 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Date</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.installation_date || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installed By</span>
                                                <span className="font-semibold text-stone-900">{selectedCust.installed_by || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Geo Tag Photo</span>
                                                {renderStatusBadge(selectedCust.geo_tag_status, 'Pending')}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 6. Utility & Commissioning Card */}
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <ClipboardCheck size={11} /> 6. Utility & Commissioning
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Meter Installation</span>
                                                {renderStatusBadge(selectedCust.meter_installation, 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Discom Inspection</span>
                                                {renderStatusBadge(selectedCust.discom_inspection, 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Subsidy Tag</span>
                                                {renderStatusBadge(selectedCust.subsidy_tag, 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Warranty Card Checked</span>
                                                {renderStatusBadge(selectedCust.warranty_card ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Insurance Status Checked</span>
                                                {renderStatusBadge(selectedCust.insurance_status ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
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
