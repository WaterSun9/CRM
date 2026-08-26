const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// Header
content = content.replace(
    `<th className="pb-2">Current Stage</th>`,
    `<th className="pb-2">Current Stage</th>\n                                                    <th className="pb-2">Location Status</th>`
);

// Cell
const oldCell = `<td className="py-2.5">
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                                                                {PRIMARY_STAGES.find(s => s.id === proj.stage)?.label || proj.stage}
                                                            </span>
                                                        </td>`;

const newCell = `<td className="py-2.5">
                                                            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-stone-100 text-stone-800 border border-stone-200">
                                                                {PRIMARY_STAGES.find(s => s.id === proj.stage)?.label || proj.stage}
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5">
                                                            <select
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
                                                                }\`}
                                                            >
                                                                <option value="PENDING">Pending</option>
                                                                <option value="IN_TRANSIT">In Transit</option>
                                                                <option value="DELIVERED">Delivered</option>
                                                            </select>
                                                        </td>`;
content = content.replace(oldCell, newCell);

fs.writeFileSync(file, content, 'utf8');
console.log("Added location status toggle to batch projects table.");
