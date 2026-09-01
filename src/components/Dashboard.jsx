// ─── Dashboard.jsx ────────────────────────────────────────────────────────────
// Main admin layout: sidebar + header + view router.
// Features:
//   • Trash sidebar item + soft-delete/recover/hard-delete
//   • Global search across ALL stages (name, phone, consumer no) with results overlay
//   • Stage counts exclude deleted records
//   • Sales/Operations roles share the same shell, but see SalesView's card UI
//     for the "stages" view and lose Activity Log / User Management / Trash
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useMemo, Suspense } from 'react';
import { supabase } from '../supabase';
import { logActivity, exportAllToCSV, uploadDocument, parseIndianNumber, lazyWithRetry, sanitizeAdminUpdate, runWrite } from '../utils';
import { PRIMARY_STAGES, STAGE_IDS, CUSTOMER_CARD_COLUMNS, ADMIN_NUMERIC_COLUMNS } from '../constants';
import DashboardView from './DashboardView';
import CustomerCard from './CustomerCard';

// Secondary views and modals with auto-retry on new deployments
const SubsidyView = lazyWithRetry(() => import('./SubsidyView'));
const LoanView = lazyWithRetry(() => import('./LoanView'));
const InstallationView = lazyWithRetry(() => import('./InstallationView'));
const CustomerDetailModal = lazyWithRetry(() => import('./CustomerDetailModal'));
const AddLeadModal = lazyWithRetry(() => import('./AddLeadModal'));
const ActivityLogView = lazyWithRetry(() => import('./ActivityLogView'));
const UserManagementView = lazyWithRetry(() => import('./UserManagementView'));
const TrashView = lazyWithRetry(() => import('./TrashView'));
const ChannelPartnerManagementView = lazyWithRetry(() => import('./ChannelPartnerManagementView'));
const InstallationPaymentsView = lazyWithRetry(() => import('./InstallationPaymentsView'));
const DeliveryBatchesView = lazyWithRetry(() => import('./DeliveryBatchesView'));
import { useGlobalPopup } from './GlobalPopup';
import BrandMark from './BrandMark';

const ViewLoader = () => <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" /></div>;

import {
    LayoutDashboard, Activity, UserCog, Menu, X,
    Search, Plus, Download, LogOut, Trash2, Users, Tag, IndianRupee, Wrench, CreditCard, Terminal, Truck
} from 'lucide-react';

// ── NavBtn ────────────────────────────────────────────────────────────────────
const NavBtn = ({ view, stage, icon: Icon, label, count, redBadge, currentView, selectedStage, setCurrentView, setSelectedStage }) => {
    const isActive = view === 'stages'
        ? (currentView === 'stages' && selectedStage === stage)
        : currentView === view;
    return (
        <button
            onClick={() => {
                if (view === 'stages') { setCurrentView('stages'); setSelectedStage(stage); }
                else setCurrentView(view);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold mb-0.5 transition-colors cursor-pointer ${isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}`}
        >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left truncate">{label}</span>
            {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold ${isActive ? 'bg-white/20 text-white' : redBadge ? 'bg-red-100 text-red-500' : 'bg-stone-100 text-stone-500'}`}>
                    {count}
                </span>
            )}
        </button>
    );
};

