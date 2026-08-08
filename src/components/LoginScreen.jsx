// ─── LoginScreen.jsx ──────────────────────────────────────────────────────────
import { useState } from 'react';
import { supabase } from '../supabase';
import { Mail, User, Eye, EyeOff, Sparkles, Sun } from 'lucide-react';

export default function LoginScreen({ onLogin }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            // Sign out any existing session first to prevent auto-redirect issues
            await supabase.auth.signOut();
            await new Promise(res => setTimeout(res, 100));

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(), password,
            });
            if (authError) throw authError;
            if (!authData?.user) throw new Error('Login failed. Please try again.');

            const { data: profile, error: profileError } = await supabase
                .from('profiles').select('*').eq('id', authData.user.id).single();
            if (profileError || !profile) {
                await supabase.auth.signOut();
                throw new Error('Profile not found. Contact Admin.');
            }
            onLogin({
                id: authData.user.id,
                email: authData.user.email,
                name: profile.name,
                role: profile.role,
                userType: profile.user_type,
            });
        } catch (err) {
            setError(err.message);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-50 p-6">
            <form onSubmit={handleLogin} className="bg-white p-12 rounded-[40px] shadow-xl w-full max-w-md text-center border border-stone-100">
                <div className="w-16 h-16 bg-amber-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-8 shadow-lg shadow-amber-200">
                    <Sun size={32} />
                </div>
                <h1 className="text-2xl font-bold text-stone-800 tracking-tight">Watersun</h1>
                <p className="text-stone-400 font-medium text-xs mb-10 mt-1">Administrative Management Portal</p>
                <div className="space-y-4 mb-8">
                    <div className="relative">
                        <Mail className="absolute left-4 top-3.5 w-4 h-4 text-stone-400" />
                        <input type="email" placeholder="Email Address" required value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-11 p-3.5 bg-stone-50 rounded-2xl border border-stone-100 outline-none font-medium focus:border-amber-400 transition-all text-sm" />
                    </div>
                    <div className="relative">
                        <User className="absolute left-4 top-3.5 w-4 h-4 text-stone-400" />
                        <input type={showPw ? 'text' : 'password'} placeholder="Password" required value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full pl-11 pr-11 p-3.5 bg-stone-50 rounded-2xl border border-stone-100 outline-none font-medium focus:border-amber-400 transition-all text-sm" />
                        <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-3.5 text-stone-400 hover:text-stone-600">
                            {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
                {error && <p className="text-red-500 text-xs mb-4 bg-red-50 p-2 rounded-xl">{error}</p>}
                <button type="submit" disabled={loading}
                    className="w-full bg-stone-800 text-white py-4 rounded-2xl font-bold hover:bg-stone-900 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? 'Entering Portal...' : <><Sparkles size={16} /> Access Portal</>}
                </button>
            </form>
        </div>
    );
}
