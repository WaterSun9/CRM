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

import { useState, useEffect } from 'react';
import { supabase } from './supabase';
import { Sun } from 'lucide-react';
import LoginScreen from './components/LoginScreen';
import Dashboard from './components/Dashboard';
import SetPasswordPage from './components/SetPassword';

export default function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);


    useEffect(() => {
        // Restore session on page load
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const { data: profile } = await supabase
                    .from('profiles').select('*').eq('id', session.user.id).single();
                if (profile) {
                    setUser({
                        id: session.user.id,
                        email: session.user.email,
                        name: profile.name,
                        role: profile.role,
                        userType: profile.user_type,
                    });
                } else {
                    // Profile missing — force sign out so login form shows
                    await supabase.auth.signOut();
                }
            }
            setLoading(false);
        });

        // Only respond to sign-out; sign-in is handled by LoginScreen via onLogin
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
            if (event === 'SIGNED_OUT') setUser(null);
            if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true); // NEW
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-stone-900">
            <Sun className="animate-spin text-amber-500" size={40} />
        </div>
    );

    if (isPasswordRecovery) {
        return <SetPasswordPage />;
    }

    return !user
        ? <LoginScreen onLogin={setUser} />
        : <Dashboard
            user={user}
            onLogout={async () => { await supabase.auth.signOut(); setUser(null); }}
        />;
}