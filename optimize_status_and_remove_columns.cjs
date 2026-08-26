const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add localStatusOverrides state
content = content.replace(
    /const \[allCustomers, setAllCustomers\] = useState\(\[\]\);/,
    "const [allCustomers, setAllCustomers] = useState([]);\n    const [localStatusOverrides, setLocalStatusOverrides] = useState({});"
);

// 2. Remove columns
content = content.replace(/<th className="pb-2">System Specs<\/th>\n\s*<th className="pb-2">Inverter & Serials<\/th>/, "");

// Remove the corresponding tds
const tdsToRemove = /<td className="py-2\.5">\s*<span className="font-bold text-amber-700 bg-amber-50 px-2 py-0\.5 rounded text-\[11px\]">\s*\{proj\.system_capacity_kwp \? \`\$\{proj\.system_capacity_kwp\} kWp\` : '–'\}\s*<\/span>\s*<span className="text-\[10px\] text-stone-500 block mt-0\.5">\s*\{proj\.no_of_modules \? \`\$\{proj\.no_of_modules\} Modules\` : ''\}\s*<\/span>\s*<\/td>\s*<td className="py-2\.5 text-\[11px\]">\s*<p className="font-semibold text-stone-800">\{proj\.inverter_make \|\| '–'\}<\/p>\s*<p className="text-\[10px\] font-mono text-stone-500">\{proj\.inverter_serial_no \|\| '–'\}<\/p>\s*<\/td>/;
content = content.replace(tdsToRemove, "");

// 3. Make select optimistic
const selectTarget = `<select
                                                                value={proj.delivery_status || 'PENDING'}
                                                                onChange={async (e) => {
                                                                    const newStat = e.target.value;
                                                                    try {
                                                                        await supabase.from('admin').update({ delivery_status: newStat }).eq('id', proj.id);
                                                                        if (onRefreshCustomers) onRefreshCustomers();
                                                                    } catch(err) {}
                                                                }}
                                                                className={\`text-[10px] font-extrabold px-2 py-0.5 rounded-md outline-none cursor-pointer \${
                                                                    proj.delivery_status === 'DELIVERED' 
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                                        : 'bg-stone-100 text-stone-600 border border-stone-300'
                                                                }\`}`;

const currentStatusVal = "(localStatusOverrides[proj.id] || proj.delivery_status || 'PENDING')";
const selectReplacement = `<select
                                                                value={${currentStatusVal}}
                                                                onChange={async (e) => {
                                                                    const newStat = e.target.value;
                                                                    setLocalStatusOverrides(prev => ({ ...prev, [proj.id]: newStat }));
                                                                    try {
                                                                        await supabase.from('admin').update({ delivery_status: newStat }).eq('id', proj.id);
                                                                        if (onRefreshCustomers) onRefreshCustomers();
                                                                    } catch(err) {}
                                                                }}
                                                                className={\`text-[10px] font-extrabold px-2 py-0.5 rounded-md outline-none cursor-pointer \${
                                                                    ${currentStatusVal} === 'DELIVERED' 
                                                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                                                        : 'bg-stone-100 text-stone-600 border border-stone-300'
                                                                }\`}`;

content = content.replace(selectTarget, selectReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log("Optimized DeliveryBatchesView status and removed columns.");
