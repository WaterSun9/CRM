import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import {
    User, Phone, Mail, MapPin, Zap, Building2, Sun, Home,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle, AlertTriangle,
    Users, CreditCard, Hash, Folder, Tag, ChevronLeft, Plus, Search, 
    ChevronDown, ChevronUp, ClipboardList, Banknote, ShieldAlert, Paperclip, Eye, Download, X,
    ShoppingBag, Ruler, IndianRupee, Layers, Save, ClipboardCheck, Upload,
    Package, PauseCircle, Truck, Wrench, Camera, Send, Printer, FileText, FolderOpen
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
import { DEMO_CUSTOMERS, getStoredDemoCustomers, updateStoredDemoCustomer, createStoredDemoCustomer } from '../mock/demoData';

export default function AgentPortal({ user, onLogout, isDemoMode = false }) {
    const [view, setView] = useState('menu');
    const [activeWorkdeskTab, setActiveWorkdeskTab] = useState('LEADS');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showAddLead, setShowAddLead] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    
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
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) { }
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

    const isAgent2 = user?.userType === 'agent2' || user?.role === 'Channel Partner (Agent 2)' || user?.role === 'Sub Agent' || !!(user?.channel_partner && user?.channel_partner !== user?.name && user?.userType !== 'channel_partner_office' && user?.userType !== 'office2');

    // Load agent's customers & metadata
    const fetchCustomers = async () => {
        setLoading(true);
        if (isDemoMode) {
            if (isAgent2) {
                const myName = (user.name || '').trim().toLowerCase();
                const matched = getStoredDemoCustomers().filter(c => !c.deleted_at && (
                    (c.sub_channel_partner || '').trim().toLowerCase() === myName ||
                    c.sub_channel_partner === 'Direct Sub Partner' ||
                    c.sub_channel_partner === 'Agent 2' ||
                    c.sub_channel_partner === 'Siddhpur Field Team' ||
                    c.sub_channel_partner === user.name
                ));
                setCustomers(matched.length > 0 ? matched : getStoredDemoCustomers().filter(c => !c.deleted_at));
            } else {
                setCustomers(getStoredDemoCustomers().filter(c => !c.deleted_at));
            }
            setLoading(false);
            return;
        }
        try {
            let query = supabase.from('admin').select('*').is('deleted_at', null).order('created_at', { ascending: false });

            if (isAgent2) {
                // Agent 2 (Sub-Agent) filters strictly by sub_channel_partner
                const subFilter = (user.name || '').trim();
                query = query.ilike('sub_channel_partner', `%${subFilter}%`);
            } else {
                // Main Channel Partner / Agent
                const cpFilter = (user.channel_partner || user.name || '').trim();
                query = query.ilike('channel_partner', `%${cpFilter}%`);
            }

            const { data, error } = await query;

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
        if (!user?.name && !isDemoMode) return;

        fetchCustomers();
        if (isDemoMode) return;

        const myName = (user.name || '').trim().toLowerCase();
        const partnerName = (user.channel_partner || user.name).trim().toLowerCase();
        const channel = supabase.channel(`agent_customers_${user.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin' }, payload => {
                const record = payload.new;
                const belongsToAgent = record && !record.deleted_at && (
                    isAgent2
                        ? (record.sub_channel_partner || '').trim().toLowerCase() === myName
                        : (record.channel_partner || '').trim().toLowerCase() === partnerName
                );

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
    }, [user, isAgent2]);

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
    }, [user?.id, user?.name, user?.channel_partner, isAgent2]);

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
            setActiveCustomerStage(selectedCust.stage === 'COMPLETED' ? 'LEADS' : selectedCust.stage);

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
            if (isDemoMode || String(id).startsWith('demo-')) {
                updateStoredDemoCustomer(id, updates);
                setSelectedCust(prev => ({ ...prev, ...updates }));
                setEditData(prev => ({ ...prev, ...updates }));
                setCustomers(prev => prev.map(customer => customer.id === id ? { ...customer, ...updates } : customer));
                setSaving(false);
                return true;
            }

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
        const parentCp = user.channel_partner || user.name;
        const subCp = isAgent2 ? user.name : (formData.sub_channel_partner || null);

        const leadData = {
            ...formData,
            channel_partner: parentCp,
            sub_channel_partner: subCp,
            application_done_by: user.name,
            created_at: new Date().toISOString()
        };

        // Clean up or format numeric values safely
        if (leadData.system_capacity_kwp !== undefined && leadData.system_capacity_kwp !== null && leadData.system_capacity_kwp !== '') {
            leadData.system_capacity_kwp = parseIndianNumber(leadData.system_capacity_kwp);
        }
        if (leadData.module_wp !== undefined && leadData.module_wp !== null && leadData.module_wp !== '') {
            leadData.module_wp = parseIndianNumber(leadData.module_wp);
        }
        if (leadData.no_of_modules !== undefined && leadData.no_of_modules !== null && leadData.no_of_modules !== '') {
            leadData.no_of_modules = parseIndianNumber(leadData.no_of_modules);
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

        if (isDemoMode) {
            const created = createStoredDemoCustomer(insertData);
            setCustomers(prev => [created, ...prev]);
            setShowAddLead(false);
            return created;
        }

        const { data: newCustomer, error } = await supabase
            .from('admin')
            .insert(insertData)
            .select()
            .single();

        if (error) {
            console.error('Submit error:', error);
            throw error;
        }

        // Await all attached file uploads so documents are fully recorded in database before completion
        if (attachedFiles && attachedFiles.length > 0) {
            await Promise.all(attachedFiles.map(async item => {
                if (item.file) {
                    try {
                        await uploadDocument(item.file, newCustomer.id, item.doc_type, user?.id);
                    } catch (uploadErr) {
                        console.error('Failed to upload file for lead:', uploadErr);
                    }
                }
            }));
        }

        setCustomers(prev => prev.some(customer => customer.id === newCustomer.id) ? prev : [newCustomer, ...prev]);
        setShowAddLead(false);

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
        // Enforce document edit permissions
        if (!['LEADS', 'REGISTRATION'].includes(activeCustomerStage) && 
            !(['METER INSTALLATION'].includes(activeCustomerStage) && docType.includes('meter')) &&
            !(['DISCOM SUBMISSION', 'DISCOM INSPECTION'].includes(activeCustomerStage) && (docType.includes('signature') || docType.includes('stamp') || docType.includes('dcr')))) {
            setCustomAlert({ title: 'Permission Denied', message: 'You can only upload lead documents during the Leads and Registration stages.', type: 'error' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }
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
        // Enforce document edit permissions
        if (!['LEADS', 'REGISTRATION'].includes(activeCustomerStage) && 
            !(['METER INSTALLATION'].includes(activeCustomerStage) && doc.doc_type.includes('meter')) &&
            !(['DISCOM SUBMISSION', 'DISCOM INSPECTION'].includes(activeCustomerStage) && (doc.doc_type.includes('signature') || doc.doc_type.includes('stamp') || doc.doc_type.includes('dcr')))) {
            setCustomAlert({ title: 'Permission Denied', message: 'You can only delete lead documents during the Leads and Registration stages.', type: 'error' });
            return;
        }
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

    // State moved to top

    const handleSelectCustomerForStage = (cust, stageTab) => {
        setEditData({});
        setActiveCustomerStage(stageTab === 'COMPLETED' ? 'LEADS' : stageTab);
        setSelectedCust(cust);
    };

    // Filter customers for workdesk
    const getWorkdeskCustomers = (stageTab) => {
        return filteredCustomers.filter(c => c.stage === stageTab);
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
    const customerStageNavigation = PRIMARY_STAGES;

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

    const handleBypassValidationAndAdvance = async () => {
        setShowValidationModal(false);
        if (!selectedCust || !validationNextStage) return;
        const targetStage = validationNextStage.toUpperCase();
        const didSave = await handleUpdateCustomer(selectedCust.id, {
            ...editData,
            stage: targetStage
        });
        if (didSave) setActiveCustomerStage(targetStage);
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
        const cleanName = String(selectedCust?.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanRef = String(selectedCust?.folder_no || selectedCust?.consumer_no || selectedCust?.crn || 'Site').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docTitle = `BOM_Material_Integration_${cleanName}_${cleanRef}`;
        const prevDocTitle = document.title;

        const removeFrame = () => {
            document.title = prevDocTitle;
            setTimeout(() => printFrame.remove(), 250);
        };

        printFrame.onload = () => {
            const printWindow = printFrame.contentWindow;
            if (!printWindow) return removeFrame();
            printWindow.onafterprint = removeFrame;
            setTimeout(() => {
                document.title = docTitle;
                printWindow.focus();
                printWindow.print();
            }, 100);
        };
        printFrame.srcdoc = `<!doctype html><html><head><title>${docTitle}</title>${styles}<style>@page { size: A4 portrait; margin: 12mm; } body { margin: 0; color: #1c1917; background: #fff; } .print-document-container { border: 1px solid #a8a29e; padding: 12mm !important; overflow: visible !important; } </style></head><body><main class="print-document-container">${documentBody.innerHTML}</main></body></html>`;
        document.body.appendChild(printFrame);
    };

    return (
        <>
            {view === 'menu' && (
                <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
                    <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10">
                        <Sun className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                        <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase">Watersun</h1>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest -mt-0.5">{isAgent2 ? 'Sub-Agent Portal' : 'Channel Partner Portal'}</p>
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
            
                <main className="flex-1 w-full max-w-md mx-auto p-4 space-y-4 animate-in fade-in duration-300">
                    <section className="relative overflow-hidden rounded-[28px] bg-stone-950 px-5 py-6 text-white shadow-xl shadow-stone-900/10">
                        <div className="absolute -right-10 -top-12 h-52 w-52 rounded-full bg-amber-400/20 blur-2xl" />
                        <div className="absolute -bottom-16 right-24 h-40 w-40 rounded-full border-[18px] border-amber-400/10" />
                        <div className="relative space-y-5">
                            <div className="max-w-xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300">
                                    {isAgent2 ? `Field Sub-Agent Workspace · ${user.channel_partner || 'Direct'}` : 'Channel Partner workspace'}
                                </p>
                                <h2 className="mt-2 text-2xl font-black tracking-tight">Good to see you, {user.name}.</h2>
                                <p className="mt-2 max-w-lg text-sm font-medium leading-relaxed text-stone-300">
                                    {isAgent2 
                                        ? 'A focused view of your field leads, sub-agent pipeline, and customer work that needs attention today.'
                                        : 'A focused view of your pipeline, pending hand-offs, and the customer work that needs attention today.'
                                    }
                                </p>
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
                            { label: 'Material Orders', value: getCustomersByStage('MATERIAL ORDER').length, icon: ShoppingBag, tone: 'bg-amber-50 text-amber-700' },
                            { label: 'Discom Subs', value: getCustomersByStage('DISCOM SUBMISSION').length, icon: Send, tone: 'bg-blue-50 text-blue-700' },
                            { label: 'Meter Installs', value: getCustomersByStage('METER INSTALLATION').length, icon: Zap, tone: 'bg-emerald-50 text-emerald-700' },
                        ].map(({ label, value, icon: Icon, tone }) => (
                            <div key={label} className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm">
                                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${tone}`}><Icon size={15} /></div>
                                <p className="mt-3 text-2xl font-black tracking-tight text-stone-900">{value}</p>
                                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p>
                            </div>
                        ))}
                    </section>

                    <section className="space-y-3">
                        <div className="grid gap-3">
                            <button onClick={() => setShowAddLead(true)} className="group flex items-center justify-between rounded-2xl bg-amber-500 p-4 text-left text-white shadow-md shadow-amber-500/20 transition hover:bg-amber-600 active:scale-[0.99] cursor-pointer">
                                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20"><Plus size={18} /></span><span><span className="block text-xs font-black">Add customer</span><span className="mt-0.5 block text-[10px] font-medium text-amber-100">Create a new lead</span></span></div>
                                <ChevronRight size={16} className="transition-transform group-hover:translate-x-0.5" />
                            </button>
                            <button onClick={() => { setActiveWorkdeskTab('LEADS'); setView('workdesk'); }} className="group flex items-center justify-between rounded-2xl border border-stone-200 bg-white p-4 text-left shadow-sm transition hover:border-stone-300 hover:shadow-md active:scale-[0.99] cursor-pointer">
                                <div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-100 text-stone-700"><Search size={17} /></span><span><span className="block text-xs font-black text-stone-900">Customer directory</span><span className="mt-0.5 block text-[10px] font-medium text-stone-400">Search and track all leads</span></span></div>
                                <ChevronRight size={16} className="text-stone-400 transition-transform group-hover:translate-x-0.5" />
                            </button>
                        </div>
                    </section>
                </main>

                </div>
            )}
            
            {view === 'workdesk' && (
                <div className="flex h-screen bg-stone-100 justify-center text-stone-850 font-sans overflow-hidden"><div className="w-full max-w-md bg-[#FCFBFA] h-full shadow-2xl relative flex flex-col">
            
            {/* MOBILE DRAWER */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] flex">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <aside className="relative w-[280px] h-full bg-slate-900 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 z-10">
                        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                            <div>
                                <h1 className="text-xs font-black tracking-widest text-white uppercase flex items-center gap-2">
                                    <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                        <Sun size={12} className="fill-white" />
                                    </div>
                                    Watersun
                                </h1>
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
                                <X size={16} />
                            </button>
                        </div>
                        
                        <div className="p-3 border-b border-slate-800 shrink-0">
                            <button onClick={() => setView('menu')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer group shadow-sm">
                                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-md shadow-amber-500/20">
                                    <Home size={14} />
                                </div>
                                <div className="flex flex-col items-start">
                                    <span className="text-[11px] font-bold">Home Page</span>
                                    <span className="text-[9px] text-slate-400 font-medium">Return to dashboard</span>
                                </div>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-1">
                            <div className="mb-2 px-1 pt-2">
                                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pipeline Stages</span>
                            </div>
                            {PRIMARY_STAGES.map(stage => {
                                const count = getCustomersByStage(stage.id).length;
                                const StageIcon = stage.icon || Folder;
                                const isActive = activeWorkdeskTab === stage.id;
                                return (
                                    <button
                                        key={stage.id}
                                        onClick={() => { setActiveWorkdeskTab(stage.id); setIsSidebarOpen(false); }}
                                        className={`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer ${
                                            isActive 
                                            ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                            : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <StageIcon size={16} />
                                            <span className="text-[11px] font-bold tracking-wide">{stage.label}</span>
                                        </div>
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                            isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                                        }`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </aside>
                </div>
            )}


            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-stone-50/50 relative">
                {/* HEADER */}
                <header className="bg-white border-b border-stone-200 px-4 md:px-6 py-3 md:py-4 shrink-0 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-[10px] uppercase tracking-wide font-black shadow-sm active:scale-95 transition-transform">
                            <Layers size={14} /> Stages
                        </button>
                        <div>
                            <h2 className="text-sm md:text-lg font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                                {PRIMARY_STAGES.find(s => s.id === activeWorkdeskTab)?.label || activeWorkdeskTab}
                            </h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-stone-50 hover:bg-stone-100 focus:bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                            <button onClick={onLogout} className="p-1.5 md:p-2 text-stone-400 hover:text-red-500 rounded-xl hover:bg-stone-100 transition-colors" title="Logout">
                                <LogOut size={16} />
                            </button>
                            <button
                                onClick={() => setShowAddLead(true)}
                                className="hidden sm:flex shrink-0 px-3 md:px-4 py-1.5 md:py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold items-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
                            >
                                <Plus size={14} /> Add Lead
                            </button>
                        </div>
                    </div>
                </header>

                
                {/* MOBILE SEARCH BAR */}
                <div className="sm:hidden px-4 py-3 bg-white border-b border-stone-150 shrink-0 shadow-sm z-10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-stone-50 focus:bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* CUSTOMER LIST */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        </div>
                    ) : getWorkdeskCustomers(activeWorkdeskTab).length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center text-stone-400 bg-white border border-dashed border-stone-200 rounded-3xl p-6 md:p-8 mt-4 max-w-sm md:max-w-lg mx-auto">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-stone-50 rounded-2xl flex items-center justify-center mb-3 md:mb-4">
                                <Users className="w-6 h-6 md:w-8 md:h-8 text-stone-300" />
                            </div>
                            <p className="text-xs md:text-sm font-bold text-stone-600">No customers</p>
                            <p className="text-[10px] md:text-[11px] text-stone-400 mt-1">
                                {searchQuery ? 'No matches found.' : 'No customers in this stage.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 auto-rows-max">
                            {getWorkdeskCustomers(activeWorkdeskTab).map((cust) => (
                                <div
                                    key={cust.id}
                                    onClick={() => handleSelectCustomerForStage(cust, activeWorkdeskTab)}
                                    className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-2 mb-3">
                                            <h4 className="text-sm font-black text-stone-900 group-hover:text-blue-600 transition-colors leading-snug">
                                                {cust.customer_name}
                                            </h4>
                                            <button type="button" className="shrink-0 w-6 h-6 md:w-7 md:h-7 bg-stone-50 group-hover:bg-blue-600 group-hover:text-white text-stone-400 rounded-lg transition-all flex items-center justify-center shadow-2xs border border-stone-100 group-hover:border-blue-600">
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-1.5 md:space-y-2 text-[11px] md:text-xs text-stone-600">
                                            <div className="flex items-center gap-2">
                                                <Phone size={11} className="text-stone-400 shrink-0" />
                                                <span className="font-semibold">{cust.phone_number || '–'}</span>
                                            </div>
                                            {cust.villages && (
                                                <div className="flex items-start gap-2">
                                                    <MapPin size={11} className="text-stone-400 shrink-0 mt-0.5" />
                                                    <span className="font-medium text-stone-500 line-clamp-1">{cust.villages}</span>
                                                </div>
                                            )}
                                            {cust.consumer_no && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        #{cust.consumer_no}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 md:mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-1.5 items-center justify-between text-[10px] md:text-[11px]">
                                        {cust.system_capacity_kwp && (
                                            <div className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                <Zap size={10} />
                                                {cust.system_capacity_kwp} kWp
                                            </div>
                                        )}
                                        {cust.payment_type && (
                                            <span className="font-bold text-stone-500 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded uppercase">
                                                {cust.payment_type}
                                            </span>
                                        )}
                                        {cust.discom_inspection === 'Yes' && activeWorkdeskTab === 'DISCOM_INSPECTION' && (
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Inspected</span>
                                        )}
                                        {cust.meter_installation === 'Yes' && activeWorkdeskTab === 'METER_INSTALLATION' && (
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Installed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* MOBILE FLOATING ACTION BUTTON */}
                <button
                    onClick={() => setShowAddLead(true)}
                    className="sm:hidden fixed bottom-6 right-4 z-40 bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Plus size={22} />
                </button>
            </main>
            </div></div>
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
                <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
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
                                {customerStageNavigation.filter(stage => {
                                    const pType = (selectedCust?.payment_type || '').trim().toLowerCase();
                                    if (stage.id === 'LOAN' && pType === 'cash') return false;
                                    if (stage.id === 'CASH' && pType === 'loan') return false;
                                    if (stage.id === 'COMPLETED' || stage.id === 'LOST PROJECT') return false;
                                    return true;
                                }).concat([
                                    { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen }
                                ]).map(stage => {
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
                            {displayedStage === 'CUSTOMER_CARD' && (
                                <div className="space-y-4">
                                    <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <User size={11} /> Customer Profile
                                        </h5>
                                        <div className="divide-y divide-stone-200/50 text-xs">
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Customer Name</span><span className="font-semibold text-stone-900">{selectedCust.customer_name || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Phone Number</span><span className="font-semibold text-stone-900">{selectedCust.phone_number || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Email</span><span className="font-semibold text-stone-900">{selectedCust.email || selectedCust.email_address || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Consumer No</span><span className="font-semibold text-stone-900">{selectedCust.consumer_no || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Location</span><span className="font-semibold text-stone-900">{selectedCust.villages || '–'} {selectedCust.sub_divisions ? `(${selectedCust.sub_divisions})` : ''}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Channel Partner</span><span className="font-semibold text-stone-900">{selectedCust.channel_partner || '–'}</span></div>
                                            <div className="flex items-center justify-between py-2"><span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">System Capacity</span><span className="font-semibold text-stone-900">{selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : '–'}</span></div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {displayedStage === 'DOCUMENTS' && (
                                <div className="space-y-3">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5 px-1">
                                        <FolderOpen size={11} /> Uploaded Documents ({custDocs?.length || 0})
                                    </h5>
                                    {(!custDocs || custDocs.length === 0) ? (
                                        <div className="p-8 text-center bg-stone-50 border border-dashed border-stone-200 rounded-xl">
                                            <p className="text-xs font-bold text-stone-500">No documents found</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-2">
                                            {custDocs.map(doc => (
                                                <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white border border-stone-200 rounded-xl shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
                                                            <FileText size={14} />
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-xs font-bold text-stone-800 truncate">{doc.file_name || doc.doc_type}</p>
                                                            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mt-0.5">{doc.doc_type.replace(/_/g, ' ')}</p>
                                                        </div>
                                                    </div>
                                                    <a href={getViewUrl(doc.storage_path)} target="_blank" rel="noreferrer" className="shrink-0 w-full sm:w-auto bg-stone-100 hover:bg-blue-50 text-stone-600 hover:text-blue-600 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5">
                                                        <Eye size={12} /> View File
                                                    </a>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

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
                                    {true && (
                                    <div className="bg-white p-4 rounded-2xl border border-stone-150 shadow-2xs space-y-3">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                            <Paperclip size={11} className="text-amber-500" /> Attached Documents & Uploads
                                        </h5>
                                        <div className="flex flex-col gap-2">
                                            {(selectedCust?.payment_type || editData?.payment_type || '')?.trim().toLowerCase() !== 'cash' && (
                                                <>
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
                                                </>
                                            )}
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
                                            <User size={11} /> Customer & Site Reference
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

                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Notes / Instructions</span>
                                                <input
                                                    type="text"
                                                    value={editData.material_order_notes ?? selectedCust.material_order_notes ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, material_order_notes: e.target.value }))}
                                                    placeholder="Optional notes"
                                                    className="w-48 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
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

                                    <div className="flex items-center justify-between py-2 border-t border-stone-200/50 mt-2 pt-3">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Inverter Make</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.inverter_make || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Inverter Serial No</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.inverter_serial_no || '–'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Panel Serial Numbers</span>
                                            <div className="font-semibold text-stone-700 bg-stone-100 p-2.5 rounded-lg text-[10px] whitespace-pre-wrap break-all min-h-[40px] border border-stone-200">
                                                {selectedCust.panel_serial_numbers || '–'}
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

                            {(displayedStage === 'LOST PROJECT' || displayedStage === 'HOLD PROCUREMENT') && (
                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-2">
                                    <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-150 pb-2 mb-1 flex items-center gap-1.5">
                                        <PauseCircle size={11} /> Lost Project Details
                                    </h5>
                                    <div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Lost Project Status</span>
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
                                            <div className="flex items-center gap-2">
                                                {selectedCust.file_status && <a href={getViewUrl(selectedCust.file_status)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.file_status ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">DCR Certificate</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.dcr_certificate && <a href={getViewUrl(selectedCust.dcr_certificate)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.dcr_certificate ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Signature Photo</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.signature_pic && <a href={getViewUrl(selectedCust.signature_pic)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.signature_pic ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Stamp</span>
                                            <div className="flex items-center gap-2">
                                                {selectedCust.stamp && <a href={getViewUrl(selectedCust.stamp)} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 p-1"><Download size={14} /></a>}
                                                {renderStatusBadge(selectedCust.stamp ? 'Yes' : 'Pending', 'Pending')}
                                            </div>
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
                                {validationIssues.map((issue, idx) => {
                                    const displayMsg = typeof issue === 'string'
                                        ? issue
                                        : (issue?.text ? (issue?.label ? `${issue.label}: ${issue.text}` : issue.text) : JSON.stringify(issue));
                                    return (
                                        <li key={idx} className="flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 px-3.5 py-2.5 text-sm font-semibold text-rose-800">
                                            <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-rose-500 text-xs font-black text-white">!</span>
                                            <span>{displayMsg}</span>
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="mt-5 flex gap-2">
                                <button 
                                    type="button" 
                                    onClick={() => setShowValidationModal(false)} 
                                    className="flex-1 rounded-xl bg-stone-100 hover:bg-stone-200 px-4 py-3 text-xs font-bold text-stone-700 transition-colors cursor-pointer"
                                >
                                    Review
                                </button>
                                <button 
                                    type="button" 
                                    onClick={handleBypassValidationAndAdvance} 
                                    className="flex-1 rounded-xl bg-amber-500 hover:bg-amber-600 px-4 py-3 text-xs font-bold text-white transition-colors shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    ⚡ Auto-Fill & Move Next
                                </button>
                            </div>
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
        </>
    );
}
