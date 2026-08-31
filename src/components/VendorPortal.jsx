import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { supabase } from '../supabase';
import { logActivity, uploadDocument, getCustomerDocuments, getViewUrl, deleteDocument, toIndianCommas, updateDocumentRemark, normalizeInstallationStatus, updateAdminRecord } from '../utils';
import { 
    User, Phone, Mail, MapPin, Zap, Building2, CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle, AlertTriangle,
    Hash, Folder, Tag, ChevronLeft, Search, ClipboardList, Banknote, Calendar, ClipboardCheck,
    Camera, Paperclip, Eye, Upload, Image as ImageIcon, X,
    Printer, ShoppingBag, Layers, Ruler, IndianRupee, Package, FileText, Truck, Check, Wrench, RefreshCw, Save, Terminal
} from 'lucide-react';
import { FilePreviewModal } from './modal-tabs/shared';
import { ROOF_BOM_TEMPLATE, SHED_BOM_TEMPLATE, STAGE_IDS, PRIMARY_STAGES, INSTALLATION_TAGS, isFinalTagValue } from '../constants';
import { isReturnedDocument } from './modal-tabs/shared';
import { useGlobalPopup } from './GlobalPopup';
import BrandMark from './BrandMark';

const parsePanelSerials = (raw) => {
    if (!raw) return [''];
    if (Array.isArray(raw)) return raw.length > 0 ? raw : [''];
    if (typeof raw !== 'string') raw = String(raw);
    
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
    } catch { /* not valid JSON, fall through to default */ }

    if (raw.includes('\n')) {
        return raw.split('\n').map(s => String(s).trim()).filter(Boolean);
    }
    if (raw.includes(',')) {
        return raw.split(',').map(s => String(s).trim()).filter(Boolean);
    }
    return [raw.trim()];
};

