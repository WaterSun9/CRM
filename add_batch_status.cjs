const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// We will add the status dropdown to the form.
// Let's find "Car Rent Paid" block and insert it after.
const target = `<div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Car Rent Paid <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={batchForm.car_rent_paid || ''}
                                            onChange={e => setBatchForm(p => ({ ...p, car_rent_paid: e.target.value }))}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        >
                                            <option value="">Select...</option>
                                            <option value="Yes">Yes</option>
                                            <option value="No">No</option>
                                        </select>
                                    </div>`;

const replacement = target + `
                                    <div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Batch Status <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={batchForm.status || 'IN_TRANSIT'}
                                            onChange={e => setBatchForm(p => ({ ...p, status: e.target.value }))}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        >
                                            <option value="IN_TRANSIT">In Transit</option>
                                            <option value="DELIVERED">Delivered</option>
                                        </select>
                                    </div>`;

content = content.replace(target, replacement);

// Also need to make grid 4 cols if we added another field? Or 3 cols is fine?
// Actually if we have Rent Amount, Car Rent Paid, and Batch Status, that's 3 inputs in that row. Wait, Driver Name, Driver Phone, Vehicle Number are above.
// Let's check how many fields are in the grid.
fs.writeFileSync(file, content, 'utf8');
console.log("Added status dropdown.");
