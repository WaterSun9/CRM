import { ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react';
import { warrantyInfo, formatWarrantyDate, WARRANTY_STATUS_LABELS } from '../utils/warranty';

const SOURCE_LABELS = {
    installation_date: 'installation date',
    material_delivery_date: 'delivery date (no installation date)',
    completed_at: 'completed date (no installation or delivery date)',
};

const STYLES = {
    light: {
        in_warranty: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        out_of_warranty: 'bg-red-50 text-red-700 border-red-200',
        unknown: 'bg-amber-50 text-amber-800 border-amber-200',
    },
    // For the stone-900 header of the customer detail window.
    dark: {
        in_warranty: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
        out_of_warranty: 'bg-red-500/15 text-red-300 border-red-400/40',
        unknown: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
    },
};

const ICONS = { in_warranty: ShieldCheck, out_of_warranty: ShieldAlert, unknown: ShieldQuestion };

// Pass either the customer row (needs installation_date, material_delivery_date
// and completed_at) or an already worked-out warrantyInfo() result.
export default function WarrantyBadge({ customer, info, tone = 'light', size = 'sm' }) {
    if (!customer && !info) return null;
    const warranty = info || warrantyInfo(customer);
    const status = STYLES.light[warranty.status] ? warranty.status : 'unknown';
    const Icon = ICONS[status];
    const endText = formatWarrantyDate(warranty.end);
    const label = status === 'unknown' || !endText ? WARRANTY_STATUS_LABELS[status]
        : status === 'in_warranty' ? `In warranty until ${endText}`
        : `Out of warranty (ended ${endText})`;
    // A complaint's saved warranty (info) may carry no start date or source.
    const title = status === 'unknown'
        ? 'No installation, delivery or completed date is saved for this customer.'
        : warranty.start
            ? `5-year warranty from ${formatWarrantyDate(warranty.start)}, the ${SOURCE_LABELS[warranty.source] || 'start date'}.`
            : '5-year warranty.';
    const sizing = size === 'md' ? 'gap-1.5 px-2.5 py-1 text-xs' : 'gap-1 px-2 py-0.5 text-[10px]';

    return (
        <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full border font-bold ${sizing} ${(STYLES[tone] || STYLES.light)[status]}`}>
            <Icon size={size === 'md' ? 14 : 12} className="flex-shrink-0" aria-hidden="true" />
            {label}
        </span>
    );
}
