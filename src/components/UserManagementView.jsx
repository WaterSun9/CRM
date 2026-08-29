// ─── UserManagementView.jsx ───────────────────────────────────────────────────
// Admin view: list, create, role-update, direct password reset, and deactivate users.
// USER_TYPE_OPTIONS / ROLE_OPTIONS sourced from constants.js.
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { logActivity } from '../utils';
import { APP_ROLES } from '../constants';
import { 
    ShieldCheck, Plus, RefreshCw, AlertTriangle, Eye, EyeOff, 
    UserCog, X, KeyRound, Ban, Search, Edit2, Check, Loader2, Building2, Send, Lock 
} from 'lucide-react';

// ─── ResetPasswordModal ───────────────────────────────────────────────────────
function ResetPasswordModal({ user, onClose, onSuccess, currentUser }) {
    const [mode, setMode] = useState('direct'); // 'direct' | 'email'
    const [newPassword, setNewPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [emailSuccessMsg, setEmailSuccessMsg] = useState('');

    const handleDirectSet = async () => {
        if (!newPassword || newPassword.length < 6) {
            setError("Password must be at least 6 characters.");
            return;
        }

        setLoading(true);
        setError("");
        try {
            const response = await supabase.functions.invoke("add_user", {
                body: { action: "update_password", user_id: user.id, new_password: newPassword },
            });

            if (response.error || response.data?.error) {
                const message = response.data?.error || response.error?.message || "Failed to update password.";
                throw new Error(message);
            }

            logActivity(
                currentUser?.id || "admin",
                "update",
                `Admin directly set new password for user: ${user.name} (${user.email})`,
                ""
            );

            onSuccess(`Password for ${user.name} successfully updated!`);
            onClose();
        } catch (err) {
            setError(err.message || "Failed to update password.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        setLoading(true);
        setError('');
        setEmailSuccessMsg('');
        try {
            if (!user.email || String(user.email).endsWith('@watersun.com')) {
                setEmailSuccessMsg(`Test user ${user.name} password is set to default role password.`);
                setLoading(false);
                return;
            }

            const { error: resetErr } = await supabase.auth.resetPasswordForEmail(user.email, {
                redirectTo: window.location.origin,
            });

            if (resetErr) {
                if (resetErr.message?.includes('rate_limit') || resetErr.status === 429) {
                    throw new Error('Supabase email hourly rate limit reached. Please use the "Set Password Directly" option above to change it immediately.');
                }
                throw resetErr;
            }

            setEmailSuccessMsg(`Password reset link successfully sent to ${user.email}`);
            logActivity(currentUser?.id || 'admin', 'update', `Sent password reset email to ${user.name}`, user.email);
        } catch (err) {
            setError(err.message || 'Failed to send reset email.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-stone-200 animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="bg-stone-900 px-5 py-4 flex justify-between items-center text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500 text-stone-950 rounded-xl">
                            <KeyRound size={16} />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">Reset User Password</h3>
                            <p className="text-[11px] text-stone-400 truncate max-w-xs">{user.name} ({user.email})</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer"><X size={18} /></button>
                </div>

                {/* Mode Selector */}
                <div className="flex border-b border-stone-150 bg-stone-50">
                    <button
                        type="button"
                        onClick={() => { setMode('direct'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                            mode === 'direct' 
                                ? 'border-amber-500 text-stone-900 bg-white shadow-xs' 
                                : 'border-transparent text-stone-500 hover:text-stone-800'
                        }`}
                    >
                        <Lock size={12} /> Set Password Directly
                    </button>
                    <button
                        type="button"
                        onClick={() => { setMode('email'); setError(''); }}
                        className={`flex-1 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center justify-center gap-1.5 ${
                            mode === 'email' 
                                ? 'border-amber-500 text-stone-900 bg-white shadow-xs' 
                                : 'border-transparent text-stone-500 hover:text-stone-800'
                        }`}
                    >
                        <Send size={12} /> Send Email Link
                    </button>
                </div>

                {/* Body */}
                <div className="p-5 space-y-4">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex items-start gap-2 text-rose-700 text-xs">
                            <AlertTriangle size={15} className="flex-shrink-0 mt-0.5" />
                            <p className="font-medium leading-relaxed">{error}</p>
                        </div>
                    )}

                    {emailSuccessMsg && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2 text-emerald-800 text-xs">
                            <Check size={15} className="flex-shrink-0 mt-0.5 text-emerald-600 stroke-[3]" />
                            <p className="font-medium leading-relaxed">{emailSuccessMsg}</p>
                        </div>
                    )}

                    {mode === 'direct' ? (
                        <div className="space-y-3">
                            <p className="text-xs text-stone-500 font-medium">
                                Set a new password directly for this user. They can use it immediately without waiting for an email.
                            </p>
                            <div>
                                <label className="block text-xs font-bold text-stone-700 mb-1">New Password *</label>
                                <div className="relative">
                                    <input 
                                        type={showPw ? 'text' : 'password'} 
                                        value={newPassword} 
                                        onChange={e => setNewPassword(e.target.value)}
                                        placeholder="Enter new password (min. 6 chars)"
                                        autoFocus
                                        className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-400" 
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => setShowPw(!showPw)} 
                                        className="absolute right-3 top-2.5 text-stone-400 hover:text-stone-600 cursor-pointer"
                                    >
                                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={loading || !newPassword}
                                onClick={handleDirectSet}
                                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                <span>{loading ? 'Updating Password...' : 'Save & Update Password'}</span>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-xs text-stone-500 font-medium">
                                Send a password reset link to <b>{user.email}</b>. (Note: Subject to Supabase email provider limits).
                            </p>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleSendEmail}
                                className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm"
                            >
                                {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                                <span>{loading ? 'Sending Email...' : 'Send Password Reset Link'}</span>
                            </button>
                        </div>
                    )}
                </div>

                <div className="bg-stone-50 px-5 py-3 border-t border-stone-150 flex justify-end">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-1.5 border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── CreateUserModal ──────────────────────────────────────────────────────────
function CreateUserModal({ onClose, onCreated, currentUser, branchOptions = [] }) {
    const isCP = currentUser?.user_type === 'channel_partner_office' || currentUser?.userType === 'channel_partner_office';
    const partnerName = (currentUser?.channel_partner || currentUser?.name || '').trim();
    const initialFormState = isCP 
        ? { name: '', email: '', password: '', role: 'Channel Partner Manager', user_type: 'office2', channel_partner: partnerName }
        : { name: '', email: '', password: '', role: 'Office', user_type: 'sales', channel_partner: '' };
    const [form, setForm] = useState(initialFormState);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [showPw, setShowPw] = useState(false);
    const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

    const handleCreate = async () => {
        const uppercaseName = form.name.toUpperCase().trim();
        const cleanEmail = form.email.trim().toLowerCase();
        if (!uppercaseName || !cleanEmail || !form.password.trim()) {
            setError('Name, email, and password are required.');
            return;
        }

        const validateComplexity = (pw) => {
            if (pw.length < 6) return 'Password must be at least 6 characters.';
            return null;
        };
        const complexityError = validateComplexity(form.password);
        if (complexityError) {
            setError(complexityError);
            return;
        }

        // Branch roles are scoped by channel_partner - every query in the app
        // filters on it - so a blank one creates a user who can see nothing (or
        // everything). A CPO gets theirs filled in automatically; an admin must
        // supply it.
        const BRANCH_SCOPED = ['channel_partner_office', 'channel_partner_office_manager', 'agent', 'office2', 'agent2'];
        const resolvedPartner = (isCP ? partnerName : (form.channel_partner || '')).trim();
        if (BRANCH_SCOPED.includes(form.user_type) && !resolvedPartner) {
            setError('Assigned Channel Partner / Branch Name is required for this role.');
            return;
        }

        setSaving(true);
        setError('');

        try {
            // The development role switcher only changes the screen being
            // previewed; it does not replace Supabase's signed-in identity.
            // Check that identity before calling the protected Edge Function so
            // the user gets a useful answer instead of a vague 403 response.
            const { data: authData, error: authError } = await supabase.auth.getUser();
            const signedInUser = authData?.user;
            if (authError || !signedInUser) {
                throw new Error('User creation needs a real signed-in Admin or CPO account. The development backdoor can preview screens, but it cannot create accounts. Please sign in normally and try again.');
            }
            if (currentUser?.id && signedInUser.id !== currentUser.id) {
                throw new Error(`You are previewing ${currentUser.email || currentUser.name || 'another account'}, but Supabase is signed in as ${signedInUser.email || 'a different account'}. Sign in normally as the Admin or CPO that should create this user.`);
            }

            const finalForm = { ...form, name: uppercaseName, email: cleanEmail, channel_partner: resolvedPartner || null };

            // 1. Try Supabase Edge Function
            try {
                const response = await supabase.functions.invoke('add_user', {
                    body: { ...finalForm, action: 'create' },
                });

                if (response.data?.error) {
                    throw new Error(response.data.error);
                } else if (response.error) {
                    let errMsg = response.error.message || 'Edge function error';
                    try {
                        if (response.error.context && typeof response.error.context.json === 'function') {
                            const errJson = await response.error.context.json();
                            if (errJson?.error) errMsg = errJson.error;
                        }
                    } catch (_) { /* could not parse error body, use default message */ }
                    throw new Error(errMsg);
                }
            } catch (edgeErr) {
                console.error('Edge function invoke failed:', edgeErr);
                // The function's own rejections (401/403/400) are answers, not
                // outages - reporting them as "not deployed" sent debugging the
                // wrong way. Only a genuine transport failure gets that message.
                const raw = edgeErr.message || 'Unknown error';
                const isAuthRejection = /unauthorized|forbidden|invalid or expired|access denied|no token/i.test(raw);
                if (isAuthRejection) {
                    throw new Error(
                        raw + ' - your own account was rejected by the account-creation service. '
                        + 'Sign out and sign back in; if it persists, your login has no profile row '
                        + 'or lacks Admin / Channel Partner Office permission.'
                    );
                }
                if (/^(?!.*(fetch|network|failed to send|load failed|timeout)).*$/i.test(raw)) {
                    // A specific message came back from the function - surface it as-is.
                    throw new Error(raw);
                }
                throw new Error('Could not reach the account-creation service: ' + raw
                    + '. This usually means the add_user edge function needs to be deployed or is misconfigured - contact your developer.');
            }

            // If the created user is a vendor, check if present in vendors table; if not, auto-add
            if (finalForm.user_type === 'vendor' || finalForm.role === 'Vendors' || (finalForm.role || '').toLowerCase().includes('vendor')) {
                try {
                    const { data: existingVendor } = await supabase
                        .from('vendors')
                        .select('id, name, email')
                        .or(`email.ilike.${finalForm.email},name.ilike.${finalForm.name}`)
                        .maybeSingle();

                    if (!existingVendor) {
                        await supabase
                            .from('vendors')
                            .insert({
                                name: finalForm.name,
                                email: finalForm.email
                            });
                    }
                } catch (vErr) {
                    console.warn('Vendor table sync warning:', vErr);
                }
            }

            logActivity(
                currentUser?.id || 'admin',
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
                        <p className="text-stone-400 text-xs mt-0.5">Assign role and permissions</p>
                    </div>
                    <button onClick={onClose} className="text-white/60 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
                </div>
                <form onSubmit={e => { e.preventDefault(); handleCreate(); }} autoComplete="off">
                    <input type="text" name="fake_usernamenotused" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />
                    <input type="password" name="fake_passwordnotused" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" />

                    <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh]">
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
                                    placeholder="Min. 6 characters"
                                    className="w-full px-3 py-2.5 pr-10 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" 
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-3 text-stone-400 hover:text-stone-600 cursor-pointer">
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        {isCP ? (
                            <div>
                                <label className="block text-xs font-medium text-stone-600 mb-1">Role in Your Branch *</label>
                                <select 
                                    value={form.user_type === 'office2' ? 'office2' : 'agent2'} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (val === 'office2') {
                                            setForm(prev => ({ ...prev, user_type: 'office2', role: 'Channel Partner Manager', channel_partner: partnerName }));
                                        } else {
                                            setForm(prev => ({ ...prev, user_type: 'agent2', role: 'Channel Partner', channel_partner: partnerName }));
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white cursor-pointer font-semibold"
                                >
                                    <option value="office2">Manager</option>
                                    <option value="agent2">Dealer</option>
                                </select>
                                <p className="text-[10px] text-stone-400 mt-1">
                                    Auto-assigned to branch: <span className="font-semibold text-stone-600">{partnerName}</span>
                                </p>
                            </div>
                        ) : (
                            <div>
                                <label className="block text-xs font-medium text-stone-600 mb-1">Role *</label>
                                <select 
                                    value={APP_ROLES.find(r => r.user_type === form.user_type)?.id || 'office'} 
                                    onChange={e => {
                                        const val = e.target.value;
                                        const selected = APP_ROLES.find(r => r.id === val);
                                        if (selected) {
                                            setForm(prev => ({
                                                ...prev,
                                                user_type: selected.user_type,
                                                role: selected.role
                                            }));
                                        }
                                    }}
                                    className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white cursor-pointer font-semibold"
                                >
                                    {APP_ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                            </div>
                        )}

                        {['channel_partner_office', 'agent', 'office2', 'agent2'].includes(form.user_type) && (
                            <div>
                                <label className="block text-xs font-medium text-stone-600 mb-1">
                                    Assigned Channel Partner / Branch Name *
                                </label>
                                {!isCP && ['channel_partner_office', 'channel_partner_office_manager'].includes(form.user_type) ? (
                                    /* A CPO *defines* a branch, so this is free text - the name typed
                                       here is stored on the new CPO's profile and becomes a selectable
                                       branch for every manager and agent created afterwards. */
                                    <>
                                        <input
                                            type="text"
                                            value={form.channel_partner || ''}
                                            onChange={e => set('channel_partner', e.target.value)}
                                            placeholder="e.g. PRAVINBHAI"
                                            autoComplete="off"
                                            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 font-medium"
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1">
                                            New branch name. Type it exactly as it appears on existing leads -
                                            it is what managers and dealers will be attached to.
                                        </p>
                                    </>
                                ) : isCP ? (
                                    /* A CPO can only create users inside their own branch, so the
                                       field is filled from their account and shown, not editable. */
                                    <>
                                        <input
                                            type="text"
                                            value={partnerName}
                                            readOnly
                                            disabled
                                            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm bg-stone-100 text-stone-700 font-semibold cursor-not-allowed"
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1">
                                            Set automatically to your branch.
                                        </p>
                                    </>
                                ) : form.user_type === 'channel_partner_office' ? (
                                    <>
                                        <input
                                            type="text"
                                            value={form.channel_partner || ''}
                                            onChange={e => set('channel_partner', e.target.value.toUpperCase())}
                                            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white font-semibold"
                                            placeholder="Enter the new CPO / branch name"
                                        />
                                        <p className="text-[10px] text-stone-400 mt-1">
                                            This new CPO name will automatically appear in Operations and future CPO selectors.
                                        </p>
                                    </>
                                ) : (
                                    <>
                                        <select
                                            value={form.channel_partner || ''}
                                            onChange={e => set('channel_partner', e.target.value)}
                                            className="w-full px-3 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white cursor-pointer font-medium"
                                        >
                                            <option value="">Select a branch / partner...</option>
                                            {branchOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                        </select>
                                        <p className="text-[10px] text-stone-400 mt-1">
                                            {branchOptions.length === 0
                                                ? 'No branches registered yet - create a Channel Partner Office user first.'
                                                : 'Pick the branch this user works under. To create a new branch, add a Channel Partner Office user instead.'}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="border-t p-4 flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 border border-stone-300 text-stone-700 rounded-xl text-sm font-medium cursor-pointer">Cancel</button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer">
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

    // Only real CPO profiles belong in this selector. Customer records and old
    // free-text assignments can contain thousands of names that are not CPOs.
    const branchOptions = useMemo(() => {
        const names = new Set();
        (profiles || []).forEach(p => {
            if (p.user_type === 'channel_partner_office' || p.role === 'Channel Partner Office') {
                const branch = String(p.channel_partner || p.name || '').trim();
                if (branch) names.add(branch);
            }
        });
        return [...names].sort((a, b) => a.localeCompare(b));
    }, [profiles]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [toast, setToast] = useState(null); // { type: 'success' | 'error', message }
    const [editingEmailId, setEditingEmailId] = useState(null);
    const [tempEmail, setTempEmail] = useState('');
    const [editingPartnerId, setEditingPartnerId] = useState(null);
    const [tempPartner, setTempPartner] = useState('');
    const [pwdResetUser, setPwdResetUser] = useState(null);

    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    const currentUserType = currentUser?.user_type || currentUser?.userType;
    const isCP = currentUserType === 'channel_partner_office';
    const partnerName = (currentUser?.channel_partner || currentUser?.name || '').trim();

    // ─── Robust Fetch Profiles ──────────────────────────────────────────────────
    const fetchProfiles = async () => {
        setLoading(true);
        try {
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
            if (!error && data && data.length > 0) {
                if (isCP) {
                    const cpoFiltered = data.filter(p => 
                        p.id !== currentUser?.id &&
                        p.user_type !== 'admin' &&
                        p.role !== 'Admin' &&
                        p.user_type !== 'channel_partner_office' &&
                        p.role !== 'Channel Partner Office' &&
                        (
                            (p.created_by && p.created_by === currentUser?.id) ||
                            (partnerName && p.channel_partner && p.channel_partner.trim().toLowerCase() === partnerName.toLowerCase())
                        )
                    );
                    setProfiles(cpoFiltered);
                } else {
                    setProfiles(data);
                }
            } else {
                setProfiles([]);
            }
        } catch (err) {
            console.error('Error fetching user profiles:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { 
        fetchProfiles(); 
    }, [isCP, partnerName, currentUser?.id]);

    // ─── Bulletproof Role Change Handler ─────────────────────────────────────────
    const handleRoleChange = async (profile, newRoleId) => {
        const selected = APP_ROLES.find(r => r.id === newRoleId);
        if (!selected) return;

        setActionLoading(profile.id);
        try {
            // 1. Direct Supabase Database Update on profiles table
            const { error: dbError } = await supabase
                .from('profiles')
                .update({
                    user_type: selected.user_type,
                    role: selected.role
                })
                .eq('id', profile.id);

            if (dbError) {
                console.error('Database role update failed:', dbError);
                throw new Error(dbError.message || 'Database update failed');
            }

            // 2. Also try Edge Function sync if deployed
            try {
                await supabase.functions.invoke('add_user', {
                    body: { 
                        action: 'update_role', 
                        user_id: profile.id, 
                        user_type: selected.user_type, 
                        role: selected.role 
                    },
                });
            } catch (edgeErr) {
                console.warn('Edge function role sync notice:', edgeErr);
            }

            // 3. Update local state immediately
            setProfiles(prev => prev.map(p => p.id === profile.id ? { 
                ...p, 
                user_type: selected.user_type, 
                role: selected.role 
            } : p));

            showToast('success', `Role for ${profile.name} updated to ${selected.label}`);
            await logActivity(currentUser?.id || 'admin', 'update', `Updated role for ${profile.name} to ${selected.label}`, `${selected.role} (${selected.user_type})`);
        } catch (err) {
            console.error('Failed to change user role:', err);
            showToast('error', `Failed to update role: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Update Assigned Channel Partner Name ──────────────────────────────────
    const handleUpdatePartner = async (profileId, newPartner) => {
        const cleanPartner = (newPartner || '').trim();
        setActionLoading(profileId);
        try {
            if (!String(profileId).startsWith('dev-')) {
                const { error } = await supabase
                    .from('profiles')
                    .update({ channel_partner: cleanPartner || null })
                    .eq('id', profileId);

                if (error) throw error;
            }

            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, channel_partner: cleanPartner } : p));
            showToast('success', 'Channel Partner name updated successfully');
            setEditingPartnerId(null);
        } catch (err) {
            console.error('Failed to update partner:', err);
            showToast('error', err.message || 'Failed to update partner name');
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Update User Email Address ──────────────────────────────────────────────
    const handleUpdateEmail = async (profileId, newEmail) => {
        const cleanEmail = (newEmail || '').trim().toLowerCase();
        if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
            showToast('error', 'Please enter a valid email address.');
            return;
        }

        setActionLoading(profileId);
        try {
            if (!String(profileId).startsWith('dev-')) {
                const { error: profileDbErr } = await supabase
                    .from('profiles')
                    .update({ email: cleanEmail })
                    .eq('id', profileId);

                if (profileDbErr) console.error('Profile DB email update failed:', profileDbErr);

                try {
                    await supabase.functions.invoke('add_user', {
                        body: { action: 'update_email', user_id: profileId, new_email: cleanEmail },
                    });
                } catch (edgeErr) {
                    console.warn('Edge function email update notice:', edgeErr);
                }
            }

            setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, email: cleanEmail } : p));
            showToast('success', 'Email updated successfully');
            setEditingEmailId(null);
            logActivity(currentUser?.id || 'admin', 'update', `Updated email address for profile ${profileId} to ${cleanEmail}`, '');
        } catch (err) {
            console.error('Failed to update email:', err);
            showToast('error', err.message || 'Failed to update email');
        } finally {
            setActionLoading(null);
        }
    };

    // ─── Deactivate / Reactivate / Delete User ──────────────────────────────────
    const deactivateUser = async (userId, name) => {
        if (!confirm(`Deactivate ${name}? They will not be able to log in.`)) return;

        setActionLoading(userId);
        try {
            if (!String(userId).startsWith('dev-')) {
                const { error: dbErr } = await supabase.from('profiles').update({ status: 'inactive' }).eq('id', userId);
                if (dbErr) throw dbErr;
                try {
                    await supabase.functions.invoke('add_user', {
                        body: { action: 'deactivate', user_id: userId },
                    });
                } catch (_) { /* edge function sync is best-effort; DB write above is authoritative */ }
            }

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'inactive' } : p));
            showToast('success', `${name} has been deactivated`);
            logActivity(currentUser?.id || 'admin', 'update', `Deactivated user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to deactivate: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const reactivateUser = async (userId, name) => {
        setActionLoading(userId);
        try {
            if (!String(userId).startsWith('dev-')) {
                const { error: dbErr } = await supabase.from('profiles').update({ status: 'active' }).eq('id', userId);
                if (dbErr) throw dbErr;
                try {
                    await supabase.functions.invoke('add_user', {
                        body: { action: 'reactivate', user_id: userId },
                    });
                } catch (_) { /* edge function sync is best-effort; DB write above is authoritative */ }
            }

            setProfiles(prev => prev.map(p => p.id === userId ? { ...p, status: 'active' } : p));
            showToast('success', `${name} has been reactivated`);
            logActivity(currentUser?.id || 'admin', 'update', `Reactivated user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to reactivate: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const deleteUser = async (userId, name) => {
        if (!confirm(`⚠️ PERMANENTLY DELETE ${name}? This cannot be undone.`)) return;

        setActionLoading(userId);
        try {
            if (!String(userId).startsWith('dev-')) {
                // Delete from Auth via edge function (service role)
                try {
                    await supabase.functions.invoke('add_user', {
                        body: { action: 'delete', user_id: userId },
                    });
                } catch (edgeEx) {
                    console.warn('Edge function delete notice:', edgeEx);
                }

                // Delete profile row
                const { error: dbErr } = await supabase.from('profiles').delete().eq('id', userId);
                if (dbErr) throw dbErr;
            }

            setProfiles(prev => prev.filter(p => p.id !== userId));
            showToast('success', `${name} permanently deleted`);
            logActivity(currentUser?.id || 'admin', 'delete', `Permanently deleted user: ${name}`, '');
        } catch (err) {
            showToast('error', `Failed to delete: ${err.message}`);
        } finally {
            setActionLoading(null);
        }
    };

    const filteredProfiles = (profiles || []).filter(p => {
        const q = (searchQuery || '').trim().toLowerCase();
        return !q ||
            String(p?.name || '').toLowerCase().includes(q) ||
            String(p?.email || '').toLowerCase().includes(q) ||
            String(p?.channel_partner || '').toLowerCase().includes(q) ||
            String(p?.role || '').toLowerCase().includes(q);
    });

    if (loading) return (
        <div className="flex flex-col items-center justify-center h-64 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-xs font-bold text-stone-500">Loading user profiles...</p>
        </div>
    );

    return (
        <div className="max-w-5xl mx-auto space-y-4 animate-in fade-in duration-200">
            {/* Toast notification */}
            {toast && (
                <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-xl shadow-lg border text-sm font-semibold flex items-center gap-2 animate-in slide-in-from-right transition-all ${
                    toast.type === 'success'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-red-50 border-red-300 text-red-800'
                }`}>
                    {toast.type === 'success' ? '✓' : '✕'} {toast.message}
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" />
                    <div>
                        <h2 className="text-base font-bold text-stone-900">User Management</h2>
                        <p className="text-xs text-stone-500 font-medium">{filteredProfiles.length} of {profiles.length} users active</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={fetchProfiles} 
                        className="p-2 border border-stone-200 hover:border-stone-300 bg-white rounded-xl text-stone-600 hover:bg-stone-50 transition-colors cursor-pointer shadow-xs"
                        title="Refresh User List"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2 bg-stone-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-stone-800 transition-all cursor-pointer shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> Create User
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden">
                {/* Search */}
                <div className="relative border-b border-stone-100 p-4 bg-stone-50/50">
                    <Search className="absolute left-7 top-6.5 w-4 h-4 text-stone-400 pointer-events-none" />
                    <input type="text" readOnly onFocus={(e) => e.target.removeAttribute('readonly')} 
                        name="crm_global_user_search_unique"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder="Search users by name, role, or channel partner..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-stone-400"
                    />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-stone-100 bg-stone-50/80">
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-wider">User Details</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-wider">Assigned Role</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-wider">Branch / Partner</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-wider">Status</th>
                                <th className="px-4 py-3 text-[10px] font-black text-stone-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-100">
                            {filteredProfiles.map(profile => {
                                const isInactive = profile.status === 'inactive';
                                const isYou = profile.id === currentUser?.id;
                                const isUpdating = actionLoading === profile.id;

                                return (
                                <tr key={profile.id} className={`transition-colors ${isInactive ? 'bg-stone-50/60 opacity-70' : 'hover:bg-stone-50/50'}`}>
                                    {/* User Details */}
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-xs ${isInactive ? 'bg-stone-400' : 'bg-stone-900'}`}>
                                                {profile.name?.split(' ').map(n => n[0]).join('').slice(0, 2) || '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className={`text-xs font-bold ${isInactive ? 'text-stone-400' : 'text-stone-900'}`}>{profile.name || 'Unnamed'}</p>
                                                {editingEmailId === profile.id ? (
                                                    <div className="flex items-center gap-1.5 mt-1 max-w-xs animate-in fade-in duration-150">
                                                        <input
                                                            type="email"
                                                            value={tempEmail}
                                                            onChange={e => setTempEmail(e.target.value)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleUpdateEmail(profile.id, tempEmail);
                                                                if (e.key === 'Escape') setEditingEmailId(null);
                                                            }}
                                                            className="px-2.5 py-1 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-medium"
                                                            placeholder="New email address..."
                                                            autoFocus
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => handleUpdateEmail(profile.id, tempEmail)}
                                                            disabled={isUpdating}
                                                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setEditingEmailId(null)}
                                                            className="p-1.5 text-stone-400 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-1.5 mt-0.5 group/email">
                                                        <p className="text-[11px] text-stone-500 font-medium truncate">{profile.email || '–'}</p>
                                                        {!isInactive && (
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setEditingEmailId(profile.id);
                                                                    setTempEmail(profile.email || '');
                                                                }}
                                                                className="p-0.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer opacity-70 group-hover/email:opacity-100"
                                                                title="Edit Email Address"
                                                            >
                                                                <Edit2 className="w-2.5 h-2.5" />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </td>

                                    {/* Role Selector Dropdown */}
                                    <td className="px-4 py-3">
                                        {isYou || isInactive ? (
                                            <div>
                                                <span className="text-xs font-bold text-stone-700 bg-stone-100 px-2.5 py-1 rounded-lg border border-stone-200">
                                                    {APP_ROLES.find(r => r.user_type === profile.user_type)?.label || profile.role || 'Admin'}
                                                </span>
                                            </div>
                                        ) : isCP ? (
                                            /* CPO managing their sub-agents */
                                            <div className="flex items-center gap-1.5">
                                                <select
                                                    value={profile.user_type === 'office2' ? 'office2' : 'agent2'}
                                                    disabled={isUpdating}
                                                    onChange={e => handleRoleChange(profile, e.target.value)}
                                                    className="px-2.5 py-1 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs"
                                                >
                                                    <option value="office2">Manager</option>
                                                    <option value="agent2">Dealer</option>
                                                </select>
                                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                                            </div>
                                        ) : (
                                            /* Admin Master Role Selector across all 8 roles */
                                            <div className="flex items-center gap-1.5">
                                                <select 
                                                    value={APP_ROLES.find(r => r.user_type === profile.user_type)?.id || 'office'} 
                                                    disabled={isUpdating}
                                                    onChange={e => handleRoleChange(profile, e.target.value)}
                                                    className="px-2.5 py-1.5 bg-white border border-stone-300 rounded-xl text-xs font-bold text-stone-850 focus:outline-none focus:ring-1 focus:ring-amber-500 cursor-pointer shadow-xs disabled:opacity-50"
                                                >
                                                    {APP_ROLES.map(r => (
                                                        <option key={r.id} value={r.id}>{r.label}</option>
                                                    ))}
                                                </select>
                                                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                                            </div>
                                        )}
                                    </td>

                                    {/* Assigned Branch / Partner */}
                                    <td className="px-4 py-3">
                                        {editingPartnerId === profile.id ? (
                                            <div className="flex items-center gap-1.5 max-w-xs">
                                                <select
                                                    value={tempPartner}
                                                    onChange={e => setTempPartner(e.target.value)}
                                                    onKeyDown={e => { if (e.key === 'Escape') setEditingPartnerId(null); }}
                                                    className="px-2.5 py-1 border border-stone-300 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 w-full font-medium cursor-pointer"
                                                    autoFocus
                                                >
                                                    <option value="">None</option>
                                                    {branchOptions.map(name => <option key={name} value={name}>{name}</option>)}
                                                </select>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdatePartner(profile.id, tempPartner)}
                                                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                                                >
                                                    <Check className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingPartnerId(null)}
                                                    className="p-1 text-stone-400 hover:bg-stone-100 rounded-lg"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1.5 group/partner">
                                                {profile.channel_partner ? (
                                                    <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                        <Building2 size={11} className="text-amber-600" />
                                                        {profile.channel_partner}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-stone-400 italic">Universal (All)</span>
                                                )}
                                                {!isInactive && !isYou && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setEditingPartnerId(profile.id);
                                                            setTempPartner(profile.channel_partner || '');
                                                        }}
                                                        className="p-0.5 text-stone-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer opacity-70 group-hover/partner:opacity-100"
                                                        title="Edit Channel Partner Name"
                                                    >
                                                        <Edit2 className="w-2.5 h-2.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>

                                    {/* Status Badge */}
                                    <td className="px-4 py-3">
                                        {isInactive ? (
                                            <span className="text-[10px] bg-red-100 text-red-700 px-2.5 py-0.5 rounded-full font-bold">Inactive</span>
                                        ) : (
                                            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">Active</span>
                                        )}
                                    </td>

                                    {/* Actions */}
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center gap-1 justify-end flex-wrap">
                                            {isYou ? (
                                                <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full font-bold">You</span>
                                            ) : isInactive ? (
                                                <>
                                                    <button
                                                        onClick={() => reactivateUser(profile.id, profile.name)}
                                                        disabled={isUpdating}
                                                        title="Reactivate this user"
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-700 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors font-bold disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <RefreshCw className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Reactivate</span>
                                                    </button>
                                                    <button
                                                        onClick={() => deleteUser(profile.id, profile.name)}
                                                        disabled={isUpdating}
                                                        title="Permanently delete this user"
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-bold disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                        <span className="hidden sm:inline">Delete</span>
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => setPwdResetUser(profile)}
                                                        disabled={isUpdating}
                                                        title="Reset or Change Password"
                                                        className="flex items-center gap-1 px-2.5 py-1 text-xs text-stone-700 hover:text-amber-800 hover:bg-amber-50 border border-stone-200 rounded-lg transition-colors font-bold disabled:opacity-50 cursor-pointer"
                                                    >
                                                        <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                                        <span>Reset Pwd</span>
                                                    </button>

                                                    <button
                                                        onClick={() => deactivateUser(profile.id, profile.name)}
                                                        disabled={isUpdating}
                                                        title="Deactivate this user"
                                                        className="flex items-center gap-1 px-2 py-1 text-xs text-stone-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors font-semibold disabled:opacity-50 cursor-pointer"
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
                    branchOptions={branchOptions}
                />
            )}

            {pwdResetUser && (
                <ResetPasswordModal
                    user={pwdResetUser}
                    onClose={() => setPwdResetUser(null)}
                    onSuccess={(msg) => { showToast('success', msg); }}
                    currentUser={currentUser}
                />
            )}
        </div>
    );
}
