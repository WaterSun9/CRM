import { useEffect, useState } from 'react';
import { Phone, X } from 'lucide-react';
import { supabase } from '../../supabase';

const HIDE_KEY = 'partner-phone-reminder-hidden';
const hiddenThisSession = () => { try { return sessionStorage.getItem(HIDE_KEY) === '1'; } catch { return false; } };

// Asks a channel partner or dealer with no phone number on file to add one in Profile,
// so the office and technicians can call them from complaints. Gone once a number is
// saved; "Later" hides it until the next login.
export default function PartnerPhoneReminder({ onOpenProfile }) {
    const [missing, setMissing] = useState(false);
    const [hidden, setHidden] = useState(hiddenThisSession);

    useEffect(() => {
        if (hidden) return undefined;
        let active = true;
        supabase.rpc('my_partner_profile').then(({ data, error }) => {
            if (active && !error && data?.[0] && !data[0].phone) setMissing(true);
        });
        return () => { active = false; };
    }, [hidden]);

    if (!missing || hidden) return null;
    const later = () => { try { sessionStorage.setItem(HIDE_KEY, '1'); } catch { /* private window */ } setHidden(true); };
    return <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
        <Phone size={18} className="shrink-0 text-amber-700" />
        <p className="min-w-0 flex-1"><strong>Add your phone number.</strong> The Watersun office and technicians see it on your customers' complaints and can call you with one tap.</p>
        <button type="button" onClick={onOpenProfile} className="min-h-11 rounded-lg bg-amber-500 px-4 text-xs font-bold text-stone-900">Add in Profile</button>
        <button type="button" onClick={later} aria-label="Remind me later" className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-amber-800 hover:bg-amber-100"><X size={16} /></button>
    </div>;
}
