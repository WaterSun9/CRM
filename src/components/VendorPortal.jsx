import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { logActivity, uploadDocument, getCustomerDocuments, getViewUrl, deleteDocument, toIndianCommas, updateDocumentRemark } from '../utils';
import { 
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle, AlertTriangle,
    Hash, Folder, Tag, ChevronLeft, Search, ClipboardList, Banknote, Calendar, ClipboardCheck,
    Camera, Paperclip, Eye, Trash2, Upload, Image as ImageIcon, X,
    Printer, ShoppingBag, Layers, Ruler, IndianRupee, Package, FileText, Truck, ClipboardPaste, Plus, Check, Copy, Wrench
} from 'lucide-react';
import { FilePreviewModal } from './modal-tabs/shared';

const parsePanelSerials = (raw) => {
    if (!raw) return [''];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.length > 0 ? parsed : [''];
    } catch (e) { }

    if (raw.includes('\n')) {
        return raw.split('\n').map(s => s.trim()).filter(Boolean);
    }
    if (raw.includes(',')) {
        return raw.split(',').map(s => s.trim()).filter(Boolean);
    }
    return [raw.trim()];
};

export default function VendorPortal({ user, onLogout }) {
    const [view, setView] = useState('list'); // 'list', 'details'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('MATERIAL'); // 'MATERIAL', 'DELIVERY', 'GEO', 'INSTALLATION'
    const [selectedCust, setSelectedCust] = useState(null);
    
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
    const [showBulkPaste, setShowBulkPaste] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [copiedIdx, setCopiedIdx] = useState(null);
    const [copiedAll, setCopiedAll] = useState(false);
    
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Document attachments state
    const [documents, setDocuments] = useState([]);
    const [uploadingPhoto, setUploadingPhoto] = useState(false);
    const [previewDoc, setPreviewDoc] = useState(null);
    const fileInputRef = useRef(null);

    // BOM Print Modal for Vendor (Read-Only)
    const [showBomModal, setShowBomModal] = useState(false);
    const [targetBomCust, setTargetBomCust] = useState(null);
    const [bomData, setBomData] = useState(null);
    const [bomItems, setBomItems] = useState([]);
    const [loadingBom, setLoadingBom] = useState(false);

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

            if (bom) {
                setBomData(bom);
                const { data: items, error: itemsErr } = await supabase
                    .from('bom_items')
                    .select('*')
                    .eq('bom_id', bom.id)
                    .order('sr_no', { ascending: true });
                setBomItems(items || []);
            } else {
                setBomData(null);
                setBomItems([]);
            }
        } catch (e) {
            console.error('Error fetching BOM for vendor:', e);
            setBomData(null);
            setBomItems([]);
        } finally {
            setLoadingBom(false);
        }
    };

    // Fetch customer leads assigned to this vendor
    const fetchCustomers = async () => {
        setLoading(true);
        try {
            // Select all active leads and filter locally for case-insensitivity & whitespace checks
            const { data, error } = await supabase
                .from('admin')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });

            if (!error && data) {
                const myName = (user.name || '').trim().toLowerCase();
                const myCustomers = data.filter(c => {
                    const vendorName = (c.vendor || '').trim().toLowerCase();
                    // If vendor gave up this project, remove it from active vendor view
                    if (c.installation_status === 'Give Up' && vendorName === myName) {
                        return false;
                    }
                    // Include leads assigned to this vendor OR any lead currently in the MATERIAL INTEGRATION stage
                    return vendorName === myName || c.stage === 'MATERIAL INTEGRATION';
                });
                setCustomers(myCustomers);
            }
        } catch (err) {
            console.error('Error fetching vendor customers:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user?.name) {
            fetchCustomers();
        }
    }, [user]);

    // Handle selecting a customer card
    const handleSelectCustomer = async (cust) => {
        setSelectedCust(cust);
        
        // Match active tab to customer stage
        if (cust.stage === 'MATERIAL INTEGRATION') {
            setActiveTab('MATERIAL');
        } else if (cust.stage === 'MATERIAL DELIVERY') {
            setActiveTab('DELIVERY');
        } else if (cust.stage === 'GEO TAG PHOTO') {
            setActiveTab('GEO');
        } else if (cust.stage === 'INSTALLATION STATUS') {
            setActiveTab('INSTALLATION');
        }

        // Pre-fill Material Delivery Details
        setInverterSerialNo(cust.inverter_serial_no || '');
        setInvoiceNo(cust.invoice_no || '');
        setDriverName(cust.driver_name || '');
        setDriverPhone(cust.driver_phone_number || '');
        setPanelSerials(parsePanelSerials(cust.panel_serial_no));
        
        // Pre-fill geo tag status
        setGeoTagStatus(cust.geo_tag_status || 'Pending');
        setGeoTagImage(!!cust.geo_tag_image);

        // Pre-fill installation status
        setInstallationStatus(cust.installation_status || 'Pending');
        setInstallationDate(cust.installation_date || '');
        setVendorNote(cust.vendor_note || '');
        
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

    // Panel serials helper functions
    const handlePanelSerialChange = (idx, val) => {
        const next = [...panelSerials];
        next[idx] = val;
        setPanelSerials(next);
    };

    const addPanelSerial = (count = 1) => {
        if (panelSerials.length >= 100) return;
        const toAdd = Math.min(count, 100 - panelSerials.length);
        const newItems = Array(toAdd).fill('');
        setPanelSerials(prev => [...prev, ...newItems]);
    };

    const removePanelSerial = (idx) => {
        const next = panelSerials.filter((_, i) => i !== idx);
        const finalVal = next.length > 0 ? next : [''];
        setPanelSerials(finalVal);
    };

    const handleApplyBulkPaste = () => {
        if (!bulkText.trim()) return;
        const parsed = bulkText
            .split(/[\n,;\t]+/)
            .map(s => s.trim())
            .filter(Boolean);
        
        if (parsed.length > 0) {
            const finalSerials = parsed.slice(0, 100);
            setPanelSerials(finalSerials);
            setBulkText('');
            setShowBulkPaste(false);
        }
    };

    const handleCopySerial = (serial, idx) => {
        if (!serial) return;
        navigator.clipboard.writeText(serial);
        setCopiedIdx(idx);
        setTimeout(() => setCopiedIdx(null), 1500);
    };

    const handleCopyAll = () => {
        const valid = panelSerials.filter(Boolean);
        if (valid.length === 0) return;
        navigator.clipboard.writeText(valid.join('\n'));
        setCopiedAll(true);
        setTimeout(() => setCopiedAll(false), 2000);
    };

    // Upload geo tag photo handler
    const handlePhotoUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || !selectedCust) return;

        setUploadingPhoto(true);
        try {
            const newDoc = await uploadDocument(file, selectedCust.id, 'geo_tag_image');
            if (newDoc) {
                setDocuments(prev => [newDoc, ...(prev || [])]);
                setGeoTagImage(true);
                
                // Update admin record directly
                await supabase.from('admin').update({ 
                    geo_tag_image: true,
                    geo_tag_status: geoTagStatus === 'Pending' ? 'Proceed' : geoTagStatus 
                }).eq('id', selectedCust.id);

                if (geoTagStatus === 'Pending') {
                    setGeoTagStatus('Proceed');
                }
                
                if (user?.id) {
                    await logActivity(
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
            alert('Failed to upload photo: ' + (err.message || err));
        } finally {
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

    // Delete photo handler
    const handlePhotoDelete = async (doc) => {
        if (!window.confirm(`Delete ${doc.file_name}?`)) return;
        try {
            await deleteDocument(doc);
            const remaining = (documents || []).filter(d => d.id !== doc.id);
            setDocuments(remaining);
            const hasOtherGeo = remaining.some(d => d.doc_type === 'geo_tag_image' || d.doc_type === 'geo_tag');
            if (!hasOtherGeo) {
                setGeoTagImage(false);
                await supabase.from('admin').update({ geo_tag_image: false }).eq('id', selectedCust.id);
            }
        } catch (err) {
            console.error('Error deleting photo:', err);
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

    // Save changes to Supabase and optionally progress stage
    const handleSaveChanges = async (nextStage = null) => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            const filteredPanels = panelSerials.filter(Boolean);
            const serializedPanels = filteredPanels.length > 0 ? filteredPanels.join('\n') : null;

            const updatePayload = {
                inverter_serial_no: inverterSerialNo || null,
                invoice_no: invoiceNo || null,
                driver_name: driverName || null,
                driver_phone_number: driverPhone || null,
                panel_serial_no: serializedPanels,
                geo_tag_status: geoTagStatus,
                geo_tag_image: geoTagImage,
                installation_status: installationStatus,
                installation_date: installationDate || null,
                vendor_note: vendorNote || null,
            };

            if (nextStage) {
                updatePayload.stage = nextStage;
            }

            const { error } = await supabase
                .from('admin')
                .update(updatePayload)
                .eq('id', selectedCust.id);

            if (!error) {
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

                await logActivity(
                    user.id,
                    'update',
                    `${selectedCust.customer_name}: ${logMsg}`,
                    '',
                    selectedCust.id
                );
                
                setSaveSuccess(true);
                fetchCustomers();
                
                // Update selectedCust reference in view
                setSelectedCust(prev => ({
                    ...prev,
                    ...updatePayload,
                    stage: nextStage || prev.stage
                }));

                setTimeout(() => {
                    setView('list');
                }, 1000);
            } else {
                alert(`Error saving changes: ${error.message}`);
            }
        } catch (err) {
            console.error('Failed to save details:', err);
        } finally {
            setSaving(false);
        }
    };

    // Give Up Project handler
    const handleConfirmGiveUp = async () => {
        if (!selectedCust?.id) return;
        setGivingUp(true);
        try {
            const { error } = await supabase
                .from('admin')
                .update({
                    installation_status: 'Give Up',
                    vendor_note: giveUpReason || null
                })
                .eq('id', selectedCust.id);

            if (error) throw error;

            await logActivity(
                user.id,
                'update',
                `Vendor ${user.name} gave up installation for ${selectedCust.customer_name}${giveUpReason ? `: "${giveUpReason}"` : ''}`,
                '',
                selectedCust.id
            );

            setShowGiveUpModal(false);
            setGiveUpReason('');
            await fetchCustomers();
            setView('list');
        } catch (err) {
            console.error('Error giving up project:', err);
            alert('Failed to submit give up: ' + err.message);
        } finally {
            setGivingUp(false);
        }
    };

    // Stats calculations
    const materialCount = customers.filter(c => c.stage === 'MATERIAL INTEGRATION').length;
    const deliveryCount = customers.filter(c => c.stage === 'MATERIAL DELIVERY').length;
    const geoPendingCount = customers.filter(c => c.stage === 'GEO TAG PHOTO' && (c.geo_tag_status || 'Pending') !== 'Proceed').length;

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
        if (activeTab === 'MATERIAL') {
            return c.stage === 'MATERIAL INTEGRATION';
        } else if (activeTab === 'DELIVERY') {
            return c.stage === 'MATERIAL DELIVERY';
        } else {
            return c.stage === 'GEO TAG PHOTO';
        }
    });

    // Geo tag documents for current selected customer
    const geoDocs = documents.filter(d => d.doc_type === 'geo_tag_image' || d.doc_type === 'geo_tag');

    return (
        <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
            {/* Top Header */}
            <header className="bg-white border-b border-stone-100 px-4 py-3 sticky top-0 z-30 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-amber-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-amber-500/10">
                        <Sun className="w-4 h-4 fill-white" />
                    </div>
                    <div>
                        <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase">Watersun</h1>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest -mt-0.5">Vendor Portal</p>
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

            {view === 'list' ? (
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in fade-in duration-300">
                    {/* Welcome banner */}
                    <div className="bg-gradient-to-br from-stone-900 to-stone-850 text-white p-5 rounded-[24px] shadow-lg relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 translate-x-4 translate-y-4 opacity-10">
                            <Sun className="w-32 h-32" />
                        </div>
                        <p className="text-[9px] uppercase tracking-widest text-amber-400 font-bold">Allotted Vendor</p>
                        <h2 className="text-lg font-bold mt-0.5">{user.name}</h2>
                        <p className="text-[11px] text-stone-300 mt-2 font-medium">Manage Material Integration BOMs, material deliveries, and site geo tagging.</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2">
                        <div 
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'MATERIAL' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`} 
                            onClick={() => setActiveTab('MATERIAL')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'MATERIAL' ? 'text-amber-100' : 'text-stone-400'}`}>Material Int.</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'MATERIAL' ? 'text-white' : 'text-stone-850'}`}>{materialCount}</p>
                        </div>
                        <div 
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'DELIVERY' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`} 
                            onClick={() => setActiveTab('DELIVERY')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'DELIVERY' ? 'text-amber-100' : 'text-stone-400'}`}>Delivery</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'DELIVERY' ? 'text-white' : 'text-stone-850'}`}>{deliveryCount}</p>
                        </div>
                        <div 
                            className={`p-3 rounded-2xl border transition-all cursor-pointer ${activeTab === 'GEO' ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20' : 'bg-white border-stone-100 shadow-sm'}`} 
                            onClick={() => setActiveTab('GEO')}
                        >
                            <p className={`text-[8px] font-bold uppercase tracking-wider ${activeTab === 'GEO' ? 'text-amber-100' : 'text-stone-400'}`}>Geo Tag</p>
                            <p className={`text-base sm:text-lg font-black mt-0.5 ${activeTab === 'GEO' ? 'text-white' : 'text-stone-850'}`}>{geoPendingCount}</p>
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
                                if (cust.stage === 'MATERIAL INTEGRATION') {
                                    return (
                                        <div 
                                            key={cust.id} 
                                            onClick={() => handleOpenBomModal(cust)}
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
                                                    Tap to view & print BOM
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

                                if (cust.stage === 'MATERIAL DELIVERY') {
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

                                const isGeoOk = cust.geo_tag_status === 'Proceed';

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
                                                    isGeoOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                    Geo: {cust.geo_tag_status || 'Pending'}
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
                            onClick={() => setView('list')}
                            className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors py-1 cursor-pointer"
                        >
                            <ChevronLeft className="w-4.5 h-4.5" /> Back to Dashboard
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowGiveUpModal(true)}
                            className="text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 px-2.5 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                        >
                            <AlertTriangle size={12} className="text-rose-600" /> Give Up Project
                        </button>
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <div className="border-b border-stone-100 pb-3">
                            <h2 className="text-base font-bold text-stone-850">{selectedCust.customer_name}</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-1">Consumer No: {selectedCust.consumer_no || '–'}</p>
                        </div>

                        {/* Stage Tabs inside Customer View */}
                        <div className="grid grid-cols-4 gap-1 p-1 bg-stone-100/80 rounded-xl border border-stone-200/60">
                            {[
                                { id: 'MATERIAL', label: 'Material (BOM)', icon: Package },
                                { id: 'DELIVERY', label: 'Delivery', icon: Truck },
                                { id: 'GEO', label: 'Geo Tag', icon: Camera },
                                { id: 'INSTALLATION', label: 'Installation', icon: Wrench },
                            ].map(tab => {
                                const Icon = tab.icon;
                                const isCurrent = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`py-1.5 px-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                                            isCurrent
                                                ? 'bg-amber-500 text-white shadow-xs'
                                                : 'text-stone-500 hover:text-stone-800'
                                        }`}
                                    >
                                        <Icon size={11} />
                                        <span className="hidden sm:inline">{tab.label}</span>
                                        <span className="sm:hidden">{tab.id === 'MATERIAL' ? 'BOM' : tab.id === 'DELIVERY' ? 'Deliv' : tab.id === 'GEO' ? 'Geo' : 'Install'}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Editable Form Card */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-stone-100 pb-1.5">
                                {activeTab === 'MATERIAL'
                                    ? 'Material Integration & BOM Specification'
                                    : activeTab === 'DELIVERY'
                                        ? 'Material Delivery Equipment Details'
                                        : activeTab === 'INSTALLATION'
                                            ? 'Installation Status & Details'
                                            : 'Geo Tag Photo Report'}
                            </h3>

                            {/* ─── Active Tab: MATERIAL INTEGRATION & BOM ─── */}
                            {activeTab === 'MATERIAL' && (
                                <div className="space-y-4">
                                    <div className="bg-gradient-to-br from-amber-50/70 to-white p-4 rounded-2xl border border-amber-200/80 space-y-3 shadow-xs">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Package className="w-4 h-4 text-amber-600" />
                                                <div>
                                                    <p className="text-[10px] font-bold text-amber-950 uppercase tracking-wide">Material Integration & BOM</p>
                                                    <p className="text-[9px] text-stone-500 font-medium">View specifications and generate BOM printable copy.</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => handleOpenBomModal(selectedCust)}
                                                className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-xl text-[10px] font-bold transition flex items-center gap-1.5 shadow-sm shadow-amber-500/20 cursor-pointer"
                                            >
                                                <Printer size={11} /> View & Print BOM
                                            </button>
                                        </div>

                                        <div className="divide-y divide-stone-200/60 text-xs pt-1">
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">Roof / Shed</span>
                                                <span className="font-semibold text-stone-850">{selectedCust.roof_shed || '–'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">Structure Height</span>
                                                <span className="font-semibold text-stone-850">{selectedCust.structure_leg_height || '–'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">DC Cable</span>
                                                <span className="font-semibold text-stone-850">{selectedCust.dc_cable ? `${selectedCust.dc_cable} m` : '–'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">AC Cable</span>
                                                <span className="font-semibold text-stone-850">{selectedCust.ac_cable ? `${selectedCust.ac_cable} m` : '–'}</span>
                                            </div>
                                            <div className="flex justify-between py-1.5">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase">Invoice Value</span>
                                                <span className="font-semibold text-stone-850">{selectedCust.invoice_value ? `₹${toIndianCommas(selectedCust.invoice_value)}` : '–'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ─── Active Tab: MATERIAL DELIVERY ─── */}
                            {activeTab === 'DELIVERY' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Inverter Serial No</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. INV-98765432"
                                                value={inverterSerialNo}
                                                onChange={e => setInverterSerialNo(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Invoice No</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. INV-2026-001"
                                                value={invoiceNo}
                                                onChange={e => setInvoiceNo(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Driver Name</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. Ramesh Kumar"
                                                value={driverName}
                                                onChange={e => setDriverName(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Driver Phone Number</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. 9876543210"
                                                value={driverPhone}
                                                onChange={e => setDriverPhone(e.target.value)}
                                                className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Panel Serial Numbers List */}
                                    <div className="bg-stone-50 p-4 rounded-2xl border border-stone-150/80 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h4 className="text-[10px] font-black text-stone-800 uppercase tracking-wide flex items-center gap-1.5">
                                                    <Layers size={12} className="text-amber-500" /> Panel Serial Numbers ({panelSerials.filter(Boolean).length})
                                                </h4>
                                                <p className="text-[9px] text-stone-400 font-medium">Record all delivered solar panel serial codes.</p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowBulkPaste(prev => !prev)}
                                                    className="text-[9px] font-bold px-2 py-1 bg-white hover:bg-stone-100 border border-stone-200 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                                >
                                                    <ClipboardPaste size={10} /> {showBulkPaste ? 'Hide Paste' : 'Bulk Paste'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => addPanelSerial(1)}
                                                    className="text-[9px] font-bold px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                                                >
                                                    <Plus size={10} /> Add 1
                                                </button>
                                            </div>
                                        </div>

                                        {showBulkPaste && (
                                            <div className="p-3 bg-white rounded-xl border border-amber-200 space-y-2">
                                                <p className="text-[9px] font-bold text-stone-500">Paste serial numbers (separated by lines, commas, or tabs):</p>
                                                <textarea
                                                    rows={3}
                                                    value={bulkText}
                                                    onChange={e => setBulkText(e.target.value)}
                                                    placeholder="Paste multiple serials here..."
                                                    className="w-full text-xs font-mono p-2 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowBulkPaste(false)}
                                                        className="text-[10px] font-bold px-2.5 py-1 text-stone-500 hover:bg-stone-100 rounded-lg"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={handleApplyBulkPaste}
                                                        className="text-[10px] font-bold px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow-xs"
                                                    >
                                                        Apply Serials
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                            {panelSerials.map((serial, idx) => (
                                                <div key={idx} className="flex items-center gap-1.5">
                                                    <span className="text-[9px] font-bold text-stone-400 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                                                    <input
                                                        type="text"
                                                        placeholder={`Panel #${idx + 1} Serial`}
                                                        value={serial}
                                                        onChange={e => handlePanelSerialChange(idx, e.target.value)}
                                                        className="flex-1 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-mono font-medium text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                    />
                                                    {serial && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopySerial(serial, idx)}
                                                            className="p-1.5 text-stone-400 hover:text-stone-700 bg-white border border-stone-200 rounded-lg"
                                                            title="Copy serial"
                                                        >
                                                            {copiedIdx === idx ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                                        </button>
                                                    )}
                                                    {panelSerials.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => removePanelSerial(idx)}
                                                            className="p-1.5 text-red-400 hover:text-red-600 bg-white border border-stone-200 rounded-lg"
                                                            title="Remove serial"
                                                        >
                                                            <Trash2 size={11} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>

                                        {panelSerials.filter(Boolean).length > 0 && (
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    type="button"
                                                    onClick={handleCopyAll}
                                                    className="text-[9px] font-bold text-stone-600 hover:text-stone-900 flex items-center gap-1"
                                                >
                                                    {copiedAll ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                                                    {copiedAll ? 'Copied all serials!' : 'Copy All Serials'}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {saveSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                            <span>Material delivery saved successfully!</span>
                                        </div>
                                    )}

                                    <div className="pt-2 flex flex-col sm:flex-row gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving}
                                            className="flex-1 bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check size={12} />}
                                            Save Delivery Info
                                        </button>
                                        {selectedCust.stage === 'MATERIAL DELIVERY' && (
                                            <button
                                                type="button"
                                                onClick={() => handleSaveChanges('INSTALLATION STATUS')}
                                                disabled={saving}
                                                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                            >
                                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ChevronRight size={14} />}
                                                Save & Move to Installation
                                            </button>
                                        )}
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
                                        <div className="grid grid-cols-3 gap-2">
                                            {[
                                                { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' },
                                                { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' },
                                                { id: 'Proceed', label: 'Proceed', activeClass: 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/10', dotClass: 'bg-white' }
                                            ].map(tag => {
                                                const isSelected = geoTagStatus === tag.id;
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => setGeoTagStatus(tag.id)}
                                                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
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
                                                disabled={uploadingPhoto}
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
                                                            <span className="text-[11px] font-semibold text-stone-800 truncate">{doc.file_name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePhotoPreview(doc)}
                                                                className="text-[9px] font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Eye size={10} /> View
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => fileInputRef.current?.click()}
                                                                className="text-[9px] font-bold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Upload size={10} /> Change
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handlePhotoDelete(doc)}
                                                                className="text-[9px] font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Trash2 size={10} /> Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 bg-white rounded-xl border border-dashed border-stone-200 text-stone-400">
                                                <Camera size={18} className="mx-auto mb-1 text-stone-300" />
                                                <p className="text-[10px] font-semibold">No geo-tag photograph uploaded yet</p>
                                            </div>
                                        )}
                                    </div>

                                    {saveSuccess && (
                                        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                            <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                            <span>Geo tag report saved successfully!</span>
                                        </div>
                                    )}

                                    <div className="pt-2">
                                        {(geoTagStatus === 'Proceed' && geoDocs.length > 0) ? (
                                            <button
                                                type="button"
                                                onClick={() => handleSaveChanges('DISCOM SUBMISSION')}
                                                disabled={saving}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                            >
                                                {saving ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Moving Stage...</>
                                                ) : (
                                                    <><CheckCircle2 size={14} /> Save & Move to Discom Submission</>
                                                )}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => handleSaveChanges(null)}
                                                disabled={saving}
                                                className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                            >
                                                {saving ? (
                                                    <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                                ) : (
                                                    'Save Geo Tag Report'
                                                )}
                                            </button>
                                        )}
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
                                                { id: 'Give Up', label: 'Give Up', activeClass: 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/10', dotClass: 'bg-white' },
                                                { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
                                                { id: 'Pending', label: 'Pending', activeClass: 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/10', dotClass: 'bg-white' },
                                                { id: 'No', label: 'No', activeClass: 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10', dotClass: 'bg-white' }
                                            ].map(tag => {
                                                const isSelected = installationStatus === tag.id;
                                                return (
                                                    <button
                                                        key={tag.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (tag.id === 'Give Up') {
                                                                setShowGiveUpModal(true);
                                                            } else {
                                                                setInstallationStatus(tag.id);
                                                            }
                                                        }}
                                                        className={`py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 cursor-pointer ${
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

                                    {/* When marked Yes: Installation Date */}
                                    {installationStatus === 'Yes' && (
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
                                                    className="w-full bg-white border border-emerald-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* When marked Give Up: Status Banner */}
                                    {installationStatus === 'Give Up' && (
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
                                        <button
                                            type="button"
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving}
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                            ) : (
                                                'Save Installation Status'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* View Customer Details (Read-only Leads information) */}
                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <h3 className="text-[10px] font-black text-stone-400 uppercase tracking-widest border-b border-stone-100 pb-1.5 flex items-center gap-1.5">
                            <ClipboardList size={12} /> Customer Information (Leads)
                        </h3>

                        <div className="space-y-3.5 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Customer Name</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.customer_name || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Phone Number</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.phone_number || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Email Address</p>
                                    <p className="font-semibold text-stone-800 mt-0.5 truncate">{selectedCust.email_address || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Consumer No</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.consumer_no || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Village / Address</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.villages || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Folder / File No</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.folder_no || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">System Capacity (kWp)</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.system_capacity_kwp || '–'} kWp</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Module Brand</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.module_brand || '–'}</p>
                                </div>
                                <div>
                                    <p className="text-[8px] font-bold text-stone-400 uppercase">Module Wp</p>
                                    <p className="font-semibold text-stone-800 mt-0.5">{selectedCust.module_wp || '–'}</p>
                                </div>
                            </div>
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
                <div className="fixed inset-0 z-[999] bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Modal Top Bar */}
                        <div className="px-5 py-4 bg-stone-900 text-white flex items-center justify-between no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={16} className="text-amber-400" />
                                <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider">
                                    Bill of Materials (BOM) — {targetBomCust.customer_name}
                                </h3>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => window.print()}
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
                        <div className="flex-1 overflow-y-auto p-6 bg-white text-stone-900 print-document" id="printable-vendor-bom">
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
                                            BILL OF MATERIALS (BOM) — {bomData?.bom_type ? `${bomData.bom_type} TYPE` : 'GENERAL'}
                                        </div>
                                    </div>

                                    {/* Customer Reference */}
                                    <div className="mb-4">
                                        <h3 className="text-[11px] font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Details</h3>
                                        <table className="w-full text-[11px] border border-stone-300">
                                            <tbody>
                                                <tr className="border-b border-stone-200">
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Party Name:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.customer_name || '–'}</td>
                                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Contact Number:</td>
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.phone_number || '–'}</td>
                                                </tr>
                                                <tr className="border-b border-stone-200">
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">System Capacity:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.system_capacity_kwp ? `${targetBomCust.system_capacity_kwp} kWp` : '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Channel Partner:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.channel_partner || '–'}</td>
                                                </tr>
                                                <tr>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">File No / Folder No:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.folder_no || '–'}</td>
                                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Consumer No:</td>
                                                    <td className="p-1.5 font-bold text-stone-900">{targetBomCust.consumer_no || '–'}</td>
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
                                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{targetBomCust.structure_leg_height || '–'}</td>
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
                    body * {
                        visibility: hidden;
                    }
                    #printable-vendor-bom, #printable-vendor-bom * {
                        visibility: visible;
                    }
                    #printable-vendor-bom {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        margin: 0;
                        padding: 15px;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
