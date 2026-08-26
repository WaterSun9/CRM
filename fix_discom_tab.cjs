const fs = require('fs');

const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add staffList state
const stateTarget = `    const [actionError, setActionError] = useState(null);`;
const stateReplacement = `    const [actionError, setActionError] = useState(null);
    const [staffList, setStaffList] = useState([]);

    React.useEffect(() => {
        supabase.from('profiles').select('name').order('name').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.name).filter(Boolean));
        });
    }, []);

    // Set defaults if missing
    React.useEffect(() => {
        if (!submissionData.date) {
            handleSubmissionFieldChange('date', new Date().toISOString().split('T')[0]);
        }
        if (!submissionData.first_party) {
            handleSubmissionFieldChange('first_party', customer.customer_name);
        }
        if (!submissionData.second_party) {
            handleSubmissionFieldChange('second_party', 'GUJRAT ENERGY DEVLOPEMENT AGENCY');
        }
        if (!submissionData.purchased_party) {
            handleSubmissionFieldChange('purchased_party', 'WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED');
        }
    }, [customer.customer_name, submissionData]);
`;

if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
} else {
    console.log("Failed to find state target");
}

// 2. Replace the grid
const gridTarget = `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">File Submitted By</label>
                        <input
                            type="text"
                            disabled={!isDiscomDetailsEditable}
                            placeholder="Enter name..."
                            value={submissionData.submitted_by || ''}
                            onChange={e => handleSubmissionFieldChange('submitted_by', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Submission Date</label>
                        <input
                            type="date"
                            disabled={!isDiscomDetailsEditable}
                            value={submissionData.date || ''}
                            onChange={e => handleSubmissionFieldChange('date', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">First Party</label>
                        <input
                            type="text"
                            disabled={!isDiscomDetailsEditable}
                            placeholder="Enter First Party..."
                            value={submissionData.first_party || ''}
                            onChange={e => handleSubmissionFieldChange('first_party', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Second Party</label>
                        <input
                            type="text"
                            disabled={!isDiscomDetailsEditable}
                            placeholder="Enter Second Party..."
                            value={submissionData.second_party || ''}
                            onChange={e => handleSubmissionFieldChange('second_party', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Purchased Party</label>
                        <input
                            type="text"
                            disabled={!isDiscomDetailsEditable}
                            placeholder="Enter Purchased Party..."
                            value={submissionData.purchased_party || ''}
                            onChange={e => handleSubmissionFieldChange('purchased_party', e.target.value)}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>
                </div>`;

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
                            value={'GUJRAT ENERGY DEVLOPEMENT AGENCY'}
                            className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-amber-300 font-semibold text-stone-700 disabled:bg-stone-100 disabled:text-stone-500"
                        />
                    </div>

                    <div>
                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">Purchased Party</label>
                        <input
                            type="text"
                            disabled={true}
                            value={'WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED'}
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
                </div>`;

if (content.includes(gridTarget)) {
    content = content.replace(gridTarget, gridReplacement);
    console.log("Replaced grid successfully");
} else {
    console.log("Failed to find grid target");
}

fs.writeFileSync(file, content, 'utf8');
