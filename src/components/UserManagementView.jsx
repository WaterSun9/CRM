// ─── UserManagementView.jsx ───────────────────────────────────────────────────
// Admin view: list, create, role-update, and deactivate users.
// USER_TYPE_OPTIONS / ROLE_OPTIONS sourced from constants.js.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { logActivity } from '../utils';
import { APP_ROLES } from '../constants';
import { ShieldCheck, Plus, RefreshCw, AlertTriangle, Eye, EyeOff, UserCog, X, KeyRound, Ban } from 'lucide-react';

// ─── CreateUserModal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, currentUser }) {
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'Office', user_type: 'sales' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPw, setShowPw] = useState(false);
    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleCreate = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
        setError('Name, email, and password are required.');
        return;
    }

    if (form.password.length < 8) {
        setError('Password must be at least 8 characters.');
        return;
    }

    setSaving(true);
    setError('');

    try {
        const response = await supabase.functions.invoke('add_user', {
            body: { ...form, action: 'create' },
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
            `Created new user: ${form.name}`,
            `${form.role} (${form.user_type})`
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
                <div className="p-4 space-y-3 overflow-y-auto">
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-red-600 text-xs">{error}</p>
                        </div>
                    )}
                    {[{ label: 'Full Name *', field: 'name', type: 'text' }, { label: 'Email *', field: 'email', type: 'email' }].map(({ label, field, type }) => (
                        <div key={field}>
                            <label className="block text-xs font-medium text-stone-600 mb-1">{label}</label>
                            <input type={type} value={form[field]} onChange={e => set(field, e.target.value)}
                                className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                        </div>
                    ))}
                    <div>
                        <label className="block text-xs font-medium text-stone-600 mb-1">Temporary Password *</label>
                        <div className="relative">
                            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
                                placeholder="Min. 8 characters"
                                className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                            <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 text-stone-400 hover:text-stone-600">
                                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
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
                </div>
                <div className="border-t p-4 flex gap-3">
                    <button onClick={onClose} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium">Cancel</button>
                    <button onClick={handleCreate} disabled={saving}
                        className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                        {saving ? 'Creating...' : <><UserCog className="w-4 h-4" /> Create User</>}
                    </button>
                </div>
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
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchProfiles = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('profiles')
            .select('*').order('created_at', { ascending: false });
        if (!error) setProfiles(data || []);
        setLoading(false);
    };

    useEffect(() => { fetchProfiles(); }, []);

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
                    <p className="text-sm text-stone-500">{profiles.length} users registered</p>
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
                            {profiles.map(profile => {
                                const isInactive = profile.status === 'inactive';
                                const isYou = profile.id === currentUser.id;
                                return (
                                <tr key={profile.id} className={`transition-colors ${isInactive ? 'bg-stone-50/50 opacity-60' : 'hover:bg-stone-50'}`}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${isInactive ? 'bg-stone-400' : 'bg-stone-900'}`}>
                                                {profile.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                            </div>
                                            <div>
                                                <p className={`font-semibold ${isInactive ? 'text-stone-400' : 'text-stone-800'}`}>{profile.name || 'Unnamed'}</p>
                                                <p className="text-xs text-stone-400">{profile.email || '–'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        {isYou || isInactive ? (
                                            <span className="text-xs font-semibold text-stone-600">
                                                {APP_ROLES.find(r => r.user_type === profile.user_type)?.label || profile.role || 'Admin'}
                                            </span>
                                        ) : (
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
                                                className="text-xs border border-stone-200 rounded-lg px-2 py-1.5 focus:outline-none disabled:opacity-50 bg-white"
                                            >
                                                {APP_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                            </select>
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
