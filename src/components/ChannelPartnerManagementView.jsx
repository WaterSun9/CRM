import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, Award, Trash2, Tag, ShieldCheck, BarChart2, X, Check, Edit3, UserCheck, Zap, Building2, ChevronRight, UserPlus, Phone, Mail, Truck } from 'lucide-react';
import { logActivity } from '../utils';
import { useGlobalPopup } from './GlobalPopup';

export default function ChannelPartnerManagementView({ customers = [], currentUser }) {
    const { showAlert } = useGlobalPopup();
    const [partners, setPartners] = useState([]);
    const [brands, setBrands] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [inverters, setInverters] = useState([]);
    const [cpos, setCpos] = useState([]);
    const [subAgents, setSubAgents] = useState([]);
    const [selectedCpo, setSelectedCpo] = useState(null);
    const [cpoLeadsCount, setCpoLeadsCount] = useState({});
    const [newPartner, setNewPartner] = useState('');
    const [newBrand, setNewBrand] = useState('');
    const [newRegistration, setNewRegistration] = useState('');
    const [newIntegration, setNewIntegration] = useState('');
    const [newInverter, setNewInverter] = useState('');
    const [activeManageCategory, setActiveManageCategory] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [loading, setLoading] = useState(true);

    const [vendors, setVendors] = useState([]);
    const [userProfilesList, setUserProfilesList] = useState([]);
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [editingVendorName, setEditingVendorName] = useState('');
    const [editingVendorEmail, setEditingVendorEmail] = useState('');
    const [performanceStats, setPerformanceStats] = useState([]);

    // Drivers directory - name, phone and vehicle are entered together and
    // feed the Delivery Batch driver picker.
    const [drivers, setDrivers] = useState([]);
    const [newDriverName, setNewDriverName] = useState('');
    const [newDriverPhone, setNewDriverPhone] = useState('');
    const [newDriverVehicle, setNewDriverVehicle] = useState('');
    const [editingDriverName, setEditingDriverName] = useState('');
    const [editingDriverPhone, setEditingDriverPhone] = useState('');
    const [editingDriverVehicle, setEditingDriverVehicle] = useState('');

    const fetchAllAdminChannelPartners = async () => {
        let all = [];
        let from = 0;
        const pageSize = 1000;
        while (true) {
            const { data, error } = await supabase
                .from('admin')
                .select('channel_partner')
                .is('deleted_at', null)
                .range(from, from + pageSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            all = all.concat(data);
            if (data.length < pageSize) break;
            from += pageSize;
        }
        return all;
    };

    // Fetch partners, brands, registrations, integrations, inverters, and CPOs
    const fetchMetadata = async () => {
        try {
            const [metaRes, profilesRes, adminRows] = await Promise.all([
                supabase
                    .from('metadata')
                    .select('id, category, label')
                    .in('category', ['channel_partner', 'module_brand', 'registration_by', 'integration_by', 'inverter_make']),
                supabase
                    .from('profiles')
                    .select('*')
                    .order('created_at', { ascending: false }),
                fetchAllAdminChannelPartners()
            ]);

            if (metaRes.error) throw metaRes.error;
            const data = metaRes.data || [];

            const partnerList = data.filter(d => d.category === 'channel_partner');
            const brandList = data.filter(d => d.category === 'module_brand');
            const registrationList = data.filter(d => d.category === 'registration_by');
            const integrationList = data.filter(d => d.category === 'integration_by');
            const inverterList = data.filter(d => d.category === 'inverter_make');

            setPartners(partnerList);
            setBrands(brandList);
            setRegistrations(registrationList);
            setIntegrations(integrationList);
            setInverters(inverterList);

            if (profilesRes.data) {
                const allProfiles = profilesRes.data;
                setUserProfilesList(allProfiles);
                const cpoList = allProfiles.filter(p => p.user_type === 'channel_partner_office' || p.role === 'Channel Partner Office');
                // Keep both the legacy `agent` accounts and the current
                // `agent2` Channel Partner accounts visible under their CPO.
                const agentList = allProfiles.filter(p =>
                    p.user_type === 'agent' ||
                    p.user_type === 'agent2' ||
                    p.role === 'Channel Partners' ||
                    p.role === 'Channel Partner'
                );
                setCpos(cpoList);
                setSubAgents(agentList);
            }

            if (adminRows) {
                const counts = {};
                adminRows.forEach(c => {
                    const partner = (c.channel_partner || '').trim().toLowerCase();
                    if (partner) {
                        counts[partner] = (counts[partner] || 0) + 1;
                    }
                });
                setCpoLeadsCount(counts);

                const perfCounts = {};
                adminRows.forEach(c => {
                    const name = c.channel_partner?.trim() || 'No Channel Partner';
                    perfCounts[name] = (perfCounts[name] || 0) + 1;
                });
                const sorted = Object.entries(perfCounts)
                    .map(([name, count]) => ({ name, count }))
                    .sort((a, b) => b.count - a.count);
                setPerformanceStats(sorted);
            }
        } catch (e) {
            console.error('Error fetching metadata & CPOs:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const { data, error } = await supabase.from('vendors').select('*').order('name');
            if (error) throw error;
            // An empty directory shows as empty. It used to be seeded with a
            // fabricated vendor, which then leaked into the vendor dropdowns
            // and could be saved onto a real customer.
            setVendors(data || []);
        } catch (e) {
            console.error('Error fetching vendors:', e);
            setVendors([]);
        }
    };

    const fetchDrivers = async () => {
        try {
            const { data, error } = await supabase.from('drivers').select('*').order('name');
            if (error) throw error;
            setDrivers(data || []);
        } catch (e) {
            console.error('Error fetching drivers:', e);
            setDrivers([]);
        }
    };

    // ─── Drivers: add / edit / delete ─────────────────────────────────────────
    const handleAddDriver = async () => {
        const name = newDriverName.trim();
        const phone = newDriverPhone.trim();
        const vehicle = newDriverVehicle.trim();

        if (!name || !phone || !vehicle) {
            showAlert('Please enter Driver Name, Phone Number and Vehicle Number - all three are required.');
            return;
        }
        if ((drivers || []).some(d => String(d?.name || '').toLowerCase() === name.toLowerCase())) {
            showAlert('A Driver with this name already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('drivers')
                .insert({ name, phone, vehicle_number: vehicle })
                .select();
            if (error) throw error;

            setDrivers(prev => [...prev, ...(data || [])].sort((a, b) => String(a.name).localeCompare(String(b.name))));
            setNewDriverName('');
            setNewDriverPhone('');
            setNewDriverVehicle('');
            await logActivity(currentUser.id, 'create', `Added new Driver: "${name}" (${phone}, ${vehicle})`);
        } catch (e) {
            console.error('Error adding driver:', e);
            showAlert('Failed to add driver: ' + e.message, { type: 'error' });
        }
    };

    const handleEditDriver = async (id) => {
        const name = editingDriverName.trim();
        const phone = editingDriverPhone.trim();
        const vehicle = editingDriverVehicle.trim();

        if (!name || !phone || !vehicle) {
            showAlert('Driver Name, Phone Number and Vehicle Number are all required.');
            return;
        }
        if ((drivers || []).some(d => d.id !== id && String(d?.name || '').toLowerCase() === name.toLowerCase())) {
            showAlert('Another Driver with this name already exists.');
            return;
        }

        try {
            const { error } = await supabase
                .from('drivers')
                .update({ name, phone, vehicle_number: vehicle, updated_at: new Date().toISOString() })
                .eq('id', id);
            if (error) throw error;

            setDrivers(prev => prev.map(d => d.id === id ? { ...d, name, phone, vehicle_number: vehicle } : d));
            setEditingId(null);
            await logActivity(currentUser.id, 'update', `Updated Driver: "${name}" (${phone}, ${vehicle})`);
        } catch (e) {
            console.error('Error updating driver:', e);
            showAlert('Failed to update driver: ' + e.message, { type: 'error' });
        }
    };

    const handleDeleteDriver = async (id, name) => {
        if (!window.confirm(`Delete driver "${name}"?\n\nDelivery batches already saved with this driver keep their details - only future batches lose the option.`)) return;
        try {
            const { error } = await supabase.from('drivers').delete().eq('id', id);
            if (error) throw error;
            setDrivers(prev => prev.filter(d => d.id !== id));
            await logActivity(currentUser.id, 'delete', `Deleted Driver: "${name}"`);
        } catch (e) {
            console.error('Error deleting driver:', e);
            showAlert('Failed to delete driver: ' + e.message, { type: 'error' });
        }
    };

    useEffect(() => {
        fetchMetadata();
        fetchVendors();
        fetchDrivers();
    }, []);

    // Add new Channel Partner
    const handleAddPartner = async () => {
        const val = newPartner.trim();
        if (!val) return;

        // Check for duplicates
        if ((partners || []).some(p => String(p?.label || '').toLowerCase() === val.toLowerCase())) {
            showAlert('This Channel Partner already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('metadata')
                .insert({ category: 'channel_partner', label: val })
                .select();

            if (error) throw error;

            setPartners(prev => [...prev, ...data]);
            setNewPartner('');
            await logActivity(currentUser.id, 'create', `Added new Channel Partner: "${val}"`);
        } catch (e) {
            console.error('Error adding partner:', e);
            showAlert('Error adding partner: ' + e.message, { type: 'error' });
        }
    };

    // Add new Module Brand
    const handleAddBrand = async () => {
        const val = newBrand.trim();
        if (!val) return;

        // Check for duplicates
        if ((brands || []).some(b => String(b?.label || '').toLowerCase() === val.toLowerCase())) {
            showAlert('This Module Brand already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('metadata')
                .insert({ category: 'module_brand', label: val })
                .select();

            if (error) throw error;

            setBrands(prev => [...prev, ...data]);
            setNewBrand('');
            await logActivity(currentUser.id, 'create', `Added new Module Brand: "${val}"`);
        } catch (e) {
            console.error('Error adding brand:', e);
            showAlert('Error adding brand: ' + e.message, { type: 'error' });
        }
    };

    // Add new Registration Staff
    const handleAddRegistration = async () => {
        const val = newRegistration.trim();
        if (!val) return;

        // Check for duplicates
        if ((registrations || []).some(r => String(r?.label || '').toLowerCase() === val.toLowerCase())) {
            showAlert('This Registration Staff already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('metadata')
                .insert({ category: 'registration_by', label: val })
                .select();

            if (error) throw error;

            setRegistrations(prev => [...prev, ...data]);
            setNewRegistration('');
            await logActivity(currentUser.id, 'create', `Added new Registration Staff: "${val}"`);
        } catch (e) {
            console.error('Error adding registration staff:', e);
            showAlert('Error adding registration staff: ' + e.message, { type: 'error' });
        }
    };

    // Add new Integration Staff
    const handleAddIntegration = async () => {
        const val = newIntegration.trim();
        if (!val) return;

        // Check for duplicates
        if ((integrations || []).some(i => String(i?.label || '').toLowerCase() === val.toLowerCase())) {
            showAlert('This Integration Staff member already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('metadata')
                .insert({ category: 'integration_by', label: val })
                .select();

            if (error) throw error;

            setIntegrations(prev => [...prev, ...data]);
            setNewIntegration('');
            await logActivity(currentUser.id, 'create', `Added new Integration Staff: "${val}"`);
        } catch (e) {
            console.error('Error adding integration staff:', e);
            showAlert('Error adding integration staff: ' + e.message, { type: 'error' });
        }
    };

    // Add new Inverter Make
    const handleAddInverter = async () => {
        const val = newInverter.trim();
        if (!val) return;

        // Check for duplicates
        if ((inverters || []).some(i => String(i?.label || '').toLowerCase() === val.toLowerCase())) {
            showAlert('This Inverter Make already exists.');
            return;
        }

        try {
            const { data, error } = await supabase
                .from('metadata')
                .insert({ category: 'inverter_make', label: val })
                .select();

            if (error) throw error;

            setInverters(prev => [...prev, ...data]);
            setNewInverter('');
            await logActivity(currentUser.id, 'create', `Added new Inverter Make: "${val}"`);
        } catch (e) {
            console.error('Error adding inverter make:', e);
            showAlert('Error adding inverter make: ' + e.message, { type: 'error' });
        }
    };

    // Add new Vendor with User Management verification
    const handleAddVendor = async () => {
        const name = newVendorName.trim();
        const email = newVendorEmail.trim();
        if (!name || !email) {
            showAlert('Please enter both Vendor Name and Email.');
            return;
        }

        if ((vendors || []).some(v => String(v?.name || '').toLowerCase() === name.toLowerCase())) {
            showAlert('A Vendor with this name already exists.');
            return;
        }

        // ─── Step: Verify email in User Management ────────────────────────
        let isPresentInUserManagement = userProfilesList.some(p => String(p.email || '').toLowerCase() === email.toLowerCase());
        
        // Also check DB live if not in local state
        if (!isPresentInUserManagement) {
            try {
                const { data: matchedProfile } = await supabase
                    .from('profiles')
                    .select('id, email')
                    .ilike('email', email)
                    .maybeSingle();
                if (matchedProfile?.id) {
                    isPresentInUserManagement = true;
                }
            } catch (err) {
                console.warn('Profile check error:', err);
            }
        }

        if (!isPresentInUserManagement) {
            const proceed = window.confirm(
                `⚠️ Email Verification Notice:\n\n` +
                `The email "${email}" was NOT found in User Management.\n\n` +
                `For this vendor to log in to the Vendor Portal, an account with role "Vendors" must be created in User Management.\n\n` +
                `Click OK to add to directory anyway, or Cancel to go register them in User Management first.`
            );
            if (!proceed) return;
        }

        try {
            const { data, error } = await supabase
                .from('vendors')
                .insert({ name, email })
                .select();

            if (error) throw error;

            setVendors(prev => [...prev, ...data]);
            setNewVendorName('');
            setNewVendorEmail('');
            await logActivity(
                currentUser.id,
                'create',
                `Added new Vendor: "${name}" (${email})${isPresentInUserManagement ? ' [Verified in User Management]' : ' [Pending User Account]'}`
            );
        } catch (e) {
            console.error('Error adding vendor:', e);
            showAlert('Error adding vendor: ' + e.message, { type: 'error' });
        }
    };

    // Edit/Rename Vendor
    const handleEditVendor = async (id, oldName, oldEmail) => {
        const name = editingVendorName.trim();
        const email = editingVendorEmail.trim();
        if (!name || !email) {
            showAlert('Vendor Name and Email cannot be empty.');
            return;
        }

        if (name === oldName && email === oldEmail) {
            setEditingId(null);
            return;
        }

        try {
            const { error } = await supabase
                .from('vendors')
                .update({ name, email })
                .eq('id', id);

            if (error) throw error;

            setVendors(prev => prev.map(v => v.id === id ? { ...v, name, email } : v));
            setEditingId(null);
            await logActivity(currentUser.id, 'update', `Updated Vendor: "${oldName}" → "${name}" (${email})`);
        } catch (e) {
            console.error('Error updating vendor:', e);
            showAlert('Error updating vendor: ' + e.message, { type: 'error' });
        }
    };

    // Delete Vendor
    const handleDeleteVendor = async (id, name) => {
        if (!window.confirm(`Are you sure you want to delete vendor "${name}"?`)) return;

        try {
            const { error } = await supabase
                .from('vendors')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setVendors(prev => prev.filter(v => v.id !== id));
            await logActivity(currentUser.id, 'delete', `Deleted Vendor: "${name}"`);
        } catch (e) {
            console.error('Error deleting vendor:', e);
            showAlert('Error deleting vendor: ' + e.message, { type: 'error' });
        }
    };

    // Edit/Rename metadata entry and cascade updates to admin table
    const handleEditMetadata = async (id, oldLabel, newLabel, category) => {
        const trimmed = newLabel.trim();
        if (!trimmed || trimmed === oldLabel) {
            setEditingId(null);
            return;
        }

        // Check for duplicates
        let listToCheck = [];
        if (category === 'channel_partner') listToCheck = partners;
        else if (category === 'module_brand') listToCheck = brands;
        else if (category === 'registration_by') listToCheck = registrations;
        else if (category === 'integration_by') listToCheck = integrations;
        else if (category === 'inverter_make') listToCheck = inverters;

        if (listToCheck.some(x => x.id !== id && x.label.toLowerCase() === trimmed.toLowerCase())) {
            showAlert('This entry already exists.');
            return;
        }

        try {
            // Update in metadata table
            const { error: metaError } = await supabase
                .from('metadata')
                .update({ label: trimmed })
                .eq('id', id);
            if (metaError) throw metaError;

            // Map category to column in admin table
            let dbField = '';
            if (category === 'channel_partner') dbField = 'channel_partner';
            else if (category === 'module_brand') dbField = 'module_brand';
            else if (category === 'registration_by') dbField = 'registration_by';
            else if (category === 'inverter_make') dbField = 'inverter_make';

            // Update in admin table
            if (dbField) {
                const { error: adminError } = await supabase
                    .from('admin')
                    .update({ [dbField]: trimmed })
                    .eq(dbField, oldLabel);
                if (adminError) throw adminError;
            }

            // Also sync the renamed label to any profiles (real logins) using the old name,
            // so a channel partner's own portal session reflects the rename immediately.
            if (category === "channel_partner") {
                const { error: profileSyncError } = await supabase
                    .from("profiles")
                    .update({ channel_partner: trimmed })
                    .eq("channel_partner", oldLabel);
                if (profileSyncError) throw profileSyncError;
            }

            // Update in bom_items table if integration_by
            if (category === 'integration_by') {
                // Unchecked before: a failed cascade left BOM lines pointing at
                // the old name, which then reads as "not in list" everywhere.
                const { error: bomSyncError } = await supabase
                    .from('bom_items')
                    .update({ integration_by: trimmed })
                    .eq('integration_by', oldLabel);
                if (bomSyncError) throw bomSyncError;
            }

            // Update state
            if (category === 'channel_partner') {
                setPartners(prev => prev.map(x => x.id === id ? { ...x, label: trimmed } : x));
            } else if (category === 'module_brand') {
                setBrands(prev => prev.map(x => x.id === id ? { ...x, label: trimmed } : x));
            } else if (category === 'registration_by') {
                setRegistrations(prev => prev.map(x => x.id === id ? { ...x, label: trimmed } : x));
            } else if (category === 'integration_by') {
                setIntegrations(prev => prev.map(x => x.id === id ? { ...x, label: trimmed } : x));
            } else if (category === 'inverter_make') {
                setInverters(prev => prev.map(x => x.id === id ? { ...x, label: trimmed } : x));
            }

            await logActivity(currentUser.id, 'update', `Renamed ${category} from "${oldLabel}" to "${trimmed}"`);
        } catch (e) {
            console.error('Error renaming metadata:', e);
            showAlert('Error renaming metadata: ' + e.message, { type: 'error' });
        } finally {
            setEditingId(null);
        }
    };

    // Delete metadata entry
    const handleDeleteMetadata = async (id, category, label) => {
        if (!window.confirm(`Are you sure you want to delete "${label}"?`)) return;

        try {
            const { error } = await supabase
                .from('metadata')
                .delete()
                .eq('id', id);

            if (error) throw error;

            let cascadeError = null;
            if (category === 'channel_partner') {
                setPartners(prev => prev.filter(p => p.id !== id));
                const { error: cErr } = await supabase
                    .from('admin')
                    .update({ channel_partner: null })
                    .eq('channel_partner', label);
                cascadeError = cErr;
            } else if (category === 'module_brand') {
                setBrands(prev => prev.filter(b => b.id !== id));
                const { error: cErr } = await supabase
                    .from('admin')
                    .update({ module_brand: null })
                    .eq('module_brand', label);
                cascadeError = cErr;
            } else if (category === 'registration_by') {
                setRegistrations(prev => prev.filter(r => r.id !== id));
                const { error: cErr } = await supabase
                    .from('admin')
                    .update({ registration_by: null })
                    .eq('registration_by', label);
                cascadeError = cErr;
            } else if (category === 'integration_by') {
                setIntegrations(prev => prev.filter(i => i.id !== id));
                const { error: cErr } = await supabase
                    .from('bom_items')
                    .update({ integration_by: null })
                    .eq('integration_by', label);
                cascadeError = cErr;
            } else if (category === 'inverter_make') {
                setInverters(prev => prev.filter(i => i.id !== id));
                const { error: cErr } = await supabase
                    .from('admin')
                    .update({ inverter_make: null })
                    .eq('inverter_make', label);
                cascadeError = cErr;
            }

            if (cascadeError) {
                await logActivity(currentUser.id, 'delete', `Deleted ${category}: "${label}" (WARNING: failed to clear from existing customer records: ${cascadeError.message})`);
                showAlert(`"${label}" was removed from the dropdown, but clearing it from existing customer records failed: ${cascadeError.message}. Some records may still show the old value.`, { type: 'error' });
            } else {
                await logActivity(currentUser.id, 'delete', `Deleted ${category}: "${label}" (cleared from customers)`);
            }
        } catch (e) {
            console.error('Error deleting metadata:', e);
            showAlert('Error deleting metadata: ' + e.message, { type: 'error' });
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-700 max-w-7xl mx-auto">
            {/* Header info */}
            <div className="flex items-center gap-3 bg-stone-900 text-white p-6 rounded-[32px] shadow-sm">
                <ShieldCheck className="w-8 h-8 text-amber-400" />
                <div>
                    <h2 className="text-lg font-black tracking-tight">Operations</h2>
                    <p className="text-xs text-stone-400">Admin Control Panel • Configure active directory listings and view top sales performance</p>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-48">
                    <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-8 animate-in fade-in duration-700">

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                        
                        {/* Directories Grid (Left 2/3) */}
                        <div className="lg:col-span-2 space-y-4">
                            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                                <Users className="w-4 h-4 text-stone-700" />
                                <h3 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Directories & Allotments</h3>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                                {/* Channel Partner Offices (CPO) Card */}
                                <button
                                    onClick={() => {
                                        setSelectedCpo(null);
                                        setActiveManageCategory('cpo_office');
                                    }}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-amber-400 hover:bg-amber-50/20 active:scale-[0.98] transition-all text-left focus:outline-none w-full group relative overflow-hidden"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-amber-50 group-hover:bg-amber-100 rounded-xl w-fit transition-colors duration-305 text-amber-700">
                                            <Building2 className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-700 transition-colors duration-305">CPO Offices & Dealers</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{cpos.length} registered office branches</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-amber-700 flex items-center gap-1 transition-colors duration-305">
                                        Manage Offices & Teams <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Channel Partners Card */}
                                <button
                                    onClick={() => setActiveManageCategory('channel_partner')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Users className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Channel Partner Directory</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{partners.length} active partners</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Module Brands Card */}
                                <button
                                    onClick={() => setActiveManageCategory('module_brand')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Tag className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Module Brands Directory</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{brands.length} active brands</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Registration Staff Card */}
                                <button
                                    onClick={() => setActiveManageCategory('registration_by')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Award className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Registration Staff</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{registrations.length} active processors</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Inverter Make Card */}
                                <button
                                    onClick={() => setActiveManageCategory('inverter_make')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Zap className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Inverter Make Directory</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{inverters.length} active inverter brands</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Integration Staff Card */}
                                <button
                                    onClick={() => setActiveManageCategory('integration_by')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <UserCheck className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Integration Staff</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{integrations.length} active members</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Vendors Card */}
                                <button
                                    onClick={() => setActiveManageCategory('vendor')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Users className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Vendors Allotment</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{vendors.length} active vendors</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>

                                {/* Drivers Card */}
                                <button
                                    onClick={() => setActiveManageCategory('driver')}
                                    className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex flex-col justify-between h-44 hover:shadow-md hover:border-stone-300 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                                >
                                    <div className="space-y-3.5 w-full">
                                        <div className="p-2.5 bg-stone-50 group-hover:bg-amber-100/70 rounded-xl w-fit transition-colors duration-305">
                                            <Truck className="w-5 h-5 text-stone-600 group-hover:text-amber-600 transition-colors duration-305" />
                                        </div>
                                        <div>
                                            <h3 className="font-extrabold text-stone-800 text-xs group-hover:text-amber-600 transition-colors duration-305">Drivers</h3>
                                            <p className="text-[11px] text-stone-400 font-medium mt-0.5">{drivers.length} registered drivers</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1 transition-colors duration-305">
                                        Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-305">→</span>
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Top Performance Ranking Chart (Right 1/3) */}
                        <div className="space-y-4 flex flex-col h-full">
                            <div className="flex items-center gap-2 border-b border-stone-100 pb-3">
                                <Award className="w-4 h-4 text-amber-500 animate-bounce" />
                                <h3 className="text-xs font-bold text-stone-850 uppercase tracking-wider">Top 5 Performers</h3>
                            </div>
                            
                            <div className="bg-white rounded-[24px] p-5 border border-stone-150 shadow-xs flex-1 lg:h-[368px] flex flex-col justify-between">
                                <div className="space-y-4 flex-1 flex flex-col justify-around py-1">
                                    {performanceStats.length > 0 ? (
                                        performanceStats.slice(0, 5).map((item, idx) => {
                                            const totalProjects = performanceStats.reduce((s, p) => s + p.count, 0);
                                            const perc = totalProjects > 0 ? (item.count / totalProjects) * 100 : 0;
                                            const isFirst = idx === 0 && item.name !== 'No Channel Partner';
                                            return (
                                                <div key={item.name} className="flex flex-col">
                                                    <div className="flex justify-between text-[11px] font-bold text-stone-600 mb-1 tracking-tight">
                                                        <span className="flex items-center gap-1.5 truncate">
                                                            {isFirst && <span className="text-amber-500">🏆</span>}
                                                            <span className="truncate">{item.name}</span>
                                                        </span>
                                                        <span className="text-stone-400 flex-shrink-0">{item.count} leads ({perc.toFixed(0)}%)</span>
                                                    </div>
                                                    <div className="h-2 bg-stone-50 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-amber-400 transition-all duration-1000 rounded-full"
                                                            style={{ width: `${perc}%` }}
                                                        />
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <p className="text-xs text-stone-400 italic text-center py-4 my-auto">No performance metrics available.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            )}

            {/* Manage Directory Full Modal */}
            {activeManageCategory && (() => {
                if (activeManageCategory === 'cpo_office') {
                    return (
                        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-2xl overflow-hidden border border-stone-100 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
                                {/* Modal Header */}
                                <div className="bg-stone-900 px-6 py-5 flex justify-between items-center text-white">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-500/20 text-amber-400 rounded-xl">
                                            <Building2 size={20} />
                                        </div>
                                        <div>
                                            <h3 className="text-sm font-bold tracking-tight">Channel Partner Offices & Dealers</h3>
                                            <p className="text-[10px] text-stone-400 mt-0.5 uppercase font-bold tracking-wider">{cpos.length} Registered CPO Branches</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setActiveManageCategory(null);
                                            setSelectedCpo(null);
                                        }}
                                        className="text-stone-400 hover:text-white p-2 hover:bg-stone-800 rounded-xl transition"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                {/* Modal Body */}
                                <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                    {selectedCpo ? (
                                        // Drilldown: Field Agents under Selected CPO
                                        <div className="space-y-4">
                                            <button
                                                onClick={() => setSelectedCpo(null)}
                                                className="text-xs font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-xl transition"
                                            >
                                                ← Back to all CPO Offices
                                            </button>

                                            <div className="bg-stone-50 p-4 rounded-2xl border border-stone-200/80 flex justify-between items-center">
                                                <div>
                                                    <h4 className="text-sm font-extrabold text-stone-850">{selectedCpo.name}</h4>
                                                    <p className="text-xs text-stone-500 font-medium">Branch Partner: <strong className="text-stone-700">{selectedCpo.channel_partner || selectedCpo.name}</strong> • {selectedCpo.email}</p>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg bg-stone-900 text-white">
                                                        {cpoLeadsCount[(selectedCpo.channel_partner || selectedCpo.name || '').trim().toLowerCase()] || 0} Total Leads
                                                    </span>
                                                </div>
                                            </div>

                                            <div>
                                                <h5 className="text-[11px] font-bold uppercase tracking-wider text-stone-400 mb-2">
                                                    Dealers Registered Under this CPO
                                                </h5>
                                                {(() => {
                                                    const partnerKey = (selectedCpo.channel_partner || selectedCpo.name || '').trim().toLowerCase();
                                                    const team = subAgents.filter(a => 
                                                        a.created_by === selectedCpo.id ||
                                                        (a.channel_partner && a.channel_partner.trim().toLowerCase() === partnerKey)
                                                    );

                                                    if (team.length === 0) {
                                                        return (
                                                            <div className="text-center py-8 bg-stone-50/50 rounded-2xl border border-stone-100">
                                                                <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                                                                <p className="text-xs text-stone-500 font-medium">No dealers added by this CPO yet.</p>
                                                                <p className="text-[10px] text-stone-400 mt-0.5">When this CPO logs in and adds dealers, they will appear here.</p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div className="space-y-2">
                                                            {team.map(agent => (
                                                                <div key={agent.id} className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-stone-200/70 hover:border-amber-300 transition-all shadow-xs">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-xs font-bold">
                                                                            {agent.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'A'}
                                                                        </div>
                                                                        <div>
                                                                            <p className="text-xs font-bold text-stone-800">{agent.name}</p>
                                                                            <p className="text-[10px] text-stone-400">{agent.email}</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${agent.status === 'inactive' ? 'bg-stone-100 text-stone-400' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
                                                                            {agent.status || 'active'}
                                                                        </span>
                                                                        <span className="text-[10px] text-stone-400 font-medium">
                                                                            {agent.created_at ? new Date(agent.created_at).toLocaleDateString() : ''}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        // Main CPO List
                                        <div className="space-y-3">
                                            {cpos.length === 0 ? (
                                                <div className="text-center py-10 bg-stone-50 rounded-2xl border border-stone-100">
                                                    <Building2 className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                                                    <p className="text-xs text-stone-600 font-bold">No Channel Partner Offices registered yet.</p>
                                                    <p className="text-[10px] text-stone-400 mt-1">Create a Channel Partner Office account in User Management. It will appear here automatically.</p>
                                                </div>
                                            ) : (
                                                cpos.map(cpo => {
                                                    const partnerKey = (cpo.channel_partner || cpo.name || '').trim().toLowerCase();
                                                    const teamCount = subAgents.filter(a => 
                                                        a.created_by === cpo.id ||
                                                        (a.channel_partner && a.channel_partner.trim().toLowerCase() === partnerKey)
                                                    ).length;
                                                    const leadsCount = cpoLeadsCount[partnerKey] || 0;

                                                    return (
                                                        <div
                                                            key={cpo.id}
                                                            onClick={() => setSelectedCpo(cpo)}
                                                            className="p-4 bg-stone-50 hover:bg-amber-50/40 rounded-2xl border border-stone-200/70 hover:border-amber-300 transition-all cursor-pointer flex flex-col sm:flex-row justify-between sm:items-center gap-3 group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center font-bold text-xs shadow-xs group-hover:bg-amber-600 transition-colors">
                                                                    {cpo.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'CP'}
                                                                </div>
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-800 transition-colors">{cpo.name}</h4>
                                                                        <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${cpo.status === 'inactive' ? 'bg-stone-200 text-stone-500' : 'bg-emerald-100 text-emerald-800'}`}>
                                                                            {cpo.status || 'active'}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-[10px] text-stone-400 font-medium mt-0.5">Partner Branch: <strong className="text-stone-600">{cpo.channel_partner || cpo.name}</strong> • {cpo.email}</p>
                                                                </div>
                                                            </div>

                                                            <div className="flex items-center gap-3 self-end sm:self-center">
                                                                <div className="text-right">
                                                                    <span className="text-xs font-extrabold text-stone-900 block">{teamCount} Dealers</span>
                                                                    <span className="text-[10px] font-semibold text-amber-700">{leadsCount} Leads</span>
                                                                </div>
                                                                <div className="p-1.5 rounded-lg bg-stone-200/70 group-hover:bg-amber-200 text-stone-600 group-hover:text-amber-900 transition-colors">
                                                                    <ChevronRight size={14} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                }

                let title = '';
                let list = [];
                let inputVal = '';
                let setInputVal = null;
                let addHandler = null;
                let placeholder = '';

                if (activeManageCategory === 'channel_partner') {
                    title = 'Manage Channel Partners';
                    list = partners;
                    inputVal = newPartner;
                    setInputVal = setNewPartner;
                    addHandler = handleAddPartner;
                    placeholder = 'Enter channel partner name...';
                } else if (activeManageCategory === 'module_brand') {
                    title = 'Manage Module Brands';
                    list = brands;
                    inputVal = newBrand;
                    setInputVal = setNewBrand;
                    addHandler = handleAddBrand;
                    placeholder = 'Enter module brand name...';
                } else if (activeManageCategory === 'inverter_make') {
                    title = 'Manage Inverter Makes';
                    list = inverters;
                    inputVal = newInverter;
                    setInputVal = setNewInverter;
                    addHandler = handleAddInverter;
                    placeholder = 'Enter inverter make (e.g. Growatt, Deye, Solis)...';
                } else if (activeManageCategory === 'registration_by') {
                    title = 'Manage Registration Staff';
                    list = registrations;
                    inputVal = newRegistration;
                    setInputVal = setNewRegistration;
                    addHandler = handleAddRegistration;
                    placeholder = 'Enter processor name...';
                } else if (activeManageCategory === 'integration_by') {
                    title = 'Manage Integration Staff';
                    list = integrations;
                    inputVal = newIntegration;
                    setInputVal = setNewIntegration;
                    addHandler = handleAddIntegration;
                    placeholder = 'Enter integration staff name...';
                } else if (activeManageCategory === 'vendor') {
                    title = 'Manage Vendors Allotment';
                    list = vendors;
                    placeholder = 'Enter vendor name...';
                } else if (activeManageCategory === 'driver') {
                    title = 'Manage Drivers';
                    list = drivers;
                    placeholder = 'Enter driver name...';
                }

                const isVendorCat = activeManageCategory === 'vendor';
                const isDriverCat = activeManageCategory === 'driver';

                return (
                    <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden border border-stone-100 flex flex-col max-h-[80vh] animate-in zoom-in-95 duration-200">

                            {/* Modal Header */}
                            <div className="bg-stone-900 px-6 py-5 flex justify-between items-center text-white">
                                <div>
                                    <h3 className="text-sm font-bold tracking-tight">{title}</h3>
                                    <p className="text-[10px] text-stone-400 mt-1 uppercase font-bold tracking-wider">{list.length} directory listings</p>
                                </div>
                                <button
                                    onClick={() => {
                                        setActiveManageCategory(null);
                                        setEditingId(null);
                                    }}
                                    className="text-stone-400 hover:text-white p-2 hover:bg-stone-800 rounded-xl transition"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            {/* Add Section */}
                            {isDriverCat ? (
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50 space-y-2">
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            placeholder="Driver Name..."
                                            value={newDriverName}
                                            onChange={e => setNewDriverName(e.target.value)}
                                            className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition"
                                        />
                                        <input
                                            type="tel"
                                            inputMode="numeric"
                                            placeholder="Phone Number..."
                                            value={newDriverPhone}
                                            onChange={e => setNewDriverPhone(e.target.value.replace(/[^0-9+\-\s]/g, ''))}
                                            className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition"
                                        />
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-2">
                                        <input
                                            type="text"
                                            placeholder="Vehicle Number..."
                                            value={newDriverVehicle}
                                            onChange={e => setNewDriverVehicle(e.target.value.toUpperCase())}
                                            onKeyDown={e => e.key === 'Enter' && handleAddDriver()}
                                            className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition uppercase"
                                        />
                                        <button
                                            onClick={handleAddDriver}
                                            className="flex items-center justify-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors shadow-md sm:w-32"
                                        >
                                            <Plus className="w-4 h-4" /> Add
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-stone-400 font-medium">All three fields are required. The name appears in the Delivery Batch driver list, and picking it fills in the phone and vehicle automatically.</p>
                                </div>
                            ) : isVendorCat ? (
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        placeholder="Vendor Name..."
                                        value={newVendorName}
                                        onChange={e => setNewVendorName(e.target.value)}
                                        className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Vendor Email..."
                                        value={newVendorEmail}
                                        onChange={e => setNewVendorEmail(e.target.value)}
                                        className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition"
                                    />
                                    <button
                                        onClick={handleAddVendor}
                                        className="flex items-center justify-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors shadow-md"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                            ) : (
                                <div className="p-4 border-b border-stone-100 bg-stone-50/50 flex gap-2">
                                    <input
                                        type="text"
                                        placeholder={placeholder}
                                        value={inputVal}
                                        onChange={e => setInputVal(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addHandler()}
                                        className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2 text-sm focus:border-amber-400 outline-none transition"
                                    />
                                    <button
                                        onClick={addHandler}
                                        className="flex items-center gap-1.5 bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors shadow-md"
                                    >
                                        <Plus className="w-4 h-4" /> Add
                                    </button>
                                </div>
                            )}

                            {/* List Section */}
                            <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                {list.length > 0 ? (
                                    list.map(item => {
                                        const isEditing = editingId === item.id;
                                        return (
                                            <div key={item.id} className="flex justify-between items-center bg-stone-50 px-4 py-2.5 rounded-xl border border-stone-100 hover:bg-stone-100/50 transition-colors">
                                                {isEditing ? (
                                                    isDriverCat ? (
                                                        <div className="flex-1 flex flex-col sm:flex-row gap-2 max-w-lg">
                                                            <input
                                                                type="text"
                                                                value={editingDriverName}
                                                                onChange={e => setEditingDriverName(e.target.value)}
                                                                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold text-stone-800"
                                                                placeholder="Name"
                                                                autoFocus
                                                            />
                                                            <input
                                                                type="tel"
                                                                inputMode="numeric"
                                                                value={editingDriverPhone}
                                                                onChange={e => setEditingDriverPhone(e.target.value.replace(/[^0-9+\-\s]/g, ''))}
                                                                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium text-stone-700"
                                                                placeholder="Phone"
                                                            />
                                                            <input
                                                                type="text"
                                                                value={editingDriverVehicle}
                                                                onChange={e => setEditingDriverVehicle(e.target.value.toUpperCase())}
                                                                onKeyDown={e => e.key === 'Enter' && handleEditDriver(item.id)}
                                                                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium text-stone-700 uppercase"
                                                                placeholder="Vehicle"
                                                            />
                                                        </div>
                                                    ) : isVendorCat ? (
                                                        <div className="flex-1 flex gap-2 max-w-md">
                                                            <input
                                                                type="text"
                                                                value={editingVendorName}
                                                                onChange={e => setEditingVendorName(e.target.value)}
                                                                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold text-stone-800"
                                                                placeholder="Name"
                                                            />
                                                            <input
                                                                type="email"
                                                                value={editingVendorEmail}
                                                                onChange={e => setEditingVendorEmail(e.target.value)}
                                                                className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-medium text-stone-700"
                                                                placeholder="Email"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={editingLabel}
                                                            onChange={e => setEditingLabel(e.target.value)}
                                                            onKeyDown={e => e.key === 'Enter' && handleEditMetadata(item.id, item.label, editingLabel, activeManageCategory)}
                                                            className="flex-1 bg-white border border-amber-300 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400 font-bold text-stone-800 max-w-md"
                                                            autoFocus
                                                        />
                                                    )
                                                ) : (
                                                    isDriverCat ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="text-xs font-bold text-stone-850 tracking-tight">{item.name}</span>
                                                            <span className="text-[10px] text-stone-400 font-medium flex items-center gap-2.5">
                                                                <span className="flex items-center gap-1"><Phone size={9} /> {item.phone || '–'}</span>
                                                                <span className="flex items-center gap-1"><Truck size={9} /> {item.vehicle_number || '–'}</span>
                                                            </span>
                                                        </div>
                                                    ) : isVendorCat ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-stone-850 tracking-tight">{item.name}</span>
                                                                {userProfilesList.some(p => String(p.email || '').toLowerCase() === String(item.email || '').toLowerCase()) ? (
                                                                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                                                                        ✓ User Account Active
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">
                                                                        ⚠ No Login in User Mgmt
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[10px] text-stone-400 font-medium">{item.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-stone-700 tracking-tight">{item.label}</span>
                                                    )
                                                )}

                                                <div className="flex items-center gap-2">
                                                    {isEditing ? (
                                                        <button
                                                            onClick={() => isDriverCat ? handleEditDriver(item.id) : isVendorCat ? handleEditVendor(item.id, item.name, item.email) : handleEditMetadata(item.id, item.label, editingLabel, activeManageCategory)}
                                                            className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition"
                                                            title="Save changes"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(item.id);
                                                                if (isDriverCat) {
                                                                    setEditingDriverName(item.name || '');
                                                                    setEditingDriverPhone(item.phone || '');
                                                                    setEditingDriverVehicle(item.vehicle_number || '');
                                                                } else if (isVendorCat) {
                                                                    setEditingVendorName(item.name);
                                                                    setEditingVendorEmail(item.email);
                                                                } else {
                                                                    setEditingLabel(item.label);
                                                                }
                                                            }}
                                                            className="text-stone-400 hover:text-stone-700 hover:bg-stone-200 p-1.5 rounded-lg transition"
                                                            title="Edit name"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}

                                                    <button
                                                        onClick={() => isDriverCat ? handleDeleteDriver(item.id, item.name) : isVendorCat ? handleDeleteVendor(item.id, item.name) : handleDeleteMetadata(item.id, activeManageCategory, item.label)}
                                                        className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                                                        title="Delete entry"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-stone-400 italic text-center py-8">No entries found in this directory.</p>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
