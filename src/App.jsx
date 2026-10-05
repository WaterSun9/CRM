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
import { Sun, MessageCircle, Wrench, X } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import SetPasswordPage from './components/SetPassword';
import UpdateChecker from './components/UpdateChecker';
import OfflineBanner from './components/OfflineBanner';
import { lazy } from 'react';
import { DIRECT_MESSAGES_ENABLED, ROLE_PREVIEW_CHAT_ENABLED, TECHNICIAN_FEATURE_ENABLED } from './constants';

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
const TeamChat = lazyWithRetry(() => import('./components/TeamChat'));
import useChatUnread from './hooks/useChatUnread';
const ServiceIssuesView = lazyWithRetry(() => import('./components/ServiceIssuesView'));
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
    const [showTeamChat, setShowTeamChat] = useState(false);
    const [showServiceIssues, setShowServiceIssues] = useState(false);
    const [issueCustomer, setIssueCustomer] = useState(null);

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
                // Read the locally cached session first so the independent remote
                // Auth and Profile checks can run together instead of serially.
                // We still refuse access unless getUser confirms the token.
                const { data: sessionData } = await supabase.auth.getSession();
                const sessionUser = sessionData?.session?.user;
                if (!sessionUser) {
                    setUser(null);
                    setLoading(false);
                    return;
                }
                const [userResult, profileResult] = await Promise.all([
                    supabase.auth.getUser(),
                    supabase.from('profiles').select('*').eq('id', sessionUser.id).maybeSingle()
                ]);
                const { data: userData, error: userError } = userResult;
                if (userError || !userData?.user) {
                    // Token expired or no session
                    setUser(null);
                    setLoading(false);
                    return;
                }

                const authUser = userData.user;
                try {
                    const { data: profile, error: profileError } = profileResult;

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
        if (!user?.id || user.previewOnly) return undefined;

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
            // A mobile tab returning from Camera/Gallery may briefly be offline.
            // Only an absent session or a definite Auth rejection should end it;
            // a transient fetch failure must not throw the user out mid-upload.
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData?.session) {
                setAuthError('Your session has expired. Please sign in again.');
                await endSession('session missing or expired');
                return;
            }

            // 1. Verify token is genuinely valid on Supabase Auth server
            const { data: authData, error: authErr } = await supabase.auth.getUser();
            if (authErr) {
                const definiteAuthFailure = [401, 403].includes(authErr.status)
                    || /invalid.*(jwt|token)|expired.*(jwt|token)|session.*(missing|expired)|not authenticated/i.test(authErr.message || '');
                if (!definiteAuthFailure) {
                    console.warn('Session verification deferred after a temporary connection error:', authErr.message);
                    return;
                }
                setAuthError('Your session has expired. Please sign in again.');
                await endSession('session expired or token invalidated');
                return;
            }
            if (!authData?.user) {
                setAuthError('Your session has expired. Please sign in again.');
                await endSession('authenticated user missing');
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
        // Startup already performed these exact two checks. Avoid immediately
        // repeating them while the first dashboard queries are loading.
        // Periodic heartbeat every 2 minutes detects later invalidation.
        const heartbeatInterval = setInterval(verifyStillActive, 2 * 60 * 1000);

        return () => {
            window.removeEventListener('focus', onFocus);
            clearInterval(heartbeatInterval);
            supabase.removeChannel(channel);
        };
    }, [user?.id, user?.previewOnly]);

    // Unread chat messages, shown as a number on the chat button. Off in Role
    // Preview (that session is the admin's) and for hidden technician accounts.
    const chatUnread = useChatUnread(user, {
        enabled: Boolean(user && !user.isDevRole && (user.userType !== 'technician' || TECHNICIAN_FEATURE_ENABLED))
    });
    useEffect(() => {
        const base = document.title.replace(/^\(\d+\+?\)\s*/, '');
        document.title = chatUnread > 0 ? `(${chatUnread > 99 ? '99+' : chatUnread}) ${base}` : base;
    }, [chatUnread]);

    if (loading) return <ScreenLoader />;

    if (isPasswordRecovery) {
        return <Suspense fallback={<ScreenLoader />}><SetPasswordPage /></Suspense>;
    }

    const isAgent = user && (user.userType === 'agent' || user.userType === 'agent2');
    const isVendor = user && (user.userType === 'vendor');
    const isStamp = user && (user.userType === 'stamp');
    const isTechnician = user && user.userType === 'technician';
    const canRaiseServiceIssue = TECHNICIAN_FEATURE_ENABLED && user && ['admin', 'sales', 'channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2'].includes(user.userType);

    const handleLogout = async () => {
        setAuthError('');
        setShowTeamChat(false);
        setShowServiceIssues(false);
        setIssueCustomer(null);
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
                    <AgentPortal user={user} onLogout={handleLogout} onRaiseServiceIssue={canRaiseServiceIssue ? customer => { setIssueCustomer(customer); setShowServiceIssues(true); setShowTeamChat(false); } : undefined} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : isVendor ? (
                    <VendorPortal user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : isStamp ? (
                    <StampPortal user={user} onLogout={handleLogout} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                ) : isTechnician && TECHNICIAN_FEATURE_ENABLED ? (
                    <div className="min-h-screen bg-[#FCFBFA]"><header className="flex items-center justify-between border-b bg-white p-4"><strong>Technician Portal</strong><button type="button" onClick={handleLogout} className="rounded-lg border px-3 py-2 text-xs font-bold">Logout</button></header><ServiceIssuesView user={user} /></div>
                ) : isTechnician ? (
                    <div className="min-h-screen bg-[#FCFBFA] flex flex-col items-center justify-center gap-4 p-6"><p className="text-sm text-stone-600">This portal is temporarily unavailable.</p><button type="button" onClick={handleLogout} className="rounded-lg border px-4 py-2 text-xs font-bold">Logout</button></div>
                ) : (
                    <Dashboard user={user} onLogout={handleLogout} onRaiseServiceIssue={canRaiseServiceIssue ? customer => { setIssueCustomer(customer); setShowServiceIssues(true); setShowTeamChat(false); } : undefined} onOpenDevSwitcher={import.meta.env.DEV ? () => setDevSwitcherOpen(true) : undefined} />
                )}
            </Suspense>

            {canRaiseServiceIssue && <>
                <button type="button" onClick={() => { setIssueCustomer(null); setShowServiceIssues(true); setShowTeamChat(false); }} aria-label="Open field service issues"
                    className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-amber-500 px-4 py-3 text-stone-950 shadow-xl sm:bottom-6 sm:left-6">
                    <Wrench size={18} /><span className="text-xs font-bold">Service issues</span>
                </button>
                {showServiceIssues && <div role="dialog" aria-label={issueCustomer ? 'Raise a service issue' : 'Field Service Management'} aria-modal="true" className={issueCustomer ? 'fixed inset-0 z-[90] flex items-center justify-center bg-stone-950/60 p-3 sm:p-6' : 'fixed inset-0 z-[60] overflow-y-auto bg-[#FCFBFA]'}>
                    <div className={issueCustomer ? 'w-full max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl bg-white p-3 shadow-2xl sm:p-5' : ''}>
                        <div className="sticky top-0 z-10 flex justify-end border-b bg-white p-2"><button type="button" onClick={() => { setShowServiceIssues(false); setIssueCustomer(null); }} aria-label="Close service issues" className="rounded-lg border p-2"><X size={20} /></button></div>
                        <Suspense fallback={<ScreenLoader />}><ServiceIssuesView key={issueCustomer?.id || 'all-issues'} user={user} initialCustomer={issueCustomer} formOnly={Boolean(issueCustomer)} /></Suspense>
                    </div>
                </div>}
            </>}

            {user?.isDevRole && !ROLE_PREVIEW_CHAT_ENABLED && <div role="status" className="fixed bottom-4 right-4 z-40 max-w-72 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs font-semibold text-amber-950 shadow-lg sm:bottom-6 sm:right-6">
                Chat is hidden in Role Preview. Sign in as that account to test its messages and permissions.
            </div>}
            {user && (!user.isDevRole || (import.meta.env.DEV && ROLE_PREVIEW_CHAT_ENABLED)) && (!isTechnician || TECHNICIAN_FEATURE_ENABLED) && <>
                {showTeamChat && <div className={`fixed inset-0 z-50 overflow-hidden bg-white shadow-2xl sm:inset-x-auto sm:inset-y-auto sm:bottom-20 sm:right-6 ${['admin', 'sales'].includes(user.userType) || DIRECT_MESSAGES_ENABLED ? 'sm:h-[min(80dvh,720px)] sm:w-[min(760px,calc(100vw-3rem))]' : 'sm:h-[min(70dvh,560px)] sm:w-[380px]'} sm:rounded-2xl`}>
                    <Suspense fallback={<ScreenLoader />}><TeamChat user={user} previewMode={Boolean(import.meta.env.DEV && user.isDevRole)} onClose={() => setShowTeamChat(false)} /></Suspense>
                </div>}
                <button type="button" onClick={() => setShowTeamChat(open => !open)}
                    aria-label={showTeamChat ? 'Close chat' : chatUnread > 0 ? `Open chat, ${chatUnread} unread` : 'Open chat'} aria-expanded={showTeamChat}
                    className="fixed bottom-4 right-4 z-40 flex h-11 w-11 items-center justify-center gap-2 rounded-full bg-stone-900 text-white shadow-xl hover:bg-stone-800 sm:bottom-6 sm:right-6 sm:h-auto sm:w-auto sm:px-4 sm:py-3">
                    {showTeamChat ? <X size={18} /> : <MessageCircle size={18} />}<span className="hidden text-xs font-bold sm:inline">{showTeamChat ? 'Close chat' : 'Chat'}</span>
                    {chatUnread > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-bold leading-none text-white ring-2 ring-white">{chatUnread > 99 ? '99+' : chatUnread}</span>}
                </button>
            </>}

            {/* Secret Backdoor Switcher (Ctrl + Shift + S) */}
            {import.meta.env.DEV && (
                <Suspense fallback={null}>
                    <DevRoleSwitcher
                        currentUser={user}
                        onSwitchUser={previewUser => { setShowTeamChat(false); setUser(previewUser); }}
                        isOpen={devSwitcherOpen}
                        onToggle={setDevSwitcherOpen}
                    />
                </Suspense>
            )}
        </>
    );
}
