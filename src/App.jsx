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
    const [authError, setAuthError] = useState('');

    useEffect(() => {
        // ── Detect auth errors or recovery link from URL hash ──
        const hash = window.location.hash;
        if (hash) {
            // Check for Supabase error in hash (e.g. #error=access_denied&error_code=otp_expired)
            if (hash.includes('error=') || hash.includes('error_code=')) {
                try {
                    const params = new URLSearchParams(hash.replace(/^#/, ''));
                    const errorCode = params.get('error_code') || '';
                    const errorDescription = params.get('error_description') || '';
                    let userFriendlyMsg = 'Your login link has expired or is invalid. Please sign in with your email and password.';
                    if (errorCode === 'otp_expired' || errorDescription.toLowerCase().includes('expired')) {
                        userFriendlyMsg = 'The email link has expired. Please sign in or request a new reset link.';
                    } else if (errorDescription) {
                        userFriendlyMsg = decodeURIComponent(errorDescription.replace(/\+/g, ' '));
                    }
                    setAuthError(userFriendlyMsg);
                } catch {
                    setAuthError('Your login link has expired or is invalid. Please sign in again.');
                }

                // Cleanly strip the error hash from browser address bar
                if (typeof window !== 'undefined' && window.history?.replaceState) {
                    window.history.replaceState(null, '', window.location.pathname + window.location.search);
                }

                // Clear any stale credentials and state
                if (typeof window !== 'undefined') {
                    Object.keys(localStorage).forEach(k => { if (k.startsWith('sb-')) localStorage.removeItem(k); });
                    Object.keys(sessionStorage).forEach(k => { if (k.startsWith('sb-')) sessionStorage.removeItem(k); });
                }
                void supabase.auth.signOut();
                setUser(null);
                setLoading(false);
                return;
            }

            // Supabase appends #type=recovery to the redirect URL
            if (hash.includes('type=recovery')) {
                setIsPasswordRecovery(true);
                setLoading(false);
            }
        }

        // Restore session on page load
        const restoreSession = async () => {
            // Skip normal login flow if we're in password recovery
            if (isPasswordRecovery) { setLoading(false); return; }

            try {
                // Verify with Supabase auth server that the token is genuinely active & valid
                const { data: userData, error: userError } = await supabase.auth.getUser();
                if (userError || !userData?.user) {
                    // Token expired or no session
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const authUser = userData.user;
                try {
                    const { data: profile, error: profileError } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('id', authUser.id)
                        .maybeSingle();

                    if (profileError) {
                        console.warn('Profile fetch warning:', profileError);
                    }

                    if (profile && profile.status !== 'inactive') {
                        setUser({
                            id: authUser.id,
                            email: authUser.email,
                            name: profile.name || authUser.email?.split('@')[0] || 'User',
                            role: profile.role || 'User',
                            userType: profile.user_type || 'sales',
                            channel_partner: profile.channel_partner || profile.name || '',
                        });
                    } else if (profile && profile.status === 'inactive') {
                        await supabase.auth.signOut();
                        setUser(null);
                    } else {
                        console.error('No profile row for authenticated user; signing out.', authUser.id);
                        await supabase.auth.signOut();
                        setUser(null);
                    }
                } catch (fetchErr) {
                    console.error('Failed to fetch profile row on startup; refusing to assume a role.', fetchErr);
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
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_OUT') {
                setUser(null);
            } else if (event === 'PASSWORD_RECOVERY') {
                setIsPasswordRecovery(true);
                setLoading(false);
            } else if (event === 'TOKEN_REFRESHED' && !session) {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    // ── Enforce deactivation & session validity mid-session ────────────────
    // Watch this user's own profile row, periodically verify token validity with
    // Supabase auth server, and re-check on tab focus to eliminate ghost sessions.
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
            // 1. Verify token is genuinely valid on Supabase Auth server
            const { data: authData, error: authErr } = await supabase.auth.getUser();
            if (authErr || !authData?.user) {
                setAuthError('Your session has expired. Please sign in again.');
                await endSession('session expired or token invalidated');
                return;
            }

            // 2. Verify profile is still active
            const { data, error } = await supabase
                .from('profiles')
                .select('status')
                .eq('id', user.id)
                .maybeSingle();

            if (!error && (!data || data.status === 'inactive')) {
                setAuthError('Your account has been deactivated. Please contact an administrator.');
                await endSession(!data ? 'profile row removed' : 'account deactivated');
            }
        };

        const channel = supabase
            .channel(`profile_status_${user.id}`)
            .on('postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
                payload => {
                    if (payload.new?.status === 'inactive') {
                        setAuthError('Your account has been deactivated. Please contact an administrator.');
                        endSession('account deactivated');
                    }
                })
            .subscribe();

        const onFocus = () => verifyStillActive();
        window.addEventListener('focus', onFocus);
        verifyStillActive();

        // Periodic heartbeat every 2 minutes to detect background token expiration
        const heartbeatInterval = setInterval(verifyStillActive, 2 * 60 * 1000);

        return () => {
            window.removeEventListener('focus', onFocus);
            clearInterval(heartbeatInterval);
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
        setAuthError('');
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
                    <LoginScreen onLogin={(userData) => { setAuthError(''); setUser(userData); }} initialError={authError} />
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
