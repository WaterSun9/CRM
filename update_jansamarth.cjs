const fs = require('fs');
let file = 'src/components/modal-tabs/LoanTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Rename Gansamarth to Jansamarth in the label and the logic.
content = content.replace(/Gansamarth/g, 'Jansamarth');
content = content.replace(/gansamarth/g, 'jansamarth');

// 2. Remove EditableDetailItem usage for this specific field and replace with a transparent version
const target = `<EditableDetailItem 
                                label={<span>Jansamarth Application No</span>} 
                                field="jansamarth_application_no" 
                                value={editData.jansamarth_application_no || ''} 
                                onChange={handleLocalChange} 
                                isEditing={isEditingAppDetails}
                                onBlur={async () => {
                                    if (editData.jansamarth_application_no !== customer.jansamarth_application_no) {
                                        await onUpdate(customer.id, { jansamarth_application_no: editData.jansamarth_application_no });
                                        await logActivity(user.id, 'update', \`\${customer.customer_name}: Updated Jansamarth Application No\`, '', customer.id);
                                        fetchLogs();
                                    }
                                }}
                            />`;

const replacement = `<div className="p-1">
                                <p className="text-[9px] text-stone-400 uppercase tracking-wide mb-1.5 font-bold">Jansamarth Application No</p>
                                {isEditingAppDetails ? (
                                    <input 
                                        type="text" 
                                        placeholder="Enter number..."
                                        value={editData.jansamarth_application_no || ''}
                                        onChange={(e) => handleLocalChange('jansamarth_application_no', e.target.value)}
                                        onBlur={async (e) => {
                                            if (editData.jansamarth_application_no !== customer.jansamarth_application_no) {
                                                await onUpdate(customer.id, { jansamarth_application_no: e.target.value });
                                                await logActivity(user.id, 'update', \`\${customer.customer_name}: Updated Jansamarth Application No\`, '', customer.id);
                                                fetchLogs();
                                            }
                                        }}
                                        className="w-full bg-white border border-stone-300 rounded-lg px-2.5 py-1.5 text-xs font-bold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition shadow-sm"
                                    />
                                ) : (
                                    <p className="text-xs font-bold text-stone-800 break-words">{editData.jansamarth_application_no || '–'}</p>
                                )}
                            </div>`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated Jansamarth formatting in LoanTab.jsx");
