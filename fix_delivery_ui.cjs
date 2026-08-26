const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Warehouse / Allotted Vendor <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={batchForm.vendor}
                                            onChange={e => setBatchForm(p => ({ ...p, vendor: e.target.value }))}
                                            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400"
                                        >
                                            <option value="">Select Vendor...</option>
                                            {vendorsList.map(v => (
                                                <option key={v} value={v}>{v}</option>
                                            ))}
                                        </select>
                                    </div>`;

const replacement = `<div>
                                        <label className="text-[9px] font-bold text-stone-400 uppercase tracking-wider block mb-1">
                                            Rent Amount <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs font-bold">₹</span>
                                            <input
                                                type="text"
                                                value={formatInputValue(batchForm.rent_amount)}
                                                onChange={e => setBatchForm(p => ({ ...p, rent_amount: parseIndianNumber(e.target.value) }))}
                                                placeholder="0"
                                                className="w-full bg-white border border-stone-200 rounded-xl pl-6 pr-3 py-2 text-xs font-bold text-stone-800 outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                                            />
                                        </div>
                                    </div>
                                    <div>
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

content = content.replace(target, replacement);

// We need to change the grid layout to accommodate the extra field.
// Let's find `<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">` inside Section A: Delivery Details
content = content.replace(
    '<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">',
    '<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">'
);
// Wait, is it sm:grid-cols-2? Let's check.
fs.writeFileSync(file, content, 'utf8');
console.log("Updated UI block.");
