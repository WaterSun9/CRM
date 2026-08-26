import React, { useState, useEffect, useRef, memo } from 'react';
import { Zap, MapPin, User, Building2, Package, FolderOpen, ShieldCheck, Phone, Edit3, Truck } from 'lucide-react';
import { PRIMARY_STAGES, SUBSIDY_TAGS, SUBSIDY_TAG_COLORS } from '../constants';

const CustomerCard = memo(function CustomerCard({ customer, onSelect, onMoveStage, currentUser }) {
    const [showStageMenu, setShowStageMenu] = useState(false);
    const [menuDirection, setMenuDirection] = useState('down');
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!showStageMenu) return;
        const handleClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowStageMenu(false);
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showStageMenu]);

    const isCompleted = customer.stage === 'COMPLETED';
    const isAdmin = currentUser?.userType === 'admin';

    const currentStageRemark = (() => {
        if (!customer.stages_remarks) return '';
        if (typeof customer.stages_remarks === 'object') {
            return customer.stages_remarks[customer.stage] || '';
        }
        if (typeof customer.stages_remarks === 'string') {
            try {
                const parsed = JSON.parse(customer.stages_remarks);
                if (typeof parsed === 'object' && parsed) {
                    return parsed[customer.stage] || '';
                }
                return parsed || '';
            } catch (e) {
                return customer.stages_remarks;
            }
        }
        return '';
    })();

    const tagInfo   = SUBSIDY_TAGS.find(f => f.id === customer.subsidy_tag);
    const tagColors = customer.subsidy_tag ? (SUBSIDY_TAG_COLORS[customer.subsidy_tag] || {}) : {};

    return (
        <div className={`rounded-2xl border shadow-sm hover:shadow-md transition-all border-l-4 group flex flex-col relative ${showStageMenu ? 'z-50' : 'z-10'} ${isCompleted ? 'bg-stone-50/80 border-stone-200 border-l-emerald-500' : 'bg-white border-stone-100 border-l-amber-400'} ${isCompleted && !showStageMenu ? 'opacity-80' : ''}`}>
            {/* Clickable top section */}
            <div className="p-5 cursor-pointer flex-1" onClick={() => onSelect(customer)}>
                <div className="flex justify-between items-start mb-3">
                    <h3 className="font-bold text-stone-800 group-hover:text-amber-600 transition-colors leading-tight">
                        {customer?.customer_name || 'Unnamed Customer'}
                    </h3>
                    {tagInfo && (
                        <span className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ml-2 whitespace-nowrap border ${tagColors.bg} ${tagColors.text} ${tagColors.border}`}>
                            {tagInfo.label}
                        </span>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 mb-3">
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                        <Zap size={11} className="text-amber-500 flex-shrink-0" />
                        <span>{customer.system_capacity_kwp ? `${customer.system_capacity_kwp} kWp` : '–'} {customer.project_type || ''}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                        <MapPin size={11} className="text-stone-300 flex-shrink-0" />
                        <span className="truncate">{customer.villages || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                        <User size={11} className="text-stone-300 flex-shrink-0" />
                        <span className="truncate">{customer.channel_partner || 'No Channel Partner'}</span>
                    </div>
                    {customer.phone_number && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium">
                            <Phone size={11} className="text-stone-300 flex-shrink-0" />
                            <span>{customer.phone_number}</span>
                        </div>
                    )}
                    {customer.company_branch && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium col-span-2">
                            <Building2 size={11} className="text-stone-300 flex-shrink-0" />
                            <span>{customer.company_branch}</span>
                        </div>
                    )}
                    {customer.vendor && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-500 font-medium col-span-2">
                            <Package size={11} className="text-stone-300 flex-shrink-0" />
                            <span>Vendor: {customer.vendor}</span>
                        </div>
                    )}
                    {customer.delivery_batch_id && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-800 bg-amber-50 border border-amber-200/80 rounded-lg px-2 py-0.5 col-span-2 font-bold">
                            <Truck size={11} className="text-amber-600 flex-shrink-0" />
                            <span className="truncate">Batch: {customer.delivery_batch_id}</span>
                        </div>
                    )}
                </div>
                {customer.google_docs && (
                    <div className="mb-3" onClick={e => e.stopPropagation()}>
                        <a href={customer.google_docs} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-2 py-1 rounded-full font-medium transition-colors">
                            <FolderOpen className="w-3 h-3" /> Docs
                        </a>
                    </div>
                )}
            </div>

            {/* Bottom strip — not clickable (stops propagation via parent) */}
            <div className="border-t border-stone-100 bg-stone-50/60 rounded-b-2xl animate-in fade-in duration-300" onClick={e => e.stopPropagation()}>
                {/* Stage remarks preview */}
                {currentStageRemark && (
                    <div className="px-4 pb-3 border-t border-stone-100 pt-2">
                        <p className="text-[10px] text-stone-500 italic leading-tight line-clamp-2">
                            💬 {currentStageRemark}
                        </p>
                    </div>
                )}

                {/* Stage Display Strip */}
                <div className="px-4 pb-4 pt-2 border-t border-stone-100">
                    <div className="relative" ref={dropdownRef}>
                        <div className={`w-full flex items-center justify-between border rounded-xl px-3 py-2 text-xs font-bold ${isCompleted ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-stone-50 border-stone-200 text-stone-600'}`}>
                            <div className="flex items-center gap-2 truncate">
                                {isCompleted && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />}
                                <span>{PRIMARY_STAGES.find(s => s.id === customer.stage)?.label || customer.stage}</span>
                            </div>
                            {isAdmin && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextShow = !showStageMenu;
                                        setShowStageMenu(nextShow);
                                        if (nextShow) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const spaceBelow = window.innerHeight - rect.bottom;
                                            setMenuDirection(spaceBelow < 280 ? 'up' : 'down');
                                        }
                                    }}
                                    className="p-1 text-stone-400 hover:text-amber-600 transition-colors ml-2 bg-stone-100 hover:bg-stone-200/60 rounded"
                                    title="Admin Override Stage"
                                >
                                    <Edit3 className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                        {showStageMenu && (
                            <div className={`absolute left-0 right-0 bg-white rounded-xl shadow-xl border border-stone-100 py-1 z-20 max-h-64 overflow-y-auto ${menuDirection === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'}`}>
                                <div className="px-3 py-1.5 text-[9px] font-bold text-amber-700 bg-amber-50 uppercase tracking-widest border-b border-stone-100">
                                    Admin Override
                                </div>
                                {PRIMARY_STAGES.map(stage => (
                                    <button key={stage.id}
                                        onClick={() => { onMoveStage(customer.id, stage.id); setShowStageMenu(false); }}
                                        className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-stone-50 transition-colors ${customer.stage === stage.id ? 'bg-amber-50 font-bold text-amber-700' : 'text-stone-600'}`}>
                                        <stage.icon className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                                        {stage.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
export default CustomerCard;
