const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Define isAllDelivered
const oldVars = `const batchKwp = linkedProjects.reduce((sum, p) => sum + (parseFloat(p.system_capacity_kwp) || 0), 0);
                        const totalModules = linkedProjects.reduce((sum, p) => sum + (parseInt(p.no_of_modules) || 0), 0);`;

const newVars = `const batchKwp = linkedProjects.reduce((sum, p) => sum + (parseFloat(p.system_capacity_kwp) || 0), 0);
                        const totalModules = linkedProjects.reduce((sum, p) => sum + (parseInt(p.no_of_modules) || 0), 0);
                        const isAllDelivered = linkedProjects.length > 0 && linkedProjects.every(p => (localStatusOverrides[p.id] || p.delivery_status) === 'DELIVERED');`;

content = content.replace(oldVars, newVars);

// 2. Modify Button
const oldButton = `<button
                                            type="button"
                                            onClick={async () => {
                                                const newOverrides = { ...localStatusOverrides };
                                                linkedProjects.forEach(p => newOverrides[p.id] = 'DELIVERED');
                                                setLocalStatusOverrides(newOverrides);

                                                const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, status: 'DELIVERED' } : b);
                                                setBatches(updatedBatches);
                                                
                                                if (!isDemoMode) {
                                                    try {
                                                        await supabase.from('delivery_batches').update({ status: 'DELIVERED' }).eq('id', batch.id);
                                                        const projectIds = linkedProjects.map(p => p.id);
                                                        if (projectIds.length > 0) {
                                                            await supabase.from('admin').update({ delivery_status: 'DELIVERED' }).in('id', projectIds);
                                                        }
                                                        if (onRefreshCustomers) onRefreshCustomers();
                                                    } catch(err) {}
                                                }
                                            }}
                                            className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition cursor-pointer shadow-xs border border-emerald-200"
                                        >
                                            ✓ Mark All Delivered
                                        </button>`;

const newButton = `<button
                                            type="button"
                                            disabled={isAllDelivered}
                                            onClick={async () => {
                                                const newOverrides = { ...localStatusOverrides };
                                                linkedProjects.forEach(p => newOverrides[p.id] = 'DELIVERED');
                                                setLocalStatusOverrides(newOverrides);

                                                const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, status: 'DELIVERED' } : b);
                                                setBatches(updatedBatches);
                                                
                                                if (!isDemoMode) {
                                                    try {
                                                        await supabase.from('delivery_batches').update({ status: 'DELIVERED' }).eq('id', batch.id);
                                                        const projectIds = linkedProjects.map(p => p.id);
                                                        if (projectIds.length > 0) {
                                                            await supabase.from('admin').update({ delivery_status: 'DELIVERED' }).in('id', projectIds);
                                                        }
                                                        if (onRefreshCustomers) onRefreshCustomers();
                                                    } catch(err) {}
                                                }
                                            }}
                                            className={\`px-3 py-1 rounded text-[10px] font-black uppercase tracking-wider transition shadow-xs border \${
                                                isAllDelivered 
                                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200 cursor-default opacity-80' 
                                                    : 'bg-stone-100 hover:bg-emerald-50 text-stone-600 hover:text-emerald-700 border-stone-200 hover:border-emerald-200 cursor-pointer'
                                            }\`}
                                        >
                                            {isAllDelivered ? '✓ All Delivered' : 'Mark All Delivered'}
                                        </button>`;

content = content.replace(oldButton, newButton);

fs.writeFileSync(file, content, 'utf8');
console.log("Styled mark all delivered button.");
