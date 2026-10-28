import { Wrench } from 'lucide-react';
import { FIXED_GREEN_DAYS, useComplaintStatus } from './complaintStatus';

const shortDate = iso => (iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' }) : '');

// The wrench on a completed customer. Black: no complaint (tap to raise one).
// Red: a complaint is open (tap to open it). Green: fixed in the last
// FIXED_GREEN_DAYS days (tap to raise a new one). tone="dark" for the dark card header.
// statusOnly (stage and partner lists): complaints are raised only from the customer card
// and the Warranty cards (owner, 27-28 Oct 2026), so it shows only a red or green wrench
// and opens that complaint.
// withLabel: the words next to the wrench ("Raise complaint" / "Complaint #1001 open"), for
// the customer card and Warranty cards, where a bare icon was not seen as a button.
// canRaise=false (not in warranty, owner 28 Oct 2026): no Raise button, only an existing
// complaint's red / green wrench.
export default function ComplaintButton({ customer, onRaise, tone = 'light', stopPropagation = false, statusOnly: onlyStatus = false, canRaise = true, withLabel = false, className = '' }) {
    const status = useComplaintStatus(customer?.id);
    const statusOnly = onlyStatus || !canRaise;
    if (!customer?.id || (!statusOnly && !onRaise)) return null;
    const name = customer.customer_name || 'customer';
    const ticket = status?.ticketNo ? ` #${status.ticketNo}` : '';
    const open = status?.state === 'open';
    const fixed = status?.state === 'fixed';
    const color = open ? 'text-red-600 hover:text-red-700'
        : fixed ? 'text-green-600 hover:text-green-700'
            : tone === 'dark' ? 'text-white hover:text-stone-200' : 'text-stone-900 hover:text-stone-700';
    if (statusOnly && !open && !fixed) return null;
    const label = open ? `Complaint${ticket} open for ${name}. Open it`
        : fixed ? `Complaint${ticket} fixed on ${shortDate(status.completedAt)} for ${name} (green for ${FIXED_GREEN_DAYS} days). ${statusOnly ? 'Open it' : 'Raise a new complaint'}`
            : `Raise complaint for ${name}`;
    const click = event => {
        if (stopPropagation) event.stopPropagation();
        if (open || (fixed && statusOnly)) window.dispatchEvent(new CustomEvent('open-complaint', { detail: { issueId: status.issueId } }));
        else onRaise(customer);
    };
    if (withLabel) {
        const words = open ? `Complaint${ticket} open` : fixed && statusOnly ? `Complaint${ticket} fixed` : 'Raise complaint';
        const pill = open ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
            : tone === 'dark' ? 'border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-stone-300 bg-white text-stone-900 hover:border-amber-400';
        return <button type="button" onClick={click} aria-label={label}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${pill} ${className}`}>
            <Wrench size={16} fill="currentColor" strokeWidth={1.5} className={open ? 'text-red-600' : fixed ? 'text-green-600' : ''} /> {words}
        </button>;
    }
    return <button type="button" onClick={click} aria-label={label} title={open ? `Complaint${ticket} open` : fixed ? `Fixed ${shortDate(status.completedAt)}` : 'Raise complaint'}
        className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${color} ${className}`}>
        <Wrench size={22} fill="currentColor" strokeWidth={1.5} />
    </button>;
}
