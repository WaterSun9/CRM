import { useEffect, useState } from 'react';
import { KeyRound, Lock, UserRound } from 'lucide-react';
import { supabase } from '../../supabase';
import { cleanMobile } from './serviceLabels';

const missingFunction = failure => failure?.code === 'PGRST202' || /could not find the function/i.test(failure?.message || '');

const PARTNER_TYPES = ['channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2'];

// Your own phone number (profiles.phone, set_my_phone), for every login. The quotation
// maker fills the salesperson phone from it. A dealer sets this same number above.
function MyPhone() {
    const [loaded, setLoaded] = useState(false);
    const [saved, setSaved] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    useEffect(() => {
        let active = true;
        supabase.rpc('my_phone').then(({ data, error }) => {
            if (!active) return;
            if (error) { setMessage({ ok: false, text: missingFunction(error) ? 'Adding your phone number is not set up yet. Ask the office.' : error.message }); return; }
            setSaved(data || ''); setPhone(data || ''); setLoaded(true);
        });
        return () => { active = false; };
    }, []);
    const save = async event => {
        event.preventDefault();
        const clean = phone.trim() ? cleanMobile(phone) : '';
        if (phone.trim() && !clean) { setMessage({ ok: false, text: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' }); return; }
        setSaving(true); setMessage(null);
        const { data, error } = await supabase.rpc('set_my_phone', { p_phone: clean || null });
        setSaving(false);
        if (error) { setMessage({ ok: false, text: error.message || 'Could not save.' }); return; }
        setSaved(data || ''); setPhone(data || '');
        setMessage({ ok: true, text: data ? 'Phone number saved. New quotations fill it in for you.' : 'Phone number removed.' });
    };
    const changed = (cleanMobile(phone) || phone.trim()) !== saved;
    return <form onSubmit={save} className="space-y-3 rounded-2xl border bg-white p-4">
        <label className="block text-xs font-semibold">Your phone number
            <input type="tel" inputMode="numeric" autoComplete="tel" disabled={!loaded} value={phone} onChange={e => { setPhone(e.target.value); setMessage(null); }} placeholder="10-digit mobile number"
                className="mt-1 block w-full min-h-12 rounded-lg border p-2 text-lg font-semibold tracking-wide disabled:bg-stone-50" />
            <span className="mt-1 block font-normal text-stone-500">Quotations you make fill this in as the salesperson phone. You can still change it on each quotation.</span>
        </label>
        {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
        <button disabled={!loaded || saving || !changed} className="min-h-11 w-full rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50 sm:w-auto">{saving ? 'Saving…' : 'Save phone number'}</button>
    </form>;
}

// Profile for every login. Name and email are fixed (the email is the login; the office
// changes it in User Management). Everyone sets their own phone (MyPhone). A channel
// partner also sets the "Partner phone" office and technicians see on complaints
// (set_my_partner_phone); a dealer's own number (profiles.phone) shows as "Dealer phone".
// Change password emails a reset link, as on the login screen.
export default function PartnerProfile({ user }) {
    const isPartner = PARTNER_TYPES.includes(user?.userType);
    const [profile, setProfile] = useState(null);
    const [failed, setFailed] = useState('');
    const [phone, setPhone] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState(null);
    const [reset, setReset] = useState({ state: '', text: '' });

    const sendReset = async () => {
        if (!user?.email) return;
        setReset({ state: 'sending', text: '' });
        const { error } = await supabase.auth.resetPasswordForEmail(user.email, { redirectTo: window.location.origin });
        setReset(error ? { state: 'error', text: error.message || 'Could not send the email. Try again.' }
            : { state: 'sent', text: `A link to set a new password was sent to ${user.email}. It may take a minute; check spam too.` });
    };

    useEffect(() => {
        if (!isPartner) return;
        let active = true;
        supabase.rpc('my_partner_profile').then(({ data, error }) => {
            if (!active) return;
            if (error) { setFailed(missingFunction(error) ? 'Profile is not set up yet. Ask the office.' : error.message); return; }
            const row = data?.[0] || null;
            setProfile(row); setPhone(row?.phone || '');
        });
        return () => { active = false; };
    }, [isPartner]);

    const save = async event => {
        event.preventDefault();
        const clean = phone.trim() ? cleanMobile(phone) : '';
        if (phone.trim() && !clean) { setMessage({ ok: false, text: 'Enter a 10-digit mobile number starting with 6, 7, 8 or 9.' }); return; }
        setSaving(true); setMessage(null);
        const { data, error } = await supabase.rpc('set_my_partner_phone', { p_phone: clean || null });
        setSaving(false);
        if (error) { setMessage({ ok: false, text: error.message || 'Could not save.' }); return; }
        setProfile(p => ({ ...p, phone: data || null })); setPhone(data || '');
        setMessage({ ok: true, text: data ? 'Phone number saved. It now shows on your customers\' complaints.' : 'Phone number removed.' });
    };

    const changed = (cleanMobile(phone) || phone.trim()) !== (profile?.phone || '');
    return <div className="mx-auto max-w-xl space-y-4">
        <div className="flex items-center gap-3 rounded-2xl border bg-white p-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-800"><UserRound size={24} /></span>
            <div className="min-w-0 flex-1 space-y-2">
                <p><span className="flex items-center gap-1 text-xs font-semibold text-stone-500">Name <Lock size={11} /></span><span className="block break-words font-bold">{user?.name || 'User'}</span></p>
                <p><span className="flex items-center gap-1 text-xs font-semibold text-stone-500">Login email <Lock size={11} /></span><span className="block break-words text-sm">{user?.email || '—'}</span></p>
                <p className="text-xs text-stone-500">To change your name or email, ask the Watersun office.</p>
            </div>
        </div>
        {failed && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{failed}</p>}
        {profile && <form onSubmit={save} className="space-y-3 rounded-2xl border bg-white p-4">
            <p className="text-sm"><span className="text-xs font-semibold text-stone-500">Channel partner</span><span className="block break-words font-bold">{profile.partner_name || '—'}</span>
                {profile.is_dealer && <span className="mt-1 block text-xs text-stone-500">Partner phone: {profile.partner_phone || 'not added yet'}</span>}</p>
            <label className="block text-xs font-semibold">{profile.is_dealer ? 'Your phone number (dealer)' : 'Partner phone number'}
                <input type="tel" inputMode="numeric" autoComplete="tel"  value={phone} onChange={e => { setPhone(e.target.value); setMessage(null); }} placeholder="10-digit mobile number"
                    className="mt-1 block w-full min-h-12 rounded-lg border p-2 text-lg font-semibold tracking-wide disabled:bg-stone-50" />
                <span className="mt-1 block font-normal text-stone-500">The office and technicians see this number on your customers' complaints and warranty cards, with a Call button.</span>
            </label>
            {message && <p role={message.ok ? 'status' : 'alert'} className={`rounded-lg p-2 text-sm ${message.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>{message.text}</p>}
            {<button disabled={saving || !changed} className="min-h-11 w-full rounded-lg bg-amber-500 px-4 text-sm font-bold disabled:opacity-50 sm:w-auto">{saving ? 'Saving…' : 'Save phone number'}</button>}
        </form>}
        {isPartner && !profile && !failed && <p className="text-sm text-stone-500">Loading…</p>}
        {user?.userType !== 'agent2' && <MyPhone />}
        <div className="space-y-2 rounded-2xl border bg-white p-4">
            <p className="flex items-center gap-2 text-sm font-bold"><KeyRound size={16} className="text-amber-600" /> Password</p>
            <p className="text-xs text-stone-500">We email you a link to set a new password. Use it if you forgot your password or want to change it.</p>
            {reset.text && <p role={reset.state === 'error' ? 'alert' : 'status'} className={`rounded-lg p-2 text-sm ${reset.state === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-800'}`}>{reset.text}</p>}
            <button type="button" disabled={!user?.email || reset.state === 'sending' || reset.state === 'sent'} onClick={sendReset}
                className="min-h-11 w-full rounded-lg border bg-white px-4 text-sm font-bold disabled:opacity-50 sm:w-auto">{reset.state === 'sending' ? 'Sending…' : reset.state === 'sent' ? 'Email sent' : 'Change password by email'}</button>
        </div>
    </div>;
}
