// ─── UserManagementView.jsx ───────────────────────────────────────────────────
// Admin view: list, create, role-update, and deactivate users.
// USER_TYPE_OPTIONS / ROLE_OPTIONS sourced from constants.js.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { logActivity } from '../utils';
import { ShieldCheck, Plus, RefreshCw, AlertTriangle, Eye, EyeOff, UserCog, X, KeyRound, Ban, Search, Edit2, Check, Loader2 } from 'lucide-react';

// ─── CreateUserModal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, currentUser }) {
    const isCP = currentUser?.user_type === 'channel_partner_office' || currentUser?.userType === 'channel_partner_office' || currentUser?.role === 'Channel Partner Office';
    const partnerName = (currentUser?.channel_partner || currentUser?.name || '').trim();
    const initialFormState = isCP 
        ? { name: '', email: '', password: '', role: 'Channel Partners', user_type: 'agent', channel_partner: partnerName }
        : { name: '', email: '', password: '', role: 'Office', user_type: 'sales' };
    const [form, setForm] = useState(initialFormState);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPw, setShowPw] = useState(false);
    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleCreate = async () => {
    const uppercaseName = form.name.toUpperCase().trim();
    if (!uppercaseName || !form.email.trim() || !form.password.trim()) {
        setError('Name, email, and password are required.');
        return;
    }

    const validateComplexity = (pw) => {
        if (pw.length < 8) return 'Password must be at least 8 characters.';
        if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter.';
        if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter.';
        if (!/[0-9]/.test(pw)) return 'Password must contain at least one number.';
        if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must contain at least one special character.';
        return null;
    };
    const complexityError = validateComplexity(form.password);
    if (complexityError) {
        setError(complexityError);
        return;
    }

    setSaving(true);
    setError('');

    try {
        const finalForm = { ...form, name: uppercaseName };
        const response = await supabase.functions.invoke('add_user', {
            body: { ...finalForm, action: 'create' },
        });

        if (response.error) {
            let message = response.error.message;

            try {
                const body = await response.error.context?.json();
                if (body?.error) {
                    message = body.error;
                }
            } catch (_) {
                // Ignore if the error body can't be parsed
            }

            throw new Error(message);
        }

        if (response.data?.error) {
            throw new Error(response.data.error);
        }



        logActivity(
            currentUser.id,
            'create',
            `Created new user: ${finalForm.name}`,
            `${finalForm.role} (${finalForm.user_type})`
        );

        onCreated();
    } catch (err) {
        setError(err.message || 'Failed to create user.');
    } finally {
        setSaving(false);
    }
};
    return (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden flex flex-col">
                <div className="bg-stone-900 px-5 py-4 flex justify-between items-center">
                    <div>
                        <h2 className="text-lg font-bold text-white">Create New User</h2>
                        <p className="text-stone-400 text-xs mt-0.5">They'll receive a login via email</p>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); handleCreate(); }} autoComplete="off">
                    {/* Hidden inputs to prevent aggressive browser credential autofill */}
                    <input type="text" name="fake_usernamenotused" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
                    <input type="password" name="fake_passwordnotused" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

                    <div className="p-4 space-y-3 overflow-y-auto">
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                                <p className="text-red-600 text-xs">{error}</p>
                            </div>
                        )}
                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">Full Name *</label>
                            <input 
                                type="text" 
                                value={form.name}
                                onChange={e => set('name', e.target.value.toUpperCase())}
                                autoComplete="off"
                                placeholder="e.g. RAHUL SHARMA"
                                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">Email *</label>
                            <input 
                                type="email" 
                                value={form.email}
                                onChange={e => set('email', e.target.value)}
                                autoComplete="off"
                                placeholder="user@example.com"
                                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" 
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-stone-600 mb-1">Temporary Password *</label>
                            <div className="relative">
                                <input 
                                    type={showPw ? 'text' : 'password'} 
                                    value={form.password} 
                                    onChange={e => set('password', e.target.value)}
                                    autoComplete="new-password"
                                    placeholder="Min. 8 characters"
                                    className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" 
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 text-stone-400 hover:text-stone-600">
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>
                        {!isCP && (
                            <div>
                                <label className="block text-xs font-medium text-stone-600 mb-1">Role *</label>
                                <select 
                                    value={APP_ROLES.find(r => r.user_type === form.user_type)?.id || 'office'} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        const selected = APP_ROLES.find(r => r.id === val);
                                        setForm(prev => ({
                                            ...prev,
                                            user_type: selected.user_type,
                                            role: selected.role
                                        }));
                                    }}
                                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white"
                                >
                                    {APP_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                            </div>
                        )}

                        {(form.user_type === 'channel_partner_office' || form.role === 'Channel Partner Office') && (
                            <div>
                                <label className="block text-xs font-medium text-stone-600 mb-1">
                                    Assigned Channel Partner Name *
                                </label>
                                <input 
                                    type="text" 
                                    value={form.channel_partner || ''} 
                                    onChange={e => set('channel_partner', e.target.value)}
                                    placeholder="e.g. Om Solar"
                                    autoComplete="off"
                                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" 
                                />
                                <p className="text-[10px] text-stone-400 mt-1">
                                    Person's Name is "{form.name || 'User'}". They will only see & manage leads for this Channel Partner.
                                </p>
                            </div>
                        )}
                    </div>
                    <div className="border-t p-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                            {saving ? 'Creating...' : <><UserCog className="w-4 h-4" /> Create User</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── UserManagementView ───────────────────────────────────────────────────────
