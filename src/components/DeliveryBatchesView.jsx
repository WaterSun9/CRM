import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
    Truck, Plus, Search, Filter, Calendar, User, Phone, MapPin, 
    Zap, Layers, Printer, Edit3, Trash2, CheckCircle2, AlertCircle, 
    ChevronDown, ChevronUp, Package, X, Check, ArrowRight, FileText, Clock, ExternalLink
} from 'lucide-react';
import { supabase } from '../supabase';
import { PRIMARY_STAGES, DELIVERY_PICKER_COLUMNS } from '../constants';
import { toIndianCommas, logActivity, formatInputValue, parseIndianNumber, runWrite } from '../utils';
import { useGlobalPopup } from './GlobalPopup';

export default function DeliveryBatchesView({ 
    currentUser, 
    customers: propCustomers = [], 
    onRefreshCustomers,
    onOpenCustomerModal
}) {
    const { showAlert } = useGlobalPopup();
    const [batches, setBatches] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [appliedMonthFilter, setAppliedMonthFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'IN_TRANSIT', 'DELIVERED'
    const [expandedBatchId, setExpandedBatchId] = useState(null);
    const [allCustomers, setAllCustomers] = useState([]);
    // Drivers directory (Operations -> Manage Drivers). Picking a name here
    // fills in that driver's phone and vehicle automatically.
    const [drivers, setDrivers] = useState([]);
    const [localStatusOverrides, setLocalStatusOverrides] = useState({});

    // Customers for the batch picker and the manifest.
    // Queries only required columns via DELIVERY_PICKER_COLUMNS to cut network payload.
    const fetchAllCustomers = async () => {
        try {
            const PICKER_STAGES = [
                'MATERIAL DELIVERY',
                'MATERIAL_DELIVERY',
                'Material Delivery',
                'MATERIAL ORDER',
                'MATERIAL_ORDER',
                'Material Order',
                'HOLD PROCUREMENT',
                'HOLD_PROCUREMENT',
                'Hold Procurement',
            ];
            const isAdmin = currentUser?.userType === 'admin';
            const includeEveryStage = false;

            const pageAll = async (buildQuery) => {
                const pageSize = 1000;
                let from = 0;
                const rows = [];
                while (true) {
                    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
                    if (error) {
                        console.error('pageAll error in DeliveryBatchesView:', error);
                        break;
                    }
                    if (!data || data.length === 0) break;
                    rows.push(...data);
                    if (data.length < pageSize) break;
                    from += pageSize;
                }
                return rows;
            };

            let all;
            if (includeEveryStage) {
                all = await pageAll(() => supabase.from('admin').select('*').is('deleted_at', null));
            } else {
                const [byStage, batched] = await Promise.all([
                    pageAll(() => supabase.from('admin').select('*').is('deleted_at', null).in('stage', PICKER_STAGES)),
                    pageAll(() => supabase.from('admin').select('*').is('deleted_at', null).not('delivery_batch_id', 'is', null)),
                ]);
                const byId = new Map();
                [...byStage, ...batched].forEach(row => byId.set(row.id, row));
                all = [...byId.values()];
            }
            setAllCustomers(all);
        } catch (e) {
            console.error('Error fetching customers in DeliveryBatchesView:', e);
        }
    };

    const fetchDrivers = async () => {
        try {
            const { data, error } = await supabase.from('drivers').select('*').order('name');
            if (error) throw error;
            setDrivers(data || []);
        } catch (e) {
            console.error('Error fetching drivers in DeliveryBatchesView:', e);
            setDrivers([]);
        }
    };

    useEffect(() => {
        fetchAllCustomers();
        fetchDrivers();
    }, []);

    // Wrap onRefreshCustomers to also update local customers list
    const handleRefresh = async () => {
        await fetchAllCustomers();
        // The rows we just fetched are authoritative. Drop the optimistic
        // overrides here or they keep shadowing the real delivery_status for
        // the rest of the session - which is how a write that silently did
        // not land still shows as green until the page is reloaded.
        setLocalStatusOverrides({});
        if (onRefreshCustomers) onRefreshCustomers();
    };

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
                // Only real vendors. A placeholder used to be prepended here
                // unconditionally, which meant a fabricated name could be
                // picked and saved onto the customer as the allotted vendor.
                setVendorsList(Array.from(new Set((data || []).map(v => v.name).filter(Boolean))));
            } catch (e) {
                console.error('Error fetching vendors in batches view:', e);
                setVendorsList([]);
            }
        };
        fetchVendors();
    }, []);

    // Load Batches from Database or LocalStorage
    // "All Stages" is the only case that needs the whole table — load it on demand.
    useEffect(() => {
        if (projectStageFilter === 'ALL') fetchAllCustomers(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectStageFilter]);

    const fetchBatches = async () => {
        setLoading(true);
        try {
            // Try fetching from delivery_batches table
            const { data, error } = await supabase
                .from('delivery_batches')
                .select('*')
                .order('created_at', { ascending: false });

            if (!error && data) {
                setBatches(data);
                localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(data));
            } else {
                console.error('Failed to fetch delivery batches from the database:', error);
                // Fallback to localStorage, but only ever trust entries with
                // a real UUID id - older locally-cached batches from before
                // the id-format fix used a fake string id that was never
                // actually written to the database, and would break any
                // future save that tries to upsert alongside them.
                const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
                const localStored = localStorage.getItem('watersun_local_delivery_batches');
                const parsed = localStored ? JSON.parse(localStored).filter(b => uuidRe.test(String(b.id))) : [];
                setBatches(parsed);
                localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(parsed));
            }
        } catch (err) {
            console.error('Failed to load delivery batches:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBatches();
    }, []);

    // Save Batches Helper
    // Returns true only if the write to the real shared database actually
    // succeeded - callers (like handleSaveBatch) must check this before
    // doing anything that assumes the batch genuinely exists in the
    // database, such as marking customer records as "already batched".
    //
    // Only `changedBatch` (the one record actually being created/edited)
    // is sent to Supabase - never the whole local `updatedBatches` list.
    // Upserting the entire list previously caused
    // "operator does not exist: uuid = text" whenever any older,
    // locally-cached batch (from before the id-format bug was fixed, or
    // loaded from the localStorage fallback) was still sitting in local
    // state with a non-UUID id - mixing valid and invalid ids in one
    // upsert call trips Postgres before it even gets to check individual
    // rows. `updatedBatches` is still used for the local UI state and
    // localStorage cache, which have no such type constraint.
    const saveBatchesState = async (updatedBatches, previousBatches, changedBatch) => {
        // React state updates optimistically for responsiveness, but the
        // localStorage cache must NOT be written until the database has accepted
        // it. It used to be written first and never rolled back, so a batch that
        // failed to save stayed in the cache - and fetchBatches falls back to
        // that cache whenever the database read fails, resurrecting a batch that
        // never existed as though it were real.
        setBatches(updatedBatches);
        try {
            const upsertRes = await runWrite(
                supabase.from('delivery_batches').upsert([changedBatch]).select('id'),
                { action: 'batch save' }
            );
            if (!upsertRes.ok) throw upsertRes.error;
            localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(updatedBatches));
            return true;
        } catch (e) {
            console.error('Failed to sync delivery batch to the database:', e);
            const reverted = previousBatches ?? batches;
            setBatches(reverted);
            // Keep the cache consistent with what actually persisted.
            try {
                localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(reverted));
            } catch { /* cache is best-effort */ }
            showAlert('Failed to save this batch to the shared database: ' + (e.message || 'Unknown error') + '. Nothing was saved - please try again.', { type: 'error' });
            return false;
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
            rent_amount: '',
            car_rent_paid: '',
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
            rent_amount: batch.rent_amount || '',
            car_rent_paid: batch.car_rent_paid || '',
            notes: batch.notes || '',
            status: batch.status || 'IN_TRANSIT',
            selectedProjectIds: batch.project_ids || []
        });
        setEditingBatch(batch);
        setShowCreateModal(true);
    };

    // Protect against accidental refresh while batch form modal is open
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (showCreateModal && batchForm.selectedProjectIds.length > 0) {
                e.preventDefault();
                e.returnValue = '';
                return '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [showCreateModal, batchForm.selectedProjectIds.length]);

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
            showAlert('Please select at least 1 project to include in this delivery batch.');
            return;
        }
        // Phone and vehicle are read-only and derived from the picked driver,
        // so a blank here means that driver's record is incomplete.
        if (!String(batchForm.driver_name || '').trim()) {
            showAlert('Please select a driver for this batch.');
            return;
        }
        if (!String(batchForm.driver_phone || '').trim() || !String(batchForm.vehicle_number || '').trim()) {
            showAlert(`Driver "${batchForm.driver_name}" is missing a phone number or vehicle number. Add them in Operations → Drivers first.`);
            return;
        }

        setSaving(true);
        try {
            // delivery_batches.id is a real `uuid` column - a plain
            // "BATCH-<timestamp>" string fails every write with a
            // Postgres 22P02 error (confirmed live), silently swallowed
            // by saveBatchesState's best-effort catch, so the batch
            // looked saved locally but never actually persisted.
            const batchId = editingBatch ? editingBatch.id : crypto.randomUUID();
            const displayBatchNo = batchForm.batch_no || `BATCH-${Date.now()}`;
            // project_ids is a real `uuid[]` column - any non-UUID id in
            // this list (e.g. a leftover synthetic/demo id) would cause
            // the exact same "operator does not exist: uuid = text" error
            // as the batch id bug above, just for the array column
            // instead of the primary key. Filter defensively.
            const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            const validProjectIds = batchForm.selectedProjectIds.filter(id => uuidRe.test(String(id)));
            if (validProjectIds.length !== batchForm.selectedProjectIds.length) {
                console.warn('Dropped non-UUID project id(s) before saving delivery batch:', batchForm.selectedProjectIds.filter(id => !uuidRe.test(String(id))));
            }
            const batchPayload = {
                id: batchId,
                batch_no: displayBatchNo,
                dispatch_date: batchForm.dispatch_date,
                driver_name: batchForm.driver_name,
                driver_phone: batchForm.driver_phone ? Number(String(batchForm.driver_phone).replace(/\D/g, '')) || null : null,
                vehicle_number: batchForm.vehicle_number,
                rent_amount: batchForm.rent_amount || '',
                car_rent_paid: batchForm.car_rent_paid || 'No',
                car_rent_paid_by: editingBatch?.car_rent_paid_by || null,
                car_rent_paid_at: editingBatch?.car_rent_paid_at || null,
                vendor: batchForm.vendor,
                notes: batchForm.notes,
                status: batchForm.status,
                project_ids: validProjectIds,
                created_at: editingBatch?.created_at || new Date().toISOString(),
                updated_at: new Date().toISOString()
            };

            const previousBatches = batches;
            let updatedBatches;
            if (editingBatch) {
                updatedBatches = batches.map(b => b.id === editingBatch.id ? batchPayload : b);
            } else {
                updatedBatches = [batchPayload, ...batches];
            }

            const removedProjectIds = editingBatch
                ? (editingBatch.project_ids || []).filter(id => !validProjectIds.includes(id))
                : [];

            // Attempt atomic RPC save (single PostgreSQL transaction)
            let atomicSuccess = false;
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc('save_delivery_batch_atomic', {
                    p_batch: batchPayload,
                    p_selected_project_ids: validProjectIds,
                    p_removed_project_ids: removedProjectIds
                });
                if (!rpcErr && rpcData?.success) {
                    atomicSuccess = true;
                } else if (rpcErr) {
                    console.warn('save_delivery_batch_atomic RPC fallback:', rpcErr);
                }
            } catch (rpcEx) {
                console.warn('save_delivery_batch_atomic exception:', rpcEx);
            }

            // If atomic RPC is not yet deployed in DB, run standard fallback
            if (!atomicSuccess) {
                const didSave = await saveBatchesState(updatedBatches, previousBatches, batchPayload);
                if (!didSave) {
                    setSaving(false);
                    return;
                }

                // Bulk update selected projects in admin table with shared delivery metadata
                const customerUpdates = {
                    delivery_batch_id: batchPayload.batch_no,
                    material_delivery_date: batchPayload.dispatch_date,
                    driver_name: batchPayload.driver_name,
                    driver_phone_number: batchPayload.driver_phone,
                    vehicle_number: batchPayload.vehicle_number,
                    vendor: batchPayload.vendor,
                    delivery_status: 'IN_TRANSIT'
                };

                // Unchecked before: the batch row saved while the customer links
                // silently did not, leaving customers stranded outside the batch
                // that claims them - the original delivery-batch bug class.
                // Checking `error` alone could not detect this: an RLS-refused
                // UPDATE matches zero rows and returns error: null. Requiring
                // every id back also catches a PARTIAL link, which would strand
                // some customers outside the batch that claims them.
                if (validProjectIds.length > 0) {
                    const linkRes = await runWrite(
                        supabase.from('admin').update(customerUpdates).in('id', validProjectIds).select('id'),
                        { action: 'batch link' }
                    );
                    if (!linkRes.ok) throw linkRes.error;
                    if (linkRes.rows.length !== validProjectIds.length) {
                        throw new Error(
                            `Only ${linkRes.rows.length} of ${validProjectIds.length} customers could be linked to this batch.`
                        );
                    }
                }

                if (removedProjectIds.length > 0) {
                    const unlinkRes = await runWrite(
                        supabase.from('admin').update({
                            delivery_batch_id: null,
                            delivery_status: 'PENDING'
                        }).in('id', removedProjectIds).select('id'),
                        { action: 'batch unlink' }
                    );
                    if (!unlinkRes.ok) throw unlinkRes.error;
                    if (unlinkRes.rows.length !== removedProjectIds.length) {
                        throw new Error(
                            `Only ${unlinkRes.rows.length} of ${removedProjectIds.length} customers could be removed from this batch.`
                        );
                    }
                }
            } else {
                setBatches(updatedBatches);
                localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(updatedBatches));
            }

            await handleRefresh();
            setShowCreateModal(false);
        } catch (err) {
            console.error('Error saving delivery batch:', err);
            showAlert('Failed to save batch: ' + err.message, { type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Disband / Delete Batch
    const handleDeleteBatch = async (batchId) => {
        if (!window.confirm('Are you sure you want to disband this delivery batch? The projects will remain intact.')) return;
        const batchToDelete = batches.find(b => b.id === batchId);
        const previousBatches = batches;
        const updatedBatches = batches.filter(b => b.id !== batchId);

        setBatches(updatedBatches);
        localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(updatedBatches));
        // Only attempt the real delete for batches that were actually
        // persisted with a real UUID - a leftover locally-cached batch
        // from before the id-format fix has no matching row to delete.
        const isPersistedBatch = batchToDelete
            && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(batchToDelete.id));

        if (!isPersistedBatch) {
            // Say so rather than skipping quietly: the batch vanishing from the
            // screen looked identical to a real delete, so there was no way to
            // tell "deleted" apart from "there was never anything to delete".
            showAlert(
                'This batch only ever existed in your browser — it was never saved to the shared database, so there was nothing to delete there. It has been removed locally.',
                { title: 'Removed locally', type: 'warning' }
            );
        }

        if (isPersistedBatch) {
            let deleteAtomicSuccess = false;
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_delivery_batch_atomic', {
                    p_batch_id: batchToDelete.id,
                    p_project_ids: batchToDelete.project_ids || []
                });
                if (!rpcErr && rpcData?.success) {
                    deleteAtomicSuccess = true;
                } else if (rpcErr) {
                    console.warn('delete_delivery_batch_atomic RPC fallback:', rpcErr);
                }
            } catch (delRpcEx) {
                console.warn('delete_delivery_batch_atomic exception:', delRpcEx);
            }

            if (!deleteAtomicSuccess) {
                const delRes = await runWrite(
                    supabase.from('delivery_batches').delete().eq('id', batchToDelete.id).select('id'),
                    { action: 'batch deletion' }
                );
                const error = delRes.ok ? null : delRes.error;
                if (error) {
                    console.error('Failed to delete delivery batch from the database:', error);
                    setBatches(previousBatches);
                    localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(previousBatches));
                    showAlert('Failed to delete this batch from the shared database: ' + error.message + '. Nothing was changed - please try again.', { type: 'error' });
                    return;
                }

                // Clear delivery_batch_id from linked projects
                if (batchToDelete?.project_ids?.length > 0) {
                    // Unchecked before: deleting a batch could leave its customers
                    // still pointing at a batch row that no longer exists.
                    // `throw` here had no enclosing try - the only one closes
                    // above - so a failure became an unhandled rejection and the
                    // user was told nothing while the batch was already gone
                    // from the UI and localStorage.
                    const clearRes = await runWrite(
                        supabase.from('admin')
                            .update({
                                delivery_batch_id: null,
                                delivery_status: 'PENDING'
                            })
                            .in('id', batchToDelete.project_ids)
                            .select('id'),
                        { action: 'batch unlink' }
                    );
                    if (!clearRes.ok || clearRes.rows.length !== batchToDelete.project_ids.length) {
                        showAlert(
                            'The batch was deleted, but '
                            + `${batchToDelete.project_ids.length - (clearRes.rows?.length || 0)} customer(s) still point at it. `
                            + 'Refresh and check the batch list before creating a new one.',
                            { type: 'error' }
                        );
                    }
                }
            }
        }
        await handleRefresh();
    };

    // Filter projects for the creation selector
    
    const checkMonthMatch = (dateStr, monthFilterStr) => {
        if (!monthFilterStr) return true;
        if (!dateStr) return false;
        
        // monthFilterStr is "YYYY-MM"
        // Try simple startsWith first
        if (dateStr.startsWith(monthFilterStr)) return true;
        
        // Try parsing the date
        try {
            // Handle DD-MM-YYYY manually if present
            let parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime()) && typeof dateStr === 'string' && dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts[0].length === 2 && parts[2].length === 4) {
                    parsedDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                }
            }
            if (isNaN(parsedDate.getTime())) return false;
            
            const y = parsedDate.getFullYear();
            const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
            return `${y}-${m}` === monthFilterStr;
        } catch {
            return false;
        }
    };

    const eligibleProjects = useMemo(() => {
        return customers.filter(c => {
            if (c.deleted_at) return false;
            const isAvailable = !c.delivery_batch_id || (editingBatch && c.delivery_batch_id === editingBatch.batch_no);
            if (!isAvailable) return false;
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
                (b.vehicle_number || '').toLowerCase().includes(q);
            const matchesMonth = checkMonthMatch(b.dispatch_date, appliedMonthFilter);
            return matchesStatus && matchesQuery && matchesMonth;
        });
    }, [batches, searchQuery, statusFilter, appliedMonthFilter]);

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
    const handlePrintBatch = () => {
        if (!printingBatch) return;

        const cleanBatch = String(printingBatch?.batch_no || printingBatch?.id || 'Batch').replace(/[^a-zA-Z0-9_-]/g, '_');
        const cleanVehicle = String(printingBatch?.vehicle_number || 'Vehicle').replace(/[^a-zA-Z0-9_-]/g, '_');
        const docTitle = `Master_Delivery_Gate_Pass_${cleanBatch}_${cleanVehicle}`;
        const prevDocTitle = document.title;

        try {
            document.title = docTitle;
            window.print();
        } catch (err) {
            console.error('Print execution error:', err);
        } finally {
            setTimeout(() => {
                document.title = prevDocTitle;
            }, 1000);
        }
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
                        placeholder="Search batch #, driver, vehicle..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:border-amber-400 transition"
                    />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                    {/* Month Filter Moved to Right Side */}
                    <div className="flex items-center gap-1">
                        <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider mr-1">Dispatch Month</span>
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-xl px-2 py-1.5 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                        />
                        <button 
                            type="button" 
                            onClick={() => setAppliedMonthFilter(monthFilter)} 
                            className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
                        >
                            Apply
                        </button>
                        {appliedMonthFilter && (
                            <button 
                                type="button" 
                                onClick={() => { setMonthFilter(''); setAppliedMonthFilter(''); }} 
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <div className="h-6 w-px bg-stone-200 hidden sm:block"></div>

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
                        const isAllDelivered = linkedProjects.length > 0 && linkedProjects.every(p => (localStatusOverrides[p.id] || p.delivery_status) === 'DELIVERED');

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
                                            <select
                                                value={batch.status || 'IN_TRANSIT'}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    const previousBatch = batch;
                                                    const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, status: newStatus } : b);
                                                    setBatches(updatedBatches);
                                                    localStorage.setItem("watersun_local_delivery_batches", JSON.stringify(updatedBatches));
                                                    try {
                                                        const projectIds = linkedProjects.map(p => p.id);
                                                        let atomicSuccess = false;
                                                        try {
                                                            const { data: rpcData, error: rpcErr } = await supabase.rpc('update_delivery_batch_status_atomic', {
                                                                p_batch_id: batch.id,
                                                                p_new_status: newStatus,
                                                                p_project_ids: projectIds
                                                            });
                                                            if (!rpcErr && rpcData?.success) {
                                                                atomicSuccess = true;
                                                                if (rpcData.projects_missing > 0) {
                                                                    console.warn(`Delivery batch ${batch.batch_no || batch.id}: ${rpcData.projects_missing} of ${rpcData.projects_expected} linked projects were not updated (deleted or missing).`);
                                                                }
                                                            }
                                                        } catch (rpcThrow) {
                                                            // Atomic RPC unavailable - fall through to the
                                                            // non-atomic path below, but say so, since this
                                                            // silently gives up the all-or-nothing guarantee.
                                                            console.warn('update_delivery_batch_status_atomic unavailable, falling back to non-atomic update:', rpcThrow?.message || rpcThrow);
                                                        }

                                                        if (!atomicSuccess) {
                                                            // Non-atomic fallback: the all-or-nothing guarantee
                                                            // is already gone here, so at minimum every write must
                                                            // prove it landed. "Mark All Delivered" flipping the
                                                            // whole batch on screen over a refused write is exactly
                                                            // the failure this path existed to avoid.
                                                            const bRes = await runWrite(
                                                                supabase.from("delivery_batches").update({ status: newStatus }).eq("id", batch.id).select('id'),
                                                                { action: 'batch status change' }
                                                            );
                                                            if (!bRes.ok) throw bRes.error;
                                                            if (projectIds.length > 0) {
                                                                const aRes = await runWrite(
                                                                    supabase.from("admin").update({ delivery_status: newStatus }).in("id", projectIds).select('id'),
                                                                    { action: 'delivery status change' }
                                                                );
                                                                if (!aRes.ok) throw aRes.error;
                                                                if (aRes.rows.length !== projectIds.length) {
                                                                    throw new Error(
                                                                        `The batch status changed, but only ${aRes.rows.length} of ${projectIds.length} customers were updated.`
                                                                    );
                                                                }
                                                            }
                                                        }

                                                        await logActivity(currentUser?.id || "admin", "update", `Changed delivery batch ${batch.batch_no || batch.id} status to ${newStatus}`, "");
                                                        await handleRefresh();
                                                    } catch (err) {
                                                        setBatches(prev => prev.map(b => b.id === batch.id ? previousBatch : b));
                                                        showAlert("Failed to update batch status: " + (err.message || "Unknown error"), { type: 'error' });
                                                    }
                                                }}
                                                className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full outline-none cursor-pointer appearance-none ${
                                                    batch.status === 'DELIVERED' 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }`}
                                            >
                                                <option value="IN_TRANSIT">In Transit</option>
                                                <option value="DELIVERED">Delivered</option>
                                            </select>
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
                                            <span className="h-3 w-px bg-stone-300 mx-1"></span>
                                            <div className="flex items-center gap-1.5 font-medium text-stone-500">
                                                 <span className="text-[10px] uppercase font-bold text-stone-400">Car Rent Paid:</span>
                                                 <select
                                                     value={batch.car_rent_paid || 'No'}
                                                     onChange={async (e) => {
                                                         const val = e.target.value;
                                                         const userIdentifier = currentUser?.name || currentUser?.email || "Admin";
                                                         const timestamp = new Date().toISOString();
                                                         const previousBatch = batch;

                                                         const updates = { 
                                                             car_rent_paid: val,
                                                             car_rent_paid_by: val === "Yes" ? userIdentifier : null,
                                                             car_rent_paid_at: val === "Yes" ? timestamp : null
                                                         };
                                                         
                                                         const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, ...updates } : b);
                                                         setBatches(updatedBatches);
                                                         
                                                         try {
                                                             const rentRes = await runWrite(
                                                                 supabase.from("delivery_batches").update(updates).eq("id", batch.id).select('id'),
                                                                 { action: 'Car Rent Paid change' }
                                                             );
                                                             if (!rentRes.ok) throw rentRes.error;
                                                         } catch (err) {
                                                             setBatches(prev => prev.map(b => b.id === batch.id ? previousBatch : b));
                                                             showAlert("Failed to save Car Rent Paid status: " + (err.message || "Unknown error"), { type: 'error' });
                                                         }
                                                     }}
                                                     className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer outline-none shadow-xs ${batch.car_rent_paid === 'Yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}
                                                 >
                                                     <option value="No">No</option>
                                                     <option value="Yes">Yes</option>
                                                 </select>
                                             </div>
                                             {batch.car_rent_paid === 'Yes' && batch.car_rent_paid_by && (
                                                 <span className="text-[9px] text-stone-400 italic">
                                                     (Paid by {batch.car_rent_paid_by} on {batch.car_rent_paid_at ? new Date(batch.car_rent_paid_at).toLocaleDateString('en-IN') : 'Unknown'})
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

                                     <div className="flex items-center gap-3">
                                         <button
                                             type="button"
                                             disabled={isAllDelivered}
                                             onClick={async () => {
                                                 const previousBatch = batch;
                                                 const previousOverrides = { ...localStatusOverrides };
                                                 const newOverrides = { ...localStatusOverrides };
                                                 linkedProjects.forEach(p => newOverrides[p.id] = "DELIVERED");
                                                 setLocalStatusOverrides(newOverrides);

                                                 const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, status: "DELIVERED" } : b);
                                                 setBatches(updatedBatches);
                                                 
                                                 try {
                                                      const projectIds = linkedProjects.map(p => p.id);
                                                      let statusAtomicSuccess = false;
                                                      try {
                                                          const { data: rpcData, error: rpcErr } = await supabase.rpc('update_delivery_batch_status_atomic', {
                                                              p_batch_id: batch.id,
                                                              p_new_status: "DELIVERED",
                                                              p_project_ids: projectIds
                                                          });
                                                          if (!rpcErr && rpcData?.success) {
                                                              statusAtomicSuccess = true;
                                                              if (rpcData.projects_missing > 0) {
                                                                  console.warn(`Delivery batch ${batch.batch_no || batch.id}: ${rpcData.projects_missing} of ${rpcData.projects_expected} linked projects were not updated (deleted or missing).`);
                                                              }
                                                          }
                                                      } catch (stErr) {
                                                          console.warn('update_delivery_batch_status_atomic fallback:', stErr);
                                                      }

                                                      if (!statusAtomicSuccess) {
                                                          const bRes = await runWrite(
                                                              supabase.from("delivery_batches").update({ status: "DELIVERED" }).eq("id", batch.id).select('id'),
                                                              { action: 'batch status change' }
                                                          );
                                                          if (!bRes.ok) throw bRes.error;
                                                          if (projectIds.length > 0) {
                                                              const aRes = await runWrite(
                                                                  supabase.from("admin").update({ delivery_status: "DELIVERED" }).in("id", projectIds).select('id'),
                                                                  { action: 'delivery status change' }
                                                              );
                                                              if (!aRes.ok) throw aRes.error;
                                                              if (aRes.rows.length !== projectIds.length) {
                                                                  throw new Error(
                                                                      `The batch was marked delivered, but only ${aRes.rows.length} of ${projectIds.length} customers were updated.`
                                                                  );
                                                              }
                                                          }
                                                      }

                                                      await logActivity(currentUser?.id || "admin", "update", `Marked delivery batch ${batch.batch_no || batch.id} as DELIVERED (${projectIds.length} projects)`, "");
                                                      await handleRefresh();
                                                  } catch (err) {
                                                     setBatches(prev => prev.map(b => b.id === batch.id ? previousBatch : b));
                                                     setLocalStatusOverrides(previousOverrides);
                                                     showAlert("Failed to mark batch delivered: " + (err.message || "Unknown error"), { type: 'error' });
                                                 }
                                             }}
                                             className={`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition shadow-xs border ${
                                                 isAllDelivered 
                                                     ? 'bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default opacity-80' 
                                                     : 'bg-stone-100 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border-stone-200 hover:border-emerald-200 cursor-pointer'
                                             }`}
                                         >
                                             {isAllDelivered ? '✓ All Delivered' : 'Mark All Delivered'}
                                         </button>
                                         <button
                                             type="button"
                                             onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                             className="text-amber-700 hover:text-amber-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                         >
                                         {isExpanded ? 'Hide project details' : `View ${linkedProjects.length} drop-off locations`}
                                         {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                     </button>
                                     </div>
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
                                                     
                                                     <th className="pb-2">Current Stage</th>
                                                     <th className="pb-2">Location Status</th>
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
                                                             <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                                                                 {PRIMARY_STAGES.find(s => s.id === proj.stage)?.label || proj.stage}
                                                             </span>
                                                         </td>
                                                         <td className="py-2.5">
                                                             <select
                                                                 value={(localStatusOverrides[proj.id] || proj.delivery_status || 'PENDING')}
                                                                 onChange={async (e) => {
                                                                     const newStat = e.target.value;
                                                                     const previousStat = localStatusOverrides[proj.id] || proj.delivery_status || 'PENDING';
                                                                     setLocalStatusOverrides(prev => ({ ...prev, [proj.id]: newStat }));
                                                                     try {
                                                                         // Back to PENDING means the client leaves the batch entirely:
                                                                         // clear the link, drop the driver/vehicle details that came
                                                                         // from the batch, and remove them from project_ids so they
                                                                         // become available for a new batch again. Updating only
                                                                         // delivery_status left them stranded — still inside the
                                                                         // batch and invisible to the customer picker.
                                                                         const leavingBatch = newStat === 'PENDING';
                                                                         const patch = leavingBatch
                                                                             ? {
                                                                                 delivery_status: 'PENDING',
                                                                                 delivery_batch_id: null,
                                                                                 driver_name: null,
                                                                                 driver_phone_number: null,
                                                                                 vehicle_number: null,
                                                                                 material_delivery_date: null,
                                                                             }
                                                                             : { delivery_status: newStat };

                                                                         const statusRes = await runWrite(
                                                                             supabase.from('admin').update(patch).eq('id', proj.id).select('id'),
                                                                             { action: 'delivery status change' }
                                                                         );
                                                                         if (!statusRes.ok) throw statusRes.error;

                                                                         if (leavingBatch) {
                                                                             const remaining = (batch.project_ids || []).filter(id => id !== proj.id);
                                                                             const batchRes = await runWrite(
                                                                                 supabase.from('delivery_batches')
                                                                                     .update({ project_ids: remaining })
                                                                                     .eq('id', batch.id)
                                                                                     .select('id'),
                                                                                 { action: 'batch update' }
                                                                             );
                                                                             if (!batchRes.ok) throw batchRes.error;
                                                                             await logActivity(currentUser?.id || 'admin', 'update',
                                                                                 `Removed ${proj.customer_name || proj.id} from delivery batch ${batch.batch_no || batch.id} (set back to Pending)`, '', proj.id);
                                                                         }
                                                                         await handleRefresh();
                                                                     } catch (err) {
                                                                         setLocalStatusOverrides(prev => ({ ...prev, [proj.id]: previousStat }));
                                                                         showAlert("Failed to update delivery status: " + (err.message || "Unknown error"), { type: 'error' });
                                                                     }
                                                                 }}
                                                                 className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md outline-none cursor-pointer ${
                                                                     (localStatusOverrides[proj.id] || proj.delivery_status || 'PENDING') === 'DELIVERED' 
                                                                         ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                                         : 'bg-stone-100 text-stone-600 border border-stone-300'
                                                                 }`}
                                                             >
                                                                <option value="PENDING">Pending</option>
                                                                <option value="IN_TRANSIT">In Transit</option>
                                                                <option value="DELIVERED">Delivered</option>
                                                            </select>
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
                                            Driver Name <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            required
                                            value={batchForm.driver_name}
                                            onChange={e => {
                                                const picked = drivers.find(d => d.name === e.target.value);
                                                setBatchForm(p => ({
                                                    ...p,
                                                    driver_name: e.target.value,
                                                    driver_phone: picked ? String(picked.phone || '').replace(/\D/g, '') : '',
                                                    vehicle_number: picked ? (picked.vehicle_number || '') : '',
                                                }));
                                            }}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-800 outline-none focus:border-amber-400 cursor-pointer"
                                        >
                                            <option value="">Select a driver...</option>
                                            {drivers.map(d => (
                                                <option key={d.id} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                        {drivers.length === 0 && (
                                            <p className="text-[9px] text-amber-700 font-semibold mt-1">
                                                No drivers registered yet - add them in Operations → Drivers.
                                            </p>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Driver Phone Number
                                        </label>
                                        <input
                                            type="tel"
                                            readOnly
                                            value={batchForm.driver_phone}
                                            placeholder="Fills in from the selected driver"
                                            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 outline-none cursor-not-allowed"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Vehicle / Truck Registration Number
                                        </label>
                                        <input
                                            type="text"
                                            readOnly
                                            value={batchForm.vehicle_number}
                                            placeholder="Fills in from the selected driver"
                                            className="w-full bg-stone-100 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-600 outline-none cursor-not-allowed"
                                        />
                                        <p className="text-[9px] text-stone-400 font-medium mt-1">
                                            Phone and vehicle come from the driver's record. To change them, edit the driver in Operations → Drivers.
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Rent Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">₹</span>
                                            <input
                                                type="text"
                                                value={formatInputValue(batchForm.rent_amount)}
                                                onChange={e => setBatchForm(p => ({ ...p, rent_amount: parseIndianNumber(e.target.value) }))}
                                                placeholder="0"
                                                className="w-full bg-white border border-stone-200 rounded-xl pl-6 pr-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                            />
                                        </div>
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
                                    Master Gate Pass Preview - {printingBatch.batch_no}
                                </h3>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={handlePrintBatch}
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
                                    BATCH DISPATCH MANIFEST - {printingBatch.batch_no}
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
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Rent Amount:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.rent_amount ? `₹ ${toIndianCommas(printingBatch.rent_amount)}` : '–'}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Total Sites:</td>
                                            <td className="p-2 font-bold text-stone-900">{(printingBatch.project_ids || []).length} Drop-off Locations</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Car Rent Paid:</td>
                                            <td className="p-2 font-bold text-stone-900" colSpan={3}>{printingBatch.car_rent_paid || '–'}</td>
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

            {/* Print Specific CSS */}
            <style>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 10mm;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    .print-container, .print-container * {
                        visibility: visible !important;
                    }
                    .print-container {
                        position: fixed !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        z-index: 9999999 !important;
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
}
