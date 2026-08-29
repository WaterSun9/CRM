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
import UpdateChecker from './components/UpdateChecker';
import OfflineBanner from './components/OfflineBanner';
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
const DevRoleSwitcher = import.meta.env.DEV
    ? lazyWithRetry(() => import('./components/DevRoleSwitcher'))
    : null;

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
        const restoreSession = async () => {
            // Skip normal login flow if we're in password recovery
            if (isPasswordRecovery) { setLoading(false); return; }

            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                if (sessionError) throw sessionError;

                if (session?.user) {
                    try {
                        const { data: profile, error: profileError } = await supabase
                            .from('profiles')
                            .select('*')
                            .eq('id', session.user.id)
                            .maybeSingle();

                        if (profileError) {
                            console.warn('Profile fetch warning:', profileError);
                        }

                        if (profile && profile.status !== 'inactive') {
                            setUser({
                                id: session.user.id,
                                email: session.user.email,
                                name: profile.name || session.user.email?.split('@')[0] || 'User',
                                role: profile.role || 'User',
                                userType: profile.user_type || 'sales',
                                channel_partner: profile.channel_partner || profile.name || '',
                            });
                        } else if (profile && profile.status === 'inactive') {
                            await supabase.auth.signOut();
                            setUser(null);
                        } else {
                            // No profile row: the account is not provisioned. This used to
                            // fall back to userType 'sales', which routes to the Office
                            // Dashboard — a missing profile GRANTED access instead of
                            // denying it. Fail closed, same as the inactive branch above.
                            console.error('No profile row for authenticated user; signing out.', session.user.id);
                            await supabase.auth.signOut();
                            setUser(null);
                        }
                    } catch (fetchErr) {
                        // The lookup failed, so the role is unknown — never assume Office.
                        // The session is left intact (this is usually a transient network
                        // error), so a retry can succeed without a fresh sign-in.
                        console.error('Failed to fetch profile row on startup; refusing to assume a role.', fetchErr);
                        setUser(null);
                    }
                } else {
                    setUser(null);
                }
            } catch (err) {
                console.warn('Session restore error or connection interrupted:', err);
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        restoreSession();

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

    // ── Enforce deactivation mid-session ────────────────────────────────────
    // `status = 'inactive'` was only checked at login, so someone deactivated
    // while working kept full access until they happened to sign out. Watch
    // this user's own profile row and end the session the moment it flips —
    // and re-check on tab focus, in case the socket dropped.
    useEffect(() => {
        if (!user?.id) return undefined;

        const endSession = async (reason) => {
            console.warn('Session ended:', reason);
            await supabase.auth.signOut();
            setUser(null);
            if (typeof window !== 'undefined') {
                Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
                Object.keys(sessionStorage).forEach(k => { if (k.startsWith('sb-')) sessionStorage.removeItem(k); });
            }
        };

        const verifyStillActive = async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('status')
                .eq('id', user.id)
                .maybeSingle();
            // A failed lookup is left alone — it is usually a dropped network,
            // and signing people out on a blip would be worse than the risk.
            if (error) return;
            if (!data || data.status === 'inactive') {
                await endSession(!data ? 'profile row removed' : 'account deactivated');
            }
        };

        const channel = supabase
            .channel(`profile_status_${user.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                payload => {
                    if (payload.new?.status === 'inactive') endSession('account deactivated');
                })
            .subscribe();

        const onFocus = () => verifyStillActive();
        window.addEventListener('focus', onFocus);
        verifyStillActive();

        return () => {
            window.removeEventListener('focus', onFocus);
            supabase.removeChannel(channel);
        };
    }, [user?.id]);

    if (loading) return <ScreenLoader />;

    if (isPasswordRecovery) {
        return <Suspense fallback={<ScreenLoader />}><SetPasswordPage /></Suspense>;
    }

    const isAgent = user && (user.userType === 'agent' || user.userType === 'agent2');
    const isVendor = user && (user.userType === 'vendor');
    const isStamp = user && (user.userType === 'stamp');

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
            {!import.meta.env.DEV && <UpdateChecker />}
            <OfflineBanner />
            <Suspense fallback={<ScreenLoader />}>
                {!user ? (
                    <LoginScreen onLogin={setUser} />
                ) : isAgent ? (
                    <AgentPortal user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : isVendor ? (
                    <VendorPortal user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : isStamp ? (
                    <StampPortal user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : (
                    <Dashboard user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                )}
            </Suspense>

            {/* Secret Backdoor Switcher (Ctrl + Shift + S) */}
            {import.meta.env.DEV && (
                <Suspense fallback={null}>
                    <DevRoleSwitcher
                        currentUser={user}
                        onSwitchUser={setUser}
                        isOpen={devSwitcherOpen}
                        onToggle={setDevSwitcherOpen}
                    />
                </Suspense>
            )}
        </>
    );
}
