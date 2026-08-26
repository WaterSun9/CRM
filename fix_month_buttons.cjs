const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add applied states
content = content.replace(
    /const \[monthFilter, setMonthFilter\] = useState\(''\);/,
    "const [monthFilter, setMonthFilter] = useState('');\n    const [appliedMonthFilter, setAppliedMonthFilter] = useState('');"
);
content = content.replace(
    /const \[projectMonthFilter, setProjectMonthFilter\] = useState\(''\);/,
    "const [projectMonthFilter, setProjectMonthFilter] = useState('');\n    const [appliedProjectMonth, setAppliedProjectMonth] = useState('');"
);

// 2. Change dependencies and logic for filteredBatches and eligibleProjects
content = content.replace(
    /checkMonthMatch\(c\.material_delivery_date, projectMonthFilter\)/,
    "checkMonthMatch(c.material_delivery_date, appliedProjectMonth)"
);
content = content.replace(
    /\[customers, projectSearchQuery, projectStageFilter, projectMonthFilter\]/,
    "[customers, projectSearchQuery, projectStageFilter, appliedProjectMonth]"
);

content = content.replace(
    /checkMonthMatch\(b\.dispatch_date, monthFilter\)/,
    "checkMonthMatch(b.dispatch_date, appliedMonthFilter)"
);
content = content.replace(
    /\[batches, searchQuery, statusFilter\]/,
    "[batches, searchQuery, statusFilter, appliedMonthFilter]"
);

// 3. UI for dashboard batches month filter
const dashMonthUiTarget = `<input
                        type="month"
                        value={monthFilter}
                        onChange={(e) => setMonthFilter(e.target.value)}
                        className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                    />`;
const dashMonthUiReplacement = `<div className="flex gap-1">
                        <input
                            type="month"
                            value={monthFilter}
                            onChange={(e) => setMonthFilter(e.target.value)}
                            className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-medium text-stone-800 outline-none focus:bg-white focus:border-amber-400 transition"
                        />
                        <button 
                            type="button" 
                            onClick={() => setAppliedMonthFilter(monthFilter)} 
                            className="bg-stone-800 hover:bg-stone-700 text-white px-3 rounded-xl text-xs font-bold cursor-pointer transition"
                        >
                            Apply
                        </button>
                        {appliedMonthFilter && (
                            <button 
                                type="button" 
                                onClick={() => { setMonthFilter(''); setAppliedMonthFilter(''); }} 
                                className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 rounded-xl text-xs font-bold cursor-pointer transition"
                            >
                                Clear
                            </button>
                        )}
                    </div>`;
content = content.replace(dashMonthUiTarget, dashMonthUiReplacement);

// 4. UI for project checklist month filter
const projMonthUiTarget = `<div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5">
                                            <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">Del. Month:</span>
                                            <input
                                                type="month"
                                                value={projectMonthFilter}
                                                onChange={e => setProjectMonthFilter(e.target.value)}
                                                className="bg-transparent border-none py-1 text-[10px] font-bold text-stone-700 outline-none w-24"
                                            />
                                        </div>`;
const projMonthUiReplacement = `<div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-0.5">
                                            <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">Del. Month:</span>
                                            <input
                                                type="month"
                                                value={projectMonthFilter}
                                                onChange={e => setProjectMonthFilter(e.target.value)}
                                                className="bg-transparent border-none py-1 text-[10px] font-bold text-stone-700 outline-none w-24"
                                            />
                                            <button 
                                                type="button" 
                                                onClick={() => setAppliedProjectMonth(projectMonthFilter)} 
                                                className="bg-stone-300 hover:bg-stone-400 text-stone-800 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition"
                                            >
                                                Apply
                                            </button>
                                            {appliedProjectMonth && (
                                                <button 
                                                    type="button" 
                                                    onClick={() => { setProjectMonthFilter(''); setAppliedProjectMonth(''); }} 
                                                    className="bg-red-100 hover:bg-red-200 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition"
                                                >
                                                    Clear
                                                </button>
                                            )}
                                        </div>`;
content = content.replace(projMonthUiTarget, projMonthUiReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Added apply and clear buttons.");
