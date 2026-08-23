import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle, AlertTriangle,
    Users, CreditCard, Hash, Folder, Tag, ChevronLeft, Plus, Search, 
    ChevronDown, ChevronUp, ClipboardList, Banknote, ShieldAlert, Paperclip, Eye, Download, X,
    ShoppingBag, Ruler, IndianRupee, Layers, Save, ClipboardCheck, Upload,
    Package, PauseCircle, Truck, Wrench, Camera, Send, Printer
} from 'lucide-react';
import { logActivity, toIndianCommas, formatInputValue, parseIndianNumber, uploadDocument, getCustomerDocuments, getDownloadUrl, getViewUrl, deleteDocument, updateDocumentRemark } from '../utils';
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
    const [integrationBom, setIntegrationBom] = useState(null);
    const [integrationBomItems, setIntegrationBomItems] = useState([]);
    const [showIntegrationPrint, setShowIntegrationPrint] = useState(false);
    const integrationPrintRef = useRef(null);
    const [loadingDocs, setLoadingDocs] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const [showStageSidebar, setShowStageSidebar] = useState(false);
    // The customer record retains its real CRM stage. This controls the stage
    // panel currently being viewed in the customer workdesk.
    const [activeCustomerStage, setActiveCustomerStage] = useState(null);
    const [activeDealerTab, setActiveDealerTab] = useState('ORDER'); // 'ORDER', 'METER', 'INSPECTION', 'PROFILE'
    const [editingSection, setEditingSection] = useState(null);
    const [uploadingDoc, setUploadingDoc] = useState(false);
    const [uploadDocType, setUploadDocType] = useState('adhaar_card_front');
    const fileInputRef = useRef(null);
    const [validationIssues, setValidationIssues] = useState([]);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [validationNextStage, setValidationNextStage] = useState('');
    const [customAlert, setCustomAlert] = useState(null);

    const handleChange = (field, val) => {
        setEditData(prev => ({ ...prev, [field]: val }));
    };

    const getStageRemarks = (value) => {
        if (value && typeof value === 'object') return value;
        if (typeof value === 'string') {
            try { return JSON.parse(value) || {}; } catch { return {}; }
        }
        return {};
    };

    const handleSaveStageRemark = async () => {
        if (!selectedCust) return;
        const remarks = getStageRemarks(editData.stages_remarks);
        await handleUpdateCustomer(selectedCust.id, { stages_remarks: remarks });
    };

    // Metadata
    const [meta, setMeta] = useState({});

    // Load agent's customers & metadata
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            const cpFilter = user.channel_partner || user.name;
            const { data, error } = await supabase
                .from('admin')
                .select('*')
                .eq('channel_partner', cpFilter)
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
        if (!user?.name) return;

        fetchCustomers();
        const partnerName = (user.channel_partner || user.name).trim().toLowerCase();
        const channel = supabase.channel(`agent_customers_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin' }, payload => {
                const record = payload.new;
                const belongsToAgent = record && !record.deleted_at &&
                    (record.channel_partner || '').trim().toLowerCase() === partnerName;

                setCustomers(previous => {
                    if (payload.eventType === 'DELETE' || !belongsToAgent) {
                        return previous.filter(customer => customer.id !== (record?.id || payload.old?.id));
                    }
                    const exists = previous.some(customer => customer.id === record.id);
                    if (payload.eventType === 'INSERT' && !exists) return [record, ...previous];
                    return previous.map(customer => customer.id === record.id ? record : customer);
                });
            })
            .subscribe();

        return () => supabase.removeChannel(channel);
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

    // Sync selectedCust state with fresh database values when updates occur
    useEffect(() => {
        if (selectedCust) {
            const fresh = customers.find(c => c.id === selectedCust.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedCust)) {
                setSelectedCust(fresh);
            }
        }
    }, [customers]);

    // Load documents and sync customer data when a customer profile is opened
    useEffect(() => {
        if (selectedCust?.id) {
            setLoadingDocs(true);
            getCustomerDocuments(selectedCust.id)
                .then(docs => setCustDocs(docs || []))
                .finally(() => setLoadingDocs(false));

            setEditData({ ...selectedCust });
            setActiveCustomerStage(selectedCust.stage);

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
            setActiveCustomerStage(null);
        }
    }, [selectedCust?.id]);

    // Material Integration is view-only for Channel Partners. Load its BOM
    // milestones so the same operational information is visible as in Vendor Portal.
    useEffect(() => {
        const stageBeingViewed = activeCustomerStage || selectedCust?.stage;
        if (!selectedCust?.id || stageBeingViewed !== 'MATERIAL INTEGRATION') {
            setIntegrationBom(null);
            setIntegrationBomItems([]);
            return;
        }

        const loadIntegrationBom = async () => {
            const { data, error } = await supabase
                .from('bom')
                .select('id, bom_type, paper_prepared_by, paper_prepared_date, material_loaded_by, material_loaded_date')
                .eq('admin_id', selectedCust.id)
                .maybeSingle();
            if (error) console.error('Failed to load material integration milestones:', error);
            setIntegrationBom(data || null);

            if (!data?.id) return;
            const { data: items, error: itemsError } = await supabase
                .from('bom_items')
                .select('*')
                .eq('bom_id', data.id)
                .order('sr_no', { ascending: true });
            if (itemsError) console.error('Failed to load BOM items:', itemsError);
            setIntegrationBomItems(items || []);
        };
        loadIntegrationBom();
    }, [selectedCust?.id, selectedCust?.stage, activeCustomerStage]);

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
            // The server has already confirmed the update. Keep the local list
            // in sync instead of downloading every lead again after each edit.
            setCustomers(prev => prev.map(customer => customer.id === id ? { ...customer, ...updates } : customer));
            return true;
        } catch (err) {
            console.error('Update failed:', err);
            setCustomAlert({
                title: 'Update Failed',
                message: err.message || 'Could not save changes to the database.',
                type: 'error'
            });
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Submit new lead from AddLeadModal
    const handleSubmitLead = async (formData, attachedFiles = []) => {
        const isSubAgent = !!user.channel_partner;
        const leadData = {
            ...formData,
            channel_partner: isSubAgent ? user.channel_partner : user.name,
            sub_channel_partner: isSubAgent ? user.name : null,
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

        // Show the saved lead straight away; attachments can continue uploading
        // independently without holding the form open.
        setCustomers(prev => prev.some(customer => customer.id === newCustomer.id) ? prev : [newCustomer, ...prev]);
        setShowAddLead(false);

        if (attachedFiles && attachedFiles.length > 0) {
            void Promise.all(attachedFiles.map(item => {
                if (item.file) {
                    return uploadDocument(item.file, newCustomer.id, item.doc_type, user?.id).catch(uploadErr => {
                        console.error('Failed to upload file for lead:', uploadErr);
                    });
                }
                return Promise.resolve(null);
            }));
        }

        void logActivity(
            user.id,
            'create',
            `Added new lead: ${formData.customer_name}`,
            `Done by Agent: ${user.name}`,
            newCustomer.id
        );

        return newCustomer;
    };

    // Filter customers
    const filteredCustomers = (customers || []).filter(c => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.trim().toLowerCase();
        return (
            String(c?.customer_name || '').toLowerCase().includes(q) ||
            String(c?.phone_number || '').toLowerCase().includes(q) ||
            String(c?.consumer_no || '').toLowerCase().includes(q)
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

    const handleUploadDocForCustomer = async (e, docType) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCust?.id) return;
        setUploadingDoc(true);
        try {
            await uploadDocument(file, selectedCust.id, docType || uploadDocType, user?.id);
            const updatedDocs = await getCustomerDocuments(selectedCust.id);
            setCustDocs(updatedDocs || []);
        } catch (err) {
            console.error('Upload failed:', err);
            setCustomAlert({
                title: 'Upload Failed',
                message: err.message || 'Failed to upload the document.',
                type: 'error'
            });
        } finally {
            setUploadingDoc(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteDoc = async (doc) => {
        try {
            await deleteDocument(doc.id, doc.storage_path);
            const updatedDocs = await getCustomerDocuments(selectedCust.id);
            setCustDocs(updatedDocs || []);
        } catch (err) {
            console.error('Delete failed:', err);
            setCustomAlert({
                title: 'Delete Failed',
                message: err.message || 'Could not delete the selected document.',
                type: 'error'
            });
        }
    };

    const handleUpdateDocRemark = async (docId, newRemark) => {
        try {
            await updateDocumentRemark(docId, newRemark);
            setCustDocs(prev => prev.map(d => d.id === docId ? { ...d, remark: newRemark } : d));
        } catch (err) {
            console.error('Failed to update remark:', err);
        }
    };

    const [activeWorkdeskTab, setActiveWorkdeskTab] = useState('MATERIAL_ORDER'); // Material views, Meter Installation, Discom Inspection

    const handleSelectCustomerForStage = (cust, stageTab) => {
        setSelectedCust(cust);
        setShowStageSidebar(false);
        const stageMap = {
            LEADS: 'LEADS',
            REGISTRATION: 'REGISTRATION',
            MATERIAL_ORDER: 'MATERIAL ORDER',
            MATERIAL_INTEGRATION: 'MATERIAL INTEGRATION',
            MATERIAL_DELIVERY: 'MATERIAL DELIVERY',
            METER_INSTALLATION: 'METER INSTALLATION',
            DISCOM_INSPECTION: 'DISCOM INSPECTION',
        };
        setActiveCustomerStage(stageMap[stageTab] || cust.stage);
        if (stageTab === 'LEADS' || stageTab === 'REGISTRATION') {
            setActiveDealerTab('LEAD_INFO');
        } else if (stageTab === 'MATERIAL_ORDER') {
            setActiveDealerTab('ORDER');
        } else if (stageTab === 'MATERIAL_INTEGRATION' || stageTab === 'MATERIAL_DELIVERY') {
            setActiveDealerTab('LEAD_INFO');
        } else if (stageTab === 'METER_INSTALLATION') {
            setActiveDealerTab('METER');
        } else if (stageTab === 'DISCOM_INSPECTION') {
            setActiveDealerTab('INSPECTION');
        }
    };

    // Filter customers for workdesk
    const getWorkdeskCustomers = (stageTab) => {
        const stageMap = {
            'LEADS': 'LEADS',
            'REGISTRATION': 'REGISTRATION',
            'MATERIAL_ORDER': 'MATERIAL ORDER',
            'MATERIAL_INTEGRATION': 'MATERIAL INTEGRATION',
            'MATERIAL_DELIVERY': 'MATERIAL DELIVERY',
            'METER_INSTALLATION': 'METER INSTALLATION',
            'DISCOM_INSPECTION': 'DISCOM INSPECTION'
        };
        const targetStage = stageMap[stageTab];
        return filteredCustomers.filter(c => c.stage === targetStage);
    };

    const leadsCount = customers.filter(c => c.stage === 'LEADS').length;
    const registrationCount = customers.filter(c => c.stage === 'REGISTRATION').length;
    const materialOrderCount = customers.filter(c => c.stage === 'MATERIAL ORDER').length;
    const materialIntegrationCount = customers.filter(c => c.stage === 'MATERIAL INTEGRATION').length;
    const materialDeliveryCount = customers.filter(c => c.stage === 'MATERIAL DELIVERY').length;
    const meterPendingCount = customers.filter(c => c.stage === 'METER INSTALLATION').length;
    const inspPendingCount = customers.filter(c => c.stage === 'DISCOM INSPECTION').length;
    const operationalQueueCount = materialOrderCount + meterPendingCount + inspPendingCount;
    const inProgressCount = materialIntegrationCount + materialDeliveryCount + meterPendingCount + inspPendingCount;
    const priorityWorkdeskTab = meterPendingCount > 0
        ? 'METER_INSTALLATION'
        : inspPendingCount > 0
            ? 'DISCOM_INSPECTION'
            : materialOrderCount > 0
                ? 'MATERIAL_ORDER'
                : 'LEADS';
    const displayedStage = activeCustomerStage || selectedCust?.stage;
    const customerStageNavigation = [
        { id: 'LEADS', label: 'Lead', icon: Users },
        { id: 'REGISTRATION', label: 'Registration', icon: ClipboardList },
        { id: 'MATERIAL ORDER', label: 'Material Order', icon: ShoppingBag },
        { id: 'MATERIAL INTEGRATION', label: 'Integration', icon: Package },
        { id: 'MATERIAL DELIVERY', label: 'Delivery', icon: Truck },
        { id: 'METER INSTALLATION', label: 'Meter', icon: Zap },
        { id: 'DISCOM INSPECTION', label: 'Inspection', icon: ClipboardCheck },
    ];

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

    const handleAdvanceMaterialOrder = async () => {
        if (!selectedCust) return;

        const updates = {
            roof_shed: editData.roof_shed ?? selectedCust.roof_shed,
            dc_cable: editData.dc_cable ?? selectedCust.dc_cable,
            ac_cable: editData.ac_cable ?? selectedCust.ac_cable,
            structure_front_leg_height: editData.structure_front_leg_height ?? selectedCust.structure_front_leg_height,
            structure_rear_leg_height: editData.structure_rear_leg_height ?? selectedCust.structure_rear_leg_height,
            invoice_value: editData.invoice_value ?? selectedCust.invoice_value,
        };
        const issues = [];
        const requireField = (condition, label) => { if (!condition) issues.push(label); };
        requireField(updates.roof_shed, 'Roof / Shed');
        requireField(Number(parseIndianNumber(updates.dc_cable)) > 0, 'DC Cable Length');
        requireField(Number(parseIndianNumber(updates.ac_cable)) > 0, 'AC Cable Length');
        requireField(String(updates.structure_front_leg_height || '').trim(), 'Structure Front Leg Height');
        requireField(String(updates.structure_rear_leg_height || '').trim(), 'Structure Rear Leg Height');
        requireField(Number(parseIndianNumber(updates.invoice_value)) > 0, 'Invoice Value');

        if (issues.length) {
            setValidationIssues(issues);
            setValidationNextStage('Material Integration');
            setShowValidationModal(true);
            return;
        }

        const didSave = await handleUpdateCustomer(selectedCust.id, {
            ...updates,
            dc_cable: parseIndianNumber(updates.dc_cable),
            ac_cable: parseIndianNumber(updates.ac_cable),
            invoice_value: parseIndianNumber(updates.invoice_value),
            stage: 'MATERIAL INTEGRATION',
        });
        if (didSave) setActiveCustomerStage('MATERIAL INTEGRATION');
    };

    const getMeterInstallationUpdates = () => {
        const meterPhotoUploaded = custDocs.some(doc =>
            doc.doc_type === 'meter_installation_photo' || doc.doc_type === 'meter_photo'
        );
        return {
            meter_installation: editData.meter_installation ?? selectedCust?.meter_installation ?? '',
            installation_date: editData.installation_date ?? selectedCust?.installation_date ?? '',
            meter_installation_photo: meterPhotoUploaded,
        };
    };

    const handleSaveMeterInstallation = async (moveToNextStage = false) => {
        if (!selectedCust) return;
        const updates = getMeterInstallationUpdates();

        if (moveToNextStage) {
            const issues = [];
            const requireField = (condition, label) => { if (!condition) issues.push(label); };
            requireField(updates.meter_installation === 'Yes', 'Meter Installation must be Yes');
            requireField(updates.installation_date, 'Meter Installation Date');
            requireField(updates.meter_installation_photo, 'Meter Installation Photo');
            if (issues.length) {
                setValidationIssues(issues);
                setValidationNextStage('Discom Inspection');
                setShowValidationModal(true);
                return;
            }
            updates.stage = 'DISCOM INSPECTION';
        }

        const didSave = await handleUpdateCustomer(selectedCust.id, updates);
        if (didSave && moveToNextStage) setActiveCustomerStage('DISCOM INSPECTION');
    };

    const handleSaveDiscomInspection = async (moveToNextStage = false) => {
        if (!selectedCust) return;
        const updates = {
            discom_inspection: editData.discom_inspection ?? selectedCust.discom_inspection ?? '',
        };

        if (moveToNextStage) {
            if (updates.discom_inspection !== 'Yes') {
                setValidationIssues(['Discom Inspection must be Yes']);
                setValidationNextStage('Subsidy Status');
                setShowValidationModal(true);
                return;
            }
            updates.stage = 'SUBSIDY STATUS';
        }

        const didSave = await handleUpdateCustomer(selectedCust.id, updates);
        if (didSave && moveToNextStage) {
            // This is the last Stage Operations task, so return to its filtered list.
            setSelectedCust(null);
            setActiveCustomerStage(null);
            setActiveWorkdeskTab('DISCOM_INSPECTION');
        }
    };

    const isMeterInstallationDirty = () => {
        if (!selectedCust) return false;
        const updates = getMeterInstallationUpdates();
        return updates.meter_installation !== (selectedCust.meter_installation || '') ||
            updates.installation_date !== (selectedCust.installation_date || '') ||
            Boolean(editData.meter_installation_photo) !== Boolean(selectedCust.meter_installation_photo);
    };

    const isDiscomInspectionDirty = () => selectedCust &&
        (editData.discom_inspection ?? selectedCust.discom_inspection ?? '') !== (selectedCust.discom_inspection || '');

    const handlePrintIntegrationPreview = () => {
        const documentBody = integrationPrintRef.current;
        if (!documentBody) return;

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(element => element.outerHTML)
            .join('');
        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('aria-hidden', 'true');
        printFrame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;';
        const removeFrame = () => setTimeout(() => printFrame.remove(), 250);
        printFrame.onload = () => {
            const printWindow = printFrame.contentWindow;
            if (!printWindow) return removeFrame();
            printWindow.onafterprint = removeFrame;
            setTimeout(() => {
                printWindow.focus();
                printWindow.print();
            }, 100);
        };
        printFrame.srcdoc = `<!doctype html><html><head><title>BOM — ${selectedCust?.customer_name || 'Customer'}</title>${styles}<style>@page { size: A4 portrait; margin: 12mm; } body { margin: 0; color: #1c1917; background: #fff; } .print-document-container { border: 1px solid #a8a29e; padding: 12mm !important; overflow: visible !important; } </style></head><body><main class="print-document-container">${documentBody.innerHTML}</main></body></html>`;
        document.body.appendChild(printFrame);
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
                <main className="flex-1 w-full max-w-md mx-auto p-4 space-y-4 animate-in fade-in duration-300">
                    <section className="relative overflow-hidden rounded-[28px] bg-stone-950 px-5 py-6 text-white shadow-xl shadow-stone-900/10">
                        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-amber-400/20 blur-2xl" />
                        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full border-[18px] border-amber-400/10" />
                        <div className="relative space-y-5">
                            <div className="max-w-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">Channel Partner workspace</p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight">Good to see you, {user.name}.</h2>
                                <p className="mt-2 max-w-lg text-sm font-medium leading-relaxed text-stone-300">A focused view of your pipeline, pending hand-offs, and the customer work that needs attention today.</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => { setActiveWorkdeskTab(priorityWorkdeskTab); setView('workdesk'); }}
                                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 px-4 py-3 text-xs font-black text-stone-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.98] cursor-pointer"
                            >
                                <Layers size={15} /> Open work queue <ChevronRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                    </section>

                    <section className="grid grid-cols-2 gap-3">
                        {[
                            { label: 'Total customers', value: customers.length, icon: Users, tone: 'bg-stone-100 text-stone-700' },
                            { label: 'Action queue', value: operationalQueueCount, icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-700' },
                            { label: 'In progress', value: inProgressCount, icon: Layers, tone: 'bg-blue-50 text-blue-700' },
                            { label: 'Ready for inspection', value: inspPendingCount, icon: Zap, tone: 'bg-emerald-50 text-emerald-700' },
                        ].map(({ label, value, icon: Icon, tone }) => (
                            <div key={label} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={15} /></div>
                                <p className="mt-3 text-2xl font-black tracking-tight text-stone-900">{value}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-3">
                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab(priorityWorkdeskTab); setView('workdesk'); }}
                            className="group rounded-[26px] border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white p-5 text-left shadow-sm transition hover:border-amber-400 hover:shadow-md active:scale-[0.99] cursor-pointer"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3">
                                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20"><ClipboardCheck size={20} /></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">Next best action</p>
                                        <h3 className="mt-1 text-base font-black text-stone-900">Continue stage operations</h3>
                                        <p className="mt-1 text-xs font-medium leading-relaxed text-stone-500">{operationalQueueCount > 0 ? `${operationalQueueCount} customer${operationalQueueCount === 1 ? '' : 's'} need an operational update.` : 'Your operational queue is clear. Review your pipeline anytime.'}</p>
                                    </div>
                                </div>
                                <ChevronRight size={19} className="mt-1 shrink-0 text-amber-600 transition-transform group-hover:translate-x-1" />
                            </div>
                            <div className="mt-5 flex flex-wrap gap-2">
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-stone-600 border border-stone-200">{materialOrderCount} material orders</span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-stone-600 border border-stone-200">{meterPendingCount} meter installs</span>
                                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-stone-600 border border-stone-200">{inspPendingCount} inspections</span>
                            </div>
                        </button>

                        <div className="grid gap-3">
                            <button onClick={() => setShowAddLead(true)} className="group flex items-center justify-between rounded-2xl bg-amber-500 p-4 text-left text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.99] cursor-pointer">
                                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Plus size={18} /></span><span><span className="block text-xs font-black">Add customer</span><span className="mt-0.5 block text-[10px] font-medium text-amber-100">Create a new lead</span></span></div>
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                            <button onClick={() => setView('my_customers')} className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md active:scale-[0.99] cursor-pointer">
                                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700"><Search size={17} /></span><span><span className="block text-xs font-black text-stone-900">Customer directory</span><span className="mt-0.5 block text-[10px] font-medium text-stone-400">Search and track all leads</span></span></div>
                                <ChevronRight size={16} className="text-stone-400 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                    </section>
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

                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">Stage Operations Workdesk</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-0.5">View material progress and update Meter Installation or Discom Inspection.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowStageSidebar(true)}
                            className="shrink-0 rounded-xl bg-stone-900 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-stone-700 cursor-pointer flex items-center gap-1.5"
                        >
                            <Layers size={13} /> Stages
                        </button>
                    </div>

                    {/* Stage sidebar / selector */}
                    {showStageSidebar && !selectedCust && <>
                    <button type="button" aria-label="Close stage sidebar" onClick={() => setShowStageSidebar(false)} className="fixed inset-0 z-[60] bg-stone-950/35 backdrop-blur-[1px] cursor-default" />
                    <section className="stage-sidebar-scroll fixed inset-y-0 left-0 z-[70] w-[272px] overflow-y-auto border-r border-stone-200 bg-white p-3 shadow-2xl animate-in slide-in-from-left duration-200">
                        <div className="mb-3 flex items-center justify-between px-1">
                            <span className="text-[9px] font-black uppercase tracking-[0.16em] text-stone-400">Stage desk</span>
                            <button type="button" onClick={() => setShowStageSidebar(false)} className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 cursor-pointer"><X size={16} /></button>
                        </div>
                    <div className="flex flex-col gap-2">
                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab('LEADS'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                activeWorkdeskTab === 'LEADS'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <Users size={16} />
                            <span className="text-[10px] font-bold">Leads</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'LEADS' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {leadsCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab('REGISTRATION'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                activeWorkdeskTab === 'REGISTRATION'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <ClipboardList size={16} />
                            <span className="text-[10px] font-bold">Registration</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'REGISTRATION' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {registrationCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab('MATERIAL_ORDER'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
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
                            onClick={() => { setActiveWorkdeskTab('MATERIAL_INTEGRATION'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                activeWorkdeskTab === 'MATERIAL_INTEGRATION'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <Package size={16} />
                            <span className="text-[10px] font-bold">Integration</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'MATERIAL_INTEGRATION' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {materialIntegrationCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab('MATERIAL_DELIVERY'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
                                activeWorkdeskTab === 'MATERIAL_DELIVERY'
                                    ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20'
                                    : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-700'
                            }`}
                        >
                            <Truck size={16} />
                            <span className="text-[10px] font-bold">Delivery</span>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                activeWorkdeskTab === 'MATERIAL_DELIVERY' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-700'
                            }`}>
                                {materialDeliveryCount}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab('METER_INSTALLATION'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
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
                            onClick={() => { setActiveWorkdeskTab('DISCOM_INSPECTION'); setShowStageSidebar(false); }}
                            className={`w-full p-3 rounded-2xl border text-center transition-all cursor-pointer flex items-center justify-between gap-2 ${
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
                    </section>
                    </>}

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
                                            {['LEADS', 'REGISTRATION', 'MATERIAL_INTEGRATION', 'MATERIAL_DELIVERY'].includes(activeWorkdeskTab) ? 'View' : 'Edit'} <ChevronRight size={12} />
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
                                        {(activeWorkdeskTab === 'LEADS' || activeWorkdeskTab === 'REGISTRATION') && (
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">View only</span>
                                        )}
                                        {activeWorkdeskTab === 'MATERIAL_INTEGRATION' && (
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">View only</span>
                                        )}
                                        {activeWorkdeskTab === 'MATERIAL_DELIVERY' && (
                                            <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded">View only</span>
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
                                <p className="text-[10px] text-stone-400 font-semibold mt-0.5">Directory of all leads registered under {user.channel_partner || user.name}.</p>
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
                        <div className="shrink-0 px-5 py-5 border-b border-stone-150 bg-stone-50/90 flex justify-between items-start">
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
                            <div className="flex items-center gap-2 ml-3">
                                <button
                                    onClick={() => setSelectedCust(null)}
                                    className="w-8 h-8 rounded-full bg-stone-200/70 hover:bg-stone-300 flex items-center justify-center text-stone-600 hover:text-stone-900 transition-colors font-bold text-xs cursor-pointer"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Swipeable stage tabs for this customer */}
                        <div className="customer-stage-tabs shrink-0 border-b border-stone-150 bg-white px-4 py-3.5 overflow-x-auto">
                            <div className="flex min-w-max gap-2">
                                {customerStageNavigation.map(stage => {
                                    const StageIcon = stage.icon;
                                    const isActive = displayedStage === stage.id;
                                    return (
                                        <button
                                            key={stage.id}
                                            type="button"
                                            onClick={() => setActiveCustomerStage(stage.id)}
                                            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide transition cursor-pointer ${
                                                isActive
                                                    ? 'border-amber-500 bg-amber-500 text-white shadow-sm shadow-amber-500/20'
                                                    : 'border-stone-200 bg-stone-50 text-stone-500 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-800'
                                            }`}
                                        >
                                            <StageIcon size={13} />
                                            {stage.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Detail Body */}
                        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-6 pb-10 space-y-4">
                            {/* Every assigned stage has one shared hand-off remark. This is
                                separate from individual document remarks, which remain on
                                each uploaded document. */}
                            {displayedStage !== 'REGISTRATION' && displayedStage !== 'LEADS' && <section className="bg-amber-50/60 border border-amber-200/70 rounded-2xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-amber-800">
                                        {PRIMARY_STAGES.find(stage => stage.id === displayedStage)?.label || displayedStage} Remark
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleSaveStageRemark}
                                        disabled={saving}
                                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-[10px] font-bold"
                                    >
                                        Save
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    value={getStageRemarks(editData.stages_remarks)[displayedStage] || ''}
                                    onChange={event => setEditData(previous => ({
                                        ...previous,
                                        stages_remarks: {
                                            ...getStageRemarks(previous.stages_remarks),
                                            [displayedStage]: event.target.value,
                                        },
                                    }))}
                                    placeholder="Add a hand-off or status remark for this stage"
                                    className="w-full bg-white border border-amber-200 rounded-xl px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                />
                            </section>}
                            {/* ─── STAGE SECTION (Render active stage component in phone format) ─── */}
                            {displayedStage === 'LEADS' && (
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

                                    {/* Track Leads is intentionally limited to the saved lead form data. */}
                                    {view !== 'my_customers' && (
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
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
                                            />
                                            <CheckboxRemarkItem
                                                label="Vera Pavti / Aakarni"
                                                field="index_2"
                                                value={editData.index_2}
                                                onChange={handleChange}
                                                isEditing={true}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
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
                                                onUpdateRemark={handleUpdateDocRemark}
                                            />
                                        </div>
                                    </div>
                                    )}
                                </div>
                            )}

                            {displayedStage === 'REGISTRATION' && (
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

                                    {/* Registration documents are view/download only for agents. */}
                                    <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-2xs space-y-3">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Paperclip size={11} className="text-amber-500" /> Registration Documents
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            <CheckboxRemarkItem
                                                label="Feasibility Document"
                                                field="feasibilty_document"
                                                value={editData.feasibilty_document}
                                                onChange={handleChange}
                                                isEditing={false}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                                onUpdateRemark={handleUpdateDocRemark}
                                            />
                                            <CheckboxRemarkItem
                                                label="Subsidy Token Photo"
                                                field="subsidy_token_photo"
                                                value={editData.subsidy_token_photo}
                                                onChange={handleChange}
                                                isEditing={false}
                                                documents={custDocs}
                                                onUpload={handleUploadDocForCustomer}
                                                onDelete={handleDeleteDoc}
                                                onPreview={handlePreviewFile}
                                                onUpdateRemark={handleUpdateDocRemark}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'LOAN' && (
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

                            {displayedStage === 'CASH' && (
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

                            {displayedStage === 'MATERIAL ORDER' && (
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
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Front Leg Height (ft)</span>
                                                <input
                                                    type="number"
                                                    value={editData.structure_front_leg_height ?? selectedCust.structure_front_leg_height ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, structure_front_leg_height: e.target.value }))}
                                                    placeholder="ft"
                                                    className="w-28 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Rear Leg Height (ft)</span>
                                                <input
                                                    type="number"
                                                    value={editData.structure_rear_leg_height ?? selectedCust.structure_rear_leg_height ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, structure_rear_leg_height: e.target.value }))}
                                                    placeholder="ft"
                                                    className="w-28 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                                <input
                                                    type="text"
                                                    inputMode="decimal"
                                                    value={formatInputValue(editData.invoice_value ?? selectedCust.invoice_value ?? '')}
                                                    onChange={e => setEditData(prev => ({ ...prev, invoice_value: formatInputValue(e.target.value) }))}
                                                    placeholder="₹ Amount"
                                                    className="w-32 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-2 border-t border-stone-200/60">
                                            <button
                                                onClick={handleAdvanceMaterialOrder}
                                                disabled={saving}
                                                className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 px-4 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
                                            >
                                                <CheckCircle2 size={14} /> {saving ? 'Advancing...' : 'Save & Move to Material Integration'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'MATERIAL INTEGRATION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Package size={11} /> Material Integration Details
                                        </h5>
                                        <button
                                            type="button"
                                            onClick={() => setShowIntegrationPrint(true)}
                                            className="no-print shrink-0 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition"
                                        >
                                            <Printer size={11} /> View & Print BOM
                                        </button>
                                    </div>
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
                                            <span className="font-semibold text-stone-900">{selectedCust.structure_front_leg_height ? `${selectedCust.structure_front_leg_height} ft / ${selectedCust.structure_rear_leg_height || '–'} ft` : '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_value ? `₹${toIndianCommas(selectedCust.invoice_value)}` : '–'}</span>
                                        </div>
                                    </div>

                                    <section className="rounded-xl border border-amber-200/80 bg-amber-50/50 p-3">
                                        <h6 className="mb-2 border-b border-amber-200/70 pb-2 text-[9px] font-black uppercase tracking-widest text-amber-800">
                                            Procurement & Loading Milestones
                                        </h6>
                                        <div className="divide-y divide-amber-100 text-xs">
                                            <div className="flex items-center justify-between gap-3 py-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Paper Prepared By</span>
                                                <span className="text-right font-semibold text-stone-900">{integrationBom?.paper_prepared_by || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 py-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Paper Prepared Date</span>
                                                <span className="text-right font-semibold text-stone-900">{integrationBom?.paper_prepared_date || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 py-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Material Loaded By</span>
                                                <span className="text-right font-semibold text-stone-900">{integrationBom?.material_loaded_by || '–'}</span>
                                            </div>
                                            <div className="flex items-center justify-between gap-3 py-2">
                                                <span className="text-[10px] font-bold uppercase tracking-wide text-stone-400">Material Loaded Date</span>
                                                <span className="text-right font-semibold text-stone-900">{integrationBom?.material_loaded_date || '–'}</span>
                                            </div>
                                        </div>
                                    </section>
                                </div>
                            )}

                            {displayedStage === 'HOLD PROCUREMENT' && (
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

                            {displayedStage === 'MATERIAL DELIVERY' && (
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

                            {(displayedStage === 'INSTALLATION STATUS' || displayedStage === 'MATERIAL INSTALLATION') && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Wrench size={11} /> Installation Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">SFDC Photo</span>
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

                            {displayedStage === 'GEO TAG PHOTO' && (
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

                            {displayedStage === 'DISCOM SUBMISSION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <Send size={11} /> Discom Submission Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">File Status</span>
                                            {renderStatusBadge(selectedCust.file_status ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DCR Certificate</span>
                                            {renderStatusBadge(selectedCust.dcr_certificate ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Signature Photo</span>
                                            {renderStatusBadge(selectedCust.signature_pic ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stamp</span>
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

                            {displayedStage === 'METER INSTALLATION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-3">
                                    <div className="border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Zap size={11} /> Meter Installation Details
                                        </h5>
                                    </div>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Meter Installation <span className="text-red-500">*</span></span>
                                            <div className="flex items-center gap-1.5">
                                                {['Yes', 'No'].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setEditData(prev => ({ ...prev, meter_installation: val }))}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                                            (editData.meter_installation || selectedCust.meter_installation) === val
                                                                ? (val === 'Yes' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600')
                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Installation Date <span className="text-red-500">*</span></span>
                                            <input
                                                type="date"
                                                value={editData.installation_date ?? selectedCust.installation_date ?? ''}
                                                onChange={e => setEditData(prev => ({ ...prev, installation_date: e.target.value }))}
                                                className="bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>
                                    <div className="pt-2">
                                        <p className="text-[10px] font-bold text-stone-500 uppercase tracking-wide mb-1">Meter Installation Photo <span className="text-red-500">*</span></p>
                                        <CheckboxRemarkItem
                                            label="Meter Installation Photo"
                                            field="meter_installation_photo"
                                            value={editData.meter_installation_photo}
                                            onChange={handleChange}
                                            isEditing={true}
                                            documents={custDocs}
                                            onUpload={handleUploadDocForCustomer}
                                            onDelete={handleDeleteDoc}
                                            onPreview={handlePreviewFile}
                                            onUpdateRemark={handleUpdateDocRemark}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60">
                                        <button
                                            onClick={() => handleSaveMeterInstallation(false)}
                                            disabled={saving}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                                isMeterInstallationDirty() ? 'bg-stone-900 hover:bg-stone-800 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            }`}
                                        >
                                            <Save size={14} /> {saving ? 'Saving...' : (isMeterInstallationDirty() ? 'Save' : 'Saved')}
                                        </button>
                                        <button
                                            onClick={() => handleSaveMeterInstallation(true)}
                                            disabled={saving}
                                            className="bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={14} /> {saving ? 'Saving...' : 'Save & Move'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'DISCOM INSPECTION' && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-3">
                                    <div className="border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <ClipboardCheck size={11} /> Discom Inspection Details
                                        </h5>
                                    </div>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Discom Inspection <span className="text-red-500">*</span></span>
                                            <div className="flex items-center gap-1.5">
                                                {['Yes', 'No'].map(val => (
                                                    <button
                                                        key={val}
                                                        type="button"
                                                        onClick={() => setEditData(prev => ({ ...prev, discom_inspection: val }))}
                                                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border cursor-pointer transition-all ${
                                                            (editData.discom_inspection || selectedCust.discom_inspection) === val
                                                                ? (val === 'Yes' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-rose-600 text-white border-rose-600')
                                                                : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'
                                                        }`}
                                                    >
                                                        {val}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60">
                                        <button
                                            onClick={() => handleSaveDiscomInspection(false)}
                                            disabled={saving}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 ${
                                                isDiscomInspectionDirty() ? 'bg-stone-900 hover:bg-stone-800 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                            }`}
                                        >
                                            <Save size={14} /> {saving ? 'Saving...' : (isDiscomInspectionDirty() ? 'Save' : 'Saved')}
                                        </button>
                                        <button
                                            onClick={() => handleSaveDiscomInspection(true)}
                                            disabled={saving}
                                            className="bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-3 rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                                        >
                                            <CheckCircle2 size={14} /> {saving ? 'Saving...' : 'Save & Move'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'SUBSIDY STATUS' && (
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

                            {(displayedStage === 'FINAL REVIEW' || displayedStage === 'COMMISSIONING') && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <ClipboardCheck size={11} /> Operational Checklist Milestones
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Warranty Card</span>
                                            {renderStatusBadge(selectedCust.warranty_card ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Insurance Status</span>
                                            {renderStatusBadge(selectedCust.insurance_status ? 'Yes' : 'Pending', 'Pending')}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'COMPLETED' && (
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
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Warranty Card</span>
                                                {renderStatusBadge(selectedCust.warranty_card ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Insurance Status</span>
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

            {/* Vendor-style BOM print preview for Material Integration. */}
            {showIntegrationPrint && selectedCust && (
                <div className="fixed inset-0 z-[999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="print-only-modal bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                        <div className="no-print px-5 py-4 bg-stone-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2"><Printer size={16} className="text-amber-400" /><h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">BOM Print Preview — {selectedCust.customer_name}</h3></div>
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={handlePrintIntegrationPreview} className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"><Printer size={13} /> Print Document</button>
                                <button type="button" onClick={() => setShowIntegrationPrint(false)} className="text-stone-400 hover:text-white p-1 rounded-lg"><X size={18} /></button>
                            </div>
                        </div>
                        <div ref={integrationPrintRef} className="print-document-container flex-1 overflow-y-auto p-6 bg-white text-stone-900">
                            <div className="border-b-2 border-stone-900 pb-3 mb-5 text-center">
                                <h1 className="text-lg font-black uppercase tracking-wider">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-[11px] font-semibold text-stone-600">Solar PV Project Integration & Material Loading Checklist</p>
                                <p className="inline-block mt-2 px-2.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-black uppercase tracking-widest">Bill of Materials — {integrationBom?.bom_type || 'General'} Type</p>
                            </div>
                            <section className="mb-4"><h4 className="text-[11px] font-black uppercase border-b border-stone-400 pb-1 mb-2">1. Customer & Site Reference</h4><table className="w-full text-[11px] border border-stone-300"><tbody><tr><td className="w-1/4 p-1.5 bg-stone-50 font-bold">Party Name:</td><td className="w-1/4 p-1.5 font-bold">{selectedCust.customer_name || '–'}</td><td className="w-1/4 p-1.5 bg-stone-50 font-bold">Contact Number:</td><td className="w-1/4 p-1.5 font-bold">{selectedCust.phone_number || '–'}</td></tr><tr><td className="p-1.5 bg-stone-50 font-bold">System Capacity:</td><td className="p-1.5 font-bold">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</td><td className="p-1.5 bg-stone-50 font-bold">Dealer / Channel Partner:</td><td className="p-1.5 font-bold">{selectedCust.channel_partner || '–'}</td></tr><tr><td className="p-1.5 bg-stone-50 font-bold">File / Folder No:</td><td className="p-1.5 font-bold">{selectedCust.folder_no || '–'}</td><td className="p-1.5 bg-stone-50 font-bold">Registration Date:</td><td className="p-1.5 font-bold">{selectedCust.registration_date || '–'}</td></tr></tbody></table></section>
                            <section className="mb-4"><h4 className="text-[11px] font-black uppercase border-b border-stone-400 pb-1 mb-2">2. Material Order Specifications</h4><table className="w-full text-[11px] border border-stone-300"><tbody><tr><td className="w-1/4 p-1.5 bg-stone-50 font-bold">Roof / Shed:</td><td className="w-1/4 p-1.5 font-bold">{selectedCust.roof_shed || '–'}</td><td className="w-1/4 p-1.5 bg-stone-50 font-bold">Structure Leg Height:</td><td className="w-1/4 p-1.5 font-bold">{selectedCust.structure_front_leg_height ? `${selectedCust.structure_front_leg_height} ft / ${selectedCust.structure_rear_leg_height || '–'} ft` : '–'}</td></tr><tr><td className="p-1.5 bg-stone-50 font-bold">DC Cable Length:</td><td className="p-1.5 font-bold">{selectedCust.dc_cable ? `${selectedCust.dc_cable} Meters` : '–'}</td><td className="p-1.5 bg-stone-50 font-bold">AC Cable Length:</td><td className="p-1.5 font-bold">{selectedCust.ac_cable ? `${selectedCust.ac_cable} Meters` : '–'}</td></tr><tr><td className="p-1.5 bg-stone-50 font-bold">Estimated Invoice Value:</td><td colSpan={3} className="p-1.5 font-bold">{selectedCust.invoice_value ? `₹ ${toIndianCommas(selectedCust.invoice_value)}` : '–'}</td></tr></tbody></table></section>
                            <section className="mb-4"><h4 className="text-[11px] font-black uppercase border-b border-stone-400 pb-1 mb-2">3. Procurement & Loading Milestones</h4><table className="w-full text-[11px] border border-stone-300"><tbody><tr><td className="p-1.5 bg-stone-50 font-bold">Paper Prepared By</td><td className="p-1.5">{integrationBom?.paper_prepared_by || '–'}</td><td className="p-1.5 bg-stone-50 font-bold">Paper Prepared Date</td><td className="p-1.5">{integrationBom?.paper_prepared_date || '–'}</td></tr><tr><td className="p-1.5 bg-stone-50 font-bold">Material Loaded By</td><td className="p-1.5">{integrationBom?.material_loaded_by || '–'}</td><td className="p-1.5 bg-stone-50 font-bold">Material Loaded Date</td><td className="p-1.5">{integrationBom?.material_loaded_date || '–'}</td></tr></tbody></table></section>
                            <section><h4 className="text-[11px] font-black uppercase border-b border-stone-400 pb-1 mb-2">4. BOM Equipment Checklist</h4>{integrationBomItems.length ? <table className="w-full text-[11px] border-collapse border border-stone-400"><thead><tr className="bg-stone-100 text-[9px] uppercase"><th className="border border-stone-400 p-1.5">#</th><th className="border border-stone-400 p-1.5 text-left">Product</th><th className="border border-stone-400 p-1.5 text-left">Make</th><th className="border border-stone-400 p-1.5">UOM</th><th className="border border-stone-400 p-1.5 text-left">Integration By</th><th className="border border-stone-400 p-1.5 text-left">Note</th></tr></thead><tbody>{integrationBomItems.map((item, index) => <tr key={item.id || index}><td className="border border-stone-400 p-1.5 text-center">{index + 1}</td><td className="border border-stone-400 p-1.5 font-bold">{item.product_name || '–'}</td><td className="border border-stone-400 p-1.5">{item.make || '–'}</td><td className="border border-stone-400 p-1.5 text-center">{item.uom || '–'}</td><td className="border border-stone-400 p-1.5">{item.integration_by || '–'}</td><td className="border border-stone-400 p-1.5">{item.note || '–'}</td></tr>)}</tbody></table> : <p className="py-4 text-center text-xs text-stone-400 border border-stone-200">No BOM checklist items configured yet.</p>}</section>
                        </div>
                    </div>
                </div>
            )}

            {showValidationModal && (
                <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onClick={() => setShowValidationModal(false)}>
                    <section className="w-full max-w-md overflow-hidden rounded-[28px] border border-amber-200 bg-white shadow-2xl animate-in zoom-in-95 fade-in duration-200" onClick={event => event.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="requirements-title">
                        <div className="bg-gradient-to-br from-amber-500 via-amber-500 to-orange-500 px-6 py-5 text-white">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="rounded-2xl bg-white/20 p-2.5"><AlertTriangle size={21} /></div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-50">Watersun checklist</p>
                                        <h3 id="requirements-title" className="mt-0.5 text-lg font-black">A few details need attention</h3>
                                    </div>
                                </div>
                                <button type="button" onClick={() => setShowValidationModal(false)} className="rounded-lg p-1 text-white/90 hover:bg-white/15 hover:text-white" aria-label="Close requirements popup"><X size={19} /></button>
                            </div>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-sm font-medium leading-relaxed text-stone-600">Complete the required items below before moving this customer to <span className="font-bold text-stone-800">{validationNextStage}</span>.</p>
                            <ul className="mt-4 space-y-2.5">
                                {validationIssues.map(issue => (
                                    <li key={issue} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-800">
                                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white">!</span>
                                        {issue}
                                    </li>
                                ))}
                            </ul>
                            <button type="button" onClick={() => setShowValidationModal(false)} className="mt-5 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-stone-800">Review requirements</button>
                        </div>
                    </section>
                </div>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <FilePreviewModal
                    file={previewDoc.doc}
                    fileUrl={previewDoc.url}
                    onClose={() => setPreviewDoc(null)}
                    onDownload={() => handleDownloadDoc(previewDoc.doc)}
                    onUpdateRemark={handleUpdateDocRemark}
                />
            )}

            {/* Custom Alert Modal */}
            {customAlert && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200"
                    onClick={() => setCustomAlert(null)}
                >
                    <div
                        className="w-full max-w-sm rounded-[28px] bg-white p-6 shadow-2xl border border-stone-150 animate-in zoom-in-95 duration-200 text-center space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className={`w-12 h-12 rounded-2xl mx-auto flex items-center justify-center ${
                            customAlert.type === 'error' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-700'
                        }`}>
                            {customAlert.type === 'error' ? <AlertCircle size={24} /> : <AlertTriangle size={24} />}
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-base font-extrabold text-stone-900">{customAlert.title}</h4>
                            <p className="text-xs text-stone-500 font-medium leading-relaxed">{customAlert.message}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCustomAlert(null)}
                            className="w-full py-3 bg-stone-900 hover:bg-stone-850 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
