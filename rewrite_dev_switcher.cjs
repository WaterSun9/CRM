const fs = require('fs');

const content = `import { useState, useEffect } from 'react';
import { Settings2, X, Database, Search, LogIn, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { supabase } from '../supabase';

export default function DevRoleSwitcher({ currentUser, onSwitchUser, isOpen, onToggle, isDemoMode }) {
    const [searchEmail, setSearchEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                onToggle(!isOpen);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onToggle]);

    const handleImpersonate = async (e) => {
        e.preventDefault();
        if (!searchEmail.trim()) {
            setError('Please enter an email address.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: profile, error: err } = await supabase
                .from('profiles')
                .select('*')
                .ilike('email', searchEmail.trim())
                .maybeSingle();

            if (err) throw err;
            if (!profile) {
                setError('No user found with that email address. Make sure the user exists in User Management.');
                setLoading(false);
                return;
            }

            // Explicitly operate on the REAL Supabase website & database
            if (typeof window !== 'undefined') {
                window.sessionStorage.setItem('watersun_demo_mode', 'false');
            }

            onSwitchUser({
                id: profile.id, // Use their real DB id so actions save properly
                email: profile.email,
                userType: profile.user_type,
                role: profile.role,
                name: profile.name,
                channel_partner: profile.channel_partner,
                isDevRole: true
            });

            setSearchEmail('');
            onToggle(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {isOpen && (
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6">
                    <div
                        className="absolute inset-0 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200"
                        onClick={() => onToggle(false)}
                    />
                    
                    <div className="relative bg-white rounded-[24px] sm:rounded-[32px] w-full max-w-lg mx-auto shadow-2xl flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200 border border-stone-200 p-6 overflow-hidden">
                        
                        {/* Header */}
                        <div className="flex items-start justify-between flex-shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl">
                                    <Settings2 size={20} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-stone-900 uppercase tracking-wide">
                                        Universal Impersonation
                                    </h3>
                                    <p className="text-[11px] text-stone-500 font-medium">
                                        Log in as any user to test their real access view
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => onToggle(false)}
                                className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Real Database Connection Banner */}
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 mt-4 flex-shrink-0">
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
                                        Impersonation acts exactly as a real login, skipping the password requirement.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Search Form */}
                        <div className="py-6 flex-1">
                            <form onSubmit={handleImpersonate} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-stone-700 mb-1.5">
                                        Impersonate Email Address
                                    </label>
                                    <div className="relative">
                                        <Search className="absolute left-3.5 top-3 w-4 h-4 text-stone-400" />
                                        <input
                                            type="email"
                                            value={searchEmail}
                                            onChange={(e) => setSearchEmail(e.target.value)}
                                            placeholder="e.g. agent.rahul@watersun.com"
                                            className="w-full pl-10 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-400 transition-all text-stone-800"
                                            autoComplete="off"
                                            autoFocus
                                        />
                                    </div>
                                    <p className="text-[10px] text-stone-500 mt-2 font-medium">
                                        Enter the email of an account you created in User Management. You will instantly access their portal without a password.
                                    </p>
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 p-3 rounded-xl flex items-start gap-2 animate-in fade-in">
                                        <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                        <p className="text-xs text-red-700 font-semibold">{error}</p>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || !searchEmail.trim()}
                                    className="w-full bg-stone-900 hover:bg-stone-800 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
                                >
                                    {loading ? 'Authenticating...' : (
                                        <>
                                            <LogIn size={16} /> Force Login (Skip Password)
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>

                        {/* Footer */}
                        <div className="pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-400 flex-shrink-0">
                            <span className="text-[11px]">
                                💡 Tip: Press <kbd className="px-1.5 py-0.5 bg-stone-100 border border-stone-200 rounded font-mono text-[10px] text-stone-700 font-bold">Ctrl+Shift+S</kbd> anywhere to toggle.
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
`;

fs.writeFileSync('src/components/DevRoleSwitcher.jsx', content, 'utf8');
console.log("Rewrote DevRoleSwitcher.jsx to be a Universal Impersonator!");
