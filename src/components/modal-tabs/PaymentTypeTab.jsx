import { useState } from 'react';
import { Banknote, CheckCircle2, Landmark } from 'lucide-react';
import { useGlobalPopup } from '../GlobalPopup';

// Payment Type stage (12 Nov 2026): the customer waits here until they choose Loan
// or Cash, which decides the next stage. Who finances a loan is set on the Loan tab.
const CHOICES = [
    { key: 'loan', label: 'Loan', hint: 'PM Surya Ghar loan or private finance - chosen on the Loan tab', payment_type: 'Loan', icon: Landmark },
    { key: 'cash', label: 'Cash', hint: 'The customer pays without a loan', payment_type: 'Cash', icon: Banknote },
];

const paymentChoiceOf = record => {
    const payment = String(record?.payment_type ?? '').trim().toLowerCase();
    return payment === 'cash' || payment === 'loan' ? payment : null;
};

export default function PaymentTypeTab({ customer, editData, setEditData, handleChange, isEditable, onUpdate, logActivity, fetchLogs, user }) {
    const { showConfirm } = useGlobalPopup();
    const [saving, setSaving] = useState(false);
    const current = paymentChoiceOf(editData);
    const set = (field, value) => (handleChange ? handleChange(field, value) : setEditData(prev => ({ ...prev, [field]: value })));

    const choose = async choice => {
        if (!isEditable || saving || choice.key === current) return;
        const next = choice.payment_type === 'Cash' ? 'Cash' : 'Loan';
        const ok = await showConfirm(
            `Set ${customer.customer_name} to ${choice.label}?\n\nWhen you move on, the customer goes to the ${next} stage.${choice.key === 'loan' ? ' Who finances the loan is chosen on the Loan tab.' : ''}`,
            { title: 'Choose the payment type?', confirmLabel: `Yes, ${choice.label}`, cancelLabel: 'Cancel', type: 'warning' }
        );
        if (!ok) return;
        setSaving(true);
        try {
            // Cash has no financer; a loan keeps whatever the Loan tab has.
            const changes = choice.key === 'cash' && editData.finance_type ? { payment_type: 'Cash', finance_type: null } : { payment_type: choice.payment_type };
            if (await onUpdate(customer.id, changes) === false) return;
            Object.entries(changes).forEach(([field, value]) => set(field, value));
            await logActivity?.(user?.id, 'update', `${customer.customer_name}: Payment type set to ${choice.label}`, '', customer.id);
            fetchLogs?.();
        } finally {
            setSaving(false);
        }
    };

    const chosen = CHOICES.find(c => c.key === current);
    return <div className="space-y-5 animate-in fade-in duration-300">
        <section className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs space-y-4">
            <div className="border-b border-stone-100 pb-2">
                <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest">How will the customer pay?</h4>
                <p className="mt-1 text-xs text-stone-500">The customer stays in this stage until this is decided.</p>
            </div>
            <div role="radiogroup" aria-label="Payment type" className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {CHOICES.map(choice => {
                    const on = choice.key === current;
                    const Icon = choice.icon;
                    return <button key={choice.key} type="button" role="radio" aria-checked={on} disabled={!isEditable || saving}
                        onClick={() => choose(choice)}
                        className={`relative rounded-2xl border p-4 text-left transition-all ${on ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-400' : 'border-stone-200 bg-white hover:border-amber-300'} disabled:cursor-not-allowed ${!on && !isEditable ? 'opacity-60' : ''}`}>
                        {on && <CheckCircle2 size={16} className="absolute right-3 top-3 text-amber-600" aria-hidden="true" />}
                        <Icon size={18} className={on ? 'text-amber-600' : 'text-stone-400'} aria-hidden="true" />
                        <span className="mt-2 block text-sm font-bold text-stone-900">{choice.label}</span>
                        <span className="mt-0.5 block text-[11px] text-stone-500">{choice.hint}</span>
                    </button>;
                })}
            </div>
            <p className={`rounded-xl px-3 py-2 text-xs font-semibold ${chosen ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                {chosen
                    ? `Chosen: ${chosen.label}. Moving on takes the customer to the ${chosen.payment_type === 'Cash' ? 'Cash' : 'Loan'} stage.`
                    : 'Not decided yet. Choose one before moving the customer on.'}
            </p>
        </section>
    </div>;
}
