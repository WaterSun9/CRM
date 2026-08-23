import React, { useState, useEffect } from 'react';
import { 
    Shield, Briefcase, Building2, Users, UserCheck, Wrench, 
    FileText, Calculator, X, Sparkles, Check, ArrowRight
} from 'lucide-react';

export const MOCK_DEV_ROLES = [
    {
        id: 'admin_master',
        name: 'Master Admin',
        title: 'Admin Master',
        email: 'admin@watersun.com',
        userType: 'admin',
        role: 'Admin',
        channel_partner: '',
        icon: Shield,
        color: 'from-amber-500 to-amber-600',
        badge: 'Full Access',
        description: 'Complete CRM access: all stages, full customer modals, user & partner management, audit logs.'
    },
    {
        id: 'office_staff',
        name: 'Office Staff',
        title: 'Office User',
        email: 'office@watersun.com',
        userType: 'sales',
        role: 'Office',
        channel_partner: '',
        icon: Briefcase,
        color: 'from-blue-500 to-blue-600',
        badge: 'Sales & Operations',
        description: 'Main pipeline workflow, customer management, Discom submissions, and agreement generator.'
    },
    {
        id: 'cpo_manager',
        name: 'Channel Partner Office',
        title: 'CPO Head Office',
        email: 'cpo@watersun.com',
        userType: 'channel_partner_office',
        role: 'Channel Partner Office',
        channel_partner: 'Apex Solar Gujarat',
        icon: Building2,
        color: 'from-indigo-500 to-indigo-600',
        badge: 'Partner Office',
        description: 'CPO Team Dashboard, manage branch managers & field agents, and track branch pipeline.'
    },
    {
        id: 'cp_manager_office2',
        name: 'CP Manager (Office 2)',
        title: 'Vikram Patel (CP Manager)',
        email: 'manager.cpo@watersun.com',
        userType: 'office2',
        role: 'Channel Partner Manager',
        channel_partner: 'Apex Solar Gujarat',
        icon: Briefcase,
        color: 'from-cyan-500 to-cyan-600',
        badge: 'CP Manager (office2)',
        description: 'Branch management view: oversees branch operations and assigned partner clients.'
    },
    {
        id: 'direct_cp_agent',
        name: 'Direct Channel Partner (Agent)',
        title: 'Om Solar (Direct CP)',
        email: 'direct.agent@watersun.com',
        userType: 'agent',
        role: 'Channel Partners',
        channel_partner: 'Om Solar Direct',
        icon: Users,
        color: 'from-emerald-500 to-emerald-600',
        badge: 'Direct CP (agent)',
        description: 'Independent Channel Partner Portal: manages direct customer leads & document workdesk.'
    },
    {
        id: 'agent_partner_agent2',
        name: 'Channel Partner under CP Office (Agent 2)',
        title: 'Rahul Sharma (Field Agent)',
        email: 'agent2@watersun.com',
        userType: 'agent2',
        role: 'Channel Partner',
        channel_partner: 'Apex Solar Gujarat',
        icon: UserCheck,
        color: 'from-teal-500 to-teal-600',
        badge: 'Branch CP (agent2)',
        description: 'Sub-agent under CP Office: leads are auto-linked to the parent branch (Apex Solar Gujarat).'
    },
    {
        id: 'vendor_tech',
        name: 'Vendor / Technician',
        title: 'Shreeji Solar Installations',
        email: 'vendor@watersun.com',
        userType: 'vendor',
        role: 'Vendors',
        channel_partner: '',
        icon: Wrench,
        color: 'from-amber-600 to-amber-700',
        badge: 'Vendor Portal',
        description: 'Mobile Vendor Portal for installation status, delivery details, and Geo Tag photos.'
    },
    {
        id: 'stamp_maker',
        name: 'Stamp Maker',
        title: 'PM Surya Ghar Stamp Maker',
        email: 'stamp@watersun.com',
        userType: 'stamp',
        role: 'Stamp',
        channel_partner: '',
        icon: FileText,
        color: 'from-sky-500 to-sky-600',
        badge: 'Stamp Portal',
        description: 'Mobile Stamp Portal: view requested customer party details, upload stamps & complete tasks.'
    }
];

