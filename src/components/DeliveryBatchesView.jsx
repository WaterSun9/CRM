import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Truck, Plus, Search, Filter, Calendar, User, Phone, MapPin, 
    Zap, Layers, Printer, Edit3, Trash2, CheckCircle2, AlertCircle, 
    ChevronDown, ChevronUp, Package, X, Check, ArrowRight, FileText, Clock, ExternalLink
} from 'lucide-react';
import { supabase } from '../supabase';
import { PRIMARY_STAGES } from '../constants';
import { formatINR, toIndianCommas, logActivity } from '../utils';
import { getStoredDemoCustomers } from '../mock/demoData';

export default function DeliveryBatchesView({ 
    currentUser, 
    customers: propCustomers = [], 
    onRefreshCustomers,
    onOpenCustomerModal,
    isDemoMode = false 
}) {
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'IN_TRANSIT', 'DELIVERED'
    const [expandedBatchId, setExpandedBatchId] = useState(null);
    const [allCustomers, setAllCustomers] = useState([]);

    // Fetch all customers for the batch dropdown and manifest
    const fetchAllCustomers = async () => {
        if (isDemoMode) {
            setAllCustomers(getStoredDemoCustomers().filter(c => !c.deleted_at));
            return;
        }
        try {
            const { data, error } = await supabase
                .from('admin')
                .select('*')
                .is('deleted_at', null)
                .order('created_at', { ascending: false });
            if (!error && data) {
                setAllCustomers(data);
            }
        } catch (e) {
            console.error('Error fetching customers in DeliveryBatchesView:', e);
        }
    };

    useEffect(() => {
        fetchAllCustomers();
    }, [isDemoMode]);

    const customers = propCustomers && propCustomers.length > 0 ? propCustomers : allCustomers;
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [printingBatch, setPrintingBatch] = useState(null);
    const printableRef = useRef(null);

    // Form state for Create / Edit Batch
    const [batchForm, setBatchForm] = useState({
        batch_no: '',
        dispatch_date: new Date().toISOString().split('T')[0],
        driver_name: '',
        driver_phone: '',
        vehicle_number: '',
        vendor: '',
        notes: '',
        status: 'IN_TRANSIT',
        selectedProjectIds: []
    });

    const [projectSearchQuery, setProjectSearchQuery] = useState('');
    const [projectStageFilter, setProjectStageFilter] = useState('MATERIAL DELIVERY');
    const [saving, setSaving] = useState(false);
    const [vendorsList, setVendorsList] = useState([]);

    // Fetch vendors for dropdown
    useEffect(() => {
        const fetchVendors = async () => {
            try {
                const { data } = await supabase.from('vendors').select('name').order('name');
                if (data) setVendorsList(data.map(v => v.name));
            } catch (e) {
                console.error('Error fetching vendors in batches view:', e);
            }
        };
        fetchVendors();
    }, []);

    // Load Batches from Database or LocalStorage (with demo mode support)
    const fetchBatches = async () => {
        setLoading(true);
        try {
            if (isDemoMode) {
                const stored = localStorage.getItem('watersun_demo_delivery_batches');
                if (stored) {
                    setBatches(JSON.parse(stored));
                } else {
                    // Seed initial demo batch
                    const demoBatch = [{
                        id: 'BATCH-2026-001',
                        batch_no: 'BATCH-2026-001 (North Gujarat Run)',
                        dispatch_date: new Date().toISOString().split('T')[0],
                        driver_name: 'Ramesh Kumar',
                        driver_phone: '9876543210',
                        vehicle_number: 'GJ-02-XY-8419',
                        vendor: 'Om Solar',
                        status: 'IN_TRANSIT',
                        notes: 'Handle fragile mono-perc solar panels with care.',
                        project_ids: customers.slice(0, 3).map(c => c.id),
                        created_at: new Date().toISOString()
                    }];
                    localStorage.setItem('watersun_demo_delivery_batches', JSON.stringify(demoBatch));
                    setBatches(demoBatch);
                }
            } else {
                // Try fetching from delivery_batches table
                const { data, error } = await supabase
                    .from('delivery_batches')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    setBatches(data);
                } else {
                    // Fallback to synthesizing batches from localStorage
                    const localStored = localStorage.getItem('watersun_local_delivery_batches');
                    if (localStored) {
                        setBatches(JSON.parse(localStored));
                    } else {
                        setBatches([]);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to load delivery batches:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, [isDemoMode]);

    // Save Batches Helper
    const saveBatchesState = async (updatedBatches) => {
        setBatches(updatedBatches);
        if (isDemoMode) {
            localStorage.setItem('watersun_demo_delivery_batches', JSON.stringify(updatedBatches));
        } else {
            localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(updatedBatches));
            try {
                // Also attempt syncing with Supabase if table exists
                await supabase.from('delivery_batches').upsert(updatedBatches);
            } catch (e) {}
        }
    };

    // Open Create Modal
    const handleOpenCreateModal = () => {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const today = new Date().toISOString().split('T')[0];
        setBatchForm({
            batch_no: `BATCH-${today.replace(/-/g, '').slice(2)}-${randNum}`,
            dispatch_date: today,
            driver_name: '',
            driver_phone: '',
            vehicle_number: '',
            vendor: vendorsList[0] || 'Om Solar',
            notes: '',
            status: 'IN_TRANSIT',
            selectedProjectIds: []
        });
        setEditingBatch(null);
        setProjectStageFilter('MATERIAL DELIVERY');
        setProjectSearchQuery('');
        setShowCreateModal(true);
    };

    // Open Edit Modal
    const handleOpenEditModal = (batch) => {
        setBatchForm({
            id: batch.id,
            batch_no: batch.batch_no || '',
            dispatch_date: batch.dispatch_date || new Date().toISOString().split('T')[0],
            driver_name: batch.driver_name || '',
            driver_phone: batch.driver_phone || '',
            vehicle_number: batch.vehicle_number || '',
            vendor: batch.vendor || '',
            notes: batch.notes || '',
            status: batch.status || 'IN_TRANSIT',
            selectedProjectIds: batch.project_ids || []
        });
        setEditingBatch(batch);
        setShowCreateModal(true);
    };

    // Toggle Project Selection in Creation Modal
    const toggleProjectSelection = (projectId) => {
        setBatchForm(prev => {
            const exists = prev.selectedProjectIds.includes(projectId);
            const next = exists 
                ? prev.selectedProjectIds.filter(id => id !== projectId)
                : [...prev.selectedProjectIds, projectId];
            return { ...prev, selectedProjectIds: next };
        });
    };

    // Save Batch & Bulk Update Selected Projects in Supabase
    const handleSaveBatch = async (e) => {
        if (e) e.preventDefault();
        if (batchForm.selectedProjectIds.length === 0) {
            alert('Please select at least 1 project to include in this delivery batch.');
            return;
        }

        setSaving(true);
        try {
            const batchId = editingBatch ? editingBatch.id : `BATCH-${Date.now()}`;
            const batchPayload = {
                id: batchId,
                batch_no: batchForm.batch_no || batchId,
                dispatch_date: batchForm.dispatch_date,
                driver_name: batchForm.driver_name,
                driver_phone: batchForm.driver_phone,
                vehicle_number: batchForm.vehicle_number,
                vendor: batchForm.vendor,
                notes: batchForm.notes,
                status: batchForm.status,
                project_ids: batchForm.selectedProjectIds,
                created_at: editingBatch?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            let updatedBatches;
            if (editingBatch) {
                updatedBatches = batches.map(b => b.id === editingBatch.id ? batchPayload : b);
            } else {
                updatedBatches = [batchPayload, ...batches];
            }

            await saveBatchesState(updatedBatches);

            // Bulk update selected projects in admin table with shared delivery metadata
            const customerUpdates = {
                delivery_batch_id: batchPayload.batch_no,
                material_delivery_date: batchPayload.dispatch_date,
                driver_name: batchPayload.driver_name,
                driver_phone_number: batchPayload.driver_phone,
                vehicle_number: batchPayload.vehicle_number,
                vendor: batchPayload.vendor
            };

            for (const projId of batchForm.selectedProjectIds) {
                if (!String(projId).startsWith('demo-')) {
                    await supabase
                        .from('admin')
                        .update(customerUpdates)
                        .eq('id', projId);
                }
            }

            if (onRefreshCustomers) onRefreshCustomers();
            setShowCreateModal(false);
        } catch (err) {
            console.error('Error saving delivery batch:', err);
            alert('Failed to save batch: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    // Disband / Delete Batch
    const handleDeleteBatch = async (batchId) => {
        if (!window.confirm('Are you sure you want to disband this delivery batch? The projects will remain intact.')) return;
        const batchToDelete = batches.find(b => b.id === batchId);
        const updatedBatches = batches.filter(b => b.id !== batchId);
        await saveBatchesState(updatedBatches);

        // Clear delivery_batch_id from linked projects
        if (batchToDelete?.project_ids) {
            for (const projId of batchToDelete.project_ids) {
                if (!String(projId).startsWith('demo-')) {
                    await supabase
                        .from('admin')
                        .update({ delivery_batch_id: null })
                        .eq('id', projId);
                }
            }
        }
        if (onRefreshCustomers) onRefreshCustomers();
    };

    // Filter projects for the creation selector
    const eligibleProjects = useMemo(() => {
        return customers.filter(c => {
            if (c.deleted_at) return false;
            const matchesQuery = !projectSearchQuery || 
                (c.customer_name || '').toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                (c.phone_number || '').includes(projectSearchQuery) ||
                (c.villages || '').toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
                (c.consumer_no || '').includes(projectSearchQuery);
            
            const matchesStage = projectStageFilter === 'ALL' || c.stage === projectStageFilter;
            return matchesQuery && matchesStage;
        });
    }, [customers, projectSearchQuery, projectStageFilter]);

    // Filter Batches by search & status
    const filteredBatches = useMemo(() => {
        return batches.filter(b => {
            const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchesQuery = !searchQuery ||
                (b.batch_no || '').toLowerCase().includes(q) ||
                (b.driver_name || '').toLowerCase().includes(q) ||
                (b.vehicle_number || '').toLowerCase().includes(q) ||
                (b.vendor || '').toLowerCase().includes(q);
            return matchesStatus && matchesQuery;
        });
    }, [batches, searchQuery, statusFilter]);

    // Top Aggregate Metrics
    const metrics = useMemo(() => {
        const totalBatches = batches.length;
        const inTransit = batches.filter(b => b.status === 'IN_TRANSIT').length;
        const totalProjectIds = new Set(batches.flatMap(b => b.project_ids || []));
        const batchedCustomers = customers.filter(c => totalProjectIds.has(c.id));
        const totalKwp = batchedCustomers.reduce((acc, c) => acc + (parseFloat(c.system_capacity_kwp) || 0), 0);
        return {
            totalBatches,
            inTransit,
            totalProjects: totalProjectIds.size,
            totalKwp: totalKwp.toFixed(1)
        };
    }, [batches, customers]);

    // Print Handler
    const handlePrintChallan = () => {
        const documentBody = printableRef.current;
        if (!documentBody) return;

        const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
            .map(element => element.outerHTML)
            .join('');
        const printFrame = document.createElement('iframe');
        printFrame.setAttribute('aria-hidden', 'true');
        printFrame.style.cssText = 'position:fixed;width:1px;height:1px;right:0;bottom:0;border:0;opacity:0;pointer-events:none;';

        const cleanBatch = (printingBatch?.batch_no || printingBatch?.id || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanVehicle = (printingBatch?.vehicle_number || 'Vehicle').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docTitle = `Master_Delivery_Gate_Pass_${cleanBatch}_${cleanVehicle}`;
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
        printFrame.srcdoc = `<!doctype html><html><head><title>${docTitle}</title>${styles}<style>@page { size: A4 portrait; margin: 10mm; } body { margin: 0; color: #1c1917; background: #fff; } .print-container { border: 1px solid #78716c; padding: 8mm !important; }</style></head><body><main class="print-container">${documentBody.innerHTML}</main></body></html>`;
        document.body.appendChild(printFrame);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Quick Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-stone-200/80 shadow-xs">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-amber-500 text-white rounded-2xl shadow-md shadow-amber-500/20">
                            <Truck size={22} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black text-stone-900 uppercase tracking-wide">
                                Material Delivery Batches
                            </h1>
                            <p className="text-xs text-stone-500 font-medium mt-0.5">
                                Club multiple customer projects into unified dispatch trips & print combined master gate passes.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={handleOpenCreateModal}
                    className="px-4 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl text-xs font-bold transition flex items-center gap-2 shadow-md shadow-stone-900/10 cursor-pointer self-start sm:self-auto"
                >
                    <Plus size={16} /> Create Delivery Batch
                </button>
            </div>

            {/* 4 Metric Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Total Batches</span>
                    <p className="text-2xl font-black text-stone-900">{metrics.totalBatches}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Recorded dispatch trips</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">In Transit</span>
                    <p className="text-2xl font-black text-amber-600">{metrics.inTransit}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Active truck runs</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Clubbed Sites</span>
                    <p className="text-2xl font-black text-stone-900">{metrics.totalProjects}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Projects in delivery</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Batched Capacity</span>
                    <p className="text-2xl font-black text-stone-900">{metrics.totalKwp} <span className="text-xs font-bold text-stone-400">kWp</span></p>
                    <span className="text-[11px] text-stone-500 font-medium">Total solar payload</span>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-stone-200/80 shadow-2xs">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search batch #, driver, vehicle, vendor..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:border-amber-400 transition"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {['ALL', 'IN_TRANSIT', 'DELIVERED'].map((status) => (
                        <button
                            key={status}
                            type="button"
                            onClick={() => setStatusFilter(status)}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                statusFilter === status
                                    ? 'bg-stone-900 text-white shadow-xs'
                                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200/70'
                            }`}
                        >
                            {status === 'ALL' ? 'All Batches' : status === 'IN_TRANSIT' ? 'In Transit' : 'Delivered'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Batch Cards List */}
            {loading ? (
                <div className="py-16 text-center text-stone-400">
                    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold">Loading delivery batches...</p>
                </div>
            ) : filteredBatches.length === 0 ? (
                <div className="bg-white border border-stone-200 rounded-3xl p-12 text-center text-stone-400 space-y-3">
                    <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 mx-auto">
                        <Truck size={24} />
                    </div>
                    <h3 className="text-sm font-bold text-stone-800">No delivery batches found</h3>
                    <p className="text-xs text-stone-500 max-w-sm mx-auto">
                        Club 2 or more projects sharing the same truck trip into a unified delivery batch.
                    </p>
                    <button
                        onClick={handleOpenCreateModal}
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                        <Plus size={14} /> Create First Batch
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredBatches.map((batch) => {
                        const isExpanded = expandedBatchId === batch.id;
                        const linkedProjects = customers.filter(c => (batch.project_ids || []).includes(c.id));
                        const batchKwp = linkedProjects.reduce((sum, p) => sum + (parseFloat(p.system_capacity_kwp) || 0), 0);
                        const totalModules = linkedProjects.reduce((sum, p) => sum + (parseInt(p.no_of_modules) || 0), 0);

                        return (
                            <div 
                                key={batch.id} 
                                className="bg-white rounded-3xl border border-stone-200/80 shadow-xs hover:shadow-md transition-all overflow-hidden"
                            >
                                {/* Card Header / Top Bar */}
                                <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-stone-100">
                                    <div className="space-y-1">
                                        <div className="flex flex-wrap items-center gap-2.5">
                                            <span className="text-xs font-black text-stone-950 uppercase tracking-wider bg-stone-100 px-2.5 py-1 rounded-lg">
                                                {batch.batch_no || batch.id}
                                            </span>
                                            <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full ${
                                                batch.status === 'DELIVERED' 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }`}>
                                                {batch.status === 'DELIVERED' ? 'Delivered' : 'In Transit'}
                                            </span>
                                            <span className="text-xs text-stone-400 font-medium">
                                                Dispatched: <strong className="text-stone-700">{batch.dispatch_date || '–'}</strong>
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs text-stone-600">
                                            {batch.vehicle_number && (
                                                <span className="flex items-center gap-1 font-semibold text-stone-900 bg-stone-50 px-2 py-0.5 rounded-md border border-stone-200/60">
                                                    <Truck size={12} className="text-amber-500" /> {batch.vehicle_number}
                                                </span>
                                            )}
                                            {batch.driver_name && (
                                                <span className="flex items-center gap-1">
                                                    <User size={12} className="text-stone-400" /> {batch.driver_name} {batch.driver_phone ? `(${batch.driver_phone})` : ''}
                                                </span>
                                            )}
                                            {batch.vendor && (
                                                <span className="flex items-center gap-1 font-medium text-stone-500">
                                                    <Package size={12} className="text-stone-400" /> Vendor: <strong className="text-stone-700">{batch.vendor}</strong>
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 self-start md:self-auto flex-shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setPrintingBatch(batch)}
                                            className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                            title="Print Combined Delivery Challan / Gate Pass"
                                        >
                                            <Printer size={13} /> Print Gate Pass
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleOpenEditModal(batch)}
                                            className="p-1.5 text-stone-500 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                                            title="Edit Batch Logistics"
                                        >
                                            <Edit3 size={15} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDeleteBatch(batch.id)}
                                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                            title="Disband Batch"
                                        >
                                            <Trash2 size={15} />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                            className="ml-1 p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition cursor-pointer"
                                        >
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Clubbed Manifest Summary Bar */}
                                <div className="bg-stone-50/70 px-5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs border-b border-stone-100">
                                    <div className="flex items-center gap-4 text-stone-600 font-medium">
                                        <span>Clubbed Sites: <strong className="text-stone-900">{linkedProjects.length} Projects</strong></span>
                                        <span>Total Capacity: <strong className="text-stone-900">{batchKwp.toFixed(1)} kWp</strong></span>
                                        <span>Total Modules: <strong className="text-stone-900">{totalModules} Panels</strong></span>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                        className="text-amber-700 hover:text-amber-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                    >
                                        {isExpanded ? 'Hide project details' : `View ${linkedProjects.length} drop-off locations`}
                                        {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                    </button>
                                </div>

                                {/* Expandable Project Drop-Off Table */}
                                {isExpanded && (
                                    <div className="p-5 overflow-x-auto animate-in fade-in duration-200">
                                        <table className="min-w-full text-xs divide-y divide-stone-100">
                                            <thead>
                                                <tr className="text-[9px] font-black uppercase tracking-wider text-stone-400 text-left">
                                                    <th className="pb-2 w-8">#</th>
                                                    <th className="pb-2">Customer & Contact</th>
                                                    <th className="pb-2">Village / Sub-Division</th>
                                                    <th className="pb-2">System Specs</th>
                                                    <th className="pb-2">Inverter & Serials</th>
                                                    <th className="pb-2">Current Stage</th>
                                                    <th className="pb-2 text-right">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-stone-100 font-medium text-stone-700">
                                                {linkedProjects.map((proj, idx) => (
                                                    <tr key={proj.id} className="hover:bg-stone-50/60 transition-colors">
                                                        <td className="py-2.5 font-bold text-stone-400">{idx + 1}</td>
                                                        <td className="py-2.5">
                                                            <p className="font-bold text-stone-900">{proj.customer_name}</p>
                                                            <p className="text-[10px] text-stone-500">{proj.phone_number || '–'}</p>
                                                        </td>
                                                        <td className="py-2.5">
                                                            <p className="font-semibold text-stone-800">{proj.villages || '–'}</p>
                                                            <p className="text-[10px] text-stone-400">{proj.sub_divisions || ''}</p>
                                                        </td>
                                                        <td className="py-2.5">
                                                            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                                                                {proj.system_capacity_kwp ? `${proj.system_capacity_kwp} kWp` : '–'}
                                                            </span>
                                                            <span className="text-[10px] text-stone-500 block mt-0.5">
                                                                {proj.no_of_modules ? `${proj.no_of_modules} Modules` : ''}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 text-[11px]">
                                                            <p className="font-semibold text-stone-800">{proj.inverter_make || '–'}</p>
                                                            <p className="text-[10px] font-mono text-stone-500">{proj.inverter_serial_no || '–'}</p>
                                                        </td>
                                                        <td className="py-2.5">
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                                                                {PRIMARY_STAGES.find(s => s.id === proj.stage)?.label || proj.stage}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 text-right">
                                                            <button
                                                                type="button"
                                                                onClick={() => onOpenCustomerModal && onOpenCustomerModal(proj)}
                                                                className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                                                            >
                                                                Open Site <ExternalLink size={10} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal 1: Create / Edit Delivery Batch Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Truck className="w-5 h-5 text-amber-400" />
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wider">
                                        {editingBatch ? 'Edit Delivery Batch' : 'Create Material Delivery Batch'}
                                    </h3>
                                    <p className="text-[10px] text-stone-400 font-medium">
                                        Group 2–10 projects into a single vehicle dispatch run.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowCreateModal(false)}
                                className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSaveBatch} className="flex-1 overflow-y-auto p-6 space-y-6">
                            {/* Section A: Transit & Vehicle Information */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 border-b border-stone-100 pb-1.5 flex items-center gap-1.5">
                                    <Truck size={14} className="text-amber-500" /> 1. Vehicle & Transit Logistics
                                </h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Batch Number / Trip Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={batchForm.batch_no}
                                            onChange={e => setBatchForm(p => ({ ...p, batch_no: e.target.value }))}
                                            placeholder="e.g. BATCH-24AUG-001"
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Dispatch / Delivery Date <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="date"
                                            required
                                            value={batchForm.dispatch_date}
                                            onChange={e => setBatchForm(p => ({ ...p, dispatch_date: e.target.value }))}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Vehicle / Truck Registration Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={batchForm.vehicle_number}
                                            onChange={e => setBatchForm(p => ({ ...p, vehicle_number: e.target.value }))}
                                            placeholder="e.g. GJ-01-AB-1234"
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Driver Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={batchForm.driver_name}
                                            onChange={e => setBatchForm(p => ({ ...p, driver_name: e.target.value }))}
                                            placeholder="e.g. Ramesh Kumar"
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Driver Phone Number <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="tel"
                                            required
                                            value={batchForm.driver_phone}
                                            onChange={e => setBatchForm(p => ({ ...p, driver_phone: e.target.value }))}
                                            placeholder="e.g. 9876543210"
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-amber-400"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Warehouse / Allotted Vendor <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={batchForm.vendor}
                                            onChange={e => setBatchForm(p => ({ ...p, vendor: e.target.value }))}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        >
                                            <option value="">Select Vendor...</option>
                                            {vendorsList.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Section B: Project Selector Checklist */}
                            <div className="space-y-3 pt-2 border-t border-stone-100">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2">
                                    <div>
                                        <h4 className="text-xs font-black uppercase tracking-wider text-stone-800 flex items-center gap-1.5">
                                            <Layers size={14} className="text-amber-500" /> 2. Select Projects to Club on this Truck
                                        </h4>
                                        <p className="text-[10px] text-stone-400">
                                            Selected: <strong className="text-stone-900">{batchForm.selectedProjectIds.length} Projects</strong>
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            placeholder="Filter projects..."
                                            value={projectSearchQuery}
                                            onChange={e => setProjectSearchQuery(e.target.value)}
                                            className="bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1 text-xs outline-none focus:bg-white focus:border-amber-400 w-44"
                                        />
                                        <select
                                            value={projectStageFilter}
                                            onChange={e => setProjectStageFilter(e.target.value)}
                                            className="bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-xs font-bold text-stone-700 outline-none"
                                        >
                                            <option value="MATERIAL DELIVERY">Material Delivery (Current Stage)</option>
                                            <option value="MATERIAL INTEGRATION">Material Integration</option>
                                            <option value="MATERIAL ORDER">Material Order</option>
                                            <option value="ALL">All Stages</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Project Checklist Cards */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 max-h-64 overflow-y-auto p-1 bg-stone-50/60 rounded-2xl border border-stone-200/70">
                                    {eligibleProjects.map(proj => {
                                        const isSelected = batchForm.selectedProjectIds.includes(proj.id);
                                        return (
                                            <div
                                                key={proj.id}
                                                onClick={() => toggleProjectSelection(proj.id)}
                                                className={`p-3 rounded-xl border transition-all cursor-pointer select-none flex items-start gap-2.5 ${
                                                    isSelected
                                                        ? 'bg-amber-50 border-amber-400 shadow-xs'
                                                        : 'bg-white border-stone-200/80 hover:border-stone-300'
                                                }`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => {}}
                                                    className="mt-0.5 accent-amber-500 w-4 h-4 rounded"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-bold text-stone-900 truncate">{proj.customer_name}</p>
                                                    <p className="text-[10px] text-stone-500 truncate">{proj.villages || 'No village'} · {proj.phone_number}</p>
                                                    <div className="flex items-center justify-between text-[10px] mt-1 pt-1 border-t border-stone-100">
                                                        <span className="font-bold text-amber-800">{proj.system_capacity_kwp || '–'} kWp</span>
                                                        <span className="text-stone-400 font-semibold">{proj.stage}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section C: Optional Notes */}
                            <div>
                                <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                    Transit Notes / Gate Instructions (Optional)
                                </label>
                                <textarea
                                    rows={2}
                                    value={batchForm.notes}
                                    onChange={e => setBatchForm(p => ({ ...p, notes: e.target.value }))}
                                    placeholder="Add any special transport notes, security gate passes, or route instructions..."
                                    className="w-full bg-white border border-stone-200 rounded-xl p-2.5 text-xs text-stone-800 outline-none focus:border-amber-400"
                                />
                            </div>

                            {/* Footer Buttons */}
                            <div className="pt-4 border-t border-stone-100 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition shadow-md shadow-stone-900/10 cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? 'Saving & Dispatching...' : editingBatch ? 'Update Batch' : 'Save & Assign Batch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Master Gate Pass & Delivery Challan Printable Sheet */}
            {printingBatch && (
                <div className="fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
                        {/* Print Header */}
                        <div className="px-6 py-4 bg-stone-900 text-white flex items-center justify-between no-print">
                            <div className="flex items-center gap-2">
                                <Printer size={18} className="text-amber-400" />
                                <h3 className="text-sm font-black uppercase tracking-wider">
                                    Master Gate Pass Preview — {printingBatch.batch_no}
                                </h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrintChallan}
                                    className="bg-amber-500 hover:bg-amber-400 text-stone-950 px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                    <Printer size={14} /> Print Document
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPrintingBatch(null)}
                                    className="text-stone-400 hover:text-white p-1 rounded-lg transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Printable Body */}
                        <div ref={printableRef} className="flex-1 overflow-y-auto p-8 bg-white text-stone-900 print-document" id="printable-master-batch">
                            {/* Company Header */}
                            <div className="border-b-2 border-stone-900 pb-4 mb-5 text-center">
                                <h1 className="text-xl font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                                <p className="text-xs font-semibold text-stone-600 mt-0.5">Master Delivery Batch & Security Gate Pass Manifest</p>
                                <div className="inline-block mt-2 px-3 py-1 bg-stone-100 border border-stone-300 rounded text-[11px] font-black uppercase tracking-widest text-stone-800">
                                    BATCH DISPATCH MANIFEST — {printingBatch.batch_no}
                                </div>
                            </div>

                            {/* Section 1: Vehicle & Transit Information */}
                            <div className="mb-5">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">
                                    1. Vehicle & Transit Logistics
                                </h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <tbody>
                                        <tr className="border-b border-stone-200">
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Vehicle / Truck No:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{printingBatch.vehicle_number || '–'}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Dispatch Date:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{printingBatch.dispatch_date || '–'}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Name:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.driver_name || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Phone:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.driver_phone || '–'}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Allotted Vendor / Point:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.vendor || '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Total Sites:</td>
                                            <td className="p-2 font-bold text-stone-900">{(printingBatch.project_ids || []).length} Drop-off Locations</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 2: Multi-Stop Drop-Off Manifest Table */}
                            <div className="mb-6">
                                <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">
                                    2. Multi-Stop Customer Drop-off Schedule & Recipient Signatures
                                </h3>
                                <table className="w-full text-xs border border-stone-300">
                                    <thead>
                                        <tr className="bg-stone-100 border-b border-stone-300 text-left font-black text-[10px] uppercase">
                                            <th className="p-2 border-r border-stone-300 w-8">Stop</th>
                                            <th className="p-2 border-r border-stone-300">Customer & Contact</th>
                                            <th className="p-2 border-r border-stone-300">Village / Address</th>
                                            <th className="p-2 border-r border-stone-300">System Specs</th>
                                            <th className="p-2 border-r border-stone-300">Inverter Serial</th>
                                            <th className="p-2 w-32">Recipient Sign</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-300 font-medium text-stone-800">
                                        {customers.filter(c => (printingBatch.project_ids || []).includes(c.id)).map((proj, idx) => (
                                            <tr key={proj.id} className="border-b border-stone-200">
                                                <td className="p-2 font-bold text-center border-r border-stone-300">{idx + 1}</td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <strong className="text-stone-900">{proj.customer_name}</strong>
                                                    <div className="text-[10px] text-stone-600">{proj.phone_number || '–'}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <div>{proj.villages || '–'}</div>
                                                    <div className="text-[10px] text-stone-500">{proj.sub_divisions || ''}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <strong>{proj.system_capacity_kwp ? `${proj.system_capacity_kwp} kWp` : '–'}</strong>
                                                    <div className="text-[10px] text-stone-600">{proj.no_of_modules ? `${proj.no_of_modules} Panels` : ''}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300 font-mono text-[10px]">
                                                    {proj.inverter_serial_no || '–'}
                                                </td>
                                                <td className="p-2 text-stone-300 text-center italic text-[10px]">
                                                    _________________
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Section 3: Signatures & Gate Pass Clearance */}
                            <div className="mt-8 pt-4 border-t-2 border-stone-800 grid grid-cols-3 gap-6 text-center text-xs">
                                <div>
                                    <div className="h-10 border-b border-stone-400 mb-1"></div>
                                    <p className="font-bold text-stone-900">Warehouse Dispatcher</p>
                                    <p className="text-[10px] text-stone-500">Sign & Stamp</p>
                                </div>
                                <div>
                                    <div className="h-10 border-b border-stone-400 mb-1"></div>
                                    <p className="font-bold text-stone-900">Driver / Transporter</p>
                                    <p className="text-[10px] text-stone-500">{printingBatch.driver_name || 'Driver Signature'}</p>
                                </div>
                                <div>
                                    <div className="h-10 border-b border-stone-400 mb-1"></div>
                                    <p className="font-bold text-stone-900">Security Gate Clearance</p>
                                    <p className="text-[10px] text-stone-500">Out-Time & Sign</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
