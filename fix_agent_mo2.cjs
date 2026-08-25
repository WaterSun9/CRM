const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>`;

const notesStr = `
                                            <div className="flex items-center justify-between py-2">
                                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Notes / Instructions</span>
                                                <input
                                                    type="text"
                                                    value={editData.material_order_notes ?? selectedCust.material_order_notes ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, material_order_notes: e.target.value }))}
                                                    placeholder="Optional notes"
                                                    className="w-48 bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-amber-500"
                                                />
                                            </div>`;

const insertIndex = content.indexOf('                                        </div>\n                                        <div className="pt-2 border-t border-stone-200/60">', content.indexOf(targetStr));
if (insertIndex !== -1) {
    content = content.substring(0, insertIndex) + notesStr + '\n' + content.substring(insertIndex);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Added MO notes');
}

