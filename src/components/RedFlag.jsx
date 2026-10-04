import React, { useState } from 'react';
import { Flag } from 'lucide-react';
import { useGlobalPopup } from './GlobalPopup';
import { canUseRedFlags, setCustomerRedFlag, useRedFlags } from '../utils/redFlags';

// Small filled red flag next to a customer's name. Renders nothing for roles
// that don't use flags, for unflagged customers, or before the SQL is applied.
export function RedFlagBadge({ customerId, user, size = 14, className = '' }) {
    const allowed = canUseRedFlags(user);
    const { ids, available } = useRedFlags(allowed);
    if (!allowed || !available || !customerId || !ids.has(customerId)) return null;
    return (
        <span title="Red flag" aria-label="Red flag" className={`inline-flex shrink-0 items-center ${className}`}>
            <Flag size={size} className="fill-red-500 text-red-500" />
        </span>
    );
}

// Button that raises / removes the flag. tone="dark" for the dark CRM header,
// tone="light" for white headers (agent / dealer portal).
export function RedFlagToggle({ customer, user, tone = 'dark', className = '' }) {
    const allowed = canUseRedFlags(user);
    const { ids, available } = useRedFlags(allowed);
    const { showAlert } = useGlobalPopup();
    const [saving, setSaving] = useState(false);
    if (!allowed || !available || !customer?.id) return null;
    const flagged = ids.has(customer.id);

    const toggle = async event => {
        event?.stopPropagation?.();
        if (saving) return;
        setSaving(true);
        const { error } = await setCustomerRedFlag(customer.id, !flagged, user.id);
        setSaving(false);
        if (error) showAlert(`Could not update the red flag: ${error.message}`, { type: 'error' });
    };

    const palette = tone === 'dark'
        ? (flagged ? 'text-red-400 bg-red-500/15 hover:bg-red-500/25' : 'text-white/40 hover:text-red-400 hover:bg-white/10')
        : (flagged ? 'text-red-600 bg-red-50 border border-red-200 hover:bg-red-100' : 'text-stone-400 border border-stone-200 bg-white hover:text-red-500 hover:border-red-200');

    return (
        <button type="button" onClick={toggle} disabled={saving}
            aria-label={flagged ? 'Remove red flag' : 'Add red flag'} title={flagged ? 'Remove red flag' : 'Add red flag'}
            aria-pressed={flagged}
            className={`inline-flex items-center justify-center rounded-lg p-2 transition-colors disabled:opacity-50 ${palette} ${className}`}>
            <Flag size={tone === 'dark' ? 18 : 15} className={flagged ? 'fill-current' : ''} />
        </button>
    );
}
