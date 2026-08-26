const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const staticBadge = `<span className={\`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full \${
                                                batch.status === 'DELIVERED' 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                            }\`}>
                                                {batch.status === 'DELIVERED' ? 'Delivered' : 'In Transit'}
                                            </span>`;

const interactiveBadge = `<select
                                                value={batch.status || 'IN_TRANSIT'}
                                                onChange={async (e) => {
                                                    const newStatus = e.target.value;
                                                    const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, status: newStatus } : b);
                                                    setBatches(updatedBatches);
                                                    if (isDemoMode) {
                                                        localStorage.setItem('watersun_demo_delivery_batches', JSON.stringify(updatedBatches));
                                                    } else {
                                                        localStorage.setItem('watersun_local_delivery_batches', JSON.stringify(updatedBatches));
                                                        try {
                                                            await supabase.from('delivery_batches').update({ status: newStatus }).eq('id', batch.id);
                                                        } catch(err) {}
                                                    }
                                                }}
                                                className={\`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full outline-none cursor-pointer appearance-none \${
                                                    batch.status === 'DELIVERED' 
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                                                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                }\`}
                                            >
                                                <option value="IN_TRANSIT">In Transit</option>
                                                <option value="DELIVERED">Delivered</option>
                                            </select>`;

content = content.replace(staticBadge, interactiveBadge);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated batch card badge to interactive select.");
