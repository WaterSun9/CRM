const fs = require('fs');
let file = 'src/components/modal-tabs/LoanTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Update imports
content = content.replace(
    "import { History, Paperclip, IndianRupee, CheckCircle2, Lock, Edit3, X } from 'lucide-react';",
    "import { History, Paperclip, IndianRupee, CheckCircle2, Lock, Edit3, X, ClipboardList } from 'lucide-react';"
);
content = content.replace(
    "import { CheckboxRemarkItem } from './shared';",
    "import { CheckboxRemarkItem, EditableDetailItem } from './shared';"
);

// 2. Add state
const stateTarget = `const [isPaymentsDirty, setIsPaymentsDirty] = useState(false);`;
const stateReplacement = `const [isPaymentsDirty, setIsPaymentsDirty] = useState(false);
    const [isEditingAppDetails, setIsEditingAppDetails] = useState(false);`;
content = content.replace(stateTarget, stateReplacement);

// 3. Add the section before "1. Loan Documents Checklist"
const sectionTarget = `{/* 1. Loan Documents Checklist */}`;
const sectionReplacement = `{/* Loan Application Details */}
                    <section className="bg-white p-5 rounded-2xl border border-stone-200/70 shadow-xs space-y-4">
                        <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                            <h4 className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                <ClipboardList size={12} className="text-amber-500" /> Application Details
                            </h4>
                            {isEditable && (
                                <button 
                                    type="button"
                                    onClick={() => setIsEditingAppDetails(!isEditingAppDetails)}
                                    className="text-stone-400 hover:text-amber-600 transition-colors p-1 cursor-pointer"
                                >
                                    {isEditingAppDetails ? <X size={14} /> : <Edit3 size={13} />}
                                </button>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <EditableDetailItem 
                                label={<span>Gansamarth Application No</span>} 
                                field="gansamarth_application_no" 
                                value={editData.gansamarth_application_no || ''} 
                                onChange={handleLocalChange} 
                                isEditing={isEditingAppDetails}
                                onBlur={async () => {
                                    if (editData.gansamarth_application_no !== customer.gansamarth_application_no) {
                                        await onUpdate(customer.id, { gansamarth_application_no: editData.gansamarth_application_no });
                                        await logActivity(user.id, 'update', \`\${customer.customer_name}: Updated Gansamarth Application No\`, '', customer.id);
                                        fetchLogs();
                                    }
                                }}
                            />
                        </div>
                    </section>

                    {/* 1. Loan Documents Checklist */}`;
content = content.replace(sectionTarget, sectionReplacement);

// 4. Remove the old Gansamarth Application Number from the checklist
const oldFieldTarget = `
                            {/* Gansamarth Application Number */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-stone-50 border border-stone-200 rounded-xl mb-3">
                                <span className="text-[11px] font-black text-stone-700 uppercase tracking-wide">
                                    Gansamarth Application No:
                                </span>
                                {isEditable ? (
                                    <input 
                                        type="text" 
                                        placeholder="Enter number..."
                                        value={editData.gansamarth_application_no || ''}
                                        onChange={(e) => handleLocalChange('gansamarth_application_no', e.target.value)}
                                        onBlur={async (e) => {
                                            if (editData.gansamarth_application_no !== customer.gansamarth_application_no) {
                                                await onUpdate(customer.id, { gansamarth_application_no: e.target.value });
                                            }
                                        }}
                                        className="mt-2 sm:mt-0 px-3 py-1.5 text-xs font-bold bg-white border border-stone-300 rounded-lg outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 w-full sm:w-64 transition"
                                    />
                                ) : (
                                    <span className="mt-1 sm:mt-0 text-xs font-bold text-stone-900">
                                        {editData.gansamarth_application_no || '–'}
                                    </span>
                                )}
                            </div>`;
content = content.replace(oldFieldTarget, '');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated LoanTab with dedicated Application Details section.");
