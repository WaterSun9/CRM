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
    }, []);

    if (loading) return <ScreenLoader />;

    if (isPasswordRecovery) {
        return <Suspense fallback={<ScreenLoader />}><SetPasswordPage /></Suspense>;
    }

    if (!user) return <Suspense fallback={<ScreenLoader />}><LoginScreen onLogin={setUser} /></Suspense>;

    const isAgent = user.userType === 'agent' || user.role === 'Channel Partners';
    const isVendor = user.userType === 'vendor' || user.role === 'Vendors';
    const isStamp = user.userType === 'stamp' || user.role === 'Stamp';

    const handleLogout = async () => {
        await supabase.auth.signOut();
        // Clear all Supabase auth tokens from both sessionStorage and localStorage
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

    if (isAgent) {
        return (<Suspense fallback={<ScreenLoader />}>
            <AgentPortal
                user={user}
                onLogout={handleLogout}
            />
        </Suspense>);
    }

    if (isVendor) {
        return (<Suspense fallback={<ScreenLoader />}>
            <VendorPortal
                user={user}
                onLogout={handleLogout}
            />
        </Suspense>);
    }

    if (isStamp) {
        return (<Suspense fallback={<ScreenLoader />}>
            <StampPortal
                user={user}
                onLogout={handleLogout}
            />
        </Suspense>);
    }

    return (<Suspense fallback={<ScreenLoader />}>
        <Dashboard
            user={user}
            onLogout={handleLogout}
        />
    </Suspense>);
}
