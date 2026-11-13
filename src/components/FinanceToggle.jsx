import { FINANCE_TYPES } from '../constants';

// Who finances a Loan customer: the PM Surya Ghar scheme loan or private finance.
export default function FinanceToggle({ value, onChange, disabled = false }) {
    return <div className="space-y-1">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Financed by</span>
        <div role="radiogroup" aria-label="Financed by" className="grid grid-cols-2 gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1">
            {FINANCE_TYPES.map(option => {
                const on = value === option;
                return <button key={option} type="button" role="radio" aria-checked={on} disabled={disabled}
                    onClick={() => onChange(option)}
                    className={`min-h-9 rounded-lg px-2 text-xs font-bold transition-colors ${on ? 'bg-white text-stone-900 shadow-sm ring-1 ring-blue-300' : 'text-stone-500 hover:text-stone-800'} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {option}
                </button>;
            })}
        </div>
    </div>;
}
