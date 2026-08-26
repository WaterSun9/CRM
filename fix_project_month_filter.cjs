const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add projectMonthFilter state
content = content.replace(
    /const \[projectSearchQuery, setProjectSearchQuery\] = useState\(''\);/,
    "const [projectSearchQuery, setProjectSearchQuery] = useState('');\n    const [projectMonthFilter, setProjectMonthFilter] = useState('');"
);

// 2. Add to eligibleProjects useMemo
const oldEligibleRegex = /const matchesStage = projectStageFilter === 'ALL' \|\| c\.stage === projectStageFilter;\s*return matchesQuery && matchesStage;/;
const newEligible = `const matchesStage = projectStageFilter === 'ALL' || c.stage === projectStageFilter;
            const matchesMonth = !projectMonthFilter || (c.material_delivery_date && c.material_delivery_date.startsWith(projectMonthFilter));
            return matchesQuery && matchesStage && matchesMonth;`;
content = content.replace(oldEligibleRegex, newEligible);

// And update the dependency array of eligibleProjects
content = content.replace(
    /\}, \[customers, projectSearchQuery, projectStageFilter\]\);/,
    "}, [customers, projectSearchQuery, projectStageFilter, projectMonthFilter]);"
);

// 3. Add to the UI next to projectSearchQuery
const targetUi = `<input
                                            type="text"
                                            placeholder="Search customer, phone, village..."
                                            value={projectSearchQuery}
                                            onChange={e => setProjectSearchQuery(e.target.value)}
                                            className="w-full sm:w-64 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        />`;
const newUi = `<input
                                            type="text"
                                            placeholder="Search customer, phone, village..."
                                            value={projectSearchQuery}
                                            onChange={e => setProjectSearchQuery(e.target.value)}
                                            className="w-full sm:w-64 bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-300"
                                        />
                                        <div className="flex items-center gap-1.5 bg-stone-50 border border-stone-200 rounded-lg px-2">
                                            <span className="text-[10px] font-bold text-stone-500 whitespace-nowrap">Filter By:</span>
                                            <input
                                                type="month"
                                                value={projectMonthFilter}
                                                onChange={e => setProjectMonthFilter(e.target.value)}
                                                className="bg-transparent border-none py-1.5 text-xs font-bold text-stone-700 outline-none w-32"
                                            />
                                        </div>`;
content = content.replace(targetUi, newUi);

fs.writeFileSync(file, content, 'utf8');
console.log("Added project month filter.");