export default function DevRoleSwitcher({ currentUser, onSwitchUser, isOpen, onToggle, isDemoMode = false, onToggleDemoMode }) {
    // Keyboard shortcut: Ctrl + Shift + S or Cmd + Shift + S
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                e.preventDefault();
                if (typeof onToggle === 'function') {
                    onToggle(prev => !prev);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onToggle]);

    const handleSelectRole = (mockRole) => {
        onSwitchUser({
            id: `dev-${mockRole.id}`,
            email: mockRole.email,
            name: mockRole.title,
            role: mockRole.role,
            userType: mockRole.userType,
            channel_partner: mockRole.channel_partner || mockRole.title || '',
            isDevBackdoor: true
        });
        if (typeof onToggle === 'function') {
            onToggle(false);
        }
    };

    const isAdminUser = currentUser && (currentUser.userType === 'admin' || currentUser.role === 'Admin' || currentUser.isDevBackdoor);

    return (
        <>
            {/* Floating Trigger Button ONLY visible to Admin users */}
            {isAdminUser && (
                <button
                    type="button"
                    onClick={() => onToggle(true)}
                    className="fixed bottom-3 right-3 z-[9999] flex items-center gap-1.5 bg-stone-900/90 hover:bg-stone-900 text-amber-400 hover:text-amber-300 border border-stone-700/80 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95 group"
                    title="Technician Control (Shortcut: Ctrl + Shift + S)"
                >
                    <Wrench size={12} className="text-amber-400 animate-pulse" />
                    <span className="text-stone-300 group-hover:text-white font-mono">
                        Technician Control
                    </span>
                    <span className="bg-amber-400/20 text-amber-300 text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase">
                        {isDemoMode ? 'SANDBOX ON' : '8 Views'}
                    </span>
                </button>
            )}

            {/* Secret Backdoor Switcher Modal */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[10000] flex items-center justify-center bg-stone-950/70 backdrop-blur-sm p-4 animate-in fade-in duration-200"
                    onClick={() => onToggle(false)}
                >
                    <div
                        className="bg-white rounded-[28px] max-w-2xl w-full p-6 shadow-2xl border border-stone-150 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between pb-4 border-b border-stone-100 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-stone-900 text-amber-400 flex items-center justify-center shadow-md">
                                    <Wrench size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                                        Technician Control
                                        <span className="text-[9px] bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded-full font-mono">
                                            Ctrl+Shift+S
                                        </span>
                                    </h3>
                                    <p className="text-xs text-stone-500 font-medium mt-0.5">
                                        Developer backdoor: jump into any of the 7 portal views without logging out.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => onToggle(false)}
                                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition cursor-pointer"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Demo Sandbox Mode Card */}
                        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-300/80 rounded-2xl flex items-center justify-between gap-3 mt-3 flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-amber-500 text-stone-950 rounded-xl font-bold shadow-xs">
                                    <Sparkles size={18} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className="text-xs font-extrabold text-stone-900">Demo Sandbox Data</h4>
                                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${isDemoMode ? 'bg-emerald-600 text-white' : 'bg-stone-200 text-stone-600'}`}>
                                            {isDemoMode ? 'Active (16 Stage Leads)' : 'Off (Live Supabase)'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-stone-500 mt-0.5">
                                        Populate 16 complete leads across all stages with 100% filled feature fields without touching live data.
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onToggleDemoMode}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer ${
                                    isDemoMode
                                        ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                        : 'bg-stone-900 text-amber-400 hover:bg-stone-800'
                                }`}
                            >
                                {isDemoMode ? 'Turn OFF Sandbox' : 'Enable Sandbox'}
                            </button>
                        </div>

                        {/* 7 Roles Grid */}
                        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
                            {MOCK_DEV_ROLES.map(role => {
                                const Icon = role.icon;
                                const isCurrent = currentUser && (
                                    (currentUser.role === role.role && currentUser.userType === role.userType) ||
                                    (currentUser.name === role.title)
                                );

                                return (
                                    <button
                                        key={role.id}
                                        type="button"
                                        onClick={() => handleSelectRole(role)}
                                        className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group relative overflow-hidden ${
                                            isCurrent
                                                ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30'
                                                : 'bg-white border-stone-200 hover:border-stone-400 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${role.color} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
                                                    <Icon size={16} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="text-xs font-bold text-stone-900 group-hover:text-amber-700 transition-colors truncate">
                                                        {role.name}
                                                    </h4>
                                                    <p className="text-[10px] text-stone-400 font-medium truncate font-mono">
                                                        {role.title}
                                                    </p>
                                                </div>
                                            </div>
                                            <span className={`text-[8px] font-extrabold uppercase px-2 py-0.5 rounded-full flex-shrink-0 border ${
                                                isCurrent
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                    : 'bg-stone-100 text-stone-600 border-stone-200'
                                            }`}>
                                                {isCurrent ? 'Active View' : role.badge}
                                            </span>
                                        </div>

                                        <p className="text-[11px] text-stone-500 font-normal leading-relaxed line-clamp-2">
                                            {role.description}
                                        </p>

                                        <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px] font-bold">
                                            <span className="text-stone-400 group-hover:text-amber-600 transition-colors flex items-center gap-1">
                                                Switch View <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                                            </span>
                                            {isCurrent && (
                                                <span className="text-emerald-600 flex items-center gap-1">
                                                    <Check size={12} /> Currently Viewing
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Footer */}
                        <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400 flex-shrink-0">
                            <span className="text-[11px]">
                                💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[10px] text-stone-700 font-bold">Ctrl+Shift+S</kbd> anywhere to toggle.
                            </span>
                            <button
                                type="button"
                                onClick={() => onToggle(false)}
                                className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl font-bold text-xs transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
