const fs = require('fs');
let file = 'src/components/modal-tabs/LoanTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<CheckboxRemarkItem
                                label="Digital Certificate"
                                field="digital_certificate"`;

const replacement = `
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
                            </div>

                            <CheckboxRemarkItem
                                label="Vendor Feasibility *"
                                field="vendor_feasibility"
                                value={editData.vendor_feasibility}
                                onChange={handleLocalChange}
                                isEditing={isEditable}
                                documents={documents}
                                onUpload={onFileUpload}
                                onDelete={onFileDelete}
                                onPreview={onFilePreview}
                                onUpdateRemark={onUpdateRemark}
                            />
                            <CheckboxRemarkItem
                                label="Site Feasibility *"
                                field="site_feasibility"
                                value={editData.site_feasibility}
                                onChange={handleLocalChange}
                                isEditing={isEditable}
                                documents={documents}
                                onUpload={onFileUpload}
                                onDelete={onFileDelete}
                                onPreview={onFilePreview}
                                onUpdateRemark={onUpdateRemark}
                            />
                            <CheckboxRemarkItem
                                label="Digital Certificate"
                                field="digital_certificate"`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated LoanTab.jsx");