export default function VendorPortal({ user, onLogout, onOpenDevSwitcher }) {
    const { showAlert, showConfirm } = useGlobalPopup();
    const [view, setView] = useState('list'); // 'list', 'details'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [refreshingAssignments, setRefreshingAssignments] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    // Material Integration and Material Delivery are intentionally hidden from vendors.
    const [activeTab, setActiveTab] = useState('DELIVERY'); // 'DELIVERY', 'INSTALLATION', 'GEO'
    const [selectedCust, setSelectedCust] = useState(null);
    const vendorIsFutureTab = useMemo(() => {
        const TAB_STAGE_MAP = { MATERIAL: STAGE_IDS.MATERIAL_INTEGRATION, DELIVERY: STAGE_IDS.MATERIAL_DELIVERY, INSTALLATION: STAGE_IDS.INSTALLATION_STATUS, GEO: STAGE_IDS.GEO_TAG_PHOTO };
        const currentStageIdx = PRIMARY_STAGES.findIndex(s => s.id === selectedCust?.stage);
        const tabStageIdx = PRIMARY_STAGES.findIndex(s => s.id === TAB_STAGE_MAP[activeTab]);
        return currentStageIdx !== -1 && tabStageIdx !== -1 && tabStageIdx > currentStageIdx;
    }, [selectedCust?.stage, activeTab]);
    
    // Edit Form State (for selected customer)
    const [geoTagStatus, setGeoTagStatus] = useState('Pending');
    const [geoTagImage, setGeoTagImage] = useState(false);
    const [installationStatus, setInstallationStatus] = useState('Pending');
    const [installationDate, setInstallationDate] = useState('');
    const [vendorNote, setVendorNote] = useState('');
    
    // Material Delivery State
    const [inverterSerialNo, setInverterSerialNo] = useState('');
    const [invoiceNo, setInvoiceNo] = useState('');
    const [driverName, setDriverName] = useState('');
    const [driverPhone, setDriverPhone] = useState('');
    const [panelSerials, setPanelSerials] = useState(['']);
    
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Document attachments state
    const [documents, setDocuments] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);
    // Set when replacing a photo that Admin/Office sent back.
    const replacingPhotoRef = useRef(null);

    // BOM Print Modal for Vendor (Read-Only)
    const [showBomModal, setShowBomModal] = useState(false);
    const [targetBomCust, setTargetBomCust] = useState(null);
    const [bomData, setBomData] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [loadingBom, setLoadingBom] = useState(false);
    const vendorBomPrintRef = useRef(null);

    // Give Up Project Modal state
    const [showGiveUpModal, setShowGiveUpModal] = useState(false);
    const [giveUpReason, setGiveUpReason] = useState('');
    const [givingUp, setGivingUp] = useState(false);


    // Fetch BOM for Print (Read-Only)
    const handleOpenBomModal = async (cust) => {
        const target = cust || selectedCust;
        if (!target?.id) return;
        setTargetBomCust(target);
        setShowBomModal(true);
        setLoadingBom(true);
        try {
            const { data: bom, error: bomErr } = await supabase
                .from('bom')
                .select('*')
                .eq('admin_id', target.id)
                .maybeSingle();

            // A failed query used to leave `bom` null, which fell through to the
            // "no BOM yet" branch below and showed a blank template - identical
            // to a customer who genuinely has no BOM. The vendor had no way to
            // tell a load failure from an empty materials list.
            if (bomErr) throw bomErr;

            if (bom) {
                setBomData(bom);
                const { data: items, error: itemsErr } = await supabase
                    .from('bom_items')
                    .select('*')
                    .eq('bom_id', bom.id)
                    .order('sr_no', { ascending: true });
                if (itemsErr) throw itemsErr;
                setBomItems(items || []);
            } else {
                const template = (target.roof_shed || '').toLowerCase().includes('shed') ? SHED_BOM_TEMPLATE : ROOF_BOM_TEMPLATE;
                setBomData({
                    bom_type: target.roof_shed || 'Roof',
                    paper_prepared_by: '',
                    material_loaded_by: ''
                });
                setBomItems(template.map((t, idx) => ({
                    sr_no: idx + 1,
                    product_name: t.product_name,
                    make: t.default_make || 'Standard',
                    uom: t.uom || 'Nos',
                    integration_by: t.default_integration || 'Vendor',
                    note: ''
                })));
            }
        } catch (e) {
            console.error('Error fetching BOM for vendor:', e);
            showAlert(
                'The Bill of Materials could not be loaded, so a blank template is being shown. Do not treat this as the final materials list - please retry or contact the office.',
                { title: 'BOM not loaded', type: 'error' }
            );
            const template = (target.roof_shed || '').toLowerCase().includes('shed') ? SHED_BOM_TEMPLATE : ROOF_BOM_TEMPLATE;
            setBomData({ bom_type: target.roof_shed || 'Roof' });
            setBomItems(template.map((t, idx) => ({
                sr_no: idx + 1,
                product_name: t.product_name,
                make: t.default_make || 'Standard',
                uom: t.uom || 'Nos',
                integration_by: t.default_integration || 'Vendor',
                note: ''
            })));
        } finally {
            setLoadingBom(false);
        }
    };

    // Keep the read-only Material Integration reference card current without
    // forcing the vendor to open the print preview first.
    useEffect(() => {
        if (activeTab !== 'MATERIAL' || !selectedCust?.id) return;
        let cancelled = false;

        supabase
            .from('bom')
            .select('*')
            .eq('admin_id', selectedCust.id)
            .maybeSingle()
            .then(({ data }) => {
                if (!cancelled) setBomData(data || null);
            });

        return () => { cancelled = true; };
    }, [activeTab, selectedCust?.id]);

    const handlePrintVendorBom = () => {
        const documentBody = vendorBomPrintRef.current;
        if (!documentBody) return;

        const cleanName = String(targetBomCust?.customer_name || 'Customer').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanRef = String(targetBomCust?.folder_no || targetBomCust?.consumer_no || 'Site').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docTitle = `BOM_Vendor_Dispatch_${cleanName}_${cleanRef}`;
        const prevDocTitle = document.title;

        // Remove any old print portal
        const existing = document.getElementById('native-print-portal');
        if (existing) existing.remove();

        const printPortal = document.createElement('div');
        printPortal.id = 'native-print-portal';
        printPortal.innerHTML = documentBody.innerHTML;
        document.body.appendChild(printPortal);

        document.body.classList.add('is-printing-document');
        document.title = docTitle;

        const cleanup = () => {
            document.body.classList.remove('is-printing-document');
            document.title = prevDocTitle;
            if (document.body.contains(printPortal)) {
                document.body.removeChild(printPortal);
            }
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup);

        setTimeout(() => {
            window.print();
            setTimeout(cleanup, 2000);
        }, 100);
    };

    const registeredVendorNamesRef = useRef([]);

    // Fetch customer leads strictly assigned to this vendor
    const userIdentifiers = useMemo(() => {
        return [
            user?.channel_partner,
            user?.name,
            user?.title,
            user?.email,
            (user?.email || '').toLowerCase().includes('deeproot') ? 'deeproot' : null,
            (user?.email || '').toLowerCase().includes('deeproot') ? 'test vendor' : null
        ].filter(Boolean).map(s => String(s).trim().toLowerCase());
    }, [user?.channel_partner, user?.name, user?.title, user?.email]);

    // Ownership must mean exactly what the RLS policy means:
    //   lower(trim(admin.vendor)) = lower(trim(get_my_name()))
    //
    // This used to match on substrings in BOTH directions, plus hardcoded demo
    // special-cases ('deeproot', 'test vendor'/'solar tech'), plus a catch-all:
    //   (target.includes('vendor') && custVendor.length > 0)
    // Because userIdentifiers includes the account's EMAIL, any vendor signed in
    // as something like vendor@company.com matched EVERY record that had any
    // vendor assigned - other vendors' jobs included. Writes to those records
    // were then refused by RLS with 0 rows and no error, so they also looked
    // saved and were not.
    const isRecordAssignedToVendor = useCallback((record) => {
        const custVendor = (record?.vendor || '').trim().toLowerCase();
        if (!custVendor) return false;

        const allTargets = [
            ...userIdentifiers,
            ...(registeredVendorNamesRef.current || [])
        ].filter(Boolean);

        return allTargets.some(id => custVendor === String(id).trim().toLowerCase());
    }, [userIdentifiers]);

    const fetchCustomers = useCallback(async ({ silent = false } = {}) => {
        if (silent) setRefreshingAssignments(true);
        else setLoading(true);

        try {
            const userEmail = (user?.email || '').trim().toLowerCase();
            const userName = (user?.name || '').trim();

            // Step 1: Get vendor names linked to this user from vendors table
            const { data: vRows } = await supabase
                .from('vendors')
                .select('name, email');

            const allVendorRows = vRows || [];
            const matchedVendorNames = allVendorRows
                .filter(v => {
                    const vEmail = (v.email || '').trim().toLowerCase();
                    const vName = (v.name || '').trim().toLowerCase();
                    return vEmail === userEmail || vName === userName.toLowerCase();
                })
                .map(v => (v.name || '').trim())
                .filter(Boolean);

            // Use profile name as fallback if not found in vendors table
            const searchNames = matchedVendorNames.length > 0 ? matchedVendorNames : (userName ? [userName] : []);

            if (searchNames.length === 0) {
                setCustomers([]);
                return;
            }

            // Step 2: Query admin table DIRECTLY using .in() for exact matches
            // We use .in() instead of .or() because it's much more reliable in Supabase
            let data = [];
            let from = 0;
            const pageSize = 1000;
            while (true) {
                const { data: page, error } = await supabase
                    .from('admin')
                    .select('*')
                    .in('vendor', searchNames)
                    .order('created_at', { ascending: false })
                    .range(from, from + pageSize - 1);
                if (error) throw error;
                if (!page || page.length === 0) break;
                data = data.concat(page);
                if (page.length < pageSize) break;
                from += pageSize;
            }
            
            // Client-side filtering to see if deleted_at or Give Up was hiding it
            const activeData = (data || []).filter(r => 
                r.deleted_at === null && r.installation_status !== 'Giveup'
            );

            console.log('[VendorPortal] Searching names:', searchNames, '| Total found:', (data || []).length, '| Active found:', activeData.length);
            if ((data || []).length > 0 && activeData.length === 0) {
                console.warn('[VendorPortal] WARNING: Records were found but ALL are either deleted or marked as Give Up!', data);
            }

            setCustomers(activeData);


        } catch (err) {
            console.error('Error fetching vendor customers:', err);
            setCustomers([]);
        } finally {
            if (silent) setRefreshingAssignments(false);
            else setLoading(false);
        }
    }, [user?.email, user?.name]);

    useEffect(() => {
        if (!user?.name && !user?.email) {
            setLoading(false);
            return;
        }

        fetchCustomers();

        const channel = supabase.channel(`vendor_customers_${user.id || 'vendor'}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'admin' }, payload => {
                const record = payload.new;
                const isVisibleToVendor = record && !record.deleted_at &&
                    isRecordAssignedToVendor(record) &&
                    // Tag id is 'Giveup' (no space) - "Give Up" never matched, so
                    // given-up records kept arriving through realtime.
                    normalizeInstallationStatus(record.installation_status) !== 'Give Up';

                setCustomers(previous => {
                    if (payload.eventType === 'DELETE' || !isVisibleToVendor) {
                        return previous.filter(customer => customer.id !== (record?.id || payload.old?.id));
                    }
                    const exists = previous.some(customer => customer.id === record.id);
                    if (payload.eventType === 'INSERT' && !exists) return [record, ...previous];
                    return previous.map(customer => customer.id === record.id ? record : customer);
                });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.name, user?.email, fetchCustomers, isRecordAssignedToVendor]);

    // Realtime is the primary update path. This lightweight fallback keeps
    // assignments current when a mobile browser temporarily drops that connection.
    useEffect(() => {
        if (!user?.name && !user?.email) return;

        const refreshAssignments = () => fetchCustomers({ silent: true });
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') refreshAssignments();
        };

        const refreshInterval = window.setInterval(refreshAssignments, 15000);
        window.addEventListener('focus', refreshAssignments);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.clearInterval(refreshInterval);
            window.removeEventListener('focus', refreshAssignments);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.name, user?.email, fetchCustomers]);

    // Sync selectedCust state with fresh database values when updates occur
    useEffect(() => {
        if (selectedCust) {
            const fresh = customers.find(c => c.id === selectedCust.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedCust)) {
                setSelectedCust(fresh);
            }
        }
    }, [customers]);

    // Handle selecting a customer card
    // Seeds every editable field from the stored record. Used when opening a
    // customer and when discarding unsaved changes.
    const hydrateFieldsFrom = (cust) => {
        if (!cust) return;
        setInverterSerialNo(cust.inverter_serial_no || '');
        setInvoiceNo(cust.invoice_no || '');
        setDriverName(cust.driver_name || '');
        setDriverPhone(cust.driver_phone_number || '');
        setPanelSerials(parsePanelSerials(cust.panel_serial_no));

        setGeoTagStatus(cust.geo_tag_status || 'Pending');
        setGeoTagImage(!!cust.geo_tag_image);

        setInstallationStatus(cust.installation_status || 'Pending');
        setInstallationDate(cust.installation_date || '');
        setVendorNote(cust.vendor_note || '');
    };

    const handleSelectCustomer = async (cust) => {
        setSelectedCust(cust);
        
        // Match active tab to the vendor-facing customer stage.
        if (cust.stage === STAGE_IDS.MATERIAL_DELIVERY) {
            setActiveTab('DELIVERY');
        } else if (cust.stage === STAGE_IDS.GEO_TAG_PHOTO) {
            setActiveTab('GEO');
        } else if (cust.stage === STAGE_IDS.INSTALLATION_STATUS) {
            setActiveTab('INSTALLATION');
        }

        hydrateFieldsFrom(cust);

        setView('details');
        setSaveSuccess(false);

        // Fetch customer documents
        try {
            const docs = await getCustomerDocuments(cust.id);
            setDocuments(docs || []);
        } catch (err) {
            console.error('Failed to fetch documents for customer:', err);
            setDocuments([]);
        }
    };

    // Upload geo tag photo handler
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCust) return;

        setUploadingPhoto(true);
        try {
            // Upload FIRST. Deleting the previous photo before the upload meant
            // a vendor on a flaky mobile connection lost the original with
            // nothing to fall back on.
            const newDoc = await uploadDocument(file, selectedCust.id, 'geo_tag_image', user?.id);

            if (newDoc) {
                const existingGeo = (documents || []).filter(d =>
                    (d.doc_type === 'geo_tag_image' || d.doc_type === 'geo_tag') && d.id !== newDoc.id);
                for (const oldDoc of existingGeo) {
                    try {
                        await deleteDocument(oldDoc);
                    } catch (delErr) {
                        console.warn('New geo tag photo saved, but removing the old one failed:', delErr);
                    }
                }
            }
            if (newDoc) {
                setDocuments(prev => [
                    newDoc,
                    ...(prev || []).filter(d => d.doc_type !== 'geo_tag_image' && d.doc_type !== 'geo_tag')
                ]);
                setGeoTagImage(true);
                
                const nextGeoStatus = geoTagStatus === 'Pending' ? 'Proceed' : geoTagStatus;
                // Unchecked before: the photo uploaded but the flag/status did
                // not save, and a missing geo_tag_image blocks the move to
                // Discom Submission - so the vendor was stuck with no reason given.
                const { ok: geoOk, error: geoErr } = await updateAdminRecord(selectedCust.id, {
                    geo_tag_image: true,
                    geo_tag_status: nextGeoStatus
                });
                if (!geoOk) throw geoErr;

                if (geoTagStatus === 'Pending') {
                    setGeoTagStatus('Proceed');
                }
                
                if (user?.id) {
                    void logActivity(
                        user.id,
                        'update',
                        `Vendor ${user.name || ''} uploaded Geo Tag Photo (${file.name})`,
                        '',
                        selectedCust.id
                    );
                }
            }
        } catch (err) {
            console.error('Error uploading geo photo:', err);
            showAlert('Failed to upload photo: ' + (err.message || err), {
                title: 'Upload Error',
                type: 'error'
            });
        } finally {
            const replaced = replacingPhotoRef.current;
            replacingPhotoRef.current = null;
            if (replaced) await handlePhotoDelete(replaced);
            setUploadingPhoto(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleUpdateDocRemark = async (docId, newRemark) => {
        try {
            await updateDocumentRemark(docId, newRemark);
            setDocuments(prev => (prev || []).map(d => d.id === docId ? { ...d, remark: newRemark } : d));
        } catch (err) {
            console.error('Failed to update remark:', err);
        }
    };

    // Removes the returned photo once its replacement has uploaded.
    const handlePhotoDelete = async (doc) => {
        try {
            await deleteDocument(doc);
            const remaining = (documents || []).filter(d => d.id !== doc.id);
            setDocuments(remaining);
            const hasOtherGeo = remaining.some(d => d.doc_type === 'geo_tag_image' || d.doc_type === 'geo_tag');
            if (!hasOtherGeo) {
                setGeoTagImage(false);
                const { ok: clearOk, error: clearGeoErr } = await updateAdminRecord(selectedCust.id, { geo_tag_image: false });
                if (!clearOk) throw clearGeoErr;
            }
        } catch (err) {
            console.error('Error deleting photo:', err);
            showAlert(err.message || 'Could not delete the selected photo.', {
                title: 'Delete Failed',
                type: 'error'
            });
        }
    };

    // Preview photo handler
    const handlePhotoPreview = async (doc) => {
        try {
            const url = await getViewUrl(doc.storage_path);
            if (url) {
                setPreviewDoc({ doc, url });
            }
        } catch (err) {
            console.error('Error loading preview:', err);
        }
    };

    const canMoveToGeoTag = normalizeInstallationStatus(installationStatus) === 'Yes';

    const isInstallationDirty = Boolean(
        String(installationStatus || 'Pending').trim() !== String(selectedCust?.installation_status || 'Pending').trim() ||
        String(installationDate || '').trim() !== String(selectedCust?.installation_date || '').trim() ||
        String(vendorNote || '').trim() !== String(selectedCust?.vendor_note || '').trim()
    );

    const isDeliveryDirty = Boolean(
        String(inverterSerialNo || '').trim() !== String(selectedCust?.inverter_serial_no || '').trim() ||
        String(invoiceNo || '').trim() !== String(selectedCust?.invoice_no || '').trim() ||
        String(driverName || '').trim() !== String(selectedCust?.driver_name || '').trim() ||
        String(driverPhone || '').trim() !== String(selectedCust?.driver_phone_number || '').trim() ||
        JSON.stringify(panelSerials.filter(Boolean)) !== JSON.stringify(parsePanelSerials(selectedCust?.panel_serial_no).filter(Boolean))
    );

    const isGeoTagDirty = Boolean(
        String(geoTagStatus || 'Pending').trim() !== String(selectedCust?.geo_tag_status || 'Pending').trim()
    );

    // Save changes to Supabase and optionally progress stage
    const handleSaveChanges = async (nextStage = null) => {
        const currentStage = String(selectedCust?.stage || '').toUpperCase().trim();
        const canEditCurrentTab =
            (activeTab === 'INSTALLATION' && currentStage === STAGE_IDS.INSTALLATION_STATUS) ||
            (activeTab === 'GEO' && currentStage === STAGE_IDS.GEO_TAG_PHOTO);

        if (!canEditCurrentTab) {
            showAlert('This stage is view-only until the office moves the customer to it.', {
                title: 'Stage Not Available Yet',
                type: 'warning'
            });
            return false;
        }

        const todayStr = new Date().toISOString().split('T')[0];
        const effectiveInstallDate = installationDate || (normalizeInstallationStatus(installationStatus) === 'Yes' ? todayStr : null);

        // Comprehensive Logical Validation when advancing from Installation to Geo Tag
        if (nextStage === STAGE_IDS.GEO_TAG_PHOTO) {
            const missingItems = [];
            if (normalizeInstallationStatus(installationStatus) !== 'Yes') {
                missingItems.push('Physical Installation Status must be marked "Yes".');
            }
            if (!effectiveInstallDate) {
                missingItems.push('Installation Date must be selected.');
            }

            if (missingItems.length > 0) {
                showAlert(`To move forward to Geo Tag Photo, please complete the following:\n\n• ${missingItems.join('\n• ')}`, {
                    title: 'Installation Incomplete',
                    type: 'warning'
                });
                return false;
            }
        }

        // Comprehensive Logical Validation when advancing from Geo Tag to Discom Submission
        if (nextStage === STAGE_IDS.DISCOM_SUBMISSION) {
            const missingItems = [];
            if (geoTagStatus !== 'Proceed') {
                missingItems.push('Geo Tag Photo Status must be set to "Proceed".');
            }
            const hasGeoTagPhoto = (documents || []).some(doc => doc.doc_type === 'geo_tag_image' || doc.doc_type === 'geo_tag');
            if (!hasGeoTagPhoto && !geoTagImage) {
                missingItems.push('Uploading a Geo-Tag site photograph is compulsory.');
            }

            if (missingItems.length > 0) {
                showAlert(`To move forward to Discom Submission, please complete the following:\n\n• ${missingItems.join('\n• ')}`, {
                    title: 'Geo Tag Report Incomplete',
                    type: 'warning'
                });
                return false;
            }
        }

        setSaving(true);
        setSaveSuccess(false);
        try {
            const updatePayload = activeTab === 'INSTALLATION'
                ? {
                    installation_status: installationStatus,
                    installation_date: effectiveInstallDate,
                    vendor_note: vendorNote || null,
                }
                : {
                    geo_tag_status: geoTagStatus,
                    geo_tag_image: geoTagImage,
                };

            if (nextStage) {
                updatePayload.stage = nextStage;
            }

            // Routed through the shared helper so this portal gets the same
            // protections as the main app: unknown columns stripped, '' turned
            // into null for numeric/date columns, and a 0-rows result treated
            // as a failure instead of a silent success.
            const { ok, error } = await updateAdminRecord(selectedCust.id, updatePayload);
            if (!ok) throw error;

            let logMsg = `Vendor ${user.name} updated ${
                activeTab === 'DELIVERY' 
                    ? 'Material Delivery Details' 
                    : activeTab === 'INSTALLATION'
                        ? 'Installation Status'
                        : 'Geo Tag Report'
            }`;
            if (nextStage) {
                logMsg += ` and advanced stage to ${nextStage}`;
            }

            if (user?.id) {
                void logActivity(
                    user.id,
                    'update',
                    `${selectedCust.customer_name}: ${logMsg}`,
                    '',
                    selectedCust.id
                );
            }
            
            setSaveSuccess(true);
            setCustomers(prev => prev.map(customer => customer.id === selectedCust.id ? { ...customer, ...updatePayload } : customer));
            
            setSelectedCust(prev => ({
                ...prev,
                ...updatePayload,
                stage: nextStage || prev.stage
            }));

            if (nextStage === STAGE_IDS.INSTALLATION_STATUS) {
                setActiveTab('INSTALLATION');
                setTimeout(() => setSaveSuccess(false), 3000);
            } else if (nextStage === STAGE_IDS.GEO_TAG_PHOTO) {
                setActiveTab('GEO');
                setTimeout(() => setSaveSuccess(false), 3000);
            } else if (nextStage === STAGE_IDS.DISCOM_SUBMISSION) {
                setTimeout(() => {
                    setView('list');
                }, 1200);
            } else {
                setTimeout(() => setSaveSuccess(false), 3000);
            }
            return true;
        } catch (err) {
            console.error('Failed to save details:', err);
            showAlert(`Error saving changes: ${err.message || err}`, {
                title: 'Database Error',
                type: 'error'
            });
            return false;
        } finally {
            setSaving(false);
        }
    };

    // Give Up Project handler
    const handleConfirmGiveUp = async () => {
        if (!selectedCust?.id) return;
        if (String(selectedCust.stage || '').toUpperCase().trim() !== STAGE_IDS.INSTALLATION_STATUS) {
            showAlert('This project can only be given up during the Installation stage.', {
                title: 'Action Not Available',
                type: 'warning'
            });
            return;
        }
        setGivingUp(true);
        try {
            const { ok, error } = await updateAdminRecord(selectedCust.id, {
                installation_status: 'Giveup',
                vendor_note: giveUpReason || null
            });
            if (!ok) throw error;

            if (user?.id) {
                void logActivity(
                    user.id,
                    'update',
                    `Vendor ${user.name} gave up installation for ${selectedCust.customer_name}${giveUpReason ? `: "${giveUpReason}"` : ''}`,
                    '',
                    selectedCust.id
                );
            }

            setShowGiveUpModal(false);
            setGiveUpReason('');
            setCustomers(prev => prev.filter(customer => customer.id !== selectedCust.id));
            setView('list');
        } catch (err) {
            console.error('Error giving up project:', err);
            showAlert(`Failed to record give up: ${err.message || err}`, {
                title: 'Submission Error',
                type: 'error'
            });
        } finally {
            setGivingUp(false);
        }
    };



    // Helper to normalize stages
    const normalizeStage = (st) => String(st || '').toUpperCase().trim();
    const selectedStage = normalizeStage(selectedCust?.stage);
    const canEditInstallation = selectedStage === STAGE_IDS.INSTALLATION_STATUS;
    const canEditGeoTag = selectedStage === STAGE_IDS.GEO_TAG_PHOTO;

    // Stats calculations
    const materialDeliveryCount = customers.filter(c => {
        const s = normalizeStage(c.stage);
        return s === STAGE_IDS.MATERIAL_DELIVERY || (s !== STAGE_IDS.INSTALLATION_STATUS && s !== STAGE_IDS.GEO_TAG_PHOTO);
    }).length;
    const installationCount = customers.filter(c => normalizeStage(c.stage) === STAGE_IDS.INSTALLATION_STATUS).length;
    const geoTagCount = customers.filter(c => normalizeStage(c.stage) === STAGE_IDS.GEO_TAG_PHOTO).length;

    // Filtered lists: search across all fields safely and across all stages if a query is typed
    const filteredCustomers = customers.filter(c => {
        const q = (searchQuery || '').trim().toLowerCase();
        
        const matchesSearch = !q || (
            String(c.customer_name || '').toLowerCase().includes(q) ||
            String(c.phone_number || '').toLowerCase().includes(q) ||
            String(c.consumer_no || '').toLowerCase().includes(q) ||
            String(c.folder_no || '').toLowerCase().includes(q) ||
            String(c.villages || '').toLowerCase().includes(q) ||
            String(c.inverter_serial_no || '').toLowerCase().includes(q) ||
            String(c.sub_channel_partner || '').toLowerCase().includes(q)
        );

        // If user is searching, return matches across all vendor stages!
        if (q) {
            return matchesSearch;
        }

        // When not searching, filter by active tab stage
        const s = normalizeStage(c.stage);
        if (activeTab === 'DELIVERY') {
            return s === STAGE_IDS.MATERIAL_DELIVERY || (s !== STAGE_IDS.INSTALLATION_STATUS && s !== STAGE_IDS.GEO_TAG_PHOTO);
        } else if (activeTab === 'INSTALLATION') {
            return s === STAGE_IDS.INSTALLATION_STATUS;
        } else {
            return s === STAGE_IDS.GEO_TAG_PHOTO;
        }
    });

    // Geo tag documents for current selected customer
    const geoDocs = documents.filter(d => d.doc_type === 'geo_tag_image' || d.doc_type === 'geo_tag');

    const saveBeforeVendorExit = async (confirmLabel) => {
        const hasChanges = (activeTab === 'INSTALLATION' && isInstallationDirty) || (activeTab === 'GEO' && isGeoTagDirty);
        if (!hasChanges) return true;
        const shouldSave = await showConfirm('You have unsaved changes. Save them before leaving?', {
            title: 'Unsaved changes',
            confirmLabel: 'Save & Leave',
            cancelLabel: 'Keep Editing',
            type: 'success'
        });
        if (!shouldSave) return false;
        return handleSaveChanges(null);
    };

    return (
        <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
            {/* Top Header */}
            <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <BrandMark label="Vendor Portal" />
                <div className="flex items-center gap-3">
                    <div className="text-right">
                        <span className="text-xs font-bold text-stone-800 block truncate max-w-[150px]">{user.name}</span>
                        {user.email && <span className="text-[10px] text-stone-400 font-medium block truncate max-w-[150px]">{user.email}</span>}
                    </div>
                    <button
                        type="button"
                        onClick={() => fetchCustomers({ silent: true })}
                        disabled={refreshingAssignments}
                        className="p-2 text-stone-400 hover:text-amber-600 transition-colors rounded-xl hover:bg-amber-50 disabled:opacity-50"
                        title="Refresh assignments"
                        aria-label="Refresh assignments"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshingAssignments ? 'animate-spin' : ''}`} />
                    </button>
                    {import.meta.env.DEV && onOpenDevSwitcher && (
                        <button
                            type="button"
                            onClick={onOpenDevSwitcher}
                            className="p-2 text-amber-600 hover:text-amber-700 transition-colors rounded-xl hover:bg-amber-50"
                            title="Open development role switcher"
                            aria-label="Open development role switcher"
                        >
                            <Terminal className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={async () => { if (await saveBeforeVendorExit('Save & Logout')) onLogout(); }}
                        className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-xl hover:bg-stone-50"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {view === 'list' ? (
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in fade-in duration-300">
                    {/* Welcome banner */}
                    <div className="bg-gradient-to-br from-stone-900 to-stone-850 text-white p-5 rounded-[24px] shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-[0.07]">
                            <BrandMark variant="white" size="lg" />
                        </div>
                        <div className="flex items-center justify-between gap-2">
                            <p className="text-[9px] uppercase tracking-widest text-amber-400 font-bold">Allotted Vendor</p>
                            {user.email && (
                                <span className="text-[10px] text-amber-200/90 font-mono bg-white/10 px-2 py-0.5 rounded-md border border-white/10">{user.email}</span>
                            )}
                        </div>
                        <h2 className="text-lg font-bold mt-1">{user.name}</h2>
                        <p className="text-[11px] text-stone-300 mt-2 font-medium">Manage assigned installation updates and site geo tagging.</p>
                    </div>

                    {/* Stats */}
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x">
                        <div
                            className={`min-w-[104px] flex-1 snap-start p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'DELIVERY' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`}
                            onClick={() => setActiveTab('DELIVERY')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'DELIVERY' ? 'text-amber-100' : 'text-stone-400'}`}>Delivery</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'DELIVERY' ? 'text-white' : 'text-stone-850'}`}>{materialDeliveryCount}</p>
                        </div>
                        <div
                            className={`min-w-[104px] flex-1 snap-start p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'INSTALLATION' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`}
                            onClick={() => setActiveTab('INSTALLATION')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'INSTALLATION' ? 'text-amber-100' : 'text-stone-400'}`}>Installation</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'INSTALLATION' ? 'text-white' : 'text-stone-850'}`}>{installationCount}</p>
                        </div>
                        <div 
                            className={`min-w-[104px] flex-1 snap-start p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'GEO' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`} 
                            onClick={() => setActiveTab('GEO')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'GEO' ? 'text-amber-100' : 'text-stone-400'}`}>Geo Tag</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'GEO' ? 'text-white' : 'text-stone-850'}`}>{geoTagCount}</p>
                        </div>
                    </div>

                    {/* Search across all stages */}
                    <div className="pt-1">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-stone-400 w-4.5 h-4.5" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, consumer no, serial..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-8 py-2.5 bg-white border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium shadow-xs"
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
                        {searchQuery.trim() && (
                            <div className="flex items-center justify-between text-[10px] text-stone-500 px-1 pt-1.5">
                                <span>Searching across all stages ({filteredCustomers.length} result{filteredCustomers.length === 1 ? '' : 's'})</span>
                                <button 
                                    onClick={() => setSearchQuery('')} 
                                    className="text-amber-600 font-bold hover:underline cursor-pointer"
                                >
                                    Reset
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Customers List */}
                    <div className="space-y-2.5 pt-1">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-stone-400">
                                <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-2" />
                                <p className="text-xs font-semibold">Loading assignments...</p>
                            </div>
                        ) : filteredCustomers.length > 0 ? (
                            filteredCustomers.map(cust => {
                                if (cust.stage === STAGE_IDS.MATERIAL_INTEGRATION) {
                                    return (
                                        <div 
                                            key={cust.id} 
                                            onClick={() => handleSelectCustomer(cust)}
                                            className="bg-white p-3.5 rounded-2xl border border-stone-150 shadow-sm hover:border-amber-400 hover:shadow-md transition-all space-y-2.5 cursor-pointer active:scale-[0.99] group"
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-xs font-bold text-stone-900 truncate group-hover:text-amber-600 transition-colors">{cust.customer_name}</h4>
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-md">
                                                            {cust.system_capacity_kwp ? `${cust.system_capacity_kwp} kWp` : 'BOM Ready'}
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-stone-400 font-medium truncate">{cust.villages || 'Address not specified'}</p>
                                                    <div className="flex flex-wrap gap-2 text-[9px] text-stone-500 pt-0.5">
                                                        {cust.consumer_no && <span>Consumer: <b>{cust.consumer_no}</b></span>}
                                                        {cust.folder_no && <span>Folder: <b>{cust.folder_no}</b></span>}
                                                        {cust.roof_shed && <span>Type: <b>{cust.roof_shed}</b></span>}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                                                <span className="text-[9px] font-bold text-stone-400 flex items-center gap-1">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                    Open BOM details or print
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenBomModal(cust);
                                                    }}
                                                    className="text-[10px] font-bold uppercase tracking-wide text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Printer size={11} /> Print BOM
                                                </button>
                                            </div>
                                        </div>
                                    );
                                }

                                if (cust.stage === STAGE_IDS.MATERIAL_DELIVERY) {
                                    const panels = parsePanelSerials(cust.panel_serial_no).filter(Boolean);
                                    return (
                                        <div 
                                            key={cust.id} 
                                            onClick={() => handleSelectCustomer(cust)}
                                            className="bg-white p-3.5 rounded-2xl border border-stone-150 shadow-sm hover:border-amber-400 hover:shadow-md transition-all space-y-2 cursor-pointer active:scale-[0.99] group"
                                        >
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="space-y-1 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-xs font-bold text-stone-900 truncate group-hover:text-amber-600 transition-colors">{cust.customer_name}</h4>
                                                        <span className="text-[8px] font-black uppercase px-1.5 py-0.5 bg-blue-100 text-blue-800 rounded-md">
                                                            Delivery Stage
                                                        </span>
                                                    </div>
                                                    <p className="text-[10px] text-stone-400 font-medium truncate">{cust.villages || 'Address not specified'}</p>
                                                    <div className="flex flex-wrap gap-2 text-[9px] text-stone-500 pt-0.5">
                                                        {cust.consumer_no && <span>Cons: <b>{cust.consumer_no}</b></span>}
                                                        {cust.inverter_serial_no && <span>Inv: <b>{cust.inverter_serial_no}</b></span>}
                                                        <span>Panels: <b>{panels.length} serials</b></span>
                                                    </div>
                                                </div>
                                                <ChevronRight className="w-4.5 h-4.5 text-stone-300 group-hover:text-stone-700 transition-colors flex-shrink-0" />
                                            </div>
                                        </div>
                                    );
                                }

                                const isInstallation = cust.stage === STAGE_IDS.INSTALLATION_STATUS;
                                const statusValue = isInstallation ? (cust.installation_status || 'Pending') : (cust.geo_tag_status || 'Pending');
                                const isComplete = isInstallation ? normalizeInstallationStatus(statusValue) === 'Yes' : statusValue === 'Proceed';

                                return (
                                    <div 
                                        key={cust.id} 
                                        onClick={() => handleSelectCustomer(cust)}
                                        className="bg-white p-4 rounded-2xl border border-stone-150 shadow-sm hover:border-amber-400 transition-all flex justify-between items-center cursor-pointer active:scale-[0.99] group"
                                    >
                                        <div className="space-y-1.5 min-w-0 pr-2">
                                            <p className="text-xs font-bold text-stone-850 truncate group-hover:text-amber-600 transition-colors">{cust.customer_name}</p>
                                            <p className="text-[10px] text-stone-400 font-medium truncate">
                                                {cust.villages || 'Address not specified'}
                                                {cust.consumer_no && ` • Cons: ${cust.consumer_no}`}
                                                {cust.phone_number && ` • Ph: ${cust.phone_number}`}
                                            </p>
                                            
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {searchQuery.trim() && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-900 text-white">
                                                        {cust.stage}
                                                    </span>
                                                )}
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isComplete ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                    {isInstallation ? 'Installation' : 'Geo'}: {statusValue}
                                                </span>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4.5 h-4.5 text-stone-300 group-hover:text-stone-700 transition-colors flex-shrink-0" />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white p-8 rounded-2xl border border-stone-100 text-center text-stone-400 shadow-sm">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                <p className="text-xs font-bold">No assigned installations found in this stage.</p>
                            </div>
                        )}
                    </div>
                </main>
            ) : (
                /* Customer Details & Editing View */
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={async () => {
                                const hasChanges = (activeTab === 'INSTALLATION' && isInstallationDirty) || (activeTab === 'GEO' && isGeoTagDirty);
                                if (hasChanges) {
                                    const shouldSave = await showConfirm('You have unsaved changes. Save them before going back?', { title: 'Unsaved changes', confirmLabel: 'Save & Back', cancelLabel: 'Keep Editing', type: 'success' });
                                    if (!shouldSave || !(await handleSaveChanges(null))) return;
                                }
                                setView('list');
                            }}
                            className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors py-1 cursor-pointer"
                        >
                            <ChevronLeft className="w-4.5 h-4.5" /> Back to Dashboard
                        </button>
                        {canEditInstallation && (
                            <button
                                type="button"
                                onClick={() => setShowGiveUpModal(true)}
                                className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                            >
                                <AlertTriangle size={12} className="text-rose-600" /> Give Up Project
                            </button>
                        )}
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <div className="border-b border-stone-100 pb-3">
                            <h2 className="text-base font-bold text-stone-850">{selectedCust.customer_name}</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-1">Consumer No: {selectedCust.consumer_no || '–'}</p>
                        </div>

                        {/* Stage Tabs inside Customer View */}
                        <div className="flex gap-1 overflow-x-auto p-1 bg-stone-100/80 rounded-xl border border-stone-200/60 snap-x">
                            {[
                                { id: 'DELIVERY', label: 'Delivery', icon: Truck },
                                { id: 'INSTALLATION', label: 'Installation', icon: Wrench },
                                { id: 'GEO', label: 'Geo Tag', icon: Camera },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isCurrent = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={async () => {
                                            const hasChanges = (activeTab === 'INSTALLATION' && isInstallationDirty) || (activeTab === 'GEO' && isGeoTagDirty);
                                            if (tab.id !== activeTab && hasChanges) {
                                                const shouldSave = await showConfirm('You have unsaved changes. Save them before continuing?', { title: 'Unsaved changes', confirmLabel: 'Save & Continue', cancelLabel: 'Keep Editing', type: 'success' });
                                                if (!shouldSave || !(await handleSaveChanges(null))) return;
                                            }
                                            setActiveTab(tab.id);
                                        }}
                                        className={`min-w-[82px] flex-1 snap-start py-1.5 px-2 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                            isCurrent
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'text-stone-500 hover:text-stone-800'
                                        }`}
                                    >
                                        <Icon size={11} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        <span className="sm:hidden">{tab.id === 'GEO' ? 'Geo' : 'Install'}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Editable Form Card */}
                        <div className="space-y-4">
                            {vendorIsFutureTab && (
                                <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 text-center">
                                    <p className="text-xs font-bold text-amber-800">This stage is view-only until the office moves the customer here.</p>
                                </div>
                            )}
                            <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-stone-100 pb-1.5">
                                {activeTab === 'DELIVERY' 
                                    ? 'Material Delivery Details' 
                                    : activeTab === 'INSTALLATION' 
                                        ? 'Installation Status & Details' 
                                        : activeTab === 'MATERIAL'
                                            ? 'Material Integration & BOM'
                                            : 'Geo Tag Photo Report'}
                            </h3>

                            {/* ─── Active Tab: MATERIAL INTEGRATION & BOM ─── */}
                            {activeTab === 'MATERIAL' && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-br from-amber-50/70 to-white p-4 shadow-xs">
                                        <div className="flex items-start justify-between gap-3 border-b border-amber-200/70 pb-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-amber-900">BOM Details</p>
                                                <p className="mt-0.5 text-[10px] font-medium text-stone-500">View the full material checklist, specifications, and signatures.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenBomModal(selectedCust)}
                                                className="shrink-0 rounded-xl bg-amber-500 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-white shadow-sm transition hover:bg-amber-600 cursor-pointer flex items-center gap-1.5"
                                            >
                                                <Printer size={12} /> View & Print
                                            </button>
                                        </div>
                                        <div className="space-y-4 pt-3">
                                            <div>
                                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-stone-400">Material Order Specifications <span className="ml-1 font-semibold normal-case tracking-normal">(View Only)</span></p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                    {[
                                                        ['Roof / Shed', selectedCust.roof_shed], ['DC Cable (Meters)', selectedCust.dc_cable], ['AC Cable (Meters)', selectedCust.ac_cable], ['Structure Front Leg Height (ft)', selectedCust.structure_front_leg_height], ['Structure Rear Leg Height (ft)', selectedCust.structure_rear_leg_height], ['Invoice Value (₹)', selectedCust.invoice_value ? `₹${toIndianCommas(selectedCust.invoice_value)}` : '–'], ['Notes / Special Instructions', selectedCust.material_order_notes],
                                                    ].map(([label, value]) => <div key={label}><p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="font-semibold text-stone-900">{value || '–'}</p></div>)}
                                                </div>
                                            </div>
                                            <div className="border-t border-amber-200/70 pt-3">
                                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-stone-400">Customer & Site Reference <span className="ml-1 font-semibold normal-case tracking-normal">(View Only)</span></p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                    {[
                                                        ['Customer Name', selectedCust.customer_name], ['Phone Number', selectedCust.phone_number], ['Email Address', selectedCust.email], ['Consumer No', selectedCust.consumer_no], ['Villages', selectedCust.villages], ['Sub Division', selectedCust.sub_divisions], ['Channel Partner Name', selectedCust.channel_partner], ['Dealer Name', selectedCust.sub_channel_partner], ['Module Brand', selectedCust.module_brand], ['Module WP', selectedCust.module_wp], ['No of Modules', selectedCust.no_of_modules], ['System Capacity (kWp)', selectedCust.system_capacity_kwp ? toIndianCommas(selectedCust.system_capacity_kwp) : '–'],
                                                    ].map(([label, value]) => <div key={label}><p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="font-semibold text-stone-900 break-words">{value || '–'}</p></div>)}
                                                </div>
                                            </div>
                                            <div className="border-t border-amber-200/70 pt-3">
                                                <p className="mb-2 text-[9px] font-black uppercase tracking-widest text-stone-400">Procurement & Loading Milestones <span className="ml-1 font-semibold normal-case tracking-normal">(View Only)</span></p>
                                                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                                    {[
                                                        ['Paper Prepared By', bomData?.paper_prepared_by], ['Paper Prepared Date', bomData?.paper_prepared_date], ['Material Loaded By', bomData?.material_loaded_by], ['Material Loaded Date', bomData?.material_loaded_date],
                                                    ].map(([label, value]) => <div key={label}><p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="font-semibold text-stone-900">{value || '–'}</p></div>)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Material Delivery is supplied by the office/logistics team.
                                Vendors can inspect every delivery field and copy serials, and proceed to installation. */}
                            {activeTab === 'DELIVERY' && (
                                <div className="space-y-4">
                                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-3 text-[11px] text-blue-800 font-medium flex items-center justify-between gap-2">
                                        <span>Material Delivery information is supplied by the dispatch team.</span>
                                        {selectedCust?.stage === STAGE_IDS.MATERIAL_DELIVERY && (
                                            <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[9px] font-bold uppercase tracking-wider">Awaiting Acknowledgment</span>
                                        )}
                                    </div>
                                    <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white px-4">
                                        {[
                                            ['Invoice No *', selectedCust.invoice_no],
                                            ['Delivery Date *', selectedCust.material_delivery_date],
                                            ['Vehicle / Truck No', selectedCust.vehicle_number],
                                            ['Driver Name *', selectedCust.driver_name],
                                            ['Driver Phone Number *', selectedCust.driver_phone_number],
                                        ].map(([label, value]) => (
                                            <div key={label} className="flex items-start justify-between gap-4 py-3 text-xs">
                                                <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">{label}</p>
                                                <p className="max-w-[58%] text-right font-semibold text-stone-800 break-words">{value || '–'}</p>
                                            </div>
                                        ))}
                                    </div>
                                    {saveSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                            <span>Stage updated successfully!</span>
                                        </div>
                                    )}

                                    <div className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-[10px] font-semibold text-stone-500">
                                        View only. The office will move this customer to Installation when delivery is complete.
                                    </div>
                                </div>
                            )}
                            
                            {/* ─── Active Tab: GEO TAG PHOTO ─── */}
                            {activeTab === 'GEO' && (
                                <div className="space-y-4">
                                    {/* Status selector */}
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                                            Geo Tag Photo Status
                                        </label>
                                        <div className="grid grid-cols-2 gap-2">
                                            {[
                                                { id: 'Proceed', label: 'Proceed', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                                                { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                                            ].map(tag => {
                                                const isSelected = geoTagStatus === tag.id;
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        disabled={!canEditGeoTag}
                                                        onClick={() => setGeoTagStatus(tag.id)}
                                                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed ${
                                                            isSelected
                                                                ? tag.activeClass
                                                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? tag.dotClass : 'bg-stone-300'}`} />
                                                        {tag.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Photo Upload Card */}
                                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/80 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Camera className="w-4 h-4 text-amber-500" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-stone-700 uppercase tracking-wide">Geo Tag Photograph</p>
                                                    <p className="text-[9px] text-stone-400 font-medium">Upload site photo with geo-coordinates.</p>
                                                </div>
                                            </div>

                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={handlePhotoUpload}
                                                className="hidden"
                                            />

                                            <button
                                                type="button"
                                                disabled={uploadingPhoto || !canEditGeoTag}
                                                onClick={() => fileInputRef.current?.click()}
                                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm shadow-amber-500/10 cursor-pointer disabled:opacity-50"
                                            >
                                                {uploadingPhoto ? (
                                                    <><Loader2 size={11} className="animate-spin" /> Uploading...</>
                                                ) : (
                                                    <><Camera size={11} /> Attach / Upload Photo</>
                                                )}
                                            </button>
                                        </div>

                                        {/* Attached Photos List */}
                                        {geoDocs.length > 0 ? (
                                            <div className="space-y-2 pt-1">
                                                {geoDocs.map(doc => (
                                                    <div key={doc.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-stone-200 shadow-xs">
                                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                                            <ImageIcon size={14} className="text-amber-500 flex-shrink-0" />
                                                            <span className="text-xs font-semibold text-stone-700 truncate">{doc.file_name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePhotoPreview(doc)}
                                                                className="text-stone-500 hover:text-stone-800 p-1 rounded-lg hover:bg-stone-100 transition cursor-pointer"
                                                                title="View full photo"
                                                            >
                                                                <Eye size={13} />
                                                            </button>
                                                            {/* An uploaded photo is locked. Admin or Office must send it
                                                                back before it can be replaced; there is no delete. */}
                                                            {isReturnedDocument(doc) ? (
                                                                <>
                                                                    <span className="text-[9px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">Returned</span>
                                                                    <button
                                                                        type="button"
                                                                        disabled={!canEditGeoTag}
                                                                        onClick={() => { replacingPhotoRef.current = doc; fileInputRef.current?.click(); }}
                                                                        className="text-blue-600 hover:text-blue-800 p-1 rounded-lg hover:bg-blue-50 transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                                                        title="Replace the returned photo"
                                                                    >
                                                                        <Upload size={13} />
                                                                    </button>
                                                                </>
                                                            ) : (
                                                                <span className="text-[9px] font-semibold text-stone-400 uppercase tracking-wide" title="Admin or Office must send this back before it can be replaced">
                                                                    Locked
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-stone-400 italic text-center py-2">
                                                No photo uploaded yet. Tap "Attach / Upload Photo" to add one.
                                            </p>
                                        )}
                                    </div>

                                    {saveSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                            <span>Geo Tag Report saved successfully!</span>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSaveChanges(STAGE_IDS.DISCOM_SUBMISSION)}
                                            disabled={saving || !canEditGeoTag || geoTagStatus !== 'Proceed' || geoDocs.length === 0 || vendorIsFutureTab}
                                            title={geoTagStatus !== 'Proceed' || geoDocs.length === 0 ? 'Set status to Proceed and upload a geo-tag photo first.' : undefined}
                                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving & Moving...</> : <><CheckCircle2 size={14} /> Save & Move to Discom Submission</>}
                                        </button>
                                        {(geoTagStatus !== 'Proceed' || geoDocs.length === 0) && (
                                            <p className="mt-2 text-center text-[10px] font-semibold text-rose-600">Set status to Proceed and upload a geo-tag photo to continue.</p>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving || !canEditGeoTag}
                                            className={`mt-2 w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                                                isGeoTagDirty
                                                    ? 'bg-stone-900 text-white hover:bg-stone-850'
                                                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                            }`}
                                        >
                                            {saving ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : isGeoTagDirty ? (
                                                <><Save size={13} /> Save Geo Tag Report Only</>
                                            ) : (
                                                <><Check size={13} /> Saved</>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* ─── Active Tab: INSTALLATION STATUS ─── */}
                            {activeTab === 'INSTALLATION' && (
                                <div className="space-y-4">
                                    {/* Status selector with Give Up in front */}
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                                            Physical Installation Status
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'Giveup', label: 'Giveup', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/10', dotClass: 'bg-white' },
                                                { id: 'Installed', label: 'Installed', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                                                { id: 'In process', label: 'In process', activeClass: 'bg-teal-600 text-white border-teal-600 shadow-md shadow-teal-600/10', dotClass: 'bg-white' },
                                                { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' }
                                            ].map(tag => {
                                                // Legacy rows hold 'Yes'/'Process'; normalise so an
                                                // existing record still shows its state as selected.
                                                const isSelected = normalizeInstallationStatus(installationStatus) === normalizeInstallationStatus(tag.id);
                                                const isLocked = isFinalTagValue(selectedCust?.installation_status, INSTALLATION_TAGS) && user?.userType !== 'admin';
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        disabled={isLocked || !canEditInstallation}
                                                        onClick={() => {
                                                            if (isLocked) return;
                                                            if (tag.id === 'Giveup') {
                                                                setShowGiveUpModal(true);
                                                            } else {
                                                                setInstallationStatus(tag.id);
                                                                if (tag.id === 'Installed' && !installationDate) {
                                                                    setInstallationDate(new Date().toISOString().split('T')[0]);
                                                                }
                                                            }
                                                        }}
                                                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                                                            isLocked && tag.id !== 'Installed' ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                                                        } ${
                                                            isSelected
                                                                ? tag.activeClass
                                                                : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                                        }`}
                                                    >
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? tag.dotClass : 'bg-stone-300'}`} />
                                                        {tag.label}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1">
                                            <label className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider">Installation Note</label>
                                            <textarea
                                                rows={2}
                                                value={vendorNote}
                                                onChange={event => setVendorNote(event.target.value)}
                                                disabled={!canEditInstallation}
                                                placeholder="Add installation notes or a site update"
                                                className="w-full resize-none bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>

                                    {/* When marked Yes: Installation Date */}
                                    {normalizeInstallationStatus(installationStatus) === 'Yes' && (
                                        <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-100 space-y-3 animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center gap-2 text-emerald-800">
                                                <CheckCircle2 size={16} />
                                                <span className="text-xs font-bold">Installation Completed</span>
                                            </div>
                                            <div>
                                                <label className="block text-[9px] font-bold text-emerald-900 uppercase tracking-wider mb-1">
                                                    Installation Date
                                                </label>
                                                <input
                                                    type="date"
                                                    value={installationDate || ''}
                                                    onChange={(e) => setInstallationDate(e.target.value)}
                                                    disabled={!canEditInstallation}
                                                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* When marked Give Up: Status Banner */}
                                    {installationStatus === 'Giveup' && (
                                        <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-200 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                                                <AlertTriangle size={15} className="text-rose-600" />
                                                <span>You have submitted to Give Up this project</span>
                                            </div>
                                            {vendorNote && (
                                                <p className="text-xs text-rose-900 italic bg-white/80 p-2.5 rounded-xl border border-rose-100 font-medium">
                                                    "{vendorNote}"
                                                </p>
                                            )}
                                            <p className="text-[11px] text-rose-600 font-semibold">
                                                Admin is reviewing this request.
                                            </p>
                                        </div>
                                    )}

                                    {saveSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                            <span>Installation status saved successfully!</span>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        {normalizeInstallationStatus(installationStatus) === 'Yes' ? (
                                            <div className="space-y-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveChanges(STAGE_IDS.GEO_TAG_PHOTO)}
                                                    disabled={saving || !canEditInstallation || vendorIsFutureTab}
                                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                                >
                                                    {saving ? (
                                                        <><Loader2 className="w-4 h-4 animate-spin" /> Moving Stage...</>
                                                    ) : (
                                                        <><ChevronRight size={14} /> Save & Move to Geo Tag Photo</>
                                                    )}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleSaveChanges(null)}
                                                    disabled={saving || !canEditInstallation}
                                                    className={`w-full py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                                                        isInstallationDirty
                                                            ? 'bg-stone-900 text-white hover:bg-stone-850'
                                                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                    }`}
                                                >
                                                    {saving ? (
                                                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                                                    ) : isInstallationDirty ? (
                                                        <><Save size={13} /> Save Installation Status</>
                                                    ) : (
                                                        <><Check size={13} /> Saved</>
                                                    )}
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleSaveChanges(null)}
                                                disabled={saving || !canEditInstallation}
                                                className={`w-full py-3.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs disabled:opacity-50 ${
                                                    isInstallationDirty
                                                        ? 'bg-stone-900 text-white hover:bg-stone-850'
                                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                                }`}
                                            >
                                                {saving ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                                ) : isInstallationDirty ? (
                                                    <><Save size={14} /> Save Installation Status</>
                                                ) : (
                                                    <><Check size={14} /> Saved</>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        </div>
                    </div>

                    {/* View Customer Details (Read-only Leads information) */}
                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1.5 flex items-center gap-1.5">
                            <ClipboardList size={12} /> Customer Information (Leads)
                        </h3>

                        <div className="divide-y divide-stone-200 rounded-2xl border border-stone-200 px-4 text-xs">
                            {[
                                ['Customer Name', selectedCust.customer_name],
                                ['Phone Number', selectedCust.phone_number],
                                ['Email Address', selectedCust.email_address || selectedCust.email],
                                ['Consumer No.', selectedCust.consumer_no],
                                ['Village / Address', selectedCust.villages],
                                ['Folder / File No.', selectedCust.folder_no],
                                ['System Capacity', selectedCust.system_capacity_kwp ? `${selectedCust.system_capacity_kwp} kWp` : null],
                                ['Module Brand', selectedCust.module_brand],
                                ['Module WP', selectedCust.module_wp],
                            ].map(([label, value]) => (
                                <div key={label} className="flex items-start justify-between gap-4 py-3">
                                    <p className="text-[9px] font-bold text-stone-400 uppercase tracking-wide">{label}</p>
                                    <p className="max-w-[58%] break-words text-right font-semibold text-stone-800">{value || '–'}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </main>
            )}

            {/* Document Preview Modal */}
            {previewDoc && (
                <FilePreviewModal
                    file={previewDoc.doc}
                    fileUrl={previewDoc.url}
                    onClose={() => setPreviewDoc(null)}
                    onDownload={() => window.open(previewDoc.url, '_blank')}
                    onUpdateRemark={handleUpdateDocRemark}
                />
            )}
             {/* Give Up Project Modal for Vendor */}
            {showGiveUpModal && (
                <div className="fixed inset-0 z-[1000] bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 shadow-xl border border-stone-200 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2 text-rose-600">
                            <AlertTriangle size={20} />
                            <h3 className="text-sm font-bold text-stone-900">Give Up Installation</h3>
                        </div>
                        <p className="text-xs text-stone-600">
                            Are you sure you want to give up the installation project for <b>{selectedCust?.customer_name}</b>?
                        </p>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                                Reason / Remarks
                            </label>
                            <textarea
                                rows={3}
                                value={giveUpReason}
                                onChange={(e) => setGiveUpReason(e.target.value)}
                                placeholder="Enter reason (e.g. roof structure issue, site inaccessible, distance)..."
                                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs text-stone-800 focus:outline-none focus:ring-1 focus:ring-rose-400 placeholder:text-stone-400 font-medium"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-1">
                            <button
                                type="button"
                                onClick={() => {
                                    setShowGiveUpModal(false);
                                    setGiveUpReason('');
                                }}
                                disabled={givingUp}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold text-stone-600 hover:bg-stone-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmGiveUp}
                                disabled={givingUp}
                                className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                            >
                                {givingUp ? <Loader2 size={12} className="animate-spin" /> : null}
                                Confirm Give Up
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* BOM View & Print Modal for Vendor (Read-Only) */}
            {showBomModal && targetBomCust && (
                <div className="print-only-modal fixed inset-0 z-[999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Top Bar */}
                        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={16} className="text-amber-400" />
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                                    Bill of Materials (BOM) - {targetBomCust.customer_name}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrintVendorBom}
                                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <Printer size={13} /> Print Document
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowBomModal(false)}
                                    className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div ref={vendorBomPrintRef} className="flex-1 overflow-y-auto p-6 bg-white text-stone-900 print-document" id="printable-vendor-bom">
                            {loadingBom ? (
                                <div className="py-16 flex flex-col items-center justify-center text-stone-400">
                                    <Loader2 className="w-7 h-7 animate-spin text-amber-500 mb-2" />
                                    <p className="text-xs font-bold">Loading Bill of Materials...</p>
                                </div>
                            ) : (
                                <>
                                    {/* Company Header */}
                                    <div className="border-b-2 border-stone-900 pb-3 mb-5 text-center">
                                        <h1 className="text-lg font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                        <p className="text-[11px] font-semibold text-stone-600">Solar PV Project Integration & Material Loading Checklist</p>
                                        <div className="inline-block mt-2 px-2.5 py-0.5 bg-stone-100 border border-stone-300 rounded text-[10px] font-black uppercase tracking-widest text-stone-800">
                                            BILL OF MATERIALS (BOM) - {bomData?.bom_type ? `${bomData.bom_type} TYPE` : 'GENERAL'}
                                        </div>
                                    </div>

                                    {/* Customer Reference */}
                                    <div className="mb-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Reference</h3>
                                        <table className="w-full text-[11px] border border-stone-300">
                                            <tbody>
                                                <tr className="border-b border-stone-200">
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Customer Name:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.customer_name || '–'}</td>
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Phone Number:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.phone_number || '–'}</td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Email Address:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.email_address || targetBomCust.email || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Consumer No:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.consumer_no || '–'}</td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Villages:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.villages || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Sub Division:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.sub_divisions || '–'}</td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Channel Partner Name:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.channel_partner || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Dealer Name:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.sub_channel_partner || '–'}</td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">MODULE BRAND:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.module_brand || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">MODULE WP:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.module_wp || '–'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">No of Modules:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.no_of_modules || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">System Capacity (kWp):</td>
                                                    <td className="p-1.5 font-bold text-stone-900">
                                                        {targetBomCust.system_capacity_kwp ? `${toIndianCommas(targetBomCust.system_capacity_kwp)} kWp` : '–'}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Material Order Specifications */}
                                    <div className="mb-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">2. Material Order Specifications</h3>
                                        <table className="w-full text-[11px] border border-stone-300">
                                            <tbody>
                                                <tr className="border-b border-stone-200">
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Roof / Shed:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.roof_shed || '–'}</td>
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Structure Leg Height:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">
                                                        {targetBomCust.structure_front_leg_height ? `${targetBomCust.structure_front_leg_height} ft / ${targetBomCust.structure_rear_leg_height || '–'} ft` : '–'}
                                                    </td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">DC Cable Length:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.dc_cable ? `${targetBomCust.dc_cable} Meters` : '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">AC Cable Length:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.ac_cable ? `${targetBomCust.ac_cable} Meters` : '–'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Invoice Value:</td>
                                                    <td colSpan={3} className="p-1.5 font-bold text-stone-900">{targetBomCust.invoice_value ? `₹ ${toIndianCommas(targetBomCust.invoice_value)}` : '–'}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* BOM Items Table */}
                                    <div className="mb-6">
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">3. BOM Equipment Checklist</h3>
                                        {bomItems.length > 0 ? (
                                            <table className="w-full text-[11px] border-collapse border border-stone-400">
                                                <thead>
                                                    <tr className="bg-stone-100 text-stone-900 uppercase font-black text-[9px]">
                                                        <th className="border border-stone-400 p-1.5 text-center w-8">#</th>
                                                        <th className="border border-stone-400 p-1.5 text-left">Product Name</th>
                                                        <th className="border border-stone-400 p-1.5 text-left w-24">Make</th>
                                                        <th className="border border-stone-400 p-1.5 text-center w-14">UOM</th>
                                                        <th className="border border-stone-400 p-1.5 text-left w-28">Integration By</th>
                                                        <th className="border border-stone-400 p-1.5 text-left">Note</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bomItems.map((item, idx) => (
                                                        <tr key={idx} className="border-b border-stone-300">
                                                            <td className="border border-stone-400 p-1.5 text-center font-bold text-stone-500">{idx + 1}</td>
                                                            <td className="border border-stone-400 p-1.5 font-bold text-stone-900">{item.product_name || '–'}</td>
                                                            <td className="border border-stone-400 p-1.5 font-medium">{item.make || '–'}</td>
                                                            <td className="border border-stone-400 p-1.5 text-center font-semibold">{item.uom || '–'}</td>
                                                            <td className="border border-stone-400 p-1.5 font-medium">{item.integration_by || '–'}</td>
                                                            <td className="border border-stone-400 p-1.5 text-stone-600">{item.note || '–'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        ) : (
                                            <p className="text-xs text-stone-400 italic text-center py-4 bg-stone-50 rounded-xl border border-stone-200">
                                                No BOM checklist items configured yet for this customer.
                                            </p>
                                        )}
                                    </div>

                                    {/* Signatures */}
                                    <div className="grid grid-cols-3 gap-4 pt-6 text-center border-t border-stone-300 text-[10px]">
                                        <div>
                                            <div className="border-b border-stone-400 pb-6 mb-1 font-bold text-stone-700">
                                                {bomData?.paper_prepared_by || ''}
                                            </div>
                                            <p className="font-black uppercase text-stone-900">Prepared By</p>
                                        </div>
                                        <div>
                                            <div className="border-b border-stone-400 pb-6 mb-1 font-bold text-stone-700">
                                                {bomData?.material_loaded_by || ''}
                                            </div>
                                            <p className="font-black uppercase text-stone-900">Loaded By</p>
                                        </div>
                                        <div>
                                            <div className="border-b border-stone-400 pb-6 mb-1"></div>
                                            <p className="font-black uppercase text-stone-900">Vendor Signature</p>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}



            {/* Print Styles for Vendor BOM */}
            <style>{`
                @media print {
                    body.is-printing-document > *:not(#native-print-portal) {
                        display: none !important;
                    }
                    body.is-printing-document #native-print-portal {
                        display: block !important;
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 15px !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        visibility: visible !important;
                    }
                    body.is-printing-document #native-print-portal,
                    body.is-printing-document #native-print-portal p,
                    body.is-printing-document #native-print-portal span,
                    body.is-printing-document #native-print-portal td,
                    body.is-printing-document #native-print-portal th,
                    body.is-printing-document #native-print-portal div {
                        font-size: 8.5pt !important;
                    }
                    body.is-printing-document #native-print-portal h1,
                    body.is-printing-document #native-print-portal h2,
                    body.is-printing-document #native-print-portal h3,
                    body.is-printing-document #native-print-portal h4 {
                        font-size: 10pt !important;
                    }
                    body.is-printing-document #native-print-portal * {
                        visibility: visible !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
