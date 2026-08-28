import { customerSchema } from '../utils/validation';
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

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
    X, Edit3, Trash2, Save, Send, AlertTriangle, CheckSquare,
    User, Zap, IndianRupee, Building2, FolderOpen, MapPin,
    LayoutDashboard, History, Plus, ShieldCheck, Lock, Unlock, ClipboardList, Banknote, Tag, Mail, PauseCircle, Check,
    Eye, Search, Image as ImageIcon, MessageSquare
} from 'lucide-react';
import { PRIMARY_STAGES, STAGE_IDS, SUBSIDY_TAGS, SUBSIDY_TAG_COLORS, LOAN_TAGS, LOAN_TAG_COLORS, ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE, DOC_TYPE_LABELS } from '../constants';
import { logActivity, formatLogDate, formatDateToDDMMYYYY, formatINR, toIndianCommas, formatInputValue, parseIndianNumber, fetchAgent2SubAgents } from '../utils';
import { supabase } from '../supabase';
import HistoryEntryEditor from './HistoryEntryEditor';
import { AgreementPreview } from './agreement/AgreementPreview';
import { Page1 } from './agreement/Page1';
import { FileText, Printer } from 'lucide-react';
import { uploadDocument, getCustomerDocuments, getDownloadUrl, getViewUrl, deleteDocument, updateDocumentRemark } from '../utils';

const getDocTypeLabel = (type) => {
    if (!type) return 'Client Attachment';
    if (DOC_TYPE_LABELS[type]) return DOC_TYPE_LABELS[type];
    return String(type).split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

import CustomerModalTabsRouter from './CustomerModalTabsRouter';
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
import HistoryTab from './modal-tabs/HistoryTab';
import CustomerDocumentsTab from './modal-tabs/CustomerDocumentsTab';
import { FilePreviewModal, DocGalleryRemarkRow, getStageRemarkFromData } from './modal-tabs/shared';
import { useGlobalPopup } from './GlobalPopup';

// ─── formatMoney: uses centralized Indian comma system from utils ─────────────
const fmt = formatINR;

// ─── formatDateTime: helper to format date as "04 Aug, 11:01 PM" ──────────────
const formatDateTime = (date) => {
    if (!date) return '–';
    const dObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dObj.getTime())) return String(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = dObj.getDate().toString().padStart(2, '0');
    const m = months[dObj.getMonth()];
    let hours = dObj.getHours();
    const minutes = dObj.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const h = hours.toString().padStart(2, '0');
    return `${d} ${m}, ${h}:${minutes} ${ampm}`;
};


// ─── Subsidy status options ───────────────────────────────────────────────────
const SUBSIDY_STATUS_OPTIONS = ['Approved', 'Returned', 'Rejected', 'Redeemed', 'Received'];
const LOAN_STATUS_OPTIONS = ['Processed', 'Sanctioned', 'Rejected', 'Returned', '1st Payment', '2nd Payment'];

const getChangedFields = (draft = {}, saved = {}) => {
    const changed = new Set();
    const ignoreKeys = new Set(['id', 'created_at', 'updated_at', 'crn']);
    const keys = new Set([...Object.keys(saved || {}), ...Object.keys(draft || {})]);

    keys.forEach(key => {
        if (ignoreKeys.has(key)) return;
        const draftValue = draft?.[key];
        const savedValue = saved?.[key];
        if (typeof draftValue === 'boolean' || typeof savedValue === 'boolean') {
            if (Boolean(draftValue) !== Boolean(savedValue)) changed.add(key);
            return;
        }
        const draftEmpty = draftValue === undefined || draftValue === null || draftValue === '';
        const savedEmpty = savedValue === undefined || savedValue === null || savedValue === '';
        if (draftEmpty && savedEmpty) return;
        if (typeof draftValue === 'object' || typeof savedValue === 'object') {
            if (JSON.stringify(draftValue ?? null) !== JSON.stringify(savedValue ?? null)) changed.add(key);
            return;
        }
        if (String(draftValue ?? '').trim() !== String(savedValue ?? '').trim()) changed.add(key);
    });

    return changed;
};

