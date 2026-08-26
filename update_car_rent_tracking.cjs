const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<select
                                                    value={batch.car_rent_paid || 'No'}
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, car_rent_paid: val } : b);
                                                        setBatches(updatedBatches);
                                                        if (!isDemoMode) {
                                                            try { await supabase.from('delivery_batches').update({ car_rent_paid: val }).eq('id', batch.id); } catch(err) {}
                                                        }
                                                    }}
                                                    className={\`text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer outline-none shadow-xs \${batch.car_rent_paid === 'Yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}\`}
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>`;

const replacement = `<select
                                                    value={batch.car_rent_paid || 'No'}
                                                    onChange={async (e) => {
                                                        const val = e.target.value;
                                                        const userIdentifier = currentUser?.name || currentUser?.email || 'Admin';
                                                        const timestamp = new Date().toISOString();
                                                        
                                                        const updates = { 
                                                            car_rent_paid: val,
                                                            car_rent_paid_by: val === 'Yes' ? userIdentifier : null,
                                                            car_rent_paid_at: val === 'Yes' ? timestamp : null
                                                        };
                                                        
                                                        const updatedBatches = batches.map(b => b.id === batch.id ? { ...b, ...updates } : b);
                                                        setBatches(updatedBatches);
                                                        
                                                        if (!isDemoMode) {
                                                            try { await supabase.from('delivery_batches').update(updates).eq('id', batch.id); } catch(err) {}
                                                        }
                                                    }}
                                                    className={\`text-[10px] font-extrabold px-1.5 py-0.5 rounded cursor-pointer outline-none shadow-xs \${batch.car_rent_paid === 'Yes' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}\`}
                                                >
                                                    <option value="No">No</option>
                                                    <option value="Yes">Yes</option>
                                                </select>
                                            </div>
                                            {batch.car_rent_paid === 'Yes' && batch.car_rent_paid_by && (
                                                <span className="text-[9px] text-stone-400 italic">
                                                    (Paid by {batch.car_rent_paid_by} on {batch.car_rent_paid_at ? new Date(batch.car_rent_paid_at).toLocaleDateString('en-IN') : 'Unknown'})
                                                </span>
                                            )}`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Added Car Rent Paid Tracking.");
