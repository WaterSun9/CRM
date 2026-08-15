import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { logActivity } from '../utils';
import { 
    User, Phone, Mail, MapPin, Zap, Building2, Sun,
    CheckCircle2, ChevronRight, LogOut, Loader2, AlertCircle,
    Hash, Folder, Tag, ChevronLeft, Search, ClipboardList, Banknote, Calendar, ClipboardCheck
} from 'lucide-react';

export default function VendorPortal({ user, onLogout }) {
    const [view, setView] = useState('list'); // 'list', 'details'
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('METER'); // 'METER', 'INSPECTION'
    const [selectedCust, setSelectedCust] = useState(null);
    
    // Edit Form State (for selected customer)
    const [meterStatus, setMeterStatus] = useState('No');
    const [installationDate, setInstallationDate] = useState('');
    const [discomInspection, setDiscomInspection] = useState('No');
    const [saving, setSaving] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

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
    const handleSelectCustomer = (cust) => {
        setSelectedCust(cust);
        
        // Pre-fill meter installation
        setMeterStatus(cust.meter_installation || 'No');
        setInstallationDate(cust.installation_date || new Date().toISOString().split('T')[0]);
        
        // Pre-fill discom inspection
        setDiscomInspection(cust.discom_inspection || 'No');
        
        setView('details');
        setSaveSuccess(false);
    };

    // Save changes to Supabase and optionally progress stage
    const handleSaveChanges = async (nextStage = null) => {
        setSaving(true);
        setSaveSuccess(false);
        try {
            const computedInstDate = meterStatus === 'Yes' ? (installationDate || new Date().toISOString().split('T')[0]) : null;

            const updatePayload = {
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
                let logMsg = `Vendor ${user.name} updated Meter Status (${meterStatus}) & Discom Inspection (${discomInspection})`;
                if (nextStage) {
                    logMsg += ` and advanced stage to ${nextStage}`;
                }

                await logActivity(
                    user.id,
                    'update',
                    `${selectedCust.customer_name}: ${logMsg} (Installation Date: ${computedInstDate || 'N/A'})`,
                    '',
                    selectedCust.id
                );
                
                setSaveSuccess(true);
                // Refresh list locally
                fetchCustomers();
                
                // Update selectedCust reference in view
                setSelectedCust(prev => ({
                    ...prev,
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
    const meterPendingCount = customers.filter(c => c.stage === 'METER INSTALLATION' && c.meter_installation !== 'Yes').length;
    const inspectionPendingCount = customers.filter(c => c.stage === 'DISCOM INSPECTION' && (c.discom_inspection || 'No') !== 'Yes').length;

    // Filtered lists depending on active tab & search query
    const filteredCustomers = customers.filter(c => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
            c.customer_name?.toLowerCase().includes(q) ||
            c.phone_number?.includes(searchQuery) ||
            c.villages?.toLowerCase().includes(q);

        if (activeTab === 'METER') {
            return matchesSearch && c.stage === 'METER INSTALLATION';
        } else {
            return matchesSearch && c.stage === 'DISCOM INSPECTION';
        }
    });

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
                        <p className="text-[11px] text-stone-300 mt-2 font-medium">Verify installations and inspection reports.</p>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Meter Pending</p>
                            <p className="text-lg font-black text-stone-850 mt-1">{meterPendingCount}</p>
                        </div>
                        <div className="bg-white p-3.5 rounded-2xl border border-stone-100 shadow-sm">
                            <p className="text-[9px] text-stone-400 font-bold uppercase tracking-wider">Inspection Pending</p>
                            <p className="text-lg font-black text-stone-850 mt-1">{inspectionPendingCount}</p>
                        </div>
                    </div>

                    {/* Tabs & Search */}
                    <div className="space-y-3 pt-2">
                        <div className="bg-stone-100 p-0.5 rounded-xl flex">
                            <button
                                onClick={() => setActiveTab('METER')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'METER' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                                }`}
                            >
                                <Zap className="w-3 h-3" /> Meter Installation
                            </button>
                            <button
                                onClick={() => setActiveTab('INSPECTION')}
                                className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1.5 ${
                                    activeTab === 'INSPECTION' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500'
                                }`}
                            >
                                <ClipboardCheck className="w-3 h-3" /> Discom Inspection
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
                                                {isMeterOk ? (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        Meter: Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                                                        Meter: No
                                                    </span>
                                                )}
                                                {isInspOk ? (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                        Inspection: Yes
                                                    </span>
                                                ) : (
                                                    <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-100">
                                                        Inspection: No
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-stone-300 flex-shrink-0 group-hover:text-stone-700 transition-colors" />
                                    </div>
                                );
                            })
                        ) : (
                            <div className="bg-white p-8 rounded-2xl border border-stone-100 text-center text-stone-400 shadow-sm">
                                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                                <p className="text-xs font-bold">No assigned installations found.</p>
                            </div>
                        )}
                    </div>
                </main>
            ) : (
                /* Customer Details & Editing View */
                <main className="flex-1 p-4 max-w-md mx-auto w-full space-y-4 animate-in slide-in-from-right duration-300">
                    <button
                        onClick={() => setView('list')}
                        className="flex items-center gap-1 text-xs font-bold text-stone-500 hover:text-stone-800 transition-colors py-1"
                    >
                        <ChevronLeft className="w-4.5 h-4.5" /> Back to Dashboard
                    </button>

                    <div className="bg-white p-5 rounded-[24px] border border-stone-150 shadow-sm space-y-4">
                        <div className="border-b border-stone-100 pb-3">
                            <h2 className="text-base font-bold text-stone-850">{selectedCust.customer_name}</h2>
                            <p className="text-[10px] text-stone-400 font-semibold mt-1">Consumer No: {selectedCust.consumer_no || '–'}</p>
                        </div>

                        {/* Editable Form Card */}
                        <div className="space-y-4">
                            <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-stone-100 pb-1.5">
                                {activeTab === 'METER' ? 'Meter Installation Report' : 'Discom Inspection Report'}
                            </h3>
                            
                            {activeTab === 'METER' ? (
                                /* Meter Installation Section */
                                <div className="space-y-3">
                                    <label className="block text-[9px] font-bold text-stone-400 uppercase tracking-wider">Meter Installation Status</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMeterStatus('No');
                                            }}
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
                            ) : (
                                /* Discom Inspection Section */
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
                                {activeTab === 'METER' ? (
                                    meterStatus === 'Yes' ? (
                                        <button
                                            onClick={() => handleSaveChanges('DISCOM INSPECTION')}
                                            disabled={saving}
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98]"
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
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98]"
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
                                            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-amber-500/10 disabled:opacity-50 transition-all active:scale-[0.98]"
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
                                            className="w-full bg-stone-900 hover:bg-stone-850 text-white font-bold text-xs py-3.5 rounded-xl flex items-center justify-center gap-1.5 disabled:opacity-50 transition-all active:scale-[0.98]"
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
        </div>
    );
}
