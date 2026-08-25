const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Material Order Notes
const invoiceValueDiv = `                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                                <input
                                                    type="text"
                                                    value={editData.invoice_value ?? selectedCust.invoice_value ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, invoice_value: formatInputValue(e.target.value) }))}
                                                    placeholder="₹ Amount"
                                                    className="w-32 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>`;
const notesDiv = `
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Notes / Instructions</span>
                                                <input
                                                    type="text"
                                                    value={editData.material_order_notes ?? selectedCust.material_order_notes ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, material_order_notes: e.target.value }))}
                                                    placeholder="Optional notes"
                                                    className="w-48 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 text-right focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>`;

if (content.includes(invoiceValueDiv)) {
    content = content.replace(invoiceValueDiv, invoiceValueDiv + notesDiv);
    console.log('Added Material Order Notes');
} else {
    console.error('Could not find Invoice Value block in Material Order');
}

fs.writeFileSync(file, content, 'utf8');
