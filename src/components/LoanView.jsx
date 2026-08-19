import { useState } from 'react';
import { IndianRupee, CheckCircle2 } from 'lucide-react';
import { LOAN_TAGS, LOAN_TAG_COLORS } from '../constants';

export default function LoanView({ customers, onSelectCustomer }) {
    const [activeFilter, setActiveFilter] = useState(null);

    // All customers associated with Loan (either tagged or payment_type is LOAN)
    const loanCustomers = customers.filter(c => c.loan_tag || c.payment_type?.trim().toLowerCase() === 'loan');
    const allClearGroup = loanCustomers.filter(c => !c.loan_tag);

    const grouped = LOAN_TAGS.reduce((acc, tag) => {
        const group = loanCustomers.filter(c => c.loan_tag === tag.id);
        if (group.length > 0) acc[tag.id] = group;
        return acc;
    }, {});

    if (loanCustomers.length === 0) return (
        <div className="flex flex-col items-center justify-center h-64 text-stone-400">
            <IndianRupee className="w-10 h-10 mb-3 text-stone-300 animate-pulse" />
            <p className="font-semibold text-stone-500 text-sm">No loan customers found</p>
            <p className="text-xs text-stone-400 mt-1">Assign loan status tags inside customer detail cards or add Loan customers.</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Tag filter buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                <button 
                    onClick={() => setActiveFilter(null)}
                    className={`rounded-2xl p-4 border text-left transition-all cursor-pointer ${activeFilter === null ? 'bg-stone-900 border-stone-900 text-white shadow-lg shadow-stone-900/10' : 'bg-white border-stone-100 text-stone-800 hover:border-stone-200'}`}
                >
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-1 opacity-60">All Loans</p>
                    <p className="text-2xl font-bold">{loanCustomers.length}</p>
                </button>

                {LOAN_TAGS.map(tag => {
                    const groupCount = (grouped[tag.id] || []).length;
                    const colors = LOAN_TAG_COLORS[tag.id] || {};
                    const isSelected = activeFilter === tag.id;
                    return (
                        <button
                            key={tag.id}
                            onClick={() => setActiveFilter(isSelected ? null : tag.id)}
                            className={`rounded-2xl p-3 border transition-all text-left cursor-pointer ${isSelected ? 'ring-2 ring-stone-900 ring-offset-2' : ''} ${colors.bg} ${colors.border}`}
                        >
                            <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 ${colors.text}`}>{tag.label}</p>
                            <p className={`text-xl font-bold ${colors.text}`}>{groupCount}</p>
                        </button>
                    );
                })}

                <button 
                    onClick={() => setActiveFilter(activeFilter === 'all_clear' ? null : 'all_clear')}
                    className={`rounded-2xl p-3 border transition-all text-left cursor-pointer ${activeFilter === 'all_clear' ? 'ring-2 ring-emerald-600 ring-offset-2 bg-emerald-50 border-emerald-300 shadow-xs' : 'bg-emerald-50/40 border-emerald-200 hover:bg-emerald-50 hover:border-emerald-300'}`}
                >
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5 text-emerald-800">All Clear</p>
                    <p className="text-xl font-bold text-emerald-950">{allClearGroup.length}</p>
                </button>
            </div>

            {/* Tagged Groups */}
            {LOAN_TAGS.filter(tag => !activeFilter || activeFilter === tag.id).map(tag => {
                const group = grouped[tag.id];
                if (!group) return null;
                const colors = LOAN_TAG_COLORS[tag.id] || {};
                return (
                    <div key={tag.id} className="animate-in slide-in-from-bottom-2 duration-300">
                        <div className="flex items-center gap-2 mb-3">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors.dot}`} />
                            <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">{tag.label}</h3>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border ${colors.bg} ${colors.text} ${colors.border}`}>{group.length}</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {group.map(c => {
                                return (
                                    <button key={c.id} onClick={() => onSelectCustomer(c)}
                                        className="w-full bg-white rounded-2xl border border-stone-100 p-4 text-left hover:border-amber-200 hover:shadow-sm transition-all group cursor-pointer">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <p className="font-bold text-stone-800 text-sm group-hover:text-amber-600 transition-colors">{c.customer_name}</p>
                                                <p className="text-[10px] text-stone-400 font-medium mt-0.5">{[c.crn, c.location].filter(Boolean).join(' · ')}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-50 text-[10px]">
                                            <div>
                                                <p className="text-stone-400 font-bold uppercase">System Capacity</p>
                                                <p className="text-xs font-semibold text-stone-700 mt-0.5">{c.system_capacity_kwp ? `${c.system_capacity_kwp} kWp` : '–'}</p>
                                            </div>
                                            <div>
                                                <p className="text-stone-400 font-bold uppercase">Current Stage</p>
                                                <p className="text-xs font-semibold text-amber-600 mt-0.5">{c.stage || '–'}</p>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}

            {/* All Clear (Untagged / No Active Tag) section at the end */}
            {(!activeFilter || activeFilter === 'all_clear') && allClearGroup.length > 0 && (
                <div className="animate-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0 bg-emerald-600" />
                        <h3 className="text-xs font-bold text-stone-700 uppercase tracking-widest">All Clear (No Tag)</h3>
                        <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-bold border bg-emerald-50 text-emerald-800 border-emerald-200">
                            {allClearGroup.length}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {allClearGroup.map(c => (
                            <button 
                                key={c.id} 
                                onClick={() => onSelectCustomer(c)}
                                className="w-full bg-white rounded-2xl border border-stone-100 p-4 text-left hover:border-amber-200 hover:shadow-sm transition-all group cursor-pointer"
                            >
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-bold text-stone-800 text-sm group-hover:text-amber-600 transition-colors">{c.customer_name}</p>
                                        <p className="text-[10px] text-stone-400 font-medium mt-0.5">{[c.crn, c.location].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <span className="text-[9px] bg-stone-100 text-stone-600 border border-stone-200 px-2 py-0.5 rounded font-bold">
                                        All Clear
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-50 text-[10px]">
                                    <div>
                                        <p className="text-stone-400 font-bold uppercase">System Capacity</p>
                                        <p className="text-xs font-semibold text-stone-700 mt-0.5">{c.system_capacity_kwp ? `${c.system_capacity_kwp} kWp` : '–'}</p>
                                    </div>
                                    <div>
                                        <p className="text-stone-400 font-bold uppercase">Current Stage</p>
                                        <p className="text-xs font-semibold text-amber-600 mt-0.5">{c.stage || '–'}</p>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