export default function Dashboard({ user, onLogout, onOpenDevSwitcher }) {
    const { showAlert } = useGlobalPopup();
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Remember current view across page reloads
    const [currentView, setCurrentView] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = window.sessionStorage.getItem('watersun_current_view');
            if (saved) return saved;
        }
        return 'dashboard';
    });

    // Remember selected stage across page reloads
    const [selectedStage, setSelectedStage] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = window.sessionStorage.getItem('watersun_selected_stage');
            if (saved) return saved;
        }
        return STAGE_IDS.LEADS;
    });

    const [stageSearch, setStageSearch] = useState('');    // per-stage search
    const [channelPartnerFilterInput, setChannelPartnerFilterInput] = useState('');  // typed channel partner name (not yet applied)
    const [channelPartnerFilter, setChannelPartnerFilter] = useState('');    // applied channel partner filter
    const [showChannelPartnerDrop, setShowChannelPartnerDrop] = useState(false);
    const channelPartnerFilterRef = useRef(null);
    const sidebarRef = useRef(null);
    const [globalSearch, setGlobalSearch] = useState('');    // global search
    const [globalResults, setGlobalResults] = useState([]);
    const [showGlobalDrop, setShowGlobalDrop] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showAddLead, setShowAddLead] = useState(false);
    const globalSearchRef = useRef(null);
    const [meta, setMeta] = useState({});

    // Synchronize navigation state to sessionStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_current_view', currentView);
        }
    }, [currentView]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_selected_stage', selectedStage);
        }
    }, [selectedStage]);

    // Restore selected customer modal if page is reloaded
    useEffect(() => {
        if (typeof window !== 'undefined') {
            if (selectedCustomer?.id) {
                window.sessionStorage.setItem('watersun_selected_customer_id', selectedCustomer.id);
            } else {
                window.sessionStorage.removeItem('watersun_selected_customer_id');
            }
        }
    }, [selectedCustomer]);

    // On initial mount, restore previously opened customer modal if any
    useEffect(() => {
        const restoreOpenedCustomer = async () => {
            if (typeof window === 'undefined') return;
            const savedCustId = window.sessionStorage.getItem('watersun_selected_customer_id');
            if (!savedCustId) return;

            try {
                const { data } = await supabase
                    .from('admin')
                    .select('*')
                    .eq('id', savedCustId)
                    .single();
                if (data) {
                    setSelectedCustomer(data);
                }
            } catch { /* best-effort restore, ignore failure */ }
        };
        restoreOpenedCustomer();
    }, []);

    const PAGE_SIZE = 50;
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [metrics, setMetrics] = useState(null);
    const [exporting, setExporting] = useState(false);
    const isChannelPartnerOffice = user?.userType === 'channel_partner_office' || user?.userType === 'office2';
    // Delivery Batches is a head-office function: Admin and Office only. Neither
    // the CPO nor the CP Manager (office2) under it gets access.
    const canSeeDeliveryBatches = user?.userType === 'admin' || user?.userType === 'sales';
    const partnerName = (user?.channel_partner || user?.name || ' ').trim();

    const handleFullExport = async () => {
        setExporting(true);
        try {

            // Fetch all records with chunking to ensure 100% of rows beyond 1000 limit are retrieved
            let allRows = [];
            let from = 0;
            const CHUNK_SIZE = 1000;
            let keepGoing = true;

            while (keepGoing) {
                let query = supabase
                    .from('admin')
                    .select('*')
                    .is('deleted_at', null)
                    .order('created_at', { ascending: false })
                    .range(from, from + CHUNK_SIZE - 1);

                if (isChannelPartnerOffice) {
                    query = query.ilike('channel_partner', partnerName);
                } else if (channelPartnerFilter && channelPartnerFilter.trim()) {
                    query = query.ilike('channel_partner', channelPartnerFilter.trim());
                }

                const { data, error } = await query;
                if (error || !data || data.length === 0) {
                    keepGoing = false;
                } else {
                    allRows = allRows.concat(data);
                    if (data.length < CHUNK_SIZE) {
                        keepGoing = false;
                    } else {
                        from += CHUNK_SIZE;
                    }
                }
            }

            if (allRows.length > 0) {
                exportAllToCSV(allRows);
            } else {
                showAlert('No customer records found to export.');
            }
        } catch (err) {
            console.error('Export error:', err);
            showAlert('Failed to export data. Please try again.', { type: 'error' });
        } finally {
            setExporting(false);
        }
    };

    // ── Data fetching ──────────────────────────────────────────────────────────
    // `skipMeta` lets the realtime path refresh only the numbers. The metadata
    // table is nearly static (dropdown lists), but it was refetched on EVERY
    // realtime event - so one person saving a customer meant 30 connected
    // clients each running 3 queries. Metadata is now fetched on mount and when
    // the branch filter changes, not on every write anywhere in the system.
    const fetchMetricsAndMeta = async (skipMeta = false) => {
        const targetPartner = isChannelPartnerOffice ? partnerName : (channelPartnerFilter?.trim() || null);
        const [metricsRes, metaRes, batchesRes] = await Promise.all([
            supabase.rpc('get_dashboard_metrics', { 
                p_channel_partner: targetPartner 
            }),
            skipMeta ? Promise.resolve({ data: null, error: null })
                     : supabase.from('metadata').select('category, label'),
            supabase.from('delivery_batches').select('id', { count: 'exact', head: true }).neq('status', 'DELIVERED')
        ]);

        let finalMetrics = {
            totalProjects: 0, completedCount: 0, liveProjects: 0, loanCount: 0, cashCount: 0, stageCounts: {}, deliveryBatchesCount: 0,
            installationTagCount: 0, subsidyTagCount: 0, loanTagCount: 0
        };

        if (!metricsRes.error && metricsRes.data) {
            finalMetrics = { 
                ...finalMetrics,
                ...metricsRes.data,
                loanTagCount: metricsRes.data.loanTagCount ?? metricsRes.data.loanCount ?? 0
            };
        } else {
            console.error('Metrics fetch error:', metricsRes.error);
        }
        
        if (!batchesRes.error) {
            finalMetrics.deliveryBatchesCount = batchesRes.count || 0;
        }
        setMetrics(finalMetrics);

        if (!metaRes.error && metaRes.data) {
            const grouped = {};
            metaRes.data.forEach(({ category, label }) => {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(label);
            });
            setMeta(grouped);
        }
    };


    const fetchStageCustomers = async (stage = selectedStage, pageNum = 0) => {
        setLoading(true);
        const normalizedStage = (stage || STAGE_IDS.LEADS).toUpperCase();
        let query = supabase
            .from('admin')
            // Was select('*') - ~90 columns for 50 cards that render 10 fields.
            // CUSTOMER_CARD_COLUMNS already existed for this and was imported
            // but never used. The detail modal fetches the full row on open, so
            // nothing downstream loses data.
            .select(CUSTOMER_CARD_COLUMNS)
            // .eq not .ilike: normalizedStage is already uppercased above, and
            // all 3,828 stage values in the table are clean uppercase - so this
            // matches exactly the same rows. ILIKE cannot use an index and
            // forced a case-folding comparison over every row on each switch.
            .eq('stage', normalizedStage)
            .order('created_at', { ascending: false })
            .range(pageNum * 50, (pageNum + 1) * 50 - 1);
            
        if (isChannelPartnerOffice) {
            query = query.ilike('channel_partner', `%${partnerName}%`);
        } else if (channelPartnerFilter && channelPartnerFilter.trim()) {
            query = query.ilike('channel_partner', `%${channelPartnerFilter.trim()}%`);
        }

        const { data, error } = await query;
        if (!error && data) {
            if (pageNum === 0) {
                setCustomers(data);
            } else {
                setCustomers(prev => {
                    // Prevent duplicate keys
                    const existingIds = new Set(prev.map(c => c.id));
                    const uniqueNew = data.filter(c => !existingIds.has(c.id));
                    return [...prev, ...uniqueNew];
                });
            }
            setHasMore(data.length === 50);
        } else {
            console.error("Error fetching stage customers:", error);
            if (pageNum === 0) setCustomers([]);
        }
        setLoading(false);
    };

    const loadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchStageCustomers(selectedStage, nextPage);
    };

    useEffect(() => {
        setPage(0);
        fetchMetricsAndMeta();
        fetchStageCustomers(selectedStage, 0);
    }, [selectedStage, channelPartnerFilter, isChannelPartnerOffice, partnerName]);

    // Refresh when the operator returns to the tab. This is what actually keeps
    // the grid current for most people - they switch away, come back, and see
    // fresh data - and it costs nothing while the tab is in the background,
    // unlike a live subscription that fires for every write in the system.
    // Throttled so rapid tab switching cannot hammer the database.
    const lastFocusFetch = useRef(0);
    useEffect(() => {
        const onFocus = () => {
            if (document.visibilityState !== 'visible') return;
            if (Date.now() - lastFocusFetch.current < 10000) return;
            lastFocusFetch.current = Date.now();
            fetchStageCustomers(selectedStage, 0);
            fetchMetricsAndMeta(true);
        };
        window.addEventListener('focus', onFocus);
        document.addEventListener('visibilitychange', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            document.removeEventListener('visibilitychange', onFocus);
        };
    }, [selectedStage, channelPartnerFilter, isChannelPartnerOffice, partnerName]);

    useEffect(() => {
        const channel = supabase.channel('admin_changes')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'admin'
            }, (payload) => {
                // Coalesced: this used to run a full-table aggregate RPC (plus two
                // more queries) on EVERY row change, for EVERY connected client.
                // One person saving a customer meant 30 clients x 3 queries. A
                // burst of edits now collapses into a single refresh.
                scheduleMetricsRefresh(); 
                
                // Realtime delivered every row change to every client and this
                // handler tested only `stage`. A CPO or Manager sitting on a
                // stage could therefore receive - and open - another branch's
                // customer. Every other portal re-tests ownership on the payload
                // (AgentPortal, VendorPortal, StampPortal); this one did not.
                const isVisibleToMe = (row) => {
                    if (!row) return false;
                    if (row.deleted_at) return false;
                    if (user?.userType === 'admin' || user?.userType === 'sales') return true;
                    if (isChannelPartnerOffice) {
                        return String(row.channel_partner || '').trim().toLowerCase()
                            === String(partnerName || '').trim().toLowerCase();
                    }
                    return false;
                };

                if (payload.eventType === 'INSERT') {
                    if (payload.new.stage === selectedStage && isVisibleToMe(payload.new)) {
                        setCustomers(prev => {
                            if (prev.some(c => c.id === payload.new.id)) return prev;
                            return [payload.new, ...prev];
                        });
                    }
                } else if (payload.eventType === 'UPDATE') {
                    const isInStage = payload.new.stage === selectedStage && isVisibleToMe(payload.new);
                    setCustomers(prev => {
                        const exists = prev.some(c => c.id === payload.new.id);
                        if (exists && isInStage) {
                            return prev.map(c => c.id === payload.new.id ? payload.new : c);
                        } else if (exists && !isInStage) {
                            return prev.filter(c => c.id !== payload.new.id);
                        } else if (!exists && isInStage) {
                            return [payload.new, ...prev];
                        }
                        return prev;
                    });
                } else if (payload.eventType === 'DELETE') {
                    setCustomers(prev => prev.filter(c => c.id !== (payload.old?.id || payload.new?.id)));
                }
            })
            .subscribe();

        return () => {
            if (metricsRefreshTimer.current) clearTimeout(metricsRefreshTimer.current);
            supabase.removeChannel(channel);
        };
        // user identity is stable for a session, but it is now read inside the
        // handler (isVisibleToMe), so it belongs in the deps rather than being
        // captured in a stale closure.
    }, [selectedStage, user?.userType, isChannelPartnerOffice, partnerName]);

    // Sync selectedCustomer state with fresh database values when updates occur
    useEffect(() => {
        if (selectedCustomer) {
            const fresh = customers.find(c => c.id === selectedCustomer.id);
            if (fresh && JSON.stringify(fresh) !== JSON.stringify(selectedCustomer)) {
                setSelectedCustomer(fresh);
            }
        }
    }, [customers]);

    // Close global search / poc dropdowns when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (globalSearchRef.current && !globalSearchRef.current.contains(e.target)) {
                setShowGlobalDrop(false);
            }
            if (channelPartnerFilterRef.current && !channelPartnerFilterRef.current.contains(e.target)) {
                setShowChannelPartnerDrop(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);


    // ── Global search: Server-side search across ALL non-deleted stages ─────
    useEffect(() => {
        const q = (globalSearch || '').trim();
        if (!q) { 
            setGlobalResults([]); 
            setShowGlobalDrop(false); 
            return; 
        }

        const fetchSearch = async () => {
            let query = supabase
                .from('admin')
                .select('id, customer_name, phone_number, consumer_no, stage')
                // Was missing, unlike every other view. Trashed records were
                // returned by global search and opened FULLY EDITABLE, since
                // isFrozen keys off stage only, never deleted_at.
                .is('deleted_at', null)
                
;
                
            let orString = `customer_name.ilike.%${q}%`;
            if (!isNaN(q) && q.length > 0) {
                // If the user types a number, search it exactly in the numeric columns
                orString += `,phone_number.eq.${q},consumer_no.eq.${q}`;
            }
            query = query.or(orString);
                query = query.limit(8);
                
            if (isChannelPartnerOffice) {
                query = query.ilike('channel_partner', `%${partnerName}%`);
            } else if (channelPartnerFilter) {
                query = query.ilike('channel_partner', `%${channelPartnerFilter.trim()}%`);
            }

            const { data, error } = await query;
            if (error) console.error("Search error:", error);
            setGlobalResults(data || []);
            setShowGlobalDrop((data || []).length > 0);
        };

        const timer = setTimeout(fetchSearch, 300); // 300ms debounce
        return () => clearTimeout(timer);
    }, [globalSearch, channelPartnerFilter, isChannelPartnerOffice, partnerName]);

    const handleGlobalSelect = (customer) => {
        // Navigate to the customer's stage so context is clear
        setCurrentView('stages');
        setSelectedStage(customer.stage || 'Leads');
        setStageSearch('');
        // Open the detail modal
        setSelectedCustomer(customer);
        setGlobalSearch('');
        setShowGlobalDrop(false);
    };

    // ── CRUD ──────────────────────────────────────────────────────────────────
    const syncMetadata = async (data) => {
        try {
            if (data.channel_partner) {
                const partner = data.channel_partner.trim();
                if (partner) {
                    const { data: existing } = await supabase
                        .from('metadata')
                        .select('id')
                        .eq('category', 'channel_partner')
                        .eq('label', partner);
                    if (!existing || existing.length === 0) {
                        // Non-blocking: the lead itself is already saved; this only
                        // seeds the dropdown for next time.
                        const { error: metaErr } = await supabase
                            .from('metadata')
                            .insert({ category: 'channel_partner', label: partner });
                        if (metaErr) console.warn('Could not add "%s" to the channel_partner list:', partner, metaErr.message);
                    }
                }
            }
            if (data.module_brand) {
                const brand = data.module_brand.trim();
                if (brand) {
                    const { data: existing } = await supabase
                        .from('metadata')
                        .select('id')
                        .eq('category', 'module_brand')
                        .eq('label', brand);
                    if (!existing || existing.length === 0) {
                        // Non-blocking: the lead itself is already saved; this only
                        // seeds the dropdown for next time.
                        const { error: metaErr } = await supabase
                            .from('metadata')
                            .insert({ category: 'module_brand', label: brand });
                        if (metaErr) console.warn('Could not add "%s" to the module_brand list:', brand, metaErr.message);
                    }
                }
            }
        } catch (e) {
            console.error('Metadata sync background error:', e);
        }
    };

    const handleUpdateCustomer = async (id, updates) => {
        // Whitelist against the real schema. This replaced a hand-maintained
        // list of deletes, which is what let `file_status` slip through and
        // fail every save on the record (PostgREST rejects the WHOLE update
        // when one key is not a column).
        const cleanUpdates = sanitizeAdminUpdate(updates);

        // These ARE real columns, but must never be written from the client.
        delete cleanUpdates.id;
        delete cleanUpdates.created_at;
        delete cleanUpdates.updated_at;
        
        // Clean numeric fields
        // Date columns reject '' exactly as numeric columns do. AgentPortal has
        // had this guard since forever; this path never got it, so clearing any
        // date (Registration Date, Delivery Date, Installation Date...) made
        // Postgres reject the WHOLE update and every other edit in that save
        // was lost with "Your changes were not saved".
        Object.keys(cleanUpdates).forEach(key => {
            if ((key === 'date' || key.endsWith('_date')) && cleanUpdates[key] === '') {
                cleanUpdates[key] = null;
            }
        });

        for (const field of ADMIN_NUMERIC_COLUMNS) {
            if (cleanUpdates[field] !== undefined) {
                if (cleanUpdates[field] === '' || cleanUpdates[field] === null) {
                    cleanUpdates[field] = null;
                } else {
                    // parseIndianNumber returns '' for unparseable input, NOT NaN,
                    // so isNaN() was always false and '' reached the numeric column.
                    const parsed = parseIndianNumber(cleanUpdates[field]);
                    cleanUpdates[field] = (parsed === '' || Number.isNaN(parsed)) ? null : parsed;
                }
            }
        }

        // Clean history arrays if present
        if (Array.isArray(cleanUpdates.loan_history)) {
            cleanUpdates.loan_history = cleanUpdates.loan_history.map(({ isNew, ...item }) => item);
        }
        if (Array.isArray(cleanUpdates.subsidy_history)) {
            cleanUpdates.subsidy_history = cleanUpdates.subsidy_history.map(({ isNew, ...item }) => item);
        }

        // 1. Optimistic UI Update (instant feedback)
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...cleanUpdates } : c));
        if (selectedCustomer?.id === id) {
            setSelectedCustomer(prev => ({ ...prev, ...cleanUpdates }));
        }


        // Every key was stripped (nothing changed, or nothing was a real column).
        // update({}) is rejected by PostgREST, which the caller then reported as
        // "The database did not accept the changes".
        if (Object.keys(cleanUpdates).length === 0) {
            console.warn('handleUpdateCustomer: nothing to write after sanitising; skipping the update.');
            return true;
        }

        // 2. Background Database Save
        try {
            // .select('id') so we can tell "saved" from "matched no rows".
            // An RLS-filtered UPDATE returns error: null with 0 rows changed, so
            // "no error" was NOT proof of a save - the user saw success and the
            // data was never written.
            const { data: changed, error } = await supabase
                .from('admin').update(cleanUpdates).eq('id', id).select('id');

            if (!error && changed && changed.length > 0) {
                syncMetadata(cleanUpdates);
                return true;
            } else if (!error) {
                console.error('Update matched no rows for id', id, '- refused by RLS, or the record no longer exists.');
                showAlert(
                    'Your changes were not saved: the database did not accept the update. '
                    + 'This usually means your account does not have permission to edit this record, '
                    + 'or it has been deleted. Please refresh and check before editing again.',
                    { type: 'error' }
                );
                const previousCustomer = customers.find(c => c.id === id);
                if (previousCustomer) {
                    setCustomers(prev => prev.map(c => c.id === id ? previousCustomer : c));
                    if (selectedCustomer?.id === id) setSelectedCustomer(previousCustomer);
                }
                return false;
            } else {
                console.error('Error updating customer in DB:', error);
                showAlert('Database Save Error: ' + (error.message || 'Unknown database error'), { type: 'error' });
                
                // Rollback on failure
                const previousCustomer = customers.find(c => c.id === id);
                if (previousCustomer) {
                    setCustomers(prev => prev.map(c => c.id === id ? previousCustomer : c));
                    if (selectedCustomer?.id === id) setSelectedCustomer(previousCustomer);
                }
                return false;
            }
        } catch (err) {
            console.error('Exception updating customer:', err);
            showAlert('Database Connection Error: ' + err.message, { type: 'error' });
            return false;
        }
    };

    // Soft-delete: sets deleted_at, never removes from DB
    const handleSoftDelete = async (id, deletedAt) => {
        const ts = deletedAt || new Date().toISOString();
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted_at: ts } : c));
        setSelectedCustomer(null);

        // Checked for zero rows, not just for an error: an RLS-refused UPDATE
        // returns error: null having changed nothing, so the row vanished from
        // the list optimistically and came back on the next refresh.
        const res = await runWrite(
            supabase.from('admin').update({ deleted_at: ts }).eq('id', id).select('id'),
            { action: 'move to Trash' }
        );
        if (!res.ok) {
            setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } : c));
            showAlert('The customer was not moved to Trash: ' + res.error.message, { type: 'error' });
        }
    };

    // Recover from trash
    const handleRecover = async (id) => {
        const res = await runWrite(
            supabase.from('admin').update({ deleted_at: null }).eq('id', id).select('id'),
            { action: 'recovery' }
        );
        if (!res.ok) {
            showAlert('The customer could not be recovered: ' + res.error.message, { type: 'error' });
            return;
        }
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, deleted_at: null } : c));
        logActivity(
            user.id,
            'update',
            `Recovered customer from trash`,
            '',
            id
        );
    };

    // Hard-delete: permanent, admin only
    const handleHardDelete = async (id) => {
        const c = customers.find(x => x.id === id);

        // The delete runs FIRST and its row count is checked. This used to write
        // "Permanently deleted" to the activity log before attempting the
        // delete, and the delete itself was unchecked - so a refused delete left
        // the record live in the database with an audit entry swearing it was
        // gone, and the card removed from the list.
        const res = await runWrite(
            supabase.from('admin').delete().eq('id', id).select('id'),
            { action: 'permanent deletion' }
        );
        if (!res.ok) {
            showAlert('The customer was NOT permanently deleted: ' + res.error.message, { type: 'error' });
            return;
        }

        await logActivity(
            user.id,
            'delete',
            `Permanently deleted: ${c?.customer_name}`,
            '',
            id
        );
        setCustomers(prev => prev.filter(c => c.id !== id));
    };

    const handleMoveStage = async (id, newStage) => {
        const customer = customers.find(c => c.id === id);
        if (!customer) return;
        const oldStage = customer.stage;

        // The customer-card stage picker wrote the new stage straight to the
        // database with no checks, so a lead could be pushed to Registration
        // with a blank Phone Number. The modal's "Move to next stage" button
        // has always enforced this list (getMissingStageRequirements in
        // CustomerDetailModal); this is the same list on the card path.
        // Backward moves, Hold Procurement and Lost Project stay unblocked.
        const movingForwardFromLeads =
            oldStage === STAGE_IDS.LEADS &&
            newStage !== STAGE_IDS.LEADS &&
            newStage !== 'HOLD PROCUREMENT' &&
            newStage !== STAGE_IDS.LOST_PROJECT;

        if (movingForwardFromLeads) {
            const missing = [];
            const need = (condition, label) => { if (!condition) missing.push(label); };
            need(customer.customer_name?.trim(), 'Customer Name');
            need(customer.phone_number?.toString().trim(), 'Phone Number');
            need(customer.consumer_no?.toString().trim(), 'Consumer Number');
            need(customer.villages?.trim(), 'Village / Address');
            need(customer.channel_partner?.trim(), 'Channel Partner Name');
            need(customer.module_brand?.trim(), 'Module Brand');
            need(customer.module_wp?.toString().trim(), 'Module WP');
            need(customer.no_of_modules?.toString().trim(), 'Number of Modules');
            need(customer.system_capacity_kwp, 'System Capacity');
            need(customer.sub_divisions?.trim(), 'Sub Division');
            need(customer.payment_type?.trim(), 'Payment Type');

            if (missing.length > 0) {
                showAlert(
                    `This lead is not ready to move to ${newStage}. Please complete:\n\n• ${missing.join('\n• ')}\n\nOpen the customer to fill these in.`,
                    { title: 'Lead details incomplete', type: 'warning' }
                );
                return;
            }
        }

        // Extract old remark before clearing it from the JSON mapping
        const oldRemark = (typeof customer.stages_remarks === 'object' && customer.stages_remarks ? customer.stages_remarks[oldStage] : '') || '';

        const prevObj = typeof customer.stages_remarks === 'object' && customer.stages_remarks ? customer.stages_remarks : {};
        const optimisticUpdates = {
            stage: newStage,
            stages_remarks: { ...prevObj, [oldStage]: '' }
        };

        // 1. Optimistic Update (UI)
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...optimisticUpdates } : c));
        if (selectedCustomer?.id === id) setSelectedCustomer(prev => ({ ...prev, ...optimisticUpdates }));


        // 2. Call Atomic RPC to append remarks safely on the server
        const { data: updatedRecord, error } = await supabase.rpc('move_stage', {
            p_customer_id: id,
            p_new_stage: newStage,
            p_old_stage: oldStage,
            p_remark: oldRemark
        });

        if (error) {
            console.error('Error moving stage:', error);
            showAlert('Error moving stage: ' + error.message, { type: 'error' });
            // Rollback on failure by reloading this stage
            fetchStageCustomers(selectedStage, page);
            return;
        }

        // Apply server returned state which includes exact formatted timestamp
        setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...updatedRecord } : c));
        if (selectedCustomer?.id === id) setSelectedCustomer(prev => ({ ...prev, ...updatedRecord }));

        // Update the JSON column to clear the old remark (since RPC only did stage & internal_remarks)
        // Non-blocking: the stage move already succeeded via the RPC above, so a
        // failure here only leaves the previous stage's remark behind. Warn
        // rather than throw, but do not let it fail invisibly.
        const followUp = { stages_remarks: optimisticUpdates.stages_remarks };

        // Moving to Lost Project must record WHERE it was lost from. The RPC
        // writes only `stage` and `internal_remarks`, so a record dragged here
        // from the card arrived with no hold_procurement at all - and
        // HoldProcurementTab then falls back to 'LEADS', so Resume offered to
        // send a project lost at Subsidy Status back to Leads.
        if (newStage === STAGE_IDS.LOST_PROJECT) {
            let existing = {};
            const raw = customer.hold_procurement;
            if (raw) {
                try {
                    existing = typeof raw === 'string' ? (JSON.parse(raw) || {}) : (raw || {});
                } catch { existing = {}; }
            }
            followUp.hold_procurement = {
                ...existing,
                previous_stage: oldStage,
                hold_date: new Date().toISOString().split('T')[0],
            };
        }

        const { error: remarkErr } = await supabase.from('admin')
            .update(followUp).eq('id', id);
        if (remarkErr) console.warn('Stage moved, but the follow-up write failed:', remarkErr.message);

        await logActivity(
            user.id,
            'stage_change',
            `${customer.customer_name}: STAGE: ${oldStage} → ${newStage}`,
            '',
            id
        );
    };

    // Collapses a burst of realtime events into one metrics refresh.
    const metricsRefreshTimer = useRef(null);
    const lastMetricsAt = useRef(0);
    const scheduleMetricsRefresh = () => {
        if (metricsRefreshTimer.current) return; // already queued - do not reset the timer
        // Under load this fired for every write from every client. The window is
        // wider now, it does NOT restart on each event (so a steady stream of
        // edits still refreshes on a fixed cadence rather than never), and it
        // skips the metadata query entirely.
        const sinceLast = Date.now() - lastMetricsAt.current;
        const wait = Math.max(8000, 15000 - sinceLast);
        metricsRefreshTimer.current = setTimeout(() => {
            metricsRefreshTimer.current = null;
            lastMetricsAt.current = Date.now();
            fetchMetricsAndMeta(true);
        }, wait);
    };

    const handleAddLead = async (data, attachedFiles = []) => {
        const leadData = { ...data, application_done_by: user.name, created_at: new Date().toISOString() };

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


        const { data: newCustomer, error } = await supabase.from('admin').insert(insertData).select().single();
        if (error) {
            console.error("Error adding lead to Supabase:", error);
            showAlert(`Failed to add lead: ${error.message} (Code: ${error.code})`, { type: 'error' });
            throw error;
        } else {
            // Collect the failures instead of swallowing them. The lead is
            // already created and must not be rolled back, but the user has to
            // be told WHICH documents did not store - otherwise their only copy
            // is the file picker in a modal that is about to close.
            if (attachedFiles && attachedFiles.length > 0) {
                const failedUploads = [];
                await Promise.all(attachedFiles.map(async item => {
                    if (item.file) {
                        try {
                            await uploadDocument(item.file, newCustomer.id, item.doc_type, user?.id);
                        } catch (uploadErr) {
                            console.error('Failed to upload file for new lead:', uploadErr);
                            failedUploads.push(item.file.name || item.doc_type || 'a document');
                        }
                    }
                }));
                if (failedUploads.length > 0) {
                    showAlert(
                        `The lead was saved, but ${failedUploads.length} document(s) did NOT upload: `
                        + failedUploads.join(', ')
                        + '. Open the customer and attach them again.',
                        { type: 'error' }
                    );
                }
            }

            setCustomers(prev => prev.some(c => c.id === newCustomer.id) ? prev : [newCustomer, ...prev]);
            setShowAddLead(false);
            syncMetadata(insertData);

            void logActivity(user.id, 'create', `Added new lead: ${data.customer_name}`, `Done by: ${user.name}`, newCustomer.id);
            return newCustomer;
        }
    };

    // ── Derived data (active = non-deleted only) ───────────────────────────────
    const { active, trashed } = useMemo(() => {
        const nextActive = [];
        const nextTrashed = [];
        customers.forEach(customer => (customer?.deleted_at ? nextTrashed : nextActive).push(customer));
        return { active: nextActive, trashed: nextTrashed };
    }, [customers]);
    const isAuthorized = (c) => {
        if (user?.userType === 'admin' || user?.userType === 'sales') return true;
        if (user?.userType === 'agent' || isChannelPartnerOffice) {
            const myPartner = partnerName.toLowerCase();
            return (c?.channel_partner || '').trim().toLowerCase() === myPartner;
        }
        return false;
    };

    // Distinct Channel Partner names from metadata table for dropdowns and top filter suggestions
    const uniqueChannelPartners = [...new Set(meta['channel_partner'] || [])].sort();
    const channelPartnerSuggestions = channelPartnerFilterInput.trim()
        ? uniqueChannelPartners.filter(p => (p || '').toLowerCase().includes(channelPartnerFilterInput.trim().toLowerCase()))
        : uniqueChannelPartners;

    const matchesChannelPartnerFilter = (c) => {
        if (isChannelPartnerOffice) {
            return (c?.channel_partner || '').trim().toLowerCase() === partnerName.toLowerCase();
        }
        return !channelPartnerFilter || (c?.channel_partner || '').toLowerCase() === channelPartnerFilter.toLowerCase();
    };

    // Everything downstream - stage counts, the stages grid, dashboard stats
    // is built from this one channel partner-scoped list
    // Sidebar counts now come straight from the server metrics to avoid downloading all records
    const subsidyTagCount = metrics?.subsidyTagCount || 0;
    const loanTagCount = metrics?.loanTagCount || 0;
    const deliveryBatchesCount = metrics?.deliveryBatchesCount || 0;
    const installationTagCount = metrics?.installationTagCount || 0;
    const stageCounts = useMemo(() => {
        const raw = metrics?.stageCounts || {};
        const normalized = { ...raw };
        if (!normalized[STAGE_IDS.LOST_PROJECT]) {
            normalized[STAGE_IDS.LOST_PROJECT] = normalized['HOLD PROCUREMENT'] || normalized['HOLD_PROCUREMENT'] || normalized['Lost Project'] || 0;
        }
        return normalized;
    }, [metrics?.stageCounts]);
    const trashCount = trashed.length; // Still local for now, could be moved to RPC later

    // Per-stage filtered cards (server already filtered by stage and channel partner)
    // We only need to apply the local search bar filter here
    const filtered = customers.filter(c => {
        if (c.deleted_at) return false;
        const q = (stageSearch || '').toLowerCase();
        return !stageSearch ||
            String(c?.customer_name || '').toLowerCase().includes(q) ||
            String(c?.phone_number || '').includes(stageSearch) ||
            String(c?.consumer_no || '').toLowerCase().includes(q);
    });

    // ── Nav button helper ─────────────────────────────────────────────────────
    
    // ── Role-based routing (agent only - sales/operations now share this shell) ─

    const headerTitle =
        currentView === 'dashboard' ? 'Business Dashboard'
            : currentView === 'delivery_batches' ? 'Material Delivery Batches'
            : currentView === 'subsidy' ? 'Subsidy Tag Tracking'
                : currentView === 'loan_tags' ? 'Loan Tag Tracking'
                : currentView === 'installation_tags' ? 'Installation Tag Tracking'
                : currentView === 'channel_partner_mgmt' ? 'Operations'
                    : currentView === 'installation_payments' ? 'Installation Payments'
                    : currentView === 'activity' ? 'Activity Log'
                        : currentView === 'users' ? 'User Management'
                            : currentView === 'trash' ? 'Trash'
                            : PRIMARY_STAGES.find(s => s.id === selectedStage)?.label || selectedStage;

    return (
        <div className="min-h-screen bg-[#FCFBFA] flex">
            {sidebarOpen && <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

            {/* ── Sidebar ── */}
            <aside className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-white border-r border-stone-100 flex flex-col h-screen max-h-screen overflow-hidden transform transition-transform duration-300 ${sidebarOpen ? 'flex' : 'hidden'} md:flex`}>
                <div className="p-5 border-b border-stone-100 flex justify-between items-center shrink-0">
                    <BrandMark size="md" />
                    <button className="md:hidden text-stone-400" onClick={() => setSidebarOpen(false)}><X className="w-5 h-5" /></button>
                </div>

                <div 
                    ref={sidebarRef} 
                    className="flex-1 overflow-y-auto p-3 space-y-0.5"
                    style={{ minHeight: 0, maxHeight: 'calc(100vh - 150px)', WebkitOverflowScrolling: 'touch' }}
                >
                    <NavBtn view="dashboard" icon={LayoutDashboard} label="Dashboard" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                    {canSeeDeliveryBatches && (
                        <NavBtn view="delivery_batches" icon={Truck} label="Delivery Batches" count={deliveryBatchesCount} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                    )}
                    <NavBtn view="subsidy" icon={Tag} label="Subsidy Tags" count={subsidyTagCount} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                    <NavBtn view="loan_tags" icon={IndianRupee} label="Loan Tags" count={loanTagCount} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                    <NavBtn view="installation_tags" icon={Wrench} label="Installation Tags" count={installationTagCount} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />



                    {/* Project Stages - identical for every role */}
                    <div className="text-[9px] uppercase font-bold text-stone-300 px-3 pt-4 pb-2 tracking-widest">Project Stages</div>
                    {PRIMARY_STAGES.map(s => (
                        <NavBtn key={s.id} view="stages" stage={s.id} icon={s.icon} label={s.label} count={stageCounts[s.id] || 0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                    ))}

                    {/* System - admin only */}
                    {user.userType === 'admin' && (
                        <>
                            <div className="text-[9px] uppercase font-bold text-stone-300 px-3 pt-5 pb-2 tracking-widest">System</div>
                            <NavBtn view="channel_partner_mgmt" icon={Users} label="Operations" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                            <NavBtn view="installation_payments" icon={CreditCard} label="Installation Payments" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                            <NavBtn view="activity" icon={Activity} label="Activity Log" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                            <NavBtn view="users" icon={UserCog} label="User Management" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                            <NavBtn view="trash" icon={Trash2} label="Trash" count={trashCount} redBadge currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                        </>
                    )}

                    {/* Partner Office - main CPO account only */}
                    {user.userType === 'channel_partner_office' && (
                        <>
                            <div className="text-[9px] uppercase font-bold text-stone-300 px-3 pt-5 pb-2 tracking-widest">Partner Office</div>
                            <NavBtn view="users" icon={UserCog} label="User Management" count={0} currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen} />
                        </>
                    )}
                </div>

                {/* User + Logout */}
                <div className="p-3 border-t border-stone-100 shrink-0 bg-white">
                    <div className="flex items-center gap-3 px-3 py-2 mb-1">
                        <div className="w-8 h-8 bg-stone-900 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {user.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'A'}
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-stone-700 truncate">{user.name}</p>
                            <p className="text-[9px] text-stone-400">{user.role}</p>
                        </div>
                    </div>
                    {import.meta.env.DEV && onOpenDevSwitcher && (
                        <button onClick={onOpenDevSwitcher}
                            className="w-full flex items-center gap-2 px-3 py-2 text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-xl text-xs font-bold transition-colors mb-1.5 cursor-pointer border border-amber-200">
                            <Terminal className="w-4 h-4 text-amber-600" /> Backdoor Terminal & Roles
                        </button>
                    )}
                    <button onClick={onLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-red-500 hover:bg-red-50 rounded-xl text-xs font-semibold transition-colors cursor-pointer">
                        <LogOut className="w-4 h-4" /> Logout
                    </button>
                </div>
            </aside>

            {/* ── Main ── */}
            <main className="flex-1 md:ml-64 flex flex-col min-h-screen">
                {/* Header */}
                <header className="h-16 bg-white/90 backdrop-blur-md border-b border-stone-100 px-4 lg:px-6 flex items-center justify-between sticky top-0 z-30">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className="md:hidden text-stone-500"><Menu className="w-6 h-6" /></button>
                        <h2 className="font-bold text-stone-800">{headerTitle}</h2>

                        {isChannelPartnerOffice ? (
                            <span className="text-xs bg-amber-100 text-amber-800 px-3 py-1 rounded-full font-bold flex items-center gap-1.5 shadow-sm border border-amber-200">
                                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                Partner: {partnerName}
                            </span>
                        ) : channelPartnerFilter ? (
                            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold">Channel Partner: {channelPartnerFilter}</span>
                        ) : null}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* ── Global search (always visible) ── */}
                        <div className="relative" ref={globalSearchRef}>
                            <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                            <input type="text" readOnly onFocus={(e) => { e.target.removeAttribute('readonly'); if (globalResults.length > 0) setShowGlobalDrop(true); }} name="crm_dash_global_search_unique" autoComplete="off" autoCorrect="off" spellCheck="false" placeholder={isChannelPartnerOffice ? `Search ${partnerName} leads...` : "Search all stages..."} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}
                                className="pl-9 pr-4 py-2 bg-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 w-40 lg:w-60"
                            />
                            {/* Results dropdown */}
                            {showGlobalDrop && (
                                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-2xl shadow-xl border border-stone-100 py-1 z-50 overflow-hidden">
                                    {globalResults.map(c => (
                                        <button key={c.id} onClick={() => handleGlobalSelect(c)}
                                             className="w-full px-4 py-2.5 text-left hover:bg-amber-50 transition-colors group">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-stone-800 group-hover:text-amber-700">{c.customer_name || 'Unnamed'}</p>
                                            </div>
                                            <p className="text-[10px] text-stone-400 mt-0.5">
                                                {PRIMARY_STAGES.find(s => s.id === c.stage)?.label || c.stage} · {c.phone_number || 'No phone'}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Per-stage search (only in stages view) */}
                        {currentView === 'stages' && (
                            <div className="relative hidden lg:block">
                                <Search className="absolute left-3 top-2.5 text-stone-400 w-4 h-4" />
                                <input type="text" readOnly onFocus={(e) => e.target.removeAttribute('readonly')}  name="crm_dash_stage_search_unique" autoComplete="off" autoCorrect="off" spellCheck="false" placeholder="Filter this stage..." value={stageSearch} onChange={e => setStageSearch(e.target.value)}
                                    className="pl-9 pr-4 py-2 bg-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 w-40" />
                            </div>
                        )}

                        {/* Channel Partner filter - applies everywhere for Admin/Office */}
                        {!isChannelPartnerOffice && (
                            <div className="relative hidden lg:flex items-center gap-1.5" ref={channelPartnerFilterRef}>
                                <input
                                    type="text"
                                    placeholder="Channel Partner..."
                                    value={channelPartnerFilterInput}
                                    onChange={e => { setChannelPartnerFilterInput(e.target.value); setShowChannelPartnerDrop(true); }}
                                    onFocus={() => setShowChannelPartnerDrop(true)}
                                    onKeyDown={e => e.key === 'Enter' && (setChannelPartnerFilter(channelPartnerFilterInput.trim()), setShowChannelPartnerDrop(false))}
                                    className="px-3 py-2 bg-stone-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 w-32"
                                />
                                <button
                                    onClick={() => {
                                        setChannelPartnerFilter(channelPartnerFilterInput.trim());
                                        setShowChannelPartnerDrop(false);
                                    }}
                                    className="px-3 py-2 rounded-xl text-xs font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors">
                                    Apply
                                </button>
                                {(channelPartnerFilter || channelPartnerFilterInput) && (
                                    <button
                                        onClick={() => {
                                            setChannelPartnerFilter('');
                                            setChannelPartnerFilterInput('');
                                            setShowChannelPartnerDrop(false);
                                        }}
                                        className="px-3 py-2 rounded-xl text-xs font-medium bg-stone-200 text-stone-700 hover:bg-stone-300 transition-colors">
                                        Clear
                                    </button>
                                )}
                                {showChannelPartnerDrop && channelPartnerSuggestions.length > 0 && (
                                    <div className="absolute top-full mt-1 left-0 w-48 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-50 max-h-48 overflow-y-auto">
                                        {channelPartnerSuggestions.map(name => (
                                            <button key={name}
                                                onClick={() => { setChannelPartnerFilterInput(name); setShowChannelPartnerDrop(false); }}
                                                className="w-full px-3 py-2 text-left text-xs hover:bg-stone-50 text-stone-700 transition-colors">
                                                {name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {user?.userType === 'admin' && (
                            <button 
                                onClick={handleFullExport}
                                disabled={exporting}
                                className="flex items-center gap-1.5 border border-stone-200 text-stone-600 px-3 py-2 rounded-xl text-sm font-medium hover:bg-stone-50 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Export complete database to CSV"
                            >
                                <Download className={`w-4 h-4 ${exporting ? 'animate-bounce text-amber-600' : ''}`} />
                                <span className="hidden sm:inline text-xs">{exporting ? 'Exporting...' : 'Export'}</span>
                            </button>
                        )}
                        {(user?.userType === 'admin' || user?.userType === 'sales' || user?.userType === 'agent' || isChannelPartnerOffice) && (
                            <button onClick={() => setShowAddLead(true)}
                                className="flex items-center gap-1.5 bg-stone-900 text-white px-3 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors">
                                <Plus className="w-4 h-4" />
                                <span className="hidden sm:inline text-xs">Add Lead</span>
                            </button>
                        )}
                    </div>
                </header>

                {/* View router */}
                <div className="flex-1 p-4 lg:p-6">
                    <Suspense fallback={<ViewLoader />}>
                    {currentView === 'dashboard' && <DashboardView metrics={metrics} loading={loading} />}
                    {currentView === 'delivery_batches' && canSeeDeliveryBatches && (
                        <DeliveryBatchesView 
                            currentUser={user} 
                            onRefreshCustomers={fetchMetricsAndMeta} 
                            onOpenCustomerModal={setSelectedCustomer} 
                        />
                    )}
                    {currentView === 'subsidy' && <SubsidyView onSelectCustomer={setSelectedCustomer} isChannelPartnerOffice={isChannelPartnerOffice} partnerName={partnerName} channelPartnerFilter={channelPartnerFilter} />}
                    {currentView === 'loan_tags' && <LoanView onSelectCustomer={setSelectedCustomer} isChannelPartnerOffice={isChannelPartnerOffice} partnerName={partnerName} channelPartnerFilter={channelPartnerFilter} />}
                    {currentView === 'installation_tags' && <InstallationView onSelectCustomer={setSelectedCustomer} isChannelPartnerOffice={isChannelPartnerOffice} partnerName={partnerName} channelPartnerFilter={channelPartnerFilter} />}

                    {currentView === 'channel_partner_mgmt' && user.userType === 'admin' && <ChannelPartnerManagementView currentUser={user} />}
                    {currentView === 'installation_payments' && user.userType === 'admin' && <InstallationPaymentsView onSelectCustomer={setSelectedCustomer} currentUser={user} />}
                    {currentView === 'activity' && user.userType === 'admin' && <ActivityLogView />}
                    {currentView === 'users' && (user.userType === 'admin' || user.userType === 'channel_partner_office') && <UserManagementView currentUser={user} />}

                    {/* Trash view - admin only */}
                    {currentView === 'trash' && user.userType === 'admin' && (
                        <TrashView
                            onRecover={handleRecover}
                            onHardDelete={handleHardDelete}
                            isAdmin={user.userType === 'admin'}
                        />
                    )}

                    {/* Stage grid - identical for every role */}
                    {currentView === 'stages' && (
                        (loading && page === 0) ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : filtered.length > 0 ? (
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {filtered.map(c => (
                                        <CustomerCard key={c.id} customer={c} onSelect={setSelectedCustomer} onMoveStage={handleMoveStage} currentUser={user} />
                                    ))}
                                </div>
                                {hasMore && (
                                    <div className="flex justify-center pt-4 pb-8">
                                        <button 
                                            onClick={loadMore} 
                                            disabled={loading}
                                            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-sm font-semibold shadow-md transition-colors disabled:opacity-70 disabled:cursor-wait">
                                            {loading ? 'Loading...' : 'Load More Leads'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-64 text-stone-400">
                                <Users className="w-12 h-12 mb-3 text-stone-200" />
                                <p className="font-medium text-stone-500">{(stageSearch || channelPartnerFilter) ? 'No matching results in this stage' : 'No customers in this stage'}</p>
                                <p className="text-sm mt-1">{channelPartnerFilter ? `No leads with Channel Partner "${channelPartnerFilter}" here` : stageSearch ? 'Try the global search bar to find across all stages' : 'Move customers here or add a new lead'}</p>
                            </div>
                        )
                    )}
                    </Suspense>
                </div>
            </main>

            {/* Modals */}
            {selectedCustomer && (
                <Suspense fallback={<ViewLoader />}>
                <CustomerDetailModal
                    customer={selectedCustomer}
                    onClose={() => setSelectedCustomer(null)}
                    onUpdate={handleUpdateCustomer}
                    onDelete={handleSoftDelete}
                    user={user}
                    meta={meta}
                    channel_partners={uniqueChannelPartners}
                    defaultTab={currentView === 'subsidy' ? STAGE_IDS.SUBSIDY_STATUS : currentView === 'loan_tags' ? STAGE_IDS.LOAN : currentView === 'installation_tags' ? STAGE_IDS.INSTALLATION_STATUS : currentView === 'stages' ? selectedStage : undefined}
                />
                </Suspense>
            )}
            {showAddLead && <Suspense fallback={<ViewLoader />}><AddLeadModal isOpen={showAddLead} onClose={() => setShowAddLead(false)} onSave={handleAddLead} meta={meta} channel_partners={uniqueChannelPartners} user={user} /></Suspense>}
        </div>
    );
}
