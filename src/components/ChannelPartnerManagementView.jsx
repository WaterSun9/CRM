// src/components/ChannelPartnerManagementView.jsx  —  Watersun Electrical Solutions Pvt Ltd
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { Users, Plus, Award, Trash2, Tag, ShieldCheck, BarChart2 } from 'lucide-react';
import { logActivity } from '../utils';

export default function ChannelPartnerManagementView({ customers = [], currentUser }) {
    const [partners, setPartners] = useState([]);
    const [brands, setBrands] = useState([]);
    const [newPartner, setNewPartner] = useState('');
    const [newBrand, setNewBrand] = useState('');
    const [loading, setLoading] = useState(true);

    // Fetch partners and brands from metadata table
    const fetchMetadata = async () => {
        try {
            const { data, error } = await supabase
                .from('metadata')
                .select('id, category, label')
                .in('category', ['channel_partner', 'module_brand']);
            
            if (error) throw error;

            const partnerList = data.filter(d => d.category === 'channel_partner');
            const brandList = data.filter(d => d.category === 'module_brand');
            
            setPartners(partnerList);
            setBrands(brandList);
        } catch (e) {
            console.error('Error fetching metadata:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMetadata();
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
            } else {
                setBrands(prev => prev.filter(b => b.id !== id));
                await supabase
                    .from('admin')
                    .update({ module_brand: null })
                    .eq('module_brand', label);
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
                    <h2 className="text-lg font-black tracking-tight">Channel Partner & Brand Management</h2>
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

                    {/* Bottom grid: Directory management side-by-side */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* Channel Partner List & Add form */}
                        <div className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
                                <Users className="w-5 h-5 text-amber-500" />
                                <h3 className="text-sm font-bold text-stone-800">Channel Partner Directory</h3>
                                <span className="ml-auto text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{partners.length} Active</span>
                            </div>

                            {/* Add input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter channel partner name..."
                                    value={newPartner}
                                    onChange={e => setNewPartner(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddPartner()}
                                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 outline-none transition"
                                />
                                <button
                                    onClick={handleAddPartner}
                                    className="flex items-center gap-1 bg-stone-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>

                            {/* List layout */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {partners.length > 0 ? (
                                    partners.map(p => (
                                        <div key={p.id} className="flex justify-between items-center bg-stone-50 px-4 py-3 rounded-xl hover:bg-stone-100 transition-colors">
                                            <span className="text-xs font-bold text-stone-700">{p.label}</span>
                                            <button
                                                onClick={() => handleDeleteMetadata(p.id, 'channel_partner', p.label)}
                                                className="text-stone-400 hover:text-red-500 transition-colors p-1"
                                                title="Delete entry"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-stone-400 italic text-center py-4">No channel partners added yet.</p>
                                )}
                            </div>
                        </div>

                        {/* Module Brands Directory List & Add form */}
                        <div className="bg-white rounded-[32px] p-6 border border-stone-100 shadow-sm space-y-6">
                            <div className="flex items-center gap-2 border-b border-stone-50 pb-4">
                                <Tag className="w-5 h-5 text-amber-500" />
                                <h3 className="text-sm font-bold text-stone-800">Module Brands Directory</h3>
                                <span className="ml-auto text-[10px] bg-stone-100 text-stone-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">{brands.length} Active</span>
                            </div>

                            {/* Add input */}
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder="Enter module brand name..."
                                    value={newBrand}
                                    onChange={e => setNewBrand(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleAddBrand()}
                                    className="flex-1 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:border-amber-400 outline-none transition"
                                />
                                <button
                                    onClick={handleAddBrand}
                                    className="flex items-center gap-1 bg-stone-900 text-white px-4 py-2.5 rounded-xl text-xs font-bold hover:bg-stone-800 transition-colors"
                                >
                                    <Plus className="w-4 h-4" /> Add
                                </button>
                            </div>

                            {/* List layout */}
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                {brands.length > 0 ? (
                                    brands.map(b => (
                                        <div key={b.id} className="flex justify-between items-center bg-stone-50 px-4 py-3 rounded-xl hover:bg-stone-100 transition-colors">
                                            <span className="text-xs font-bold text-stone-700">{b.label}</span>
                                            <button
                                                onClick={() => handleDeleteMetadata(b.id, 'module_brand', b.label)}
                                                className="text-stone-400 hover:text-red-500 transition-colors p-1"
                                                title="Delete entry"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-xs text-stone-400 italic text-center py-4">No brands added yet.</p>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            )}
        </div>
    );
}