export default function UserManagementView({ currentUser }) {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
    const [editingEmailId, setEditingEmailId] = useState(null);
    const [tempEmail, setTempEmail] = useState('');

    const handleUpdateEmail = async (profileId, newEmail) => {
        const cleanEmail = (newEmail || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            showToast('error', 'Please enter a valid email address.');
            return;
        }

        setActionLoading(profileId);
        try {
            // 1. Update database profile directly to ensure immediate UI and table sync
            const { error: profileDbErr } = await supabase
                .from('profiles')
                .update({ email: cleanEmail })
                .eq('id', profileId);

            if (profileDbErr) {
                console.error('Profile DB email update failed:', profileDbErr);
            }

            // 2. Update Supabase Auth email via edge function
            try {
                const response = await supabase.functions.invoke('add_user', {
                    body: { action: 'update_email', user_id: profileId, new_email: cleanEmail },
                });

                if (response.error) {
                    let message = response.error.message;
                    try {
                        const body = await response.error.context?.json();
                        if (body?.error) message = body.error;
                    } catch (_) {}
                    console.warn('Edge function auth email sync notice:', message);
                }
            } catch (edgeErr) {
                console.warn('Edge function unavailable, updated profile directly:', edgeErr);
            }

            // 3. Update local state profiles
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, email: cleanEmail } : p));
            showToast('success', 'Email updated successfully');
            logActivity(currentUser.id, 'update', `Updated email address for profile ID ${profileId} to ${cleanEmail}`, '');
        } catch (err) {
            console.error('Failed to update email:', err);
            showToast('error', err.message || 'Failed to update email');
        } finally {
            setActionLoading(null);
            setEditingEmailId(null);
        }
    };

    const filteredProfiles = (profiles || []).filter(p => {
        const q = (searchQuery || '').trim().toLowerCase();
        return !q ||
            String(p?.name || '').toLowerCase().includes(q) ||
            String(p?.email || '').toLowerCase().includes(q) ||
            String(p?.role || '').toLowerCase().includes(q);
    });

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const isCP = currentUser?.user_type === 'channel_partner_office' || currentUser?.userType === 'channel_partner_office' || currentUser?.role === 'Channel Partner Office';
    const partnerName = (currentUser?.channel_partner || currentUser?.name || '').trim();

    const fetchProfiles = async () => {
        setLoading(true);
        let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
        if (isCP) {
            if (currentUser?.id && partnerName) {
                query = query.or(`created_by.eq.${currentUser.id},channel_partner.ilike.${partnerName}`);
            } else if (currentUser?.id) {
                query = query.eq('created_by', currentUser.id);
            } else if (partnerName) {
                query = query.ilike('channel_partner', partnerName);
            }
        }
        const { data, error } = await query;
        if (!error && data) {
            if (isCP) {
                // For Channel Partner Office, show ONLY sub-agents under this partner / created by this CPO.
                // Filter out Admins, Super Admins, and other CPOs.
                const cpoFiltered = data.filter(p => 
                    p.id !== currentUser.id &&
                    p.user_type !== 'admin' &&
                    p.role !== 'Admin' &&
                    p.user_type !== 'channel_partner_office' &&
                    p.role !== 'Channel Partner Office' &&
                    (
                        (p.created_by && p.created_by === currentUser.id) ||
                        (partnerName && p.channel_partner && p.channel_partner.trim().toLowerCase() === partnerName.toLowerCase())
                    )
                );
                setProfiles(cpoFiltered);
            } else {
                setProfiles(data);
            }
        } else {
            setProfiles(data || []);
        }
        setLoading(false);
    };

    useEffect(() => { fetchProfiles(); }, [isCP, partnerName, currentUser?.id]);

    const handleUpdateRole = async (profileId, field, value) => {
        setActionLoading(profileId);
        const { error } = await supabase.from('profiles').update({ [field]: value }).eq('id', profileId);
        if (!error) {
            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, [field]: value } : p));
            logActivity(currentUser.id, 'update', `Updated ${field} for user profile`, value);
        }
        setActionLoading(null);
    };

    const handleResetPassword = async (email, name) => {
        setActionLoading(email);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: 'https://watersun9.github.io/CRM/',
            });
            if (error) throw error;
            showToast('success', `Password reset email sent to ${name}`);
            logActivity(currentUser.id, 'update', `Sent password reset to ${name}`, email);
        } catch (err) {
            showToast('error', `Failed: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };



    const deactivateUser = async (userId, name) => {
        if (!confirm(`Deactivate ${name}? They will no longer be able to log in, but their record stays.`)) return;

        setActionLoading(userId);
        try {
            const response = await supabase.functions.invoke('add_user', {
                body: { action: 'deactivate', user_id: userId },
            });

            if (response.error) {
                let message = response.error.message;
                try {
                    const body = await response.error.context?.json();
                    if (body?.error) message = body.error;
                } catch (_) {}
                throw new Error(message);
            }

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'inactive' } : p));
            showToast('success', `${name} has been deactivated`);
            logActivity(currentUser.id, 'update', `Deactivated user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to deactivate: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const reactivateUser = async (userId, name) => {
        setActionLoading(userId);
        try {
            const response = await supabase.functions.invoke('add_user', {
                body: { action: 'reactivate', user_id: userId },
            });

            if (response.error) {
                let message = response.error.message;
                try {
                    const body = await response.error.context?.json();
                    if (body?.error) message = body.error;
                } catch (_) {}
                throw new Error(message);
            }

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'active' } : p));
            showToast('success', `${name} has been reactivated`);
            logActivity(currentUser.id, 'update', `Reactivated user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to reactivate: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const deleteUser = async (userId, name) => {
        if (!confirm(`⚠️ PERMANENTLY DELETE ${name}? This cannot be undone. Their account and profile will be completely removed.`)) return;
        if (!confirm(`Are you absolutely sure? Type-to-confirm: Delete ${name} forever?`)) return;

        setActionLoading(userId);
        try {
            const response = await supabase.functions.invoke('add_user', {
                body: { action: 'delete', user_id: userId },
            });

            if (response.error) {
                let message = response.error.message;
                try {
                    const body = await response.error.context?.json();
                    if (body?.error) message = body.error;
                } catch (_) {}
                throw new Error(message);
            }

            if (response.data?.error) {
                throw new Error(response.data.error);
            }

            setProfiles(prev => prev.filter(p => p.id !== userId));
            showToast('success', `${name} has been permanently deleted`);
            logActivity(currentUser.id, 'delete', `Permanently deleted user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to delete: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-stone-900 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-4xl mx-auto space-y-4">
            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-medium flex items-center gap-2 animate-in slide-in-from-right transition-all ${
                    toast.type === 'success'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        : 'bg-red-50 border-red-200 text-red-700'
                }`}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-stone-400" />
                    <p className="text-sm text-stone-500">{filteredProfiles.length} of {profiles.length} users</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={fetchProfiles} className="p-2 border border-stone-200 rounded-xl text-stone-500 hover:bg-stone-50 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-stone-800 transition-colors">
                        <Plus className="w-4 h-4" /> Create User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-100 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="relative border-b border-stone-100 p-4">
                    <Search className="absolute left-7 top-6 w-4 h-4 text-stone-400" />
                    <input
                        type="text"
                        placeholder="Search users by name or email..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 placeholder:text-stone-400"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-stone-100 bg-stone-50">
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">User</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Role</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Status</th>
                                <th className="text-left px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Joined</th>
                                <th className="text-right px-4 py-3 text-[10px] font-bold text-stone-400 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-50">
                            {filteredProfiles.map(profile => {
                                const isInactive = profile.status === 'inactive';
                                const isYou = profile.id === currentUser.id;
                                return (
                                <tr key={profile.id} className={`transition-colors ${isInactive ? 'bg-stone-50/50 opacity-60' : 'hover:bg-stone-50'}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isInactive ? 'bg-stone-400' : 'bg-stone-900'}`}>
                                                {profile.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-semibold ${isInactive ? 'text-stone-400' : 'text-stone-800'}`}>{profile.name || 'Unnamed'}</p>
                                                {editingEmailId === profile.id ? (
                                                    <div className="flex items-center gap-1.5 mt-1 max-w-xs animate-in fade-in duration-150">
                                                        <input
                                                            type="email"
                                                            value={tempEmail}
                                                            onChange={e => setTempEmail(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleUpdateEmail(profile.id, tempEmail.trim());
                                                                if (e.key === 'Escape') setEditingEmailId(null);
                                                            }}
                                                            className="px-2.5 py-1 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-medium shadow-xs"
                                                            placeholder="New email address..."
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateEmail(profile.id, tempEmail.trim())}
                                                            disabled={actionLoading === profile.id}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 flex-shrink-0"
                                                            title="Save Email (Enter)"
                                                        >
                                                            {actionLoading === profile.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Check className="w-3.5 h-3.5" />
                                                            )}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingEmailId(null)}
                                                            className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer flex-shrink-0"
                                                            title="Cancel (Esc)"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 mt-0.5 group/email">
                                                        <p className="text-xs text-stone-500 font-medium truncate">{profile.email || '–'}</p>
                                                        {!isInactive && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingEmailId(profile.id);
                                                                    setTempEmail(profile.email || '');
                                                                }}
                                                                className="p-1 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-all cursor-pointer opacity-70 group-hover/email:opacity-100"
                                                                title="Edit Email Address"
                                                            >
                                                                <Edit2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {isYou || isInactive || isCP ? (
                                            <div>
                                                <span className="text-xs font-semibold text-stone-600">
                                                    {APP_ROLES.find(r => r.user_type === profile.user_type)?.label || profile.role || 'Admin'}
                                                </span>
                                                {(profile.user_type === 'channel_partner_office' || profile.role === 'Channel Partner Office') && (
                                                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Partner: {profile.channel_partner || profile.name}</p>
                                                )}
                                            </div>
                                        ) : (
                                            <div>
                                                <select 
                                                    value={APP_ROLES.find(r => r.user_type === profile.user_type)?.id || 'office'} 
                                                    disabled={actionLoading === profile.id}
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        const selected = APP_ROLES.find(r => r.id === val);
                                                        setActionLoading(profile.id);
                                                        const { error } = await supabase.from('profiles').update({
                                                            user_type: selected.user_type,
                                                            role: selected.role
                                                        }).eq('id', profile.id);
                                                        if (!error) {
                                                            setProfiles(prev => prev.map(p => p.id === profile.id ? { ...p, user_type: selected.user_type, role: selected.role } : p));
                                                            logActivity(currentUser.id, 'update', `Updated role for ${profile.name} to ${selected.label}`, '');


                                                        }
                                                        setActionLoading(null);
                                                    }}
                                                    className="px-2.5 py-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-amber-300"
                                                >
                                                    {APP_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                                </select>
                                                {(profile.user_type === 'channel_partner_office' || profile.role === 'Channel Partner Office') && (
                                                    <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Partner: {profile.channel_partner || profile.name}</p>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        {isInactive ? (
                                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">Inactive</span>
                                        ) : (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">Active</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-xs text-stone-500">
                                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN') : '–'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-1 justify-end flex-wrap">
                                            {isYou ? (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold">You</span>
                                            ) : isInactive ? (
                                                /* ── Inactive user actions ── */
                                                <>
                                                    <button
                                                        onClick={() => reactivateUser(profile.id, profile.name)}
                                                        disabled={actionLoading === profile.id}
                                                        title="Reactivate this user"
                                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Reactivate</span>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(profile.id, profile.name)}
                                                        disabled={actionLoading === profile.id}
                                                        title="Permanently delete this user"
                                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Delete</span>
                                                    </button>
                                                </>
                                            ) : (
                                                /* ── Active user actions ── */
                                                <>
                                                    <button
                                                        onClick={() => handleResetPassword(profile.email, profile.name)}
                                                        disabled={actionLoading === profile.email}
                                                        title="Send password reset email"
                                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                                                    >
                                                        <KeyRound className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Reset Pwd</span>
                                                    </button>

                                                    <button
                                                        onClick={() => deactivateUser(profile.id, profile.name)}
                                                        disabled={actionLoading === profile.id}
                                                        title="Deactivate this user"
                                                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-stone-600 hover:text-orange-700 hover:bg-orange-50 rounded-lg transition-colors font-medium disabled:opacity-50"
                                                    >
                                                        <Ban className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Deactivate</span>
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showCreateModal && (
                <CreateUserModal
                    onClose={() => setShowCreateModal(false)}
                    onCreated={() => { setShowCreateModal(false); fetchProfiles(); }}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
}
