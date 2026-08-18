// src/components/ChannelPartnerManagementView.jsx  —  Watersun Electrical Solutions Pvt Ltd
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, Award, Trash2, Tag, ShieldCheck, BarChart2, X, Check, Edit3, UserCheck } from 'lucide-react';
import { logActivity } from '../utils';

export default function ChannelPartnerManagementView({ customers = [], currentUser }) {
    const [partners, setPartners] = useState([]);
    const [brands, setBrands] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [integrations, setIntegrations] = useState([]);
    const [newPartner, setNewPartner] = useState('');
    const [newBrand, setNewBrand] = useState('');
    const [newRegistration, setNewRegistration] = useState('');
    const [newIntegration, setNewIntegration] = useState('');
    const [activeManageCategory, setActiveManageCategory] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editingLabel, setEditingLabel] = useState('');
    const [loading, setLoading] = useState(true);

    const [vendors, setVendors] = useState([]);
    const [newVendorName, setNewVendorName] = useState('');
    const [newVendorEmail, setNewVendorEmail] = useState('');
    const [editingVendorName, setEditingVendorName] = useState('');
    const [editingVendorEmail, setEditingVendorEmail] = useState('');

    // Fetch partners, brands, registrations, and integrations from metadata table
    const fetchMetadata = async () => {
        try {
            const { data, error } = await supabase
                .from('metadata')
                .select('id, category, label')
                .in('category', ['channel_partner', 'module_brand', 'registration_by', 'integration_by']);

            if (error) throw error;

            const partnerList = data.filter(d => d.category === 'channel_partner');
            const brandList = data.filter(d => d.category === 'module_brand');
            const registrationList = data.filter(d => d.category === 'registration_by');
            const integrationList = data.filter(d => d.category === 'integration_by');

            setPartners(partnerList);
            setBrands(brandList);
            setRegistrations(registrationList);
            setIntegrations(integrationList);
        } catch (e) {
            console.error('Error fetching metadata:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchVendors = async () => {
        try {
            const { data, error } = await supabase.from('vendors').select('*').order('name');
            if (!error && data) setVendors(data);
        } catch (e) {
            console.error('Error fetching vendors:', e);
        }
    };

    useEffect(() => {
        fetchMetadata();
        fetchVendors();
    }, []);

    // Add new Channel Partner
    const handleAddPartner = async () => {
        const val = newPartner.trim();
        if (!val) return;

        // Check for duplicates
        if (partners.some(p => p.label.toLowerCase() === val.toLowerCase())) {
            alert('This Channel Partner already exists.');
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
        }
    };

    // Add new Module Brand
    const handleAddBrand = async () => {
        const val = newBrand.trim();
        if (!val) return;

        // Check for duplicates
        if (brands.some(b => b.label.toLowerCase() === val.toLowerCase())) {
            alert('This Module Brand already exists.');
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
        }
    };

    // Add new Registration Staff
    const handleAddRegistration = async () => {
        const val = newRegistration.trim();
        if (!val) return;

        // Check for duplicates
        if (registrations.some(r => r.label.toLowerCase() === val.toLowerCase())) {
            alert('This Registration Staff already exists.');
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
        }
    };

    // Add new Integration Staff
    const handleAddIntegration = async () => {
        const val = newIntegration.trim();
        if (!val) return;

        // Check for duplicates
        if (integrations.some(i => i.label.toLowerCase() === val.toLowerCase())) {
            alert('This Integration Staff member already exists.');
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
        }
    };

    // Add new Vendor
    const handleAddVendor = async () => {
        const name = newVendorName.trim();
        const email = newVendorEmail.trim();
        if (!name || !email) {
            alert('Please enter both Vendor Name and Email.');
            return;
        }

        if (vendors.some(v => v.name.toLowerCase() === name.toLowerCase())) {
            alert('A Vendor with this name already exists.');
            return;
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
            await logActivity(currentUser.id, 'create', `Added new Vendor: "${name}" (${email})`);
        } catch (e) {
            console.error('Error adding vendor:', e);
            alert('Error adding vendor: ' + e.message);
        }
    };

    // Edit/Rename Vendor
    const handleEditVendor = async (id, oldName, oldEmail) => {
        const name = editingVendorName.trim();
        const email = editingVendorEmail.trim();
        if (!name || !email) {
            alert('Vendor Name and Email cannot be empty.');
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
            alert('Error updating vendor: ' + e.message);
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
            alert('Error deleting vendor: ' + e.message);
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

        if (listToCheck.some(x => x.id !== id && x.label.toLowerCase() === trimmed.toLowerCase())) {
            alert('This entry already exists.');
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

            // Update in admin table
            if (dbField) {
                const { error: adminError } = await supabase
                    .from('admin')
                    .update({ [dbField]: trimmed })
                    .eq(dbField, oldLabel);
                if (adminError) throw adminError;
            }

            // Update in bom_items table if integration_by
            if (category === 'integration_by') {
                await supabase
                    .from('bom_items')
                    .update({ integration_by: trimmed })
                    .eq('integration_by', oldLabel);
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
            }

            await logActivity(currentUser.id, 'update', `Renamed ${category} from "${oldLabel}" to "${trimmed}"`);
        } catch (e) {
            console.error('Error renaming metadata:', e);
            alert('Error renaming metadata: ' + e.message);
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

            if (category === 'channel_partner') {
                setPartners(prev => prev.filter(p => p.id !== id));
                await supabase
                    .from('admin')
                    .update({ channel_partner: null })
                    .eq('channel_partner', label);
            } else if (category === 'module_brand') {
                setBrands(prev => prev.filter(b => b.id !== id));
                await supabase
                    .from('admin')
                    .update({ module_brand: null })
                    .eq('module_brand', label);
            } else if (category === 'registration_by') {
                setRegistrations(prev => prev.filter(r => r.id !== id));
                await supabase
                    .from('admin')
                    .update({ registration_by: null })
                    .eq('registration_by', label);
            } else if (category === 'integration_by') {
                setIntegrations(prev => prev.filter(i => i.id !== id));
                await supabase
                    .from('bom_items')
                    .update({ integration_by: null })
                    .eq('integration_by', label);
            }
            await logActivity(currentUser.id, 'delete', `Deleted ${category}: "${label}" (cleared from customers)`);
        } catch (e) {
            console.error('Error deleting metadata:', e);
        }
    };

    // ─── Calculate Channel Partner Performance statistics ───
    const active = customers.filter(c => !c.deleted_at);
    const channelPartnerCounts = {};
    active.forEach(c => {
        const partnerName = c.channel_partner?.trim() || 'No Channel Partner';
        channelPartnerCounts[partnerName] = (channelPartnerCounts[partnerName] || 0) + 1;
    });

    const sortedPerformance = Object.entries(channelPartnerCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

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

                    {/* Top Performance Ranking Chart - Full Width */}
                    <div className="bg-white rounded-[32px] p-8 border border-stone-100 shadow-sm space-y-6">
                        <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
                            <Award className="w-5 h-5 text-amber-500 animate-bounce" />
                            <h3 className="text-sm font-bold text-stone-800">Channel Partner Performance (Top 5 Volume)</h3>
                        </div>
                        <div className="space-y-4">
                            {sortedPerformance.length > 0 ? (
                                sortedPerformance.slice(0, 5).map((item, idx) => {
                                    const totalProjects = active.length;
                                    const perc = totalProjects > 0 ? (item.count / totalProjects) * 100 : 0;
                                    const isFirst = idx === 0 && item.name !== 'No Channel Partner';
                                    return (
                                        <div key={item.name} className="flex flex-col">
                                            <div className="flex justify-between text-xs font-bold text-stone-600 mb-1 tracking-tight">
                                                <span className="flex items-center gap-1.5 truncate">
                                                    {isFirst && <span className="text-amber-500">🏆</span>}
                                                    <span className="truncate">{item.name}</span>
                                                </span>
                                                <span className="text-stone-400">{item.count} leads ({perc.toFixed(0)}%)</span>
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
                                <p className="text-xs text-stone-400 italic text-center py-4">No performance metrics available.</p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">

                        {/* Channel Partners Card */}
                        <button
                            onClick={() => setActiveManageCategory('channel_partner')}
                            className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md hover:border-stone-200 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                        >
                            <div className="space-y-3 w-full">
                                <div className="p-3 bg-stone-50 group-hover:bg-amber-100/70 rounded-2xl w-fit transition-colors duration-300">
                                    <Users className="w-6 h-6 text-stone-600 group-hover:text-amber-600 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-stone-850 text-sm group-hover:text-amber-600 transition-colors duration-300">Channel Partner Directory</h3>
                                    <p className="text-xs text-stone-400 font-medium mt-0.5">{partners.length} active channel partners</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1.5 transition-colors duration-300">
                                Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-300">→</span>
                            </span>
                        </button>

                        {/* Module Brands Card */}
                        <button
                            onClick={() => setActiveManageCategory('module_brand')}
                            className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md hover:border-stone-200 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                        >
                            <div className="space-y-3 w-full">
                                <div className="p-3 bg-stone-50 group-hover:bg-amber-100/70 rounded-2xl w-fit transition-colors duration-300">
                                    <Tag className="w-6 h-6 text-stone-600 group-hover:text-amber-600 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-stone-850 text-sm group-hover:text-amber-600 transition-colors duration-300">Module Brands Directory</h3>
                                    <p className="text-xs text-stone-400 font-medium mt-0.5">{brands.length} active module brands</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1.5 transition-colors duration-300">
                                Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-300">→</span>
                            </span>
                        </button>

                        {/* Registration Staff Card */}
                        <button
                            onClick={() => setActiveManageCategory('registration_by')}
                            className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md hover:border-stone-200 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                        >
                            <div className="space-y-3 w-full">
                                <div className="p-3 bg-stone-50 group-hover:bg-amber-100/70 rounded-2xl w-fit transition-colors duration-300">
                                    <Award className="w-6 h-6 text-stone-600 group-hover:text-amber-600 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-stone-850 text-sm group-hover:text-amber-600 transition-colors duration-300">Registration Staff</h3>
                                    <p className="text-xs text-stone-400 font-medium mt-0.5">{registrations.length} active registration staff</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1.5 transition-colors duration-300">
                                Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-300">→</span>
                            </span>
                        </button>

                        {/* Integration Staff Card */}
                        <button
                            onClick={() => setActiveManageCategory('integration_by')}
                            className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md hover:border-stone-200 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                        >
                            <div className="space-y-3 w-full">
                                <div className="p-3 bg-stone-50 group-hover:bg-amber-100/70 rounded-2xl w-fit transition-colors duration-300">
                                    <UserCheck className="w-6 h-6 text-stone-600 group-hover:text-amber-600 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-stone-850 text-sm group-hover:text-amber-600 transition-colors duration-300">Integration Staff</h3>
                                    <p className="text-xs text-stone-400 font-medium mt-0.5">{integrations.length} active integration staff</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1.5 transition-colors duration-300">
                                Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-300">→</span>
                            </span>
                        </button>

                        {/* Vendors Card */}
                        <button
                            onClick={() => setActiveManageCategory('vendor')}
                            className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm flex flex-col justify-between h-48 hover:shadow-md hover:border-stone-200 hover:bg-stone-50/50 active:scale-[0.98] transition-all text-left focus:outline-none w-full group"
                        >
                            <div className="space-y-3 w-full">
                                <div className="p-3 bg-stone-50 group-hover:bg-amber-100/70 rounded-2xl w-fit transition-colors duration-300">
                                    <Users className="w-6 h-6 text-stone-600 group-hover:text-amber-600 transition-colors duration-300" />
                                </div>
                                <div>
                                    <h3 className="font-extrabold text-stone-850 text-sm group-hover:text-amber-600 transition-colors duration-300">Vendors Allotment</h3>
                                    <p className="text-xs text-stone-400 font-medium mt-0.5">{vendors.length} active vendors</p>
                                </div>
                            </div>
                            <span className="text-xs font-bold text-stone-600 group-hover:text-amber-650 flex items-center gap-1.5 transition-colors duration-300">
                                Open Manager <span className="transition-transform group-hover:translate-x-1.5 duration-300">→</span>
                            </span>
                        </button>

                    </div>

                </div>
            )}

            {/* Manage Directory Full Modal */}
            {activeManageCategory && (() => {
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
                }

                const isVendorCat = activeManageCategory === 'vendor';

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
                            {isVendorCat ? (
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
                                                    isVendorCat ? (
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
                                                    isVendorCat ? (
                                                        <div className="flex flex-col">
                                                            <span className="text-xs font-bold text-stone-700 tracking-tight">{item.name}</span>
                                                            <span className="text-[10px] text-stone-400 font-medium">{item.email}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs font-bold text-stone-700 tracking-tight">{item.label}</span>
                                                    )
                                                )}

                                                <div className="flex items-center gap-2">
                                                    {isEditing ? (
                                                        <button
                                                            onClick={() => isVendorCat ? handleEditVendor(item.id, item.name, item.email) : handleEditMetadata(item.id, item.label, editingLabel, activeManageCategory)}
                                                            className="text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 p-1.5 rounded-lg transition"
                                                            title="Save changes"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => {
                                                                setEditingId(item.id);
                                                                if (isVendorCat) {
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
                                                        onClick={() => isVendorCat ? handleDeleteVendor(item.id, item.name) : handleDeleteMetadata(item.id, activeManageCategory, item.label)}
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
