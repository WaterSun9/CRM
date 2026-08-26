const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<div className="flex items-center gap-3">
                                        <button
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

const replacement = `const isAllDelivered = linkedProjects.length > 0 && linkedProjects.every(p => (localStatusOverrides[p.id] || p.delivery_status) === 'DELIVERED');
                                    
                                    return (
                                        <div className="flex items-center gap-3">
                                        <button
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

// Wait, I am returning a snippet inside a JSX expression, but wait, this is inside the return of map.
// The button is inside JSX. I can't just throw `const isAllDelivered = ...` there unless it's before the JSX return of the map.
