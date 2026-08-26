const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Fix eligible projects logic
const oldEligible = `const eligibleProjects = useMemo(() => {
        return customers.filter(c => {
            if (c.deleted_at) return false;
            const matchesQuery = !projectSearchQuery || `;

const newEligible = `const eligibleProjects = useMemo(() => {
        return customers.filter(c => {
            if (c.deleted_at) return false;
            const isAvailable = !c.delivery_batch_id || (editingBatch && c.delivery_batch_id === editingBatch.batch_no);
            if (!isAvailable) return false;
            const matchesQuery = !projectSearchQuery || `;

content = content.replace(oldEligible, newEligible);

// 2. Remove Batch Status and Car Rent Paid from inside the Edit Modal
const insideInputs = /<div>\s*<label className="text-\[9px\] font-bold text-stone-400 uppercase tracking-wider block mb-1">\s*Car Rent Paid[\s\S]*?<\/select>\s*<\/div>\s*<div>\s*<label className="text-\[9px\] font-bold text-stone-400 uppercase tracking-wider block mb-1">\s*Batch Status[\s\S]*?<\/select>\s*<\/div>/;
content = content.replace(insideInputs, "");

// 3. Add Car Rent Paid to outside batch card
const oldVendorSpan = /\{batch\.vendor && \(\s*<span className="flex items-center gap-1 font-medium text-stone-500">\s*<Package size=\{12\} className="text-stone-400" \/> Vendor: <strong className="text-stone-700">\{batch\.vendor\}<\/strong>\s*<\/span>\s*\)\}/;

const newVendorAndCarRent = `{batch.vendor && (
                                                <span className="flex items-center gap-1 font-medium text-stone-500">
                                                    <Package size={12} className="text-stone-400" /> Vendor: <strong className="text-stone-700">{batch.vendor}</strong>
                                                </span>
                                            )}
                                            <span className="h-3 w-px bg-stone-300 mx-1"></span>
                                            <div className="flex items-center gap-1.5 font-medium text-stone-500">
                                                <span className="text-[10px] uppercase font-bold text-stone-400">Car Rent Paid:</span>
                                                <select
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

content = content.replace(oldVendorSpan, newVendorAndCarRent);

// 4. Add "Mark All Delivered" button to expanded summary bar
const oldSummaryBtn = /<button\s*type="button"\s*onClick=\{\(\) => setExpandedBatchId\(isExpanded \? null : batch\.id\)\}\s*className="text-amber-700 hover:text-amber-800 font-bold text-\[11px\] flex items-center gap-1 cursor-pointer"\s*>/;

const newSummaryBtn = `<div className="flex items-center gap-3">
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
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                                            className="text-amber-700 hover:text-amber-800 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                                        >`;

content = content.replace(oldSummaryBtn, newSummaryBtn);

fs.writeFileSync(file, content, 'utf8');
console.log("Applied all delivery batch logic fixes.");
