import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { 
    Truck, Plus, Search, Filter, Calendar, User, Phone, MapPin, 
    Zap, Layers, Printer, Edit3, Trash2, CheckCircle2, AlertCircle, 
    ChevronDown, ChevronUp, Package, X, Check, ArrowRight, FileText, Clock, ExternalLink
} from 'lucide-react';
import { supabase } from '../supabase';
import { PRIMARY_STAGES, DELIVERY_PICKER_COLUMNS } from '../constants';
import { toIndianCommas, logActivity, logFieldChanges, formatInputValue, parseIndianNumber, runWrite } from '../utils';
import { useGlobalPopup } from './GlobalPopup';
import { getBomTypeForCustomer, loadBomForCustomer } from '../utils/bom';
import { buildTruckLoad } from '../utils/truckLoad';
import TruckLoadingSheet from './TruckLoadingSheet';
import { getEligibleBatchProjects } from '../utils/deliveryBatchSelection';

const localDateKey = (date = new Date()) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const projectsInRouteOrder = (batch, customers) => {
    const byId = new Map(customers.map(customer => [customer.id, customer]));
    return (batch.project_ids || []).map(id => byId.get(id)).filter(Boolean);
};

const readCachedBatches = () => {
    try {
        const raw = localStorage.getItem('watersun_local_delivery_batches');
        if (!raw) return { rows: [], available: false };
        const parsed = JSON.parse(raw);
        const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const rows = Array.isArray(parsed) ? parsed.filter(batch => uuidRe.test(String(batch.id))) : [];
        return { rows, available: rows.length > 0 };
    } catch { return { rows: [], available: false }; }
};

const cacheBatches = rows => {
    try { localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(rows)); }
    catch (error) { console.warn('Delivery batch cache could not be updated:', error); }
};

