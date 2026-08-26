const fs = require('fs');

const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const startMarker = '<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">';
const endMarker = '</div>\n\n                {/* ── Send to Stamp Maker footer & PM Surya Ghar Stamp ── */}';
const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex !== -1 && endIndex !== -1) {
    const gridReplacement = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">File Submitted By</label>
                        <select
                            disabled={!isDiscomDetailsEditable}
                            value={submissionData.submitted_by || ''}
                            onChange={e => handleSubmissionFieldChange('submitted_by', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        >
                            <option value="">Select Staff...</option>
                            {staffList.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Submission Date</label>
                        <input
                            type="date"
                            disabled={!isDiscomDetailsEditable}
                            value={submissionData.date || new Date().toISOString().split('T')[0]}
                            onChange={e => handleSubmissionFieldChange('date', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">First Party</label>
                        <input
                            type="text"
                            disabled={true}
                            value={submissionData.first_party || customer.customer_name}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Second Party</label>
                        <input
                            type="text"
                            disabled={true}
                            value={submissionData.second_party || 'GUJRAT ENERGY DEVLOPEMENT AGENCY'}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Purchased Party</label>
                        <input
                            type="text"
                            disabled={true}
                            value={submissionData.purchased_party || 'WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED'}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Stamp Value</label>
                        <select
                            disabled={!isDiscomDetailsEditable}
                            value={submissionData.stamp_value || ''}
                            onChange={e => handleSubmissionFieldChange('stamp_value', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        >
                            <option value="">Select Value...</option>
                            <option value="50">50</option>
                            <option value="300">300</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Stamp Description</label>
                        <select
                            disabled={!isDiscomDetailsEditable}
                            value={submissionData.stamp_description || ''}
                            onChange={e => handleSubmissionFieldChange('stamp_description', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        >
                            <option value="">Select Description...</option>
                            <option value="Affidavit">Affidavit</option>
                            <option value="Undertaking">Undertaking</option>
                            <option value="Option 3">Option 3</option>
                        </select>
                    </div>
                `;
    const newContent = content.substring(0, startIndex) + gridReplacement + content.substring(endIndex);
    fs.writeFileSync(file, newContent, 'utf8');
    console.log("Replaced grid successfully using substring");
} else {
    console.log("Failed to find substring indices");
    console.log({ startIndex, endIndex });
}
