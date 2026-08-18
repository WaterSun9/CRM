import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { logActivity, uploadDocument, getCustomerDocuments, getViewUrl, deleteDocument, toIndianCommas } from '../utils';
import { 
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Hash, Folder, Tag, ChevronLeft, Search, ClipboardList, Banknote, Calendar, ClipboardCheck,
    Camera, Paperclip, Eye, Trash2, Upload, Image as ImageIcon, X,
    Printer, ShoppingBag, Layers, Ruler, IndianRupee
} from 'lucide-react';
import { FilePreviewModal } from './modal-tabs/shared';

export default function VendorPortal({ user, onLogout }) {
    const [view, setView] = useState('list'); // 'list', 'details'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('GEO'); // 'GEO', 'METER', 'INSPECTION'
    const [selectedCust, setSelectedCust] = useState(null);
    
    // Edit Form State (for selected customer)
    const [geoTagStatus, setGeoTagStatus] = useState('Pending');
    const [geoTagImage, setGeoTagImage] = useState(false);
    const [meterStatus, setMeterStatus] = useState('No');
    const [installationDate, setInstallationDate] = useState('');
    const [discomInspection, setDiscomInspection] = useState('No');
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
                    return vendorName === myName;
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
        
        // Pre-fill geo tag status
        setGeoTagStatus(cust.geo_tag_status || 'Pending');
        setGeoTagImage(!!cust.geo_tag_image);

        // Pre-fill meter installation
        setMeterStatus(cust.meter_installation || 'No');
        setInstallationDate(cust.installation_date || new Date().toISOString().split('T')[0]);
        
        // Pre-fill discom inspection
        setDiscomInspection(cust.discom_inspection || 'No');
        
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
            const newDoc = await uploadDocument(file, selectedCust.id, 'geo_tag_image');
            if (newDoc) {
                setDocuments(prev => [newDoc, ...(prev || [])]);
                setGeoTagImage(true);
                
                // Update admin record directly
                await supabase.from('admin').update({ 
                    geo_tag_image: true,
                    geo_tag_status: geoTagStatus === 'Pending' ? 'Yes' : geoTagStatus 
                }).eq('id', selectedCust.id);

                if (geoTagStatus === 'Pending') {
                    setGeoTagStatus('Yes');
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
            const computedInstDate = meterStatus === 'Yes' ? (installationDate || new Date().toISOString().split('T')[0]) : null;

            const updatePayload = {
                geo_tag_status: geoTagStatus,
                geo_tag_image: geoTagImage,
                meter_installation: meterStatus,
                discom_inspection: discomInspection,
                installation_date: computedInstDate
            };

            if (nextStage) {
                updatePayload.stage = nextStage;
            }

            const { error } = await supabase
                .from('admin')
                .update(updatePayload)
                .eq('id', selectedCust.id);

            if (!error) {
                let logMsg = `Vendor ${user.name} updated Geo Tag (${geoTagStatus}), Meter (${meterStatus}) & Discom Inspection (${discomInspection})`;
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
                // Refresh list locally
                fetchCustomers();
                
                // Update selectedCust reference in view
                setSelectedCust(prev => ({
                    ...prev,
                    geo_tag_status: geoTagStatus,
                    geo_tag_image: geoTagImage,
                    meter_installation: meterStatus,
                    discom_inspection: discomInspection,
                    installation_date: computedInstDate,
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

    // Stats calculations
    const geoPendingCount = customers.filter(c => c.stage === 'GEO TAG PHOTO' && (c.geo_tag_status || 'Pending') !== 'Yes' && (c.geo_tag_status || 'Pending') !== 'Proceed').length;
    const meterPendingCount = customers.filter(c => c.stage === 'METER INSTALLATION' && c.meter_installation !== 'Yes').length;
    const inspectionPendingCount = customers.filter(c => c.stage === 'DISCOM INSPECTION' && (c.discom_inspection || 'No') !== 'Yes').length;

    // Filtered lists depending on active tab & search query
    const filteredCustomers = customers.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
            c.customer_name?.toLowerCase().includes(q) ||
            c.phone_number?.includes(searchQuery) ||
            c.villages?.toLowerCase().includes(q);

        if (activeTab === 'GEO') {
            return matchesSearch && c.stage === 'GEO TAG PHOTO';
        } else if (activeTab === 'METER') {
            return matchesSearch && c.stage === 'METER INSTALLATION';
        } else {
            return matchesSearch && c.stage === 'DISCOM INSPECTION';
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
                        <p className="text-[11px] text-stone-300 mt-2 font-medium">Manage geo tagging, meter installations, and inspection reports.</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">Geo Tag Pending</p>
                            <p className="text-base sm:text-lg font-black text-stone-850 mt-0.5">{geoPendingCount}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">Meter Pending</p>
                            <p className="text-base sm:text-lg font-black text-stone-850 mt-0.5">{meterPendingCount}</p>
                        </div>
                        <div className="bg-white p-3 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-[8px] text-stone-400 font-bold uppercase tracking-wider">Inspection Pending</p>
                            <p className="text-base sm:text-lg font-black text-stone-850 mt-0.5">{inspectionPendingCount}</p>
                        </div>
                    </div>

                    {/* Tabs & Search */}
                    <div className="space-y-3 pt-2">
                        <div className="bg-stone-100 p-0.5 rounded-xl flex gap-1">
                            <button
                                onClick={() => setActiveTab('GEO')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                                    activeTab === 'GEO' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                                }`}
                            >
                                <Camera className="w-3 h-3" /> Geo Tag
                            </button>
                            <button
                                onClick={() => setActiveTab('METER')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                                    activeTab === 'METER' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                                }`}
                            >
                                <Zap className="w-3 h-3" /> Meter
                            </button>
                            <button
                                onClick={() => setActiveTab('INSPECTION')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 ${
                                    activeTab === 'INSPECTION' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                                }`}
                            >
                                <ClipboardCheck className="w-3 h-3" /> Inspection
                            </button>
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 text-stone-400 w-4.5 h-4.5" />
                            <input
                                type="text"
                                placeholder="Search assigned customers..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-2.5 bg-white border border-stone-200 rounded-xl text-xs w-full focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
                            />
                        </div>
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
                                const isGeoOk = cust.geo_tag_status === 'Yes' || cust.geo_tag_status === 'Proceed';
                                const isMeterOk = cust.meter_installation === 'Yes';
                                const isInspOk = cust.discom_inspection === 'Yes';

                                return (
                                    <div 
                                        key={cust.id} 
                                        onClick={() => handleSelectCustomer(cust)}
                                        className="bg-white p-4 rounded-2xl border border-stone-150 shadow-sm hover:border-amber-400 transition-all flex justify-between items-center cursor-pointer active:scale-[0.99] group"
                                    >
                                        <div className="space-y-1.5 min-w-0 pr-2">
                                            <p className="text-xs font-bold text-stone-850 truncate group-hover:text-amber-600 transition-colors">{cust.customer_name}</p>
                                            <p className="text-[10px] text-stone-400 font-medium truncate">{cust.villages || 'Address not specified'}</p>
                                            
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isGeoOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100'
                                                }`}>
                                                    Geo: {cust.geo_tag_status || 'Pending'}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isMeterOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                                }`}>
                                                    Meter: {cust.meter_installation || 'No'}
                                                </span>
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                                                    isInspOk ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'
                                                }`}>
                                                    Insp: {cust.discom_inspection || 'No'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleOpenBomModal(cust);
                                                }}
                                                className="text-[10px] font-bold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
                                                title="View & Print BOM"
                                            >
                                                <Printer size={11} /> Print BOM
                                            </button>
                                            <ChevronRight className="w-4.5 h-4.5 text-stone-300 group-hover:text-stone-700 transition-colors" />
                                        </div>
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
                            onClick={() => handleOpenBomModal(selectedCust)}
                            className="text-[11px] font-bold text-stone-800 hover:text-stone-950 bg-white hover:bg-stone-50 border border-stone-200 px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                            <Printer size={12} className="text-amber-600" /> Print BOM
                        </button>
                    </div>

                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <div className="border-b border-stone-100 pb-3">
                            <h2 className="text-base font-bold text-stone-850">{selectedCust.customer_name}</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-1">Consumer No: {selectedCust.consumer_no || '–'}</p>
                        </div>

                        {/* Editable Form Card */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-stone-100 pb-1.5">
                                {activeTab === 'GEO' 
                                    ? 'Geo Tag Photo Report' 
                                    : activeTab === 'METER' 
                                        ? 'Meter Installation Report' 
                                        : 'Discom Inspection Report'}
                            </h3>
                            
                            {/* ─── Active Tab: GEO TAG PHOTO ─── */}
                            {activeTab === 'GEO' && (
                                <div className="space-y-4">
                                    {/* Status selector */}
                                    <div className="space-y-2">
                                        <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">
                                            Geo Tag Photo Status
                                        </label>
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                            {[
                                                { id: 'Yes', label: 'Yes', activeClass: 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10', dotClass: 'bg-white' },
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
                                </div>
                            )}

                            {/* ─── Active Tab: METER INSTALLATION ─── */}
                            {activeTab === 'METER' && (
                                <div className="space-y-3">
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">Meter Installation Status</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setMeterStatus('No')}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                                                meterStatus === 'No'
                                                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10'
                                                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${meterStatus === 'No' ? 'bg-white' : 'bg-stone-300'}`} />
                                            No
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeterStatus('Yes');
                                                if (!installationDate) setInstallationDate(new Date().toISOString().split('T')[0]);
                                            }}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                                                meterStatus === 'Yes'
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10'
                                                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${meterStatus === 'Yes' ? 'bg-white' : 'bg-stone-300'}`} />
                                            Yes
                                        </button>
                                    </div>

                                    {meterStatus === 'Yes' && (
                                        <div className="pt-2">
                                            <label className="block text-[8px] font-bold text-stone-400 uppercase tracking-wider mb-1">Installation Date</label>
                                            <input
                                                type="date"
                                                value={installationDate}
                                                onChange={e => setInstallationDate(e.target.value)}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold text-stone-700"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ─── Active Tab: DISCOM INSPECTION ─── */}
                            {activeTab === 'INSPECTION' && (
                                <div className="space-y-3">
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">Discom Inspection Status</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setDiscomInspection('No')}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                                                discomInspection === 'No'
                                                    ? 'bg-red-600 text-white border-red-600 shadow-md shadow-red-600/10'
                                                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${discomInspection === 'No' ? 'bg-white' : 'bg-stone-300'}`} />
                                            No
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDiscomInspection('Yes')}
                                            className={`py-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 ${
                                                discomInspection === 'Yes'
                                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/10'
                                                    : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-600'
                                            }`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${discomInspection === 'Yes' ? 'bg-white' : 'bg-stone-300'}`} />
                                            Yes
                                        </button>
                                    </div>
                                </div>
                            )}

                            {saveSuccess && (
                                <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl text-[10px] font-bold flex items-center gap-1.5 animate-in fade-in duration-200">
                                    <CheckCircle2 className="w-4.5 h-4.5 flex-shrink-0" />
                                    <span>Changes saved successfully!</span>
                                </div>
                            )}

                            <div className="pt-2">
                                {activeTab === 'GEO' ? (
                                    (geoTagStatus === 'Yes' || geoTagStatus === 'Proceed') ? (
                                        <button
                                            onClick={() => handleSaveChanges('DISCOM SUBMISSION')}
                                            disabled={saving}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Moving Stage...</>
                                            ) : (
                                                'Move to Discom Submission'
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving}
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    )
                                ) : activeTab === 'METER' ? (
                                    meterStatus === 'Yes' ? (
                                        <button
                                            onClick={() => handleSaveChanges('DISCOM INSPECTION')}
                                            disabled={saving}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Moving Stage...</>
                                            ) : (
                                                'Move to Discom Inspection'
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving}
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    )
                                ) : (
                                    discomInspection === 'Yes' ? (
                                        <button
                                            onClick={() => handleSaveChanges('SUBSIDY STATUS')}
                                            disabled={saving}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Moving Stage...</>
                                            ) : (
                                                'Move to Subsidy Status'
                                            )}
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handleSaveChanges(null)}
                                            disabled={saving}
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                                        >
                                            {saving ? (
                                                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
                                            ) : (
                                                'Save Changes'
                                            )}
                                        </button>
                                    )
                                )}
                            </div>
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
                />
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
