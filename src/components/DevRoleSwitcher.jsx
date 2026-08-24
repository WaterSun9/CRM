import React, { useState, useEffect } from 'react';
import { 
    Shield, Briefcase, Building2, Users, UserCheck, Wrench, 
    FileText, X, Check, ArrowRight, Terminal, Key, Database
} from 'lucide-react';
import { MOCK_DEV_ROLES } from '../mock/demoData';

const ROLE_ICONS = {
    admin_master: Shield,
    office_staff: Briefcase,
    cpo_manager: Building2,
    cp_manager_office2: Briefcase,
    direct_cp_agent: Users,
    agent_partner_agent2: UserCheck,
    vendor_tech: Wrench,
    stamp_maker: FileText,
};

const ROLE_COLORS = {
    admin_master: 'from-amber-500 to-amber-600',
    office_staff: 'from-blue-500 to-blue-600',
    cpo_manager: 'from-indigo-500 to-indigo-600',
    cp_manager_office2: 'from-cyan-500 to-cyan-600',
    direct_cp_agent: 'from-emerald-500 to-emerald-600',
    agent_partner_agent2: 'from-teal-500 to-teal-600',
    vendor_tech: 'from-amber-600 to-amber-700',
    stamp_maker: 'from-sky-500 to-sky-600',
};

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
        // Explicitly operate on the REAL Supabase website & database (disable sandbox demo)
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_demo_mode', 'false');
        }

        onSwitchUser({
            id: `dev-${mockRole.id}`,
            email: mockRole.email,
            name: mockRole.title,
            role: mockRole.role,
            userType: mockRole.userType,
            channel_partner: mockRole.channel_partner || '',
            isDevBackdoor: true
        });

        if (typeof onToggle === 'function') {
            onToggle(false);
        }
    };

    /*
    // ════════════════════════════════════════════════════════════════════════════
    // [COMMENTED OUT FOR NOW AS REQUESTED] FAKE BACKEND SANDBOX DEMO TABLE RESET
    // ════════════════════════════════════════════════════════════════════════════
    const [resetMsg, setResetMsg] = useState(false);
    const handleResetTable = () => {
        resetStoredDemoCustomers();
        setResetMsg(true);
        setTimeout(() => setResetMsg(false), 2500);
    };
    */

    const isAdminUser = Boolean(currentUser && (currentUser.userType === 'admin' || currentUser.role === 'Admin' || currentUser.isDevBackdoor));

    return (
        <>
            {/* Floating Trigger Button for Admin/Dev */}
            {isAdminUser && (
                <button
                    type="button"
                    onClick={() => onToggle(true)}
                    className="fixed bottom-3 right-3 z-[9999] flex items-center gap-1.5 bg-stone-900/90 hover:bg-stone-900 text-amber-400 hover:text-amber-300 border border-stone-700/80 px-3 py-1.5 rounded-full text-[10px] font-bold shadow-xl backdrop-blur-md transition-all cursor-pointer hover:scale-105 active:scale-95 group"
                    title="Backdoor Terminal (Shortcut: Ctrl + Shift + S)"
                >
                    <Terminal size={12} className="text-amber-400 animate-pulse" />
                    <span className="text-stone-300 group-hover:text-white font-mono">
                        Backdoor Terminal
                    </span>
                    <span className="bg-amber-400/20 text-amber-300 text-[8px] px-1.5 py-0.5 rounded-full font-mono uppercase">
                        8 Roles (Live DB)
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
                                    <Terminal size={20} />
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-stone-900 flex items-center gap-2">
                                        Backdoor Terminal & Role Switcher
                                        <span className="text-[9px] bg-stone-100 text-stone-600 font-bold px-2 py-0.5 rounded-full font-mono">
                                            Ctrl+Shift+S
                                        </span>
                                    </h3>
                                    <p className="text-xs text-stone-500 font-medium mt-0.5">
                                        1-click test access to all 8 system screens connected directly to the <b>Real Database</b>.
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

                        {/* Real Database Connection Banner */}
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 mt-3 flex-shrink-0">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 bg-emerald-600 text-white rounded-xl font-bold shadow-xs">
                                    <Database size={16} />
                                </div>
                                <div>
                                    <h4 className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                                        Connected to Real Supabase Backend
                                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase font-mono bg-emerald-200 text-emerald-900">
                                            Live
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-emerald-800/80 mt-0.5 font-medium">
                                        Switching roles loads real database leads, assigned vendors, and partner records.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 8 Roles Grid */}
                        <div className="flex-1 overflow-y-auto py-4 grid grid-cols-1 sm:grid-cols-2 gap-3 pr-1">
                            {MOCK_DEV_ROLES.map(role => {
                                const Icon = ROLE_ICONS[role.id] || Shield;
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
                                                ? 'bg-amber-50/60 border-amber-300 ring-2 ring-amber-400/30 shadow-sm'
                                                : 'bg-white border-stone-200 hover:border-stone-400 hover:shadow-md'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${role.color || 'from-amber-500 to-amber-600'} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
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

                                        {/* Fake Credentials Box */}
                                        <div className="bg-stone-50 p-2 rounded-xl border border-stone-200/80 flex items-center justify-between text-[10px] font-mono text-stone-600">
                                            <div className="flex items-center gap-1.5 truncate">
                                                <Key size={10} className="text-amber-600 flex-shrink-0" />
                                                <span className="truncate">{role.email}</span>
                                            </div>
                                            <span className="font-bold text-stone-800 bg-stone-200/70 px-1.5 py-0.5 rounded flex-shrink-0">
                                                {role.password}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between pt-1 border-t border-stone-100 text-[10px] font-bold">
                                            <span className="text-stone-400 group-hover:text-amber-600 transition-colors flex items-center gap-1">
                                                Open Live Screen <ArrowRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
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
                                💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[10px] text-stone-700 font-bold">Ctrl+Shift+S</kbd> anywhere to toggle backdoor.
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
