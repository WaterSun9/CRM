import { useState } from 'react';
import { supabase } from '../supabase';
import BrandMark from './BrandMark';
import { Mail, Lock, Eye, EyeOff, ArrowLeft, KeyRound, LogIn } from 'lucide-react';

export default function LoginScreen({ onLogin, initialError = '' }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(initialError);
    const [loading, setLoading] = useState(false);
    const [showPw, setShowPw] = useState(false);
    const [showForgot, setShowForgot] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetStatus, setResetStatus] = useState(''); // 'sent' | 'error' | ''
    const [resetError, setResetError] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Sign out any old sessions first
            await supabase.auth.signOut();
            await new Promise(res => setTimeout(res, 50));

            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password
            });

            if (authError) throw authError;
            if (!authData?.user) throw new Error('Login failed. Please verify your credentials.');

            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', authData.user.id)
                .single();

            if (profileError || !profile) {
                console.error('Profile query failed:', profileError);
                await supabase.auth.signOut();
                throw new Error('User profile not found. Please contact your administrator.');
            }

            if (profile.status === 'inactive') {
                await supabase.auth.signOut();
                throw new Error('Your account has been deactivated. Please contact your administrator.');
            }

            onLogin({
                id: authData.user.id,
                email: authData.user.email,
                name: profile.name,
                role: profile.role,
                userType: profile.user_type,
                channel_partner: profile.channel_partner || profile.name || '',
            });
        } catch (err) {
            console.error('Authentication error:', err);
            setError(err.message || 'Invalid email or password. Please try again.');
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        if (!resetEmail.trim()) { setResetError('Please enter your email address.'); return; }
        setResetLoading(true);
        setResetError('');
        setResetStatus('');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
                redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
            });
            if (error) throw error;
            setResetStatus('sent');
        } catch (err) {
            setResetError(err.message);
            setResetStatus('error');
        } finally {
            setResetLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4 sm:p-6">
            <div className="bg-white p-8 sm:p-10 rounded-[32px] shadow-2xl w-full max-w-md text-center border border-stone-200 animate-in fade-in zoom-in-95 duration-200">
                <BrandMark size="lg" className="justify-center mb-5" />
                <h1 className="text-lg font-black text-stone-900 tracking-tight">Customer Relationship Manager</h1>
                <p className="text-stone-400 font-semibold text-xs mb-8 mt-1">Solar Operations &amp; Management Portal</p>

                {!showForgot ? (
                    /* ─── Login Form ─── */
                    <form onSubmit={handleLogin} autoComplete="off">
                        <div className="space-y-3.5 mb-4 text-left">
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-stone-400" />
                                <input
                                    type="email"
                                    placeholder="Email Address"
                                    required
                                    value={email}
                                    autoComplete="email"
                                    onChange={e => setEmail(e.target.value)}
                                    className="w-full pl-11 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 outline-none font-semibold text-stone-800 focus:border-amber-400 focus:bg-white transition-all text-xs"
                                />
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-stone-400" />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    placeholder="Password"
                                    required
                                    value={password}
                                    autoComplete="current-password"
                                    onChange={e => setPassword(e.target.value)}
                                    className="w-full pl-11 pr-11 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 outline-none font-semibold text-stone-800 focus:border-amber-400 focus:bg-white transition-all text-xs"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-4 top-3.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="text-right mb-5">
                            <button
                                type="button"
                                onClick={() => { setShowForgot(true); setResetEmail(email); setResetStatus(''); setResetError(''); }}
                                className="text-[11px] text-amber-600 hover:text-amber-700 font-bold hover:underline transition-colors cursor-pointer"
                            >
                                Forgot Password?
                            </button>
                        </div>

                        {error && (
                            <p className="text-rose-600 text-xs mb-4 bg-rose-50 p-3 rounded-xl border border-rose-200 font-semibold text-left">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-stone-900 text-white py-3.5 rounded-2xl font-extrabold hover:bg-stone-800 transition-all shadow-lg shadow-stone-300 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer text-xs uppercase tracking-wider"
                        >
                            {loading ? 'Authenticating...' : <><LogIn size={15} /> Sign In</>}
                        </button>
                    </form>
                ) : (
                    /* ─── Forgot Password Form ─── */
                    <form onSubmit={handleForgotPassword}>
                        <div className="mb-6">
                            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                <KeyRound className="w-5 h-5 text-amber-600" />
                            </div>
                            <p className="text-stone-600 text-xs font-medium">Enter your email and we'll send you a link to reset your password.</p>
                        </div>
                        <div className="space-y-4 mb-6">
                            <div className="relative">
                                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-stone-400" />
                                <input type="email" placeholder="Email Address" required value={resetEmail}
                                    onChange={e => setResetEmail(e.target.value)}
                                    className="w-full pl-11 p-3.5 bg-stone-50 rounded-2xl border border-stone-200 outline-none font-semibold text-stone-800 focus:border-amber-400 transition-all text-xs" />
                            </div>
                        </div>
                        {resetStatus === 'sent' && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4">
                                <p className="text-emerald-700 text-xs font-bold">✓ Reset link sent! Check your inbox.</p>
                            </div>
                        )}
                        {resetError && (
                            <p className="text-red-500 text-xs mb-4 bg-red-50 p-2 rounded-xl border border-red-200">{resetError}</p>
                        )}
                        <button type="submit" disabled={resetLoading || resetStatus === 'sent'}
                            className="w-full bg-stone-900 text-white py-3.5 rounded-2xl font-bold hover:bg-stone-800 transition-all shadow-lg shadow-stone-200 flex items-center justify-center gap-2 disabled:opacity-60 mb-4 cursor-pointer text-xs">
                            {resetLoading ? 'Sending...' : resetStatus === 'sent' ? 'Email Sent ✓' : 'Send Reset Link'}
                        </button>
                        <button type="button" onClick={() => { setShowForgot(false); setResetStatus(''); setResetError(''); }}
                            className="flex items-center justify-center gap-1.5 text-xs text-stone-500 hover:text-stone-700 font-bold mx-auto transition-colors cursor-pointer">
                            <ArrowLeft className="w-3.5 h-3.5" /> Back to Login
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