export default function DeliveryBatchesView({ 
    currentUser, 
    customers: propCustomers = [], 
    onRefreshCustomers,
    onOpenCustomerModal
}) {
    const { showAlert } = useGlobalPopup();
    const [cachedSnapshot] = useState(readCachedBatches);
    const [batches, setBatches] = useState(cachedSnapshot.rows);
    const [hasBatchSnapshot, setHasBatchSnapshot] = useState(cachedSnapshot.available);
    const [loading, setLoading] = useState(true);
    const [batchError, setBatchError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [monthFilter, setMonthFilter] = useState('');
    const [appliedMonthFilter, setAppliedMonthFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'IN_TRANSIT', 'DELIVERED'
    const [expandedBatchId, setExpandedBatchId] = useState(null);
    const [allCustomers, setAllCustomers] = useState([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [projectsError, setProjectsError] = useState('');
    // Drivers directory (Operations -> Manage Drivers). Picking a name here
    // fills in that driver's phone and vehicle automatically.
    const [drivers, setDrivers] = useState([]);
    const [localStatusOverrides, setLocalStatusOverrides] = useState({});
    const [reorderingBatchId, setReorderingBatchId] = useState(null);

    // Batch actions write driver, vehicle, date, vendor and delivery status onto
    // every customer in the batch. They used to log once per batch, with no
    // customer attached, so none of it showed in a customer's own history.
    // This writes one value-level entry per affected customer.
    const logBatchChangeForCustomers = (customerIds, patch, source) => {
        (customerIds || []).forEach(customerId => {
            const before = allCustomers.find(c => c.id === customerId)
                || propCustomers.find(c => c.id === customerId)
                || {};
            void logFieldChanges(currentUser?.id, customerId, before.customer_name, before, patch, source);
        });
    };

    // Load only the customer columns used by the picker and manifest. Stable
    // ordering lets the remaining pages load concurrently without duplicates.
    const fetchAllCustomers = async () => {
        setLoadingProjects(true);
        try {
            const pageSize = 1000;
            const query = () => supabase.from('admin').select(DELIVERY_PICKER_COLUMNS).is('deleted_at', null).order('id');
            const firstPage = await supabase.from('admin').select(DELIVERY_PICKER_COLUMNS, { count: 'exact' }).is('deleted_at', null).order('id').range(0, pageSize - 1);
            if (firstPage.error) throw firstPage.error;
            const remainingOffsets = Array.from({ length: Math.max(0, Math.ceil((firstPage.count || 0) / pageSize) - 1) }, (_, index) => (index + 1) * pageSize);
            const pages = await Promise.all(remainingOffsets.map(offset => query().range(offset, offset + pageSize - 1)));
            const failedPage = pages.find(page => page.error);
            if (failedPage) throw failedPage.error;
            const all = [...(firstPage.data || []), ...pages.flatMap(page => page.data || [])];
            setAllCustomers(all);
            setProjectsError('');
        } catch (e) {
            console.error('Error fetching customers in DeliveryBatchesView:', e);
            setProjectsError(e.message || 'Could not load projects.');
        } finally {
            setLoadingProjects(false);
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
    const customers = propCustomers && propCustomers.length > 0 ? propCustomers : allCustomers;
    
    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [editingBatch, setEditingBatch] = useState(null);
    const [printingBatch, setPrintingBatch] = useState(null);
    const [truckSheet, setTruckSheet] = useState(null);
    const [loadingTruckSheet, setLoadingTruckSheet] = useState(false);
    const printableRef = useRef(null);

    // Form state for Create / Edit Batch
    const [batchForm, setBatchForm] = useState({
        batch_no: '',
        dispatch_date: localDateKey(),
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
    const fetchBatches = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('delivery_batches')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setBatches(data || []);
            setHasBatchSnapshot(true);
            setBatchError('');
            cacheBatches(data || []);
        } catch (err) {
            console.error('Failed to load delivery batches:', err);
            setBatchError(err.message || 'Could not refresh delivery batches.');
        } finally {
            setLoading(false);
        }
    };

    const handleRefresh = async () => {
        await Promise.all([fetchBatches(), fetchAllCustomers()]);
        setLocalStatusOverrides({});
        if (onRefreshCustomers) onRefreshCustomers();
    };

    useEffect(() => {
        fetchBatches();

        const channel = supabase.channel('delivery_batches_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_batches' }, payload => {
                if (payload.eventType === 'INSERT' && payload.new) {
                    setBatches(prev => {
                        if (prev.some(b => b.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                } else if (payload.eventType === 'UPDATE' && payload.new) {
                    setBatches(prev => prev.map(b => b.id === payload.new.id ? payload.new : b));
                } else if (payload.eventType === 'DELETE' && payload.old?.id) {
                    setBatches(prev => prev.filter(b => b.id !== payload.old.id));
                }
            })
            .subscribe();

        const onFocus = () => {
            if (document.visibilityState === 'visible') {
                fetchBatches();
                fetchAllCustomers();
            }
        };
        document.addEventListener('visibilitychange', onFocus);
        window.addEventListener('focus', onFocus);

        return () => {
            supabase.removeChannel(channel);
            document.removeEventListener('visibilitychange', onFocus);
            window.removeEventListener('focus', onFocus);
        };
    }, []);

    // Open Create Modal
    const handleOpenCreateModal = () => {
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const today = localDateKey();
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
            dispatch_date: batch.dispatch_date || localDateKey(),
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
        setProjectSearchQuery('');
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

    const moveStop = async (batch, index, direction) => {
        if (reorderingBatchId) return;
        const ids = [...(batch.project_ids || [])];
        const target = index + direction;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        setReorderingBatchId(batch.id);
        try {
            const result = await runWrite(
                supabase.from('delivery_batches').update({ project_ids: ids, updated_at: new Date().toISOString() }).eq('id', batch.id).select('id'),
                { action: 'route order update' }
            );
            if (!result.ok || result.rows.length !== 1) throw result.error || new Error('No batch row was updated.');
            const next = batches.map(row => row.id === batch.id ? { ...row, project_ids: ids } : row);
            setBatches(next);
            cacheBatches(next);
        } catch (error) {
            showAlert('Could not save the new stop order: ' + error.message, { type: 'error' });
        } finally { setReorderingBatchId(null); }
    };

    const openTruckSheet = async (batch) => {
        setLoadingTruckSheet(true);
        try {
            const projectIds = batch.project_ids || [];
            // The saved BOM lives in bom + bom_items. Read only the customer
            // fields needed to label the stops and choose the BOM template.
            const { data: bomCustomers, error } = await supabase.from('admin')
                .select('id, customer_name, roof_shed')
                .in('id', projectIds);
            if (error) throw error;
            const bomById = new Map((bomCustomers || []).map(customer => [customer.id, customer]));
            const listedById = new Map(customers.map(customer => [customer.id, customer]));
            const projects = projectIds.map(id => ({
                ...(listedById.get(id) || { id }),
                ...bomById.get(id)
            }));
            const projectBoms = await Promise.all(projects.map(async customer => ({
                customer,
                ...await loadBomForCustomer(customer, getBomTypeForCustomer(customer))
            })));
            setTruckSheet({ batch, projects, ...buildTruckLoad(projectBoms) });
        } catch (error) {
            showAlert('Could not prepare the truck sheet: ' + error.message, { type: 'error' });
        } finally { setLoadingTruckSheet(false); }
    };

    // Save Batch & Bulk Update Selected Projects in Supabase
    const handleSaveBatch = async (e) => {
        if (e) e.preventDefault();
        if (batchForm.selectedProjectIds.length === 0) {
            showAlert('Please select at least 1 project to include in this delivery batch.');
            return;
        }
        if (loadingProjects || projectsError || missingSelectedProjectIds.length > 0) {
            showAlert(loadingProjects ? 'Projects are still loading. Please try again.' : projectsError || `${missingSelectedProjectIds.length} selected project(s) could not be loaded. Refresh before updating this batch.`, { type: 'error' });
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
            // Postgres 22P02 error (confirmed live), so generate a UUID.
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

            let updatedBatches;
            if (editingBatch) {
                updatedBatches = batches.map(b => b.id === editingBatch.id ? batchPayload : b);
            } else {
                updatedBatches = [batchPayload, ...batches];
            }

            const removedProjectIds = editingBatch
                ? (editingBatch.project_ids || []).filter(id => !validProjectIds.includes(id))
                : [];

            const { data: rpcData, error: rpcErr } = await supabase.rpc('save_delivery_batch_atomic', {
                p_batch: batchPayload,
                p_selected_project_ids: validProjectIds,
                p_removed_project_ids: removedProjectIds
            });
            if (rpcErr) throw rpcErr;
            if (!rpcData?.success) throw new Error(rpcData?.error || 'The delivery batch save was not confirmed.');
            setBatches(updatedBatches);
            cacheBatches(updatedBatches);

            logBatchChangeForCustomers(validProjectIds, {
                delivery_batch_id: batchPayload.batch_no,
                material_delivery_date: batchPayload.dispatch_date,
                driver_name: batchPayload.driver_name,
                driver_phone_number: batchPayload.driver_phone,
                vehicle_number: batchPayload.vehicle_number,
                ...(batchPayload.vendor ? { vendor: batchPayload.vendor } : {}),
            }, `Delivery batch ${batchPayload.batch_no || ''} saved`);
            logBatchChangeForCustomers(removedProjectIds, {
                delivery_batch_id: null,
                delivery_status: 'PENDING',
                driver_name: null, driver_phone_number: null, vehicle_number: null, material_delivery_date: null,
            }, `Removed from delivery batch ${batchPayload.batch_no || ''}`);

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
                'This batch only ever existed in your browser - it was never saved to the shared database, so there was nothing to delete there. It has been removed locally.',
                { title: 'Removed locally', type: 'warning' }
            );
            cacheBatches(updatedBatches);
        }

        if (isPersistedBatch) {
            try {
                const { data: rpcData, error: rpcErr } = await supabase.rpc('delete_delivery_batch_atomic', {
                    p_batch_id: batchToDelete.id,
                    p_project_ids: batchToDelete.project_ids || []
                });
                if (rpcErr) throw rpcErr;
                if (!rpcData?.success) throw new Error(rpcData?.error || 'Batch deletion was not confirmed.');
            } catch (delRpcEx) {
                setBatches(previousBatches);
                showAlert('Failed to delete this batch: ' + (delRpcEx.message || 'Unknown database error'), { type: 'error' });
                return;
            }
            logBatchChangeForCustomers(batchToDelete?.project_ids || [], {
                delivery_batch_id: null,
                delivery_status: 'PENDING',
                driver_name: null, driver_phone_number: null, vehicle_number: null, material_delivery_date: null,
            }, `Delivery batch ${batchToDelete?.batch_no || batchToDelete?.id || ''} disbanded`);
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

    const eligibleProjects = useMemo(() => getEligibleBatchProjects(
        customers, batchForm.selectedProjectIds, editingBatch, projectSearchQuery, projectStageFilter
    ), [customers, batchForm.selectedProjectIds, editingBatch, projectSearchQuery, projectStageFilter]);
    const missingSelectedProjectIds = useMemo(() => {
        const loadedIds = new Set(customers.map(customer => String(customer.id)));
        return batchForm.selectedProjectIds.filter(id => !loadedIds.has(String(id)));
    }, [customers, batchForm.selectedProjectIds]);

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

    const handlePrintTruckSheet = () => {
        if (!truckSheet) return;
        const madeAt = new Date(truckSheet.batch.created_at || Date.now());
        const date = Number.isNaN(madeAt.getTime()) ? new Date() : madeAt;
        const dateStamp = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const driver = String(truckSheet.batch.driver_name || 'Driver').trim()
            .replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '') || 'Driver';
        const previousTitle = document.title;
        let fallbackTimer;
        const restoreTitle = () => {
            window.removeEventListener('afterprint', restoreTitle);
            clearTimeout(fallbackTimer);
            document.title = previousTitle;
        };
        document.title = `${driver}_${dateStamp}_Truck_Loading_Sheet`;
        window.addEventListener('afterprint', restoreTitle, { once: true });
        fallbackTimer = setTimeout(restoreTitle, 30000);
        try { window.print(); }
        catch (error) {
            restoreTitle();
            showAlert('Could not open the print dialog: ' + error.message, { type: 'error' });
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
                    <p className="text-2xl font-black text-stone-900">{hasBatchSnapshot ? metrics.totalBatches : '…'}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Recorded dispatch trips</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-amber-600 uppercase tracking-wider block">In Transit</span>
                    <p className="text-2xl font-black text-amber-600">{hasBatchSnapshot ? metrics.inTransit : '…'}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Active truck runs</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Clubbed Sites</span>
                    <p className="text-2xl font-black text-stone-900">{hasBatchSnapshot ? metrics.totalProjects : '…'}</p>
                    <span className="text-[11px] text-stone-500 font-medium">Projects in delivery</span>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-2xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Batched Capacity</span>
                    <p className="text-2xl font-black text-stone-900">{!hasBatchSnapshot || loadingProjects ? '…' : metrics.totalKwp} <span className="text-xs font-bold text-stone-400">kWp</span></p>
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
            {batchError && <p role="alert" className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-900">{hasBatchSnapshot ? 'Showing saved batches. ' : ''}{batchError}</p>}
            {loading && hasBatchSnapshot && <p className="text-xs text-stone-500">Refreshing delivery batches…</p>}
            {loading && !hasBatchSnapshot ? (
                <div className="py-16 text-center text-stone-400">
                    <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold">Loading delivery batches...</p>
                </div>
            ) : batchError && !hasBatchSnapshot ? (
                <div className="bg-white border border-amber-300 rounded-3xl p-8 text-center space-y-3">
                    <p className="text-sm font-bold text-stone-800">Delivery batches could not be loaded.</p>
                    <button type="button" onClick={fetchBatches} className="px-4 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold">Retry</button>
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
                        const linkedProjects = projectsInRouteOrder(batch, customers);
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
                                                    try {
                                                        const projectIds = linkedProjects.map(p => p.id);
                                                        const { data: rpcData, error: rpcErr } = await supabase.rpc('update_delivery_batch_status_atomic', {
                                                            p_batch_id: batch.id,
                                                            p_new_status: newStatus,
                                                            p_project_ids: projectIds
                                                        });
                                                        if (rpcErr) throw rpcErr;
                                                        if (!rpcData?.success || rpcData.projects_missing > 0) {
                                                            throw new Error(rpcData?.error || 'The delivery status change could not be confirmed for every customer.');
                                                        }

                                                        await logActivity(currentUser?.id || "admin", "update", `Changed delivery batch ${batch.batch_no || batch.id} status to ${newStatus}`, "");
                                                        logBatchChangeForCustomers(projectIds, { delivery_status: newStatus }, `Delivery batch ${batch.batch_no || batch.id} status changed`);
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
                                         <button type="button" disabled={loadingTruckSheet} onClick={() => openTruckSheet(batch)} className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 disabled:opacity-50 text-amber-900 rounded-xl text-xs font-bold flex items-center gap-1"><Package size={13} /> Truck load sheet</button>

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
                                                      const { data: rpcData, error: rpcErr } = await supabase.rpc('update_delivery_batch_status_atomic', {
                                                          p_batch_id: batch.id,
                                                          p_new_status: 'DELIVERED',
                                                          p_project_ids: projectIds
                                                      });
                                                      if (rpcErr) throw rpcErr;
                                                      if (!rpcData?.success || rpcData.projects_missing > 0) {
                                                          throw new Error(rpcData?.error || 'The delivered status could not be confirmed for every customer.');
                                                      }

                                                      await logActivity(currentUser?.id || "admin", "update", `Marked delivery batch ${batch.batch_no || batch.id} as DELIVERED (${projectIds.length} projects)`, "");
                                                      logBatchChangeForCustomers(projectIds, { delivery_status: 'DELIVERED' }, `Delivery batch ${batch.batch_no || batch.id} marked delivered`);
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
                                                         <td className="py-2.5 font-bold text-stone-400"><div className="flex items-center gap-1">{idx + 1}<div className="flex flex-col"><button type="button" disabled={Boolean(reorderingBatchId) || idx === 0} onClick={() => moveStop(batch, idx, -1)} aria-label={`Move ${proj.customer_name} earlier`} className="disabled:opacity-25">▲</button><button type="button" disabled={Boolean(reorderingBatchId) || idx === linkedProjects.length - 1} onClick={() => moveStop(batch, idx, 1)} aria-label={`Move ${proj.customer_name} later`} className="disabled:opacity-25">▼</button></div></div></td>
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
                                                                         // delivery_status left them stranded - still inside the
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

                                                                         if (leavingBatch) {
                                                                             const remaining = (batch.project_ids || []).filter(id => id !== proj.id);
                                                                             const { data: rpcData, error: rpcErr } = await supabase.rpc('save_delivery_batch_atomic', {
                                                                                 p_batch: { ...batch, project_ids: remaining },
                                                                                 p_selected_project_ids: remaining,
                                                                                 p_removed_project_ids: [proj.id]
                                                                             });
                                                                             if (rpcErr) throw rpcErr;
                                                                             if (!rpcData?.success) throw new Error(rpcData?.error || 'The customer could not be removed from the batch.');
                                                                             await logActivity(currentUser?.id || 'admin', 'update',
                                                                                 `Removed ${proj.customer_name || proj.id} from delivery batch ${batch.batch_no || batch.id} (set back to Pending)`, '', proj.id);
                                                                         } else {
                                                                             const statusRes = await runWrite(
                                                                                 supabase.from('admin').update(patch).eq('id', proj.id).select('id'),
                                                                                 { action: 'delivery status change' }
                                                                             );
                                                                             if (!statusRes.ok) throw statusRes.error;
                                                                         }
                                                                         logBatchChangeForCustomers([proj.id], patch, `Delivery status changed in batch ${batch.batch_no || batch.id}`);
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
                                        {editingBatch && <p className="text-[10px] text-stone-500">Selected projects stay visible even after moving to another stage.</p>}
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
                                {loadingProjects && <p className="text-xs text-stone-500">Loading projects…</p>}
                                {projectsError && <p role="alert" className="text-xs text-red-700">Could not load projects: {projectsError}</p>}
                                {!loadingProjects && missingSelectedProjectIds.length > 0 && <p role="alert" className="text-xs text-amber-800">{missingSelectedProjectIds.length} saved project(s) could not be found. Refresh before updating this batch.</p>}
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
                                    {!loadingProjects && !projectsError && eligibleProjects.length === 0 && <p className="col-span-full p-3 text-xs text-stone-500">No projects match this filter.</p>}
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
            {printingBatch && createPortal(
                <div className="print-container fixed inset-0 z-50 bg-stone-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-[1122px] w-full max-h-[96vh] flex flex-col overflow-hidden">
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
                        <div className="flex-1 overflow-y-auto bg-stone-100 p-3">
                        <div ref={printableRef} className="mx-auto w-full aspect-[297/210] p-8 bg-white text-stone-900 print-document" id="printable-master-batch">
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
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{printingBatch.vehicle_number || ''}</td>
                                            <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Dispatch Date:</td>
                                            <td className="w-1/4 p-2 font-bold text-stone-900">{printingBatch.dispatch_date || ''}</td>
                                        </tr>
                                        <tr className="border-b border-stone-200">
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Name:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.driver_name || ''}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Driver Phone:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.driver_phone || ''}</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Rent Amount:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.rent_amount ? `₹ ${toIndianCommas(printingBatch.rent_amount)}` : ''}</td>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Total Sites:</td>
                                            <td className="p-2 font-bold text-stone-900">{(printingBatch.project_ids || []).length} Drop-off Locations</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Car Rent Paid:</td>
                                            <td className="p-2 font-bold text-stone-900" colSpan={3}>{printingBatch.car_rent_paid || ''}</td>
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
                                        {projectsInRouteOrder(printingBatch, customers).map((proj, idx) => (
                                            <tr key={proj.id} className="border-b border-stone-200">
                                                <td className="p-2 font-bold text-center border-r border-stone-300">{idx + 1}</td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <strong className="text-stone-900">{proj.customer_name}</strong>
                                                    <div className="text-[10px] text-stone-600">{proj.phone_number || ''}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <div>{proj.villages || ''}</div>
                                                    <div className="text-[10px] text-stone-500">{proj.sub_divisions || ''}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300">
                                                    <strong>{proj.system_capacity_kwp ? `${proj.system_capacity_kwp} kWp` : ''}</strong>
                                                    <div className="text-[10px] text-stone-600">{proj.no_of_modules ? `${proj.no_of_modules} Panels` : ''}</div>
                                                </td>
                                                <td className="p-2 border-r border-stone-300 font-mono text-[10px]">
                                                    {proj.inverter_serial_no || ''}
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
                </div>, document.body
            )}

            {truckSheet && createPortal(
                <TruckLoadingSheet sheet={truckSheet} onPrint={handlePrintTruckSheet} onClose={() => setTruckSheet(null)} />,
                document.body
            )}

            {/* Print Specific CSS */}
            <style>{`
                @media print {
                    @page {
                        size: ${printingBatch || truckSheet ? 'A4 landscape' : 'A4 portrait'};
                        margin: ${truckSheet ? '0' : '12mm'};
                    }
                    ${printingBatch || truckSheet ? 'body > #root { display: none !important; }' : ''}
                    body * {
                        visibility: hidden !important;
                    }
                    .print-container, .print-container * {
                        visibility: visible !important;
                    }
                    .print-container {
                        display: block !important;
                        position: static !important;
                        width: ${truckSheet ? '296mm' : '273mm'} !important;
                        max-width: 100% !important;
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        box-sizing: border-box !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    .print-container > div {
                        width: 100% !important;
                        max-width: none !important;
                        min-height: 0 !important;
                        max-height: none !important;
                        aspect-ratio: auto !important;
                        display: block !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        box-shadow: none !important;
                    }
                    .print-container > div > div:last-child,
                    .print-container #printable-master-batch {
                        overflow: visible !important;
                        min-height: 0 !important;
                        max-height: none !important;
                    }
                    .print-container > div > div:last-child { padding: 0 !important; }
                    .truck-sheet-print .truck-sheet-preview {
                        display: block !important;
                        overflow: visible !important;
                        width: 296mm !important;
                        gap: 0 !important;
                    }
                    .truck-sheet-print .truck-sheet-page {
                        width: 296mm !important;
                        height: 208mm !important;
                        min-height: 208mm !important;
                        max-height: 208mm !important;
                        padding: 8mm 10mm 9mm !important;
                        margin: 0 !important;
                        overflow: hidden !important;
                        box-shadow: none !important;
                        break-after: page;
                        page-break-after: always;
                    }
                    .truck-sheet-print .truck-sheet-page > header {
                        display: flex !important;
                        flex-direction: row !important;
                        align-items: flex-start !important;
                        justify-content: space-between !important;
                        break-inside: avoid !important;
                    }
                    .truck-sheet-print .truck-sheet-page > footer {
                        position: relative !important;
                        z-index: 1 !important;
                        flex-shrink: 0 !important;
                        min-height: 7mm !important;
                        background: #ffffff !important;
                        margin-top: 3mm !important;
                    }
                    .truck-sheet-print .truck-sheet-page:last-child {
                        break-after: auto;
                        page-break-after: auto;
                    }
                    .print-container #printable-master-batch { padding: 0 !important; }
                    .print-container #printable-master-batch { aspect-ratio: auto !important; }
                    .print-container header { display: block !important; }
                    .no-print {
                        display: none !important;
                    }
                    .print-table-scroll { overflow: visible !important; }
                    thead { display: table-header-group; }
                    tr { break-inside: avoid; }
                }
            `}</style>
        </div>
    );
}
