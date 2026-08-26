const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add monthFilter state
content = content.replace(
    /const \[searchQuery, setSearchQuery\] = useState\(''\);/,
    "const [searchQuery, setSearchQuery] = useState('');\n    const [monthFilter, setMonthFilter] = useState('');"
);

// 2. Add filtering logic to filteredBatches
const oldFilterRegex = /const matchesStatus = statusFilter === 'ALL' \|\| b\.status === statusFilter;\s*const q = searchQuery\.toLowerCase\(\);\s*const matchesQuery = !searchQuery \|\|\s*\(b\.batch_no \|\| ''\)\.toLowerCase\(\)\.includes\(q\) \|\|\s*\(b\.driver_name \|\| ''\)\.toLowerCase\(\)\.includes\(q\) \|\|\s*\(b\.vehicle_number \|\| ''\)\.toLowerCase\(\)\.includes\(q\) \|\|\s*\(b\.vendor \|\| ''\)\.toLowerCase\(\)\.includes\(q\);\s*return matchesStatus && matchesQuery;/;
const newFilter = `const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
            const q = searchQuery.toLowerCase();
            const matchesQuery = !searchQuery ||
                (b.batch_no || '').toLowerCase().includes(q) ||
                (b.driver_name || '').toLowerCase().includes(q) ||
                (b.vehicle_number || '').toLowerCase().includes(q);
            const matchesMonth = !monthFilter || (b.dispatch_date && b.dispatch_date.startsWith(monthFilter));
            return matchesStatus && matchesQuery && matchesMonth;`;
content = content.replace(oldFilterRegex, newFilter);

// 3. Add month input to the UI
const uiTarget = `<input
                        type="text"
                        placeholder="Search batches by ID, driver, vehicle..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                </div>`;
const uiReplacement = `<input
                        type="text"
                        placeholder="Search batches by ID, driver, vehicle..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-amber-300"
                    />
                </div>
                <input
                    type="month"
                    value={monthFilter}
                    onChange={e => setMonthFilter(e.target.value)}
                    className="w-full sm:w-48 bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-stone-700 outline-none focus:border-amber-400"
                />`;
content = content.replace(uiTarget, uiReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated filters.");
