// ─── App.jsx ──────────────────────────────────────────────────────────────────
// Root component: auth session management only. Routes to Login or Dashboard.
//
// To customise this CRM for a client, edit:
//   src/constants.js        ← pipeline stages, financial tags, colours
//   src/models.jsx           ← checklist template, lead form defaults
//   src/utils.jsx            ← logActivity, exportAllToCSV, formatters
//   src/components/Dashboard.jsx           ← main layout + data
//   src/components/CustomerCard.jsx
//   src/components/CustomerDetailModal.jsx
//   src/components/AddLeadModal.jsx
//   src/components/FinancialView.jsx
//   src/components/DashboardView.jsx
//   src/components/ActivityLogView.jsx
//   src/components/UserManagementView.jsx
//   src/components/LoginScreen.jsx
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, Suspense } from 'react';
import { supabase } from './supabase';
import { Sun } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import SetPasswordPage from './components/SetPassword';
import DevRoleSwitcher from './components/DevRoleSwitcher';
import { lazy } from 'react';

function lazyWithRetry(componentImport) {
    return lazy(async () => {
        const isRefreshed = window.sessionStorage.getItem('retry-lazy-refreshed') === 'true';
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
            return component;
        } catch (error) {
            console.warn('Dynamic import failed, reloading latest module chunk...', error);
            if (!isRefreshed) {
                window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
                window.location.reload();
                return { default: () => null };
            }
            throw error;
        }
    });
}

const AgentPortal = lazyWithRetry(() => import('./components/AgentPortal'));
const VendorPortal = lazyWithRetry(() => import('./components/VendorPortal'));
const StampPortal = lazyWithRetry(() => import('./components/StampPortal'));

function ScreenLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-900">
            <Sun className="animate-spin text-amber-500" size={40} />
        </div>
    );
}

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
    const [devSwitcherOpen, setDevSwitcherOpen] = useState(false);
    const [isDemoMode, setIsDemoMode] = useState(() => {
        if (typeof window !== 'undefined') {
            return window.sessionStorage.getItem('watersun_demo_mode') === 'true';
        }
        return false;
    });

    const handleToggleDemoMode = () => {
        const next = !isDemoMode;
        setIsDemoMode(next);
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_demo_mode', String(next));
        }
        if (next && !user) {
            setUser({
                id: 'dev-admin_master',
                email: 'admin@watersun.com',
                name: 'Admin Master',
                role: 'Admin',
                userType: 'admin',
                channel_partner: '',
                isDevBackdoor: true
            });
        }
    };

    useEffect(() => {
        // ── Detect recovery link from URL hash BEFORE any async work ──
        // Supabase appends #type=recovery to the redirect URL.
        // We check this synchronously so we never accidentally show the
        // Dashboard before the PASSWORD_RECOVERY event fires.
        const hash = window.location.hash;
        if (hash && hash.includes('type=recovery')) {
            setIsPasswordRecovery(true);
            setLoading(false);
            // Don't return — still set up the listener below for cleanup.
        }

        // Restore session on page load
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            // Skip normal login flow if we're in password recovery
            if (isPasswordRecovery) { setLoading(false); return; }

            if (session?.user) {
                const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('*,created_by')
  .eq('id', session.user.id)
  .single();
if (profileError && profileError.code !== 'PGRST100') {
  // Real error – sign out user
  await supabase.auth.signOut();
  setLoading(false);
  return;
}
                if (profile && profile.status !== 'inactive') {
                    setUser({
                        id: session.user.id,
                        email: session.user.email,
                        name: profile.name,
                        role: profile.role,
                        userType: profile.user_type,
                        channel_partner: profile.channel_partner || profile.name || '',
                    });
                } else {
                    // Profile missing or deactivated — force sign out
                    await supabase.auth.signOut();
                }
            } else if (isDemoMode) {
                // If demo mode is active and no session, provide default Master Admin demo session
                setUser({
                    id: 'dev-admin_master',
                    email: 'admin@watersun.com',
                    name: 'Admin Master',
                    role: 'Admin',
                    userType: 'admin',
                    channel_partner: '',
                    isDevBackdoor: true
                });
            }
            setLoading(false);
        });

        // Listen for auth events
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') setUser(null);
            if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, [isDemoMode]);

    if (loading) return <ScreenLoader />;

    if (isPasswordRecovery) {
        return <Suspense fallback={<ScreenLoader />}><SetPasswordPage /></Suspense>;
    }

    const isAgent = user && (user.userType === 'agent' || user.userType === 'agent2' || user.role === 'Channel Partners' || user.role === 'Channel Partner');
    const isVendor = user && (user.userType === 'vendor' || user.role === 'Vendors');
    const isStamp = user && (user.userType === 'stamp' || user.role === 'Stamp');

    const handleLogout = async () => {
        await supabase.auth.signOut();
        if (typeof window !== 'undefined') {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith('sb-')) localStorage.removeItem(key);
            });
            Object.keys(sessionStorage).forEach(key => {
                if (key.startsWith('sb-')) sessionStorage.removeItem(key);
            });
        }
        setUser(null);
    };


    return (
        <>
            {/* Demo Mode Top Alert Banner */}
            {isDemoMode && (
                <div className="bg-amber-400 text-stone-950 font-bold px-4 py-2 text-xs flex items-center justify-between shadow-md z-[99999] sticky top-0 border-b border-amber-500">
                    <div className="flex items-center gap-2">
                        <span className="bg-black text-amber-300 px-2 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider">SANDBOX ACTIVE</span>
                        <span className="truncate">Demo Sandbox: 16 Fully-Populated Stage Leads loaded with 100% feature data. Real database is unaffected.</span>
                    </div>
                    <button 
                        onClick={handleToggleDemoMode}
                        className="bg-stone-950 hover:bg-stone-800 text-amber-300 text-[10px] font-mono uppercase px-3 py-1 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                    >
                        Exit Sandbox
                    </button>
                </div>
            )}

            <Suspense fallback={<ScreenLoader />}>
                {!user ? (
                    <LoginScreen onLogin={setUser} />
                ) : isAgent ? (
                    <AgentPortal user={user} onLogout={handleLogout} isDemoMode={isDemoMode} />
                ) : isVendor ? (
                    <VendorPortal user={user} onLogout={handleLogout} isDemoMode={isDemoMode} />
                ) : isStamp ? (
                    <StampPortal user={user} onLogout={handleLogout} isDemoMode={isDemoMode} />
                ) : (
                    <Dashboard user={user} onLogout={handleLogout} isDemoMode={isDemoMode} onToggleDemoMode={handleToggleDemoMode} />
                )}
            </Suspense>

            {/* Secret Backdoor Switcher (Ctrl + Shift + S) */}
            <DevRoleSwitcher
                currentUser={user}
                onSwitchUser={setUser}
                isOpen={devSwitcherOpen}
                onToggle={setDevSwitcherOpen}
                isDemoMode={isDemoMode}
                onToggleDemoMode={handleToggleDemoMode}
            />
        </>
    );
}