// ─── CustomerDetailModal ──────────────────────────────────────────────────────
export default function CustomerDetailModal({ customer, onClose, onUpdate, onDelete, user, meta, channel_partners = [], defaultTab }) {
    const { showAlert, showConfirm } = useGlobalPopup();
    const [activeTab, setActiveTab] = useState(() => {
        if (defaultTab) return defaultTab;
        
        // Force completed customers to open on the LEADS tab by default
        if ((customer?.stage || '').trim().toUpperCase() === STAGE_IDS.COMPLETED) return STAGE_IDS.LEADS;
        
        if (typeof window !== 'undefined') {
            const saved = window.sessionStorage.getItem('watersun_modal_active_tab');
            if (saved) return saved;
        }
        return customer?.stage || STAGE_IDS.LEADS;
    });
    const [editingSection, setEditingSection] = useState(null);
    const [isFormDirty, setIsFormDirty] = useState(false);
    const [editData, setEditData] = useState({ ...customer });
    const savedDataRef = useRef({ ...customer });
    const [subAgents, setSubAgents] = useState([]);

    useEffect(() => {
        const managerBranch = user?.userType === 'office2' ? user?.channel_partner : '';
        const branch = (managerBranch || editData.channel_partner || customer.channel_partner || '').trim();
        if (!branch) { setSubAgents([]); return; }
        let cancelled = false;
        fetchAgent2SubAgents(branch).then(names => { if (!cancelled) setSubAgents(names); });
        return () => { cancelled = true; };
    }, [editData.channel_partner, customer.channel_partner, user?.userType, user?.channel_partner]);

    useEffect(() => {
        if (typeof window !== 'undefined' && activeTab) {
            window.sessionStorage.setItem('watersun_modal_active_tab', activeTab);
        }
    }, [activeTab]);

    // Prevent any scenario where the active tab becomes COMPLETED or CUSTOMER_CARD (since they were removed from the nav)
    // We allow LOST PROJECT because there is an explicit "Move to Lost Project" button that needs to open it.
    useEffect(() => {
        if (activeTab === STAGE_IDS.COMPLETED || activeTab === 'CUSTOMER_CARD') {
            setActiveTab(STAGE_IDS.LEADS);
        }
    }, [activeTab]);


    const handleEditDataChange = (updater) => {
        setEditData(previous => {
            const next = typeof updater === 'function' ? updater(previous) : updater;
            setIsFormDirty(getChangedFields(next, savedDataRef.current).size > 0);
            return next;
        });
    };

    // Keep editData in sync with realtime prop updates if the user isn't currently editing
    useEffect(() => {
        if (!isFormDirty) {
            savedDataRef.current = { ...customer };
            setEditData({ ...customer });
        }
    }, [customer, isFormDirty]);
    const [followUpText, setFollowUpText] = useState('');
    const [saving, setSaving] = useState(false);
    const [sendingInfo, setSendingInfo] = useState(false);
    const [infoSentStatus, setInfoSentStatus] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [validationError, setValidationError] = useState(null);
    const [validationIssues, setValidationIssues] = useState([]);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [showCompletedConfirm, setShowCompletedConfirm] = useState(false);
    const [activityLogs, setActivityLogs] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [uploading, setUploading] = useState(false);
    const [filePreview, setFilePreview] = useState({ doc: null, url: null });
    const isAdmin = user?.userType === 'admin';
    const isCompleted = customer.stage === STAGE_IDS.COMPLETED;
    const [adminUnlocked, setAdminUnlocked] = useState(false);
    // Frozen for ALL users when completed. Admin can temporarily unlock.
    const isFrozen = isCompleted && !(isAdmin && adminUnlocked);
    const isAgent = user?.userType === 'agent';
    const isSales = user?.userType === 'sales' || user?.userType === 'office';
    const isChannelPartnerOffice = user?.userType === 'channel_partner_office' || user?.userType === 'channel_partner_office_manager';
    const isChannelPartnerManager = user?.userType === 'office2';
    const isChannelPartnerOfficeOrManager = isChannelPartnerOffice || isChannelPartnerManager;
    const isOffice = (user?.userType === 'sales' || user?.userType === 'office' || user?.role?.toLowerCase().includes('office')) && !isChannelPartnerOfficeOrManager;
    const canDeleteDocs = isAdmin || isOffice;

    const isDiscomOrMeterStage = editData.stage === STAGE_IDS.DISCOM_SUBMISSION || editData.stage === STAGE_IDS.METER_INSTALLATION;

    const canUserEdit = (() => {
        if (isAdmin || isChannelPartnerOffice || isChannelPartnerManager || isOffice || isSales) return true;
        if (user?.role?.toLowerCase().includes('office') || user?.role?.toLowerCase().includes('admin') || user?.role?.toLowerCase().includes('sales')) return true;
        if (isAgent) {
            // Agent can edit if it's their client AND in DISCOM SUBMISSION or METER INSTALLATION stage
            const isMyClient = (customer.channel_partner || '').trim().toLowerCase() === (user.name || '').trim().toLowerCase();
            return isMyClient && isDiscomOrMeterStage;
        }
        // In main Dashboard, all staff members (except external vendor/stamp portals) can edit
        if (user?.userType !== 'vendor' && user?.userType !== 'stamp') return true;
        return false;
    })();

    // Channel Partner Office and Channel Partner Manager cannot edit Material Integration and Material Delivery (View only)
    const isStageRestrictedForUser = isChannelPartnerOfficeOrManager && (activeTab === STAGE_IDS.MATERIAL_INTEGRATION || activeTab === STAGE_IDS.MATERIAL_DELIVERY);

    const isEditable = !isFrozen && canUserEdit && !isStageRestrictedForUser;
    // Sales and Office can always add remarks and edit fields
    const canAddRemark = isEditable || !isFrozen;
    // CPO Manager can update only the SFDC Photo checklist in Installation
    // Status. All other installation status/details remain view-only.
    const isInstallationDetailsEditable = isEditable && !isChannelPartnerManager;

    // Fetch full customer record in background if opened from lightweight views (Subsidy, Loan, Installation)
    useEffect(() => {
        if (!customer?.id || String(customer.id).startsWith('demo-')) return;
        supabase.from('admin').select('*').eq('id', customer.id).single().then(({ data }) => {
            if (data) {
                savedDataRef.current = { ...data, ...savedDataRef.current };
                setEditData(prev => {
                    const next = { ...data, ...prev };
                    return next;
                });
            }
        });
    }, [customer?.id]);

    const saveBomRef = useRef(null);
    const prevCustomerRef = useRef(customer);
    const [saved, setSaved] = useState(false);
    const [showAgreementPopup, setShowAgreementPopup] = useState(false);
    const [agreementData, setAgreementData] = useState({
        executionDate: '',
        consumerName: '',
        consumerNo: '',
        village: '',
        taluka: '',
        district: '',
        vendorName: 'Watersun Electrical Solutions Pvt Ltd',
        vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
        paymentTerms: 'Mutually Agreed Terms of Payment',
        firstPartySignature: '',
        secondPartyStamp: '',
        secondPartySignature: '',
        highlightColor: '#fef08a',
        showHighlights: true,
    });

    useEffect(() => {
        if (showAgreementPopup) {
            const rawDate = editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0];
            const formattedDate = formatDateToDDMMYYYY(rawDate);

            // Find signature and stamp documents
            const sigDoc = documents.find(d => 
                d.doc_type === 'signature_pic' || 
                d.doc_type === 'signature' || 
                d.doc_type === 'firstPartySignature' || 
                d.doc_type === 'customer_signature'
            );
            const stampDoc = documents.find(d => 
                d.doc_type === 'stamp' || 
                d.doc_type === 'stamp_pic' || 
                d.doc_type === 'vendor_stamp' || 
                d.doc_type === 'secondPartyStamp'
            );
            const gpaStampDoc = documents.find(d => 
                d.doc_type === 'pm_surya_ghar_stamp' || 
                d.doc_type === 'surya_ghar_stamp' || 
                d.doc_type === 'ghar_stamp'
            );

            const initialSigUrl = sigDoc ? (urlCacheRef.current[sigDoc.storage_path] || '') : '';
            const initialStampUrl = stampDoc ? (urlCacheRef.current[stampDoc.storage_path] || '') : '';
            const initialGpaStampUrl = gpaStampDoc ? (urlCacheRef.current[gpaStampDoc.storage_path] || '') : '';

            setAgreementData({
                executionDate: formattedDate,
                consumerName: editData.customer_name || '',
                consumerNo: editData.consumer_no || '',
                village: editData.villages || '',
                taluka: editData.villages || '',
                district: editData.sub_divisions || '',
                vendorName: 'Watersun Electrical Solutions Pvt Ltd',
                vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
                paymentTerms: 'Mutually Agreed Terms of Payment',
                firstPartySignature: initialSigUrl,
                secondPartyStamp: initialStampUrl || './stamp.png',
                secondPartySignature: '',
                signatureUrl: initialSigUrl,
                stampUrl: initialStampUrl || './stamp.png',
                gpaStampUrl: initialGpaStampUrl,
                highlightColor: '#fef08a',
                showHighlights: true,
            });

            // If not yet in cache, fetch and update state
            if (sigDoc && !initialSigUrl) {
                getViewUrl(sigDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[sigDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            firstPartySignature: url,
                            signatureUrl: url,
                        }));
                    }
                });
            }

            if (stampDoc && !initialStampUrl) {
                getViewUrl(stampDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[stampDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            secondPartyStamp: url,
                            stampUrl: url,
                        }));
                    }
                });
            }

            if (gpaStampDoc && !initialGpaStampUrl) {
                getViewUrl(gpaStampDoc.storage_path).then(url => {
                    if (url) {
                        urlCacheRef.current[gpaStampDoc.storage_path] = url;
                        setAgreementData(prev => ({
                            ...prev,
                            gpaStampUrl: url,
                        }));
                    }
                });
            }
        }
    }, [showAgreementPopup, editData, documents]);

    const handleGenerateAgreement = async () => {
        // Find signature, stamp and GPAE stamp documents
        const sigDoc = documents.find(d => 
            d.doc_type === 'signature_pic' || 
            d.doc_type === 'signature' || 
            d.doc_type === 'firstPartySignature' || 
            d.doc_type === 'customer_signature'
        );
        const stampDoc = documents.find(d => 
            d.doc_type === 'stamp' || 
            d.doc_type === 'stamp_pic' || 
            d.doc_type === 'vendor_stamp' || 
            d.doc_type === 'secondPartyStamp'
        );
        const gpaStampDoc = documents.find(d => 
            d.doc_type === 'pm_surya_ghar_stamp' || 
            d.doc_type === 'surya_ghar_stamp' || 
            d.doc_type === 'ghar_stamp'
        );

        let sigUrl = sigDoc ? (urlCacheRef.current[sigDoc.storage_path] || await getViewUrl(sigDoc.storage_path)) : '';
        let stampUrl = stampDoc ? (urlCacheRef.current[stampDoc.storage_path] || await getViewUrl(stampDoc.storage_path)) : '';
        let gpaStampUrl = gpaStampDoc ? (urlCacheRef.current[gpaStampDoc.storage_path] || await getViewUrl(gpaStampDoc.storage_path)) : '';

        if (sigDoc && sigUrl) urlCacheRef.current[sigDoc.storage_path] = sigUrl;
        if (stampDoc && stampUrl) urlCacheRef.current[stampDoc.storage_path] = stampUrl;
        if (gpaStampDoc && gpaStampUrl) urlCacheRef.current[gpaStampDoc.storage_path] = gpaStampUrl;

        const rawDate = editData.stages_remarks?.discom_agreement_date || new Date().toISOString().split('T')[0];
        const formattedDate = formatDateToDDMMYYYY(rawDate);

        setAgreementData({
            executionDate: formattedDate,
            consumerName: editData.customer_name || '',
            consumerNo: editData.consumer_no || '',
            village: editData.villages || '',
            taluka: editData.villages || '',
            district: editData.sub_divisions || '',
            vendorName: 'Watersun Electrical Solutions Pvt Ltd',
            vendorAddress: 'Plot No 40 GIDC Estate Radhanpur',
            paymentTerms: 'Mutually Agreed Terms of Payment',
            firstPartySignature: sigUrl || '',
            secondPartyStamp: stampUrl || './stamp.png',
            secondPartySignature: '',
            signatureUrl: sigUrl || '',
            stampUrl: stampUrl || './stamp.png',
            gpaStampUrl: gpaStampUrl || '',
            highlightColor: '#fef08a',
            showHighlights: true,
        });

        setShowAgreementPopup(true);
    };
    const ACTION_COLORS = {
        create: 'bg-emerald-100 text-emerald-700', update: 'bg-blue-100 text-blue-700',
        delete: 'bg-rose-100 text-rose-700', stage_change: 'bg-amber-100 text-amber-700',
        note: 'bg-indigo-100 text-indigo-700',
    };

    const fetchLogs = useCallback(async () => {
        const { data } = await supabase.from('activity_log').select('*, profiles(name)')
            .or(`new_value.eq.${customer.id},message.ilike.%${customer.customer_name}%`)
            .order('created_at', { ascending: false }).limit(25);
        if (data) setActivityLogs(data);
    }, [customer.id, customer.customer_name]);

    const urlCacheRef = useRef({});

    useEffect(() => {
        if (customer?.id) {
            getCustomerDocuments(customer.id).then(docs => {
                setDocuments(docs);
            });
        }
    }, [customer?.id]);

    const handleFileUpload = async (e, docType = null, replacingDocId = null) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            // Delete old document if replacing or if field already had a document
            if (replacingDocId) {
                const oldDoc = documents.find(d => d.id === replacingDocId);
                if (oldDoc) {
                    deleteDocument(oldDoc.id, oldDoc.storage_path);
                }
            } else if (docType) {
                const existingDocs = documents.filter(d => d.doc_type === docType);
                for (const oldDoc of existingDocs) {
                    deleteDocument(oldDoc.id, oldDoc.storage_path);
                }
            }

            const newDoc = await uploadDocument(file, customer.id, docType, user?.id);
            if (newDoc) {
                setDocuments(prev => [
                    newDoc,
                    ...prev.filter(d => replacingDocId ? d.id !== replacingDocId : (docType ? d.doc_type !== docType : true))
                ]);
                // Pre-cache the new doc URL
                getViewUrl(newDoc.storage_path).then(url => {
                    if (url) urlCacheRef.current[newDoc.storage_path] = url;
                });
                // Automatically mark checklist field as true and persist
                if (docType) {
                    setEditData(prev => ({ ...prev, [docType]: true }));
                    onUpdate(customer.id, { [docType]: true }).catch(console.error);
                }
                logActivity(
                    user.id,
                    'update',
                    `${customer.customer_name}: Uploaded document (${file.name})`,
                    '',
                    customer.id
                ).catch(console.error);
                fetchLogs();
            }
        } catch (err) {
            console.error('Document upload failed:', err);
            showAlert('Document upload failed: ' + (err.message || 'Please check your connection and try again.'), { type: 'error' });
        } finally {
            setUploading(false);
            if (e.target) e.target.value = '';
        }
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

    const handlePreviewDoc = async (doc) => {
        // Use cached URL if available (instant), otherwise fetch
        let url = urlCacheRef.current[doc.storage_path];
        if (!url) {
            url = await getViewUrl(doc.storage_path);
            if (url) urlCacheRef.current[doc.storage_path] = url;
        }
        if (url) setFilePreview({ doc, url });
    };

    const handleDeleteDoc = async (doc) => {
        deleteDocument(doc.id, doc.storage_path);
        setDocuments(prev => prev.filter(d => d.id !== doc.id));
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Deleted document (${doc.file_name})`,
            '',
            customer.id
        );
        fetchLogs();
    };

    const handleUpdateDocRemark = async (docId, newRemark) => {
        await updateDocumentRemark(docId, newRemark);
        setDocuments(prev => prev.map(d => d.id === docId ? { ...d, remark: newRemark } : d));
        const docObj = documents.find(d => d.id === docId);
        const fileName = docObj?.file_name || 'Document';
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Document remark update (${fileName}) - "${newRemark}"`,
            '',
            customer.id
        );
        fetchLogs();
    };

    const REG_CHECKLIST_FIELDS = [
        'adhaar_card_front',
        'adhaar_card_back',
        'pan_card',
        'light_bill',
        'index_2',
        'bank_details',
        'house_geo_tag_photo',
        'extra_docs',
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

        await handleSectionUpdate(customer.id, patch);
        if (changes.length > 0) {
            await logActivity(user.id, 'update', `${customer.customer_name}: Registration checklist update - ${changes.join(' | ')}`, '', customer.id);
        }
        fetchLogs();
    };

    const OPERATIONAL_CHECKLIST_FIELDS = [
        'warranty_card',
        'insurance_status',
    ];

    const isOperationalChecklistDirty = OPERATIONAL_CHECKLIST_FIELDS.some(field => {
        return !!editData[field] !== !!customer[field];
    });

    const handleSaveOperationalChecklist = async () => {
        const patch = {};
        const changes = [];
        OPERATIONAL_CHECKLIST_FIELDS.forEach(field => {
            const oldCheck = !!customer[field];
            const newCheck = !!editData[field];
            if (oldCheck !== newCheck) {
                patch[field] = newCheck;
                changes.push(`${field}: ${oldCheck ? 'Checked' : 'Unchecked'} → ${newCheck ? 'Checked' : 'Unchecked'}`);
            }
        });

        await handleSectionUpdate(customer.id, patch);
        if (changes.length > 0) {
            await logActivity(user.id, 'update', `${customer.customer_name}: Operational checklist update - ${changes.join(' | ')}`, '', customer.id);
        }
        fetchLogs();
    };

    useEffect(() => {
        setEditData(prev => {
            // On first mount or customer ID change, do a full reset
            if (!prev || prev.id !== customer.id) {
                prevCustomerRef.current = customer;
                return { ...customer };
            }
            // Smart merge: only update fields user hasn't locally changed
            const merged = { ...prev };
            const prevCust = prevCustomerRef.current;
            for (const key of Object.keys(customer)) {
                // If the field in prev still matches the OLD customer value
                // (i.e. user didn't touch it), accept the new server value
                const prevVal = prev[key];
                const oldCustVal = prevCust?.[key];
                // Use JSON.stringify for objects/arrays (e.g. subsidy_history)
                const isSame = typeof prevVal === 'object' && prevVal !== null
                    ? JSON.stringify(prevVal) === JSON.stringify(oldCustVal)
                    : prevVal === oldCustVal;
                if (isSame) {
                    merged[key] = customer[key];
                }
                // Otherwise keep the user's local edit (prev[key])
            }
            // Also bring in any new keys from server that weren't in prev
            for (const key of Object.keys(customer)) {
                if (!(key in merged)) {
                    merged[key] = customer[key];
                }
            }
            prevCustomerRef.current = customer;
            return merged;
        });
        fetchLogs();
    }, [customer]);






    const handleSaveStageRemark = async (stageId) => {
        const targetStage = stageId || editData.stage;
        const currentRemark = getStageRemarkFromData(editData.stages_remarks, targetStage);
        const originalRemark = getStageRemarkFromData(customer.stages_remarks, targetStage);

        if (currentRemark !== originalRemark) {
            let prevObj = {};
            if (typeof customer.stages_remarks === 'object' && customer.stages_remarks) {
                prevObj = customer.stages_remarks;
            } else if (typeof customer.stages_remarks === 'string') {
                try {
                    const parsed = JSON.parse(customer.stages_remarks);
                    if (typeof parsed === 'object' && parsed) prevObj = parsed;
                } catch (ex) { /* not valid JSON, fall through to default */ }
            }
            const updatedRemarks = {
                ...prevObj,
                [targetStage]: currentRemark
            };

            // Append the remark update to internal_remarks
            let updatedInternalRemarks = editData.internal_remarks || '';
            const formattedTime = formatDateTime(new Date());
            const appendText = `${targetStage} (${formattedTime}): ${currentRemark.trim() || 'Remark cleared'}`;
            updatedInternalRemarks = updatedInternalRemarks
                ? `${updatedInternalRemarks}\n${appendText}`
                : appendText;

            setEditData(prev => ({
                ...prev,
                stages_remarks: updatedRemarks,
                internal_remarks: updatedInternalRemarks
            }));

            await handleSectionUpdate(customer.id, {
                stages_remarks: updatedRemarks,
                internal_remarks: updatedInternalRemarks
            });

            await logActivity(
                user.id,
                'update',
                `${customer.customer_name}: Stage remark update for ${targetStage} - "${currentRemark}"`,
                '',
                customer.id
            );
            fetchLogs();
        }
    };

    const handleChange = (field, val) => {
        if (field === 'driver_phone_number' || field === 'phone_number') {
            const clean = String(val).replace(/[^0-9]/g, '');
            val = clean.length === 11 && clean.startsWith('0') ? clean.slice(1) : clean.slice(0, 10);
        }
        setEditData(prev => {
            const next = { ...prev, [field]: val };
            setIsFormDirty(getChangedFields(next, savedDataRef.current).size > 0);
            return next;
        });
    };

    // Child tabs have their own Save buttons. Once one succeeds, merge only
    // that saved patch into the baseline and keep the popup active solely for
    // any other fields that are still genuinely unsaved.
    const handleSectionUpdate = async (id, patch) => {
        const result = await onUpdate(id, patch);
        if (result === false) return false;
        savedDataRef.current = { ...savedDataRef.current, ...patch };
        setEditData(previous => {
            const next = { ...previous, ...patch };
            setIsFormDirty(getChangedFields(next, savedDataRef.current).size > 0);
            return next;
        });
        return result;
    };

    const hasNextStage = (() => {
        const currentIdx = PRIMARY_STAGES.findIndex(s => s.id === editData.stage);
        if (currentIdx === -1) return false;
        if (editData.stage === STAGE_IDS.COMPLETED || editData.stage === STAGE_IDS.LOST_PROJECT || editData.stage === 'HOLD PROCUREMENT') return false;

        let nextIdx = currentIdx + 1;
        if (nextIdx >= PRIMARY_STAGES.length) return false;

        let nextStage = PRIMARY_STAGES[nextIdx];
        if (nextStage.id === STAGE_IDS.LOAN && editData.payment_type?.trim().toLowerCase() === 'cash') {
            nextIdx++;
        }
        if (nextStage.id === STAGE_IDS.CASH && editData.payment_type?.trim().toLowerCase() === 'loan') {
            nextIdx++;
        }
        if (nextIdx < PRIMARY_STAGES.length && (PRIMARY_STAGES[nextIdx].id === 'HOLD PROCUREMENT' || PRIMARY_STAGES[nextIdx].id === STAGE_IDS.LOST_PROJECT)) {
            nextIdx++;
        }

        return nextIdx < PRIMARY_STAGES.length && PRIMARY_STAGES[nextIdx].id !== STAGE_IDS.LOST_PROJECT && PRIMARY_STAGES[nextIdx].id !== 'HOLD PROCUREMENT';
    })();

    const nextStageId = (() => {
        const currentIdx = PRIMARY_STAGES.findIndex(s => s.id === editData.stage);
        if (currentIdx === -1) return null;
        if (editData.stage === STAGE_IDS.COMPLETED || editData.stage === STAGE_IDS.LOST_PROJECT || editData.stage === 'HOLD PROCUREMENT') return null;

        let nextIdx = currentIdx + 1;
        if (nextIdx >= PRIMARY_STAGES.length) return null;

        let nextStage = PRIMARY_STAGES[nextIdx];
        if (nextStage.id === STAGE_IDS.LOAN && editData.payment_type?.trim().toLowerCase() === 'cash') {
            nextIdx++;
        }
        if (nextStage.id === STAGE_IDS.CASH && editData.payment_type?.trim().toLowerCase() === 'loan') {
            nextIdx++;
        }
        if (nextIdx < PRIMARY_STAGES.length && (PRIMARY_STAGES[nextIdx].id === 'HOLD PROCUREMENT' || PRIMARY_STAGES[nextIdx].id === STAGE_IDS.LOST_PROJECT)) {
            nextIdx++;
        }

        if (nextIdx < PRIMARY_STAGES.length && PRIMARY_STAGES[nextIdx].id !== STAGE_IDS.LOST_PROJECT && PRIMARY_STAGES[nextIdx].id !== 'HOLD PROCUREMENT') {
            return PRIMARY_STAGES[nextIdx].id;
        }
        return null;
    })();

    const nextStageLabel = nextStageId ? PRIMARY_STAGES.find(s => s.id === nextStageId)?.label : '';

    const isLeadFieldsFilled = !!(
        editData.customer_name?.trim() &&
        editData.phone_number?.toString().trim() &&
        (editData.email_address?.trim() || editData.email_address?.trim()) &&
        editData.consumer_no?.toString().trim() &&
        editData.villages?.trim() &&
        editData.channel_partner?.trim() &&
// editData.sub_channel_partner?.trim() && // Sub Channel Partner is optional
        editData.module_brand?.trim() &&
        editData.module_wp?.toString().trim() &&
        editData.no_of_modules?.toString().trim() &&
        editData.system_capacity_kwp &&
        editData.sub_divisions?.trim() &&
        editData.payment_type?.trim()
    );

    const hasFeasibilityDoc = documents.some(d => d.doc_type === 'feasibilty_document' || d.doc_type === 'feasibility_document') || !!editData.feasibilty_document;
    const hasSubsidyTokenDoc = documents.some(d => d.doc_type === 'subsidy_token_photo') || !!editData.subsidy_token_photo;
    const hasApplicationAcknowledgment = documents.some(d => d.doc_type === 'application_acknowledgment') || !!editData.application_acknowledgment;
    const hasVendorFeasibility = documents.some(d => d.doc_type === 'vendor_feasibility') || !!editData.vendor_feasibility;
    const hasSiteFeasibility = documents.some(d => d.doc_type === 'site_feasibility') || !!editData.site_feasibility;
    const isRegistrationFieldsFilled = !!(
        editData.registration_date &&
        editData.registration_by?.trim() &&
        (editData.registration_no?.toString().trim() || editData.feasibility_no?.toString().trim()) &&
        editData.folder_no?.toString().trim()
    );
    const isRegistrationReady = isRegistrationFieldsFilled && hasFeasibilityDoc && hasSubsidyTokenDoc && hasApplicationAcknowledgment;

    const isMaterialOrderFilled = Boolean(
        editData.roof_shed &&
        editData.dc_cable && Number(parseIndianNumber(editData.dc_cable)) > 0 &&
        editData.ac_cable && Number(parseIndianNumber(editData.ac_cable)) > 0 &&
        String(editData.structure_front_leg_height || '').trim() &&
        String(editData.structure_rear_leg_height || '').trim() &&
        editData.invoice_value && Number(parseIndianNumber(editData.invoice_value)) > 0
    );

    const getMissingStageRequirements = () => {
        const issues = [];
        const requireField = (condition, label) => { if (!condition) issues.push(label); };

        switch (editData.stage) {
            case STAGE_IDS.LEADS:
                requireField(editData.customer_name?.trim(), 'Customer Name');
                requireField(editData.phone_number?.toString().trim(), 'Phone Number');
                requireField(editData.consumer_no?.toString().trim(), 'Consumer Number');
                requireField(editData.villages?.trim(), 'Village / Address');
                requireField(editData.channel_partner?.trim(), 'Channel Partner Name');
                requireField(editData.module_brand?.trim(), 'Module Brand');
                requireField(editData.module_wp?.toString().trim(), 'Module WP');
                requireField(editData.no_of_modules?.toString().trim(), 'Number of Modules');
                requireField(editData.system_capacity_kwp, 'System Capacity');
                requireField(editData.sub_divisions?.trim(), 'Sub Division');
                requireField(editData.payment_type?.trim(), 'Payment Type');
                break;
            case STAGE_IDS.REGISTRATION:
                requireField(editData.registration_date, 'Registration Date');
                requireField(editData.registration_by?.trim(), 'Registration By');
                requireField(editData.registration_no?.toString().trim() || editData.feasibility_no?.toString().trim(), 'Feasibility No');
                requireField(editData.folder_no?.toString().trim(), 'File No');
                requireField(hasFeasibilityDoc, 'Feasibility Document');
                requireField(hasSubsidyTokenDoc, 'Subsidy Token Photo');
                requireField(hasApplicationAcknowledgment, 'Application Acknowledgment');
                break;
            case STAGE_IDS.LOAN:
                requireField(hasVendorFeasibility, 'Vendor Feasibility');
                requireField(hasSiteFeasibility, 'Site Feasibility');
                break;
            case STAGE_IDS.MATERIAL_ORDER:
                requireField(editData.roof_shed, 'Roof / Shed');
                requireField(editData.dc_cable && Number(parseIndianNumber(editData.dc_cable)) > 0, 'DC Cable Length');
                requireField(editData.ac_cable && Number(parseIndianNumber(editData.ac_cable)) > 0, 'AC Cable Length');
                requireField(String(editData.structure_front_leg_height || '').trim(), 'Structure Front Leg Height');
                requireField(String(editData.structure_rear_leg_height || '').trim(), 'Structure Rear Leg Height');
                requireField(editData.invoice_value && Number(parseIndianNumber(editData.invoice_value)) > 0, 'Invoice Value');
                break;
            case STAGE_IDS.MATERIAL_INTEGRATION:
                requireField(editData.inverter_make?.trim(), 'Inverter Make');
                requireField(editData.inverter_serial_no?.trim(), 'Inverter Serial Number');
                requireField(
                    Array.isArray(editData.panel_serial_no)
                        ? editData.panel_serial_no.some(Boolean)
                        : String(editData.panel_serial_no || '').trim(),
                    'At Least One Panel Serial Number'
                );
                break;
            case STAGE_IDS.MATERIAL_DELIVERY:
                requireField(editData.vendor?.trim(), 'Vendor Allotment');
                requireField(editData.invoice_no?.trim(), 'Invoice Number');
                requireField(editData.material_delivery_date, 'Delivery Date');
                requireField(editData.driver_name?.trim(), 'Driver Name');
                requireField(editData.driver_phone_number?.toString().trim(), 'Driver Phone Number');
                break;
            case STAGE_IDS.INSTALLATION_STATUS:
                requireField(editData.installation_status === 'Yes', 'Installation Status must be Yes');
                break;
            case STAGE_IDS.GEO_TAG_PHOTO:
                requireField(editData.geo_tag_status === 'Proceed', 'Geo Tag Photo Status must be Proceed');
                requireField(editData.geo_tag_image, 'Geo Tag Photograph');
                break;
            case STAGE_IDS.METER_INSTALLATION:
                requireField(editData.meter_installation === 'Yes', 'Meter Installation Status must be Yes');
                requireField(editData.installation_date, 'Meter Installation Date');
                requireField(editData.meter_installation_photo, 'Meter Installation Photo');
                break;
            case STAGE_IDS.DISCOM_INSPECTION:
                requireField(editData.discom_inspection === 'Yes', 'Discom Inspection Status must be Yes');
                break;
            default:
                break;
        }

        return issues;
    };

    const showMissingRequirements = (issues) => {
        setValidationIssues(issues);
        setShowValidationModal(true);
    };

    const handleBypassValidationAndAdvance = async () => {
        setShowValidationModal(false);
        setValidationIssues([]);
        const destStageId = nextStageId;
        if (!destStageId) return;

        setSaving(true);
        const oldStage = editData.stage;
        let prevObj = {};
        if (typeof editData.stages_remarks === 'object' && editData.stages_remarks) {
            prevObj = editData.stages_remarks;
        }
        const updatedRemarks = {
            ...prevObj,
            [oldStage]: ''
        };

        const updates = {
            ...editData,
            stage: destStageId,
            stages_remarks: updatedRemarks
        };

        setEditData(updates);
        await onUpdate(customer.id, updates);
        await logActivity(
            user.id,
            'update',
            `${customer.customer_name}: Stage changed to ${destStageId} (Quick Bypass & Auto-fill)`,
            `Moved from ${oldStage} to ${destStageId}`,
            customer.id
        );
        setActiveTab(destStageId);
        setSaved(true);
        setSaving(false);
    };

    const handleAdvanceStage = async (overrideNextStageId) => {
        const destStageId = overrideNextStageId || nextStageId;
        if (!destStageId) return;

        const missingRequirements = getMissingStageRequirements();
        if (missingRequirements.length > 0) {
            showMissingRequirements(missingRequirements);
            return;
        }

        setSaving(true);
        if (saveBomRef.current) {
            try {
                const wasSaved = await saveBomRef.current();
                if (wasSaved === false) {
                    setSaving(false);
                    showAlert('Failed to save the Material Integration BOM, so the stage was not advanced. Please try again.', { type: 'error' });
                    return;
                }
            } catch (err) {
                console.error('Error saving BOM during stage advance:', err);
                setSaving(false);
                showAlert('Failed to save the Material Integration BOM, so the stage was not advanced: ' + (err.message || 'Unknown error'), { type: 'error' });
                return;
            }
        }

        if (editData.stage === STAGE_IDS.MATERIAL_INTEGRATION) {
            const { data: bomData } = await supabase
                .from('bom')
                .select('paper_prepared_by, paper_prepared_date, material_loaded_by, material_loaded_date')
                .eq('admin_id', customer.id)
                .maybeSingle();

            if (!bomData || !bomData.paper_prepared_by || !bomData.paper_prepared_date || !bomData.material_loaded_by || !bomData.material_loaded_date) {
                const missingMilestones = [];
                if (!bomData?.paper_prepared_by) missingMilestones.push('Paper Prepared By');
                if (!bomData?.paper_prepared_date) missingMilestones.push('Paper Prepared Date');
                if (!bomData?.material_loaded_by) missingMilestones.push('Material Loaded By');
                if (!bomData?.material_loaded_date) missingMilestones.push('Material Loaded Date');
                showMissingRequirements(missingMilestones);
                setSaving(false);
                return;
            }
        }

        const oldStage = editData.stage;
        let prevObj = {};
        if (typeof editData.stages_remarks === 'object' && editData.stages_remarks) {
            prevObj = editData.stages_remarks;
        } else if (typeof editData.stages_remarks === 'string') {
            try {
                const parsed = JSON.parse(editData.stages_remarks);
                if (typeof parsed === 'object' && parsed) prevObj = parsed;
            } catch (e) { /* not valid JSON, fall through to default */ }
        }
        const updatedRemarks = {
            ...prevObj,
            [oldStage]: ''
        };

        const updates = {
            ...editData,
            stage: destStageId,
            stages_remarks: updatedRemarks
        };

        if (updates.system_capacity_kwp !== undefined && updates.system_capacity_kwp !== null && updates.system_capacity_kwp !== '') {
            updates.system_capacity_kwp = String(parseIndianNumber(updates.system_capacity_kwp));
        }
        if (updates.module_wp !== undefined && updates.module_wp !== null && updates.module_wp !== '') {
            updates.module_wp = String(parseIndianNumber(updates.module_wp));
        }
        if (updates.no_of_modules !== undefined && updates.no_of_modules !== null && updates.no_of_modules !== '') {
            updates.no_of_modules = String(parseIndianNumber(updates.no_of_modules));
        }
        if (updates.invoice_value !== undefined && updates.invoice_value !== null && updates.invoice_value !== '') {
            updates.invoice_value = String(parseIndianNumber(updates.invoice_value));
        }
        if (updates.dc_cable !== undefined && updates.dc_cable !== null && updates.dc_cable !== '') {
            updates.dc_cable = String(parseIndianNumber(updates.dc_cable));
        }
        if (updates.ac_cable !== undefined && updates.ac_cable !== null && updates.ac_cable !== '') {
            updates.ac_cable = String(parseIndianNumber(updates.ac_cable));
        }

        if (destStageId === STAGE_IDS.LOST_PROJECT || destStageId === 'HOLD PROCUREMENT') {
            const prevHold = (typeof updates.hold_procurement === 'object' && updates.hold_procurement) ? updates.hold_procurement : {};
            updates.hold_procurement = {
                ...prevHold,
                previous_stage: (oldStage !== STAGE_IDS.LOST_PROJECT && oldStage !== 'HOLD PROCUREMENT') ? oldStage : (prevHold.previous_stage || STAGE_IDS.LEADS),
                hold_date: new Date().toISOString().split('T')[0]
            };
        }

        if (destStageId === STAGE_IDS.METER_INSTALLATION) {
            const currentMeter = updates.meter_installation || {};
            updates.meter_installation = {
                status: currentMeter.status || 'No',
                no_date: currentMeter.no_date || new Date().toISOString().split('T')[0],
                yes_date: currentMeter.yes_date || null
            };
        }

        if (destStageId === STAGE_IDS.DISCOM_INSPECTION) {
            if (!updates.discom_inspection) {
                updates.discom_inspection = 'No';
            }
        }

        if (updates.subsidy_history) {
            updates.subsidy_history = updates.subsidy_history.map(({ isNew, ...rest }) => rest);
        }
        if (updates.loan_history) {
            updates.loan_history = updates.loan_history.map(({ isNew, ...rest }) => rest);
        }

        let changeSummary = [];
        Object.keys(updates).forEach(key => {
            if (updates[key] !== customer[key] && key !== 'id' && key !== 'created_at' && key !== 'crn' && key !== 'updated_at' && key !== 'stage' && key !== 'stages_remarks' && typeof updates[key] !== 'object') {
                changeSummary.push(`${key.replace(/_/g, ' ').toUpperCase()}: ${customer[key] || 'None'} → ${updates[key] || 'None'}`);
            }
        });

        delete updates.id;
        delete updates.created_at;
        delete updates.crn;
        delete updates.updated_at;

        setEditingSection(null);
        setEditData(updates);
        setActiveTab(destStageId);
        
        // Fire and forget in the background to avoid 2-second UI freeze
        (async () => {
            const promises = [
                onUpdate(customer.id, updates),
                logActivity(user.id, 'stage_change', `${customer.customer_name}: STAGE: ${oldStage} → ${destStageId}`, '', customer.id)
            ];
            if (changeSummary.length > 0) {
                promises.push(logActivity(user.id, 'update', `${customer.customer_name}: ${changeSummary.join(' | ')}`, '', customer.id));
            }
            await Promise.all(promises);
            fetchLogs();
        })().catch(err => {
            console.error("Background save error:", err);
            showAlert("Warning: the stage change may not have saved correctly (" + (err.message || "unknown error") + "). Please refresh and verify before continuing.", { type: 'error' });
        });
        setSaving(false);
    };


    const handleSave = async () => {
        setSaving(true);
        if (saveBomRef.current) {
            try {
                const bomSaved = await saveBomRef.current();
                if (bomSaved === false) throw new Error('The BOM could not be saved.');
            } catch (err) {
                console.error('Error saving BOM during handleSave:', err);
                showAlert(`Your BOM was not saved. Please try again.\n\n${err.message || ''}`, { type: 'error' });
                setSaving(false);
                return false;
            }
        }
        const updates = { ...editData };

        if (updates.system_capacity_kwp !== undefined && updates.system_capacity_kwp !== null && updates.system_capacity_kwp !== '') {
            updates.system_capacity_kwp = String(parseIndianNumber(updates.system_capacity_kwp));
        }
        if (updates.module_wp !== undefined && updates.module_wp !== null && updates.module_wp !== '') {
            updates.module_wp = String(parseIndianNumber(updates.module_wp));
        }
        if (updates.no_of_modules !== undefined && updates.no_of_modules !== null && updates.no_of_modules !== '') {
            updates.no_of_modules = String(parseIndianNumber(updates.no_of_modules));
        }
        if (updates.invoice_value !== undefined && updates.invoice_value !== null && updates.invoice_value !== '') {
            updates.invoice_value = String(parseIndianNumber(updates.invoice_value));
        }
        if (updates.dc_cable !== undefined && updates.dc_cable !== null && updates.dc_cable !== '') {
            updates.dc_cable = String(parseIndianNumber(updates.dc_cable));
        }
        if (updates.ac_cable !== undefined && updates.ac_cable !== null && updates.ac_cable !== '') {
            updates.ac_cable = String(parseIndianNumber(updates.ac_cable));
        }
        if (updates.vendor_quote !== undefined && updates.vendor_quote !== null && updates.vendor_quote !== '') {
            updates.vendor_quote = String(parseIndianNumber(updates.vendor_quote));
        } else if (updates.vendor_quote === '') {
            updates.vendor_quote = null;
        }

        let changeSummary = [];
        Object.keys(updates).forEach(key => {
            if (updates[key] !== customer[key] && key !== 'id' && key !== 'updated_at' && typeof updates[key] !== 'object') {
                changeSummary.push(`${key.replace(/_/g, ' ').toUpperCase()}: ${customer[key] || 'None'} → ${updates[key] || 'None'}`);
            }
        });

        if (updates.subsidy_history) {
            updates.subsidy_history = updates.subsidy_history.map(({ isNew, ...rest }) => rest);
        }
        if (updates.loan_history) {
            updates.loan_history = updates.loan_history.map(({ isNew, ...rest }) => rest);
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

        // Compare loan_history
        const oldLoan = customer.loan_history || [];
        const newLoan = updates.loan_history || [];
        if (JSON.stringify(oldLoan) !== JSON.stringify(newLoan)) {
            const loanChanges = [];
            if (newLoan.length === 0 && oldLoan.length > 0) {
                loanChanges.push("Cleared all loan entries");
            } else {
                const maxLen = Math.max(oldLoan.length, newLoan.length);
                for (let i = 0; i < maxLen; i++) {
                    const oldItem = oldLoan[i];
                    const newItem = newLoan[i];
                    if (!oldItem && newItem) {
                        loanChanges.push(`Added Entry ${i + 1} (${newItem.status}${newItem.date ? ` on ${newItem.date}` : ''}${newItem.remark ? `: ${newItem.remark}` : ''})`);
                    } else if (oldItem && !newItem) {
                        loanChanges.push(`Removed Entry ${i + 1} (${oldItem.status})`);
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
                            loanChanges.push(`Updated Entry ${i + 1} (${diffs.join(', ')})`);
                        }
                    }
                }
            }
            if (loanChanges.length > 0) {
                changeSummary.push(`LOAN STATUS: ${loanChanges.join(' | ')}`);
            }
        }

        // We do not run safeParse here because regular save should allow partial/invalid data to be saved as drafts.
        // Validation only happens strictly when advancing stages.

        const stageChanged = editData.stage !== customer.stage;
        delete updates.id; delete updates.created_at; delete updates.crn; delete updates.updated_at;
        
        try {
            const promises = [onUpdate(customer.id, updates)];
            if (changeSummary.length > 0) promises.push(logActivity(user.id, 'update', `${customer.customer_name}: ${changeSummary.join(' | ')}`, '', customer.id));
            const [updateResult] = await Promise.all(promises);
            if (updateResult === false) throw new Error('The database did not accept the changes.');

            savedDataRef.current = { ...savedDataRef.current, ...updates };
            setEditingSection(null);
            setIsFormDirty(false);
            setSaved(true);
            if (stageChanged) setActiveTab(editData.stage);
            // The customer update is already confirmed. Refreshing the activity
            // list does not need to delay Save & Close.
            void fetchLogs();
            return true;
        } catch (err) {
            console.error('Save failed:', err);
            showAlert(`Your changes were not saved. Please try again.\n\n${err.message || ''}`, { type: 'error' });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleAddNote = async () => {
        if (!followUpText.trim()) return;
        const updatedNotes = [...(editData.follow_ups || []), { text: followUpText, author: user.name, date: new Date().toISOString() }];
        await handleSectionUpdate(customer.id, { follow_ups: updatedNotes });
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

    const isDirty = (() => {
        if (!customer || !editData) return false;
        
        const ignoreKeys = new Set(['id', 'created_at', 'updated_at', 'crn']);
        for (const key of Object.keys(editData)) {
            if (ignoreKeys.has(key)) continue;
            let val1 = editData[key];
            let val2 = customer[key];
            
            // Handle booleans vs null/undefined (e.g. false vs null, checklist items)
            if (typeof val1 === 'boolean' || typeof val2 === 'boolean') {
                if (Boolean(val1) !== Boolean(val2)) return true;
                continue;
            }

            // Normalize empty / null / undefined values
            const isVal1Empty = val1 === undefined || val1 === null || val1 === '';
            const isVal2Empty = val2 === undefined || val2 === null || val2 === '';
            if (isVal1Empty && isVal2Empty) continue;

            if (typeof val1 === 'object' || typeof val2 === 'object') {
                if (JSON.stringify(val1 ?? null) !== JSON.stringify(val2 ?? null)) return true;
            } else {
                const str1 = val1 !== undefined && val1 !== null ? String(val1).trim() : '';
                const str2 = val2 !== undefined && val2 !== null ? String(val2).trim() : '';
                if (str1 !== str2) return true;
            }
        }
        return false;
    })();

    const SectionHeader = ({ title, id, icon: Icon }) => (
        <div className="flex items-center justify-between mb-3 border-b border-stone-100 pb-1.5 mt-4">
            <h3 className="text-[9px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-2">
                <Icon size={12} /> {title}
            </h3>
            {isEditable && (
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

    const tabProps = {
        activeTab, customer: savedDataRef.current, editData, setEditData: handleEditDataChange, handleChange,
        isEditable, editingSection, setEditingSection, channel_partners, subAgents, isAdmin, 
        isOffice, meta, user, isRegChecklistDirty, handleSaveRegChecklist, 
        isOperationalChecklistDirty, handleSaveOperationalChecklist, documents, 
        uploading, 
        onFileUpload: handleFileUpload, 
        onUpload: handleFileUpload,
        onFileDelete: handleDeleteDoc, 
        onDelete: handleDeleteDoc,
        onDeleteDocument: handleDeleteDoc,
        onFilePreview: handlePreviewDoc, 
        onPreview: handlePreviewDoc,
        onViewDocument: handlePreviewDoc,
        onDownloadDocument: handleDownloadDoc,
        onFileDownload: handleDownloadDoc,
        onDownload: handleDownloadDoc,
        onUpdateRemark: handleUpdateDocRemark, 
        onUpdate: handleSectionUpdate, logActivity, fetchLogs, saving, setSaving, handleAdvanceStage,
        saveBomRef, onDirty: () => setIsFormDirty(true), onGenerateAgreement: handleGenerateAgreement,
        isInstallationDetailsEditable,
        isSfdcEditable: isEditable,
        onSfdcSaved: () => {
            if (isChannelPartnerManager) setIsFormDirty(false);
        }
    };

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
                    <div className="flex items-center gap-2">
                        {/* Admin unlock/lock toggle for completed cards */}
                        {isCompleted && isAdmin && (
                            <button onClick={() => { setAdminUnlocked(prev => !prev); setEditingSection(null); }}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all ${adminUnlocked ? 'bg-amber-500 text-white hover:bg-amber-600 shadow-lg shadow-amber-500/30' : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white'}`}>
                                {adminUnlocked ? <><Lock size={12} /> Re-lock</> : <><Unlock size={12} /> Unlock to Edit</>}
                            </button>
                        )}
                        {isAdmin && <button onClick={() => setShowDeleteConfirm(true)} className="p-2 text-white/30 hover:text-red-400"><Trash2 size={18} /></button>}
                        <button onClick={async () => {
                            if (isFormDirty) {
                                const shouldSave = await showConfirm('You have unsaved changes. Save them before closing?', { title: 'Unsaved changes', confirmLabel: 'Save & Close', cancelLabel: 'Keep Editing', type: 'success' });
                                if (!shouldSave || !(await handleSave())) return;
                            }
                            onClose();
                        }} className="p-2 text-white/30 hover:text-white"><X size={24} /></button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex bg-stone-900 px-6 gap-6 border-t border-white/5 flex-shrink-0 overflow-x-auto scrollbar-none whitespace-nowrap">
                    {[
                        ...PRIMARY_STAGES.filter(s => {
                            if (s.id === STAGE_IDS.LOAN && editData.payment_type?.trim().toLowerCase() === 'cash') return false;
                            if (s.id === STAGE_IDS.CASH && editData.payment_type?.trim().toLowerCase() === 'loan') return false;
                            if (s.id === STAGE_IDS.COMPLETED || s.id === STAGE_IDS.LOST_PROJECT) return false;
                            return true;
                        }).map(s => ({ id: s.id, label: s.label, icon: s.icon })),
                        { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen },
                        { id: 'history', label: 'Notes & History', icon: History },
                    ].map(tab => (
                        <button key={tab.id} onClick={async () => {
                            if (tab.id !== activeTab && isFormDirty) {
                            const shouldSave = await showConfirm('You have unsaved changes. Save them before continuing?', { title: 'Unsaved changes', confirmLabel: 'Save & Continue', cancelLabel: 'Keep Editing', type: 'success' });
                            if (!shouldSave || !(await handleSave())) return;
                            }
                            setActiveTab(tab.id); setEditingSection(null);
                        }}
                            className={`flex items-center gap-2 py-3 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 flex-shrink-0 ${activeTab === tab.id ? 'text-amber-400 border-amber-400' : 'text-stone-500 border-transparent hover:text-stone-300'}`}>
                            <tab.icon size={12} /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-6 bg-[#FCFBFA]">

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
                                <p className="text-xs font-bold text-amber-700">Admin edit mode - Record unlocked</p>
                                <p className="text-[10px] text-amber-500">Click "Re-lock" when done to freeze the record again</p>
                            </div>
                        </div>
                    )}

                    {isStageRestrictedForUser && (
                        <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl mb-6 border bg-amber-50/70 border-amber-200/80 text-amber-950">
                            <Eye className="w-4 h-4 text-amber-600 flex-shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs font-bold text-amber-900">View-Only Stage</p>
                                <p className="text-[10px] text-amber-700 font-medium">Channel Partner Office and Channel Partner Manager accounts have view-only access to Material Integration and Material Delivery.</p>
                            </div>
                        </div>
                    )}

                    {activeTab !== 'history' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            {/* Primary Stage Info */}
                            <div className={`p-4 rounded-2xl border shadow-sm ${isCompleted ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-stone-100'} flex flex-col justify-between`}>
                                <div>
                                    <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Primary Stage</label>
                                    <div className="flex items-center gap-3 min-h-[38px]">
                                        <div className="text-xs text-stone-850 font-bold px-3 py-1.5 bg-stone-50 border border-stone-100 rounded-xl flex items-center gap-1.5">
                                            {PRIMARY_STAGES.find(s => s.id === editData.stage)?.label || editData.stage}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Stage Remark */}
                            <div className="bg-white p-4 rounded-2xl border border-stone-100 shadow-sm flex flex-col justify-between">
                                <div>
                                    <label className="text-[9px] text-stone-400 font-bold uppercase mb-2 block">Stage Remark (Current Stage)</label>
                                    {!canAddRemark ? (
                                        <div className="text-xs text-stone-500 font-medium italic min-h-[38px] bg-stone-50 p-2 rounded-lg">
                                            {(typeof editData.stages_remarks === 'object' && editData.stages_remarks ? editData.stages_remarks[editData.stage] : '') || 'No remarks for this stage.'}
                                        </div>
                                    ) : (
                                        (() => {
                                            const curRemark = getStageRemarkFromData(editData.stages_remarks, editData.stage);
                                            const origRemark = getStageRemarkFromData(customer.stages_remarks, customer.stage);
                                            const isRemarkDirty = (curRemark || '').trim() !== (origRemark || '').trim();

                                            return (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Add remark for current stage..."
                                                        value={curRemark}
                                                        onChange={e => {
                                                            const newVal = e.target.value;
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
                                                        onClick={() => handleSaveStageRemark()}
                                                        disabled={!isRemarkDirty}
                                                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                                                            !isRemarkDirty
                                                                ? 'bg-emerald-600 text-white cursor-default'
                                                                : 'bg-stone-900 text-white hover:bg-stone-800 cursor-pointer'
                                                        }`}
                                                    >
                                                        {!isRemarkDirty ? 'Saved' : 'Save'}
                                                    </button>
                                                </div>
                                            );
                                        })()
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <CustomerModalTabsRouter {...tabProps} />

                    {/* ── DOCUMENTS ── */}
                    {activeTab === "DOCUMENTS" && (
                        <CustomerDocumentsTab
                            documents={documents}
                            isEditable={isEditable}
                            canDelete={canDeleteDocs}
                            docSearchQuery={docSearchQuery}
                            setDocSearchQuery={setDocSearchQuery}
                            uploading={uploading}
                            handleFileUpload={handleFileUpload}
                            getDocTypeLabel={getDocTypeLabel}
                            handlePreviewDoc={handlePreviewDoc}
                            handleDeleteDoc={handleDeleteDoc}
                            handleUpdateDocRemark={handleUpdateDocRemark}
                        />
                    )}

                    {/* ── NOTES & HISTORY ── */}
                    {activeTab === 'history' && (
                        <HistoryTab
                            editData={editData}
                            handleChange={handleChange}
                            isEditable={isEditable}
                            editingSection={editingSection}
                            setEditingSection={setEditingSection}
                            followUpText={followUpText}
                            setFollowUpText={setFollowUpText}
                            handleAddNote={handleAddNote}
                            activityLogs={activityLogs}
                        />
                    )}

                    {isEditable && activeTab !== STAGE_IDS.LOST_PROJECT && activeTab !== 'HOLD PROCUREMENT' && activeTab !== 'DOCUMENTS' && activeTab !== 'history' && customer.stage !== STAGE_IDS.COMPLETED && (
                        <div className="mt-8 pt-4 border-t border-stone-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-50/70 p-3.5 rounded-2xl border border-stone-200/60">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg flex-shrink-0">
                                    <PauseCircle size={16} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-stone-700">Need to mark as lost project or put on hold?</p>
                                    <p className="text-[11px] text-stone-500 font-medium">Classify this project as lost with origin stage details & audit notes.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setActiveTab(STAGE_IDS.LOST_PROJECT)}
                                className="px-3.5 py-2 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold border border-stone-200 transition-colors shadow-2xs self-start sm:self-auto cursor-pointer"
                            >
                                Move to Lost Project
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer bar - 50/50 split buttons at customer card */}
                {isEditable && activeTab !== STAGE_IDS.LOST_PROJECT && activeTab !== 'HOLD PROCUREMENT' && (
                    <div className="p-4 border-t border-stone-100 bg-white flex-shrink-0 flex gap-3">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className={`flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs cursor-pointer shadow-sm disabled:opacity-50 ${
                                isFormDirty
                                    ? 'bg-stone-900 text-white hover:bg-stone-800'
                                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                        >
                            {saving ? (
                                'Saving...'
                            ) : isFormDirty ? (
                                <>
                                    <Save size={14} />
                                    <span>Save</span>
                                </>
                            ) : (
                                <>
                                    <Check size={14} className="text-white" />
                                    <span>Saved</span>
                                </>
                            )}
                        </button>

                        {/* Restored: removed in rd48, leaving hasNextStage / nextStageId /
                            nextStageLabel / handleAdvanceStage all in place but unreachable,
                            so no role could advance a customer from the modal. */}
                        {hasNextStage && activeTab === customer.stage && (
                            <button
                                onClick={() => {
                                    if (nextStageId === STAGE_IDS.COMPLETED) {
                                        setShowCompletedConfirm(true);
                                    } else {
                                        handleAdvanceStage();
                                    }
                                }}
                                disabled={saving}
                                className="flex-1 py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all text-xs bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-500/10 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {saving ? 'Saving & Moving...' : `Save & Move to ${nextStageLabel}`}
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Soft-delete confirm */}
            {showValidationModal && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm" onClick={() => setShowValidationModal(false)}>
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
                            <p className="text-sm font-medium leading-relaxed text-stone-600">Complete the required items below before moving this customer to <span className="font-bold text-stone-800">{nextStageLabel}</span>.</p>
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
                            </div>
                        </div>
                    </section>
                </div>
            )}

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

            {/* Move-to-Completed lock confirm */}
            {showCompletedConfirm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-full"><Lock className="w-5 h-5 text-amber-600" /></div>
                            <h3 className="font-bold text-stone-800">Mark as Completed?</h3>
                        </div>
                        <p className="text-sm text-stone-600 mb-5">
                            Moving <strong>{customer.customer_name}</strong> to Completed will lock this record. Only an admin will be able to unlock it for further edits. Do you want to proceed?
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowCompletedConfirm(false)} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
                            <button
                                onClick={() => {
                                    setShowCompletedConfirm(false);
                                    handleAdvanceStage();
                                }}
                                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2"
                            >
                                <Lock className="w-4 h-4" /> Proceed & Lock
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* PM Surya Ghar Agreement Popup Modal */}
            {showAgreementPopup && (
                <AgreementPreview
                    data={agreementData}
                    onChange={setAgreementData}
                    onClose={() => setShowAgreementPopup(false)}
                />
            )}

            {/* File Preview Modal */}
            {filePreview.doc && (
                <FilePreviewModal
                    file={filePreview.doc}
                    fileUrl={filePreview.url}
                    onClose={() => setFilePreview({ doc: null, url: null })}
                    onDownload={() => handleDownloadDoc(filePreview.doc)}
                />
            )}
        </div>
    );
}
