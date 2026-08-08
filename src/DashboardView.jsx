import React from 'react';
import { Users, Zap, IndianRupee, Wallet, Target, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { formatINRCompact, toIndianCommas } from './utils';

export default function DashboardView({ customers = [], loading }) {
    if (loading) return <div className="p-20 text-center animate-pulse text-gray-400 font-bold uppercase tracking-widest">Analyzing Data...</div>;

    const totalCapacity = customers.reduce((sum, c) => sum + (Number(c.capacity) || 0), 0);
    const completedProjects = customers.filter(c => c.stage === 'completed').length;

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard label="Live Projects" value={customers.length} icon={Users} color="blue" />
                <StatCard label="Total Capacity" value={`${totalCapacity.toFixed(1)} kWp`} icon={Zap} color="amber" />
                <StatCard label="Total Revenue" value={formatINRCompact(totalRevenue)} icon={IndianRupee} color="emerald" />
                <StatCard label="Outstanding" value={formatINRCompact(receivables)} icon={Wallet} color="rose" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Workflow Status */}
                <div className="lg:col-span-2 bg-white rounded-[32px] p-8 border border-gray-100 shadow-sm">
                    <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 mb-8 flex items-center gap-2">
                        <Target size={16} /> Workflow Distribution
                    </h3>
                    <div className="space-y-6">
                        {['leads', 'pending_loans', 'material_procurement', 'installation', 'completed'].map(stageId => {
                            const count = customers.filter(c => c.stage === stageId).length;
                            const percentage = customers.length > 0 ? (count / customers.length) * 100 : 0;
                            return (
                                <div key={stageId} className="space-y-2">
                                    <div className="flex justify-between items-center text-xs font-bold uppercase">
                                        <span className="text-gray-600">{stageId.replace('_', ' ')}</span>
                                        <span className="text-gray-900">{count} Projects</span>
                                    </div>
                                    <div className="h-3 bg-gray-50 rounded-full overflow-hidden">
                                        <div 
                                            className={`h-full rounded-full transition-all duration-1000 ${
                                                stageId === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'
                                            }`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Right Sidebar Dashboard */}
                <div className="space-y-8">
                    <div className="bg-gray-900 rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden">
                        <TrendingUp className="absolute -right-4 -bottom-4 w-32 h-32 text-white/5" />
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6">Financial Snapshot</h4>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                <span className="text-sm text-gray-400 font-medium">Total Collected</span>
                                <span className="font-bold">{formatINRCompact(totalCollected)}</span>
                            </div>
                            <div className="flex justify-between items-center border-b border-white/10 pb-4">
                                <span className="text-sm text-gray-400 font-medium">Completed Projects</span>
                                <span className="font-bold text-emerald-400">{completedProjects}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-gray-400 font-medium">Avg Project Size</span>
                                <span className="font-bold">{(totalCapacity / (customers.length || 1)).toFixed(1)} kWp</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[32px] p-8 border border-gray-100">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6">Recent Additions</h4>
                        <div className="space-y-4">
                            {customers.slice(0, 4).map(c => (
                                <div key={c.id} className="flex items-center gap-4">
                                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-blue-500 font-black text-xs">
                                        {c.customer_name[0]}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{c.customer_name}</p>
                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{c.capacity}kWp • {c.location}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatCard({ label, value, icon: Icon, color }) {
    const colors = {
        blue: 'bg-blue-50 text-blue-600',
        amber: 'bg-amber-50 text-amber-600',
        emerald: 'bg-emerald-50 text-emerald-600',
        rose: 'bg-rose-50 text-rose-600'
    };
    return (
        <div className="bg-white p-6 rounded-[32px] border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${colors[color]}`}>
                <Icon size={24} />
            </div>
            <p className="text-2xl font-black text-gray-900">{value}</p>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">{label}</p>
        </div>
    );
}