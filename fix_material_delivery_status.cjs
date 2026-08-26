const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialDeliveryTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const topBarOld = `<div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest">Material Delivery & Dispatch</h4>
                    <p className="text-[11px] text-stone-500 font-medium">Vendor assignment, equipment serial numbers and dispatch note.</p>
                </div>
                <div className="flex items-center gap-2">`;

const topBarNew = `<div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                <div>
                    <h4 className="text-xs font-bold text-stone-700 uppercase tracking-widest flex items-center gap-3">
                        Material Delivery & Dispatch
                        <select
                            value={editData.delivery_status || 'PENDING'}
                            onChange={async (e) => {
                                const newStat = e.target.value;
                                setEditData(p => ({ ...p, delivery_status: newStat }));
                                try {
                                    await onUpdate(customer.id, { delivery_status: newStat });
                                } catch(err) {}
                            }}
                            className={\`text-[9px] font-extrabold px-2 py-0.5 rounded-full outline-none cursor-pointer tracking-normal \${
                                editData.delivery_status === 'DELIVERED' 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                            }\`}
                        >
                            <option value="PENDING">Status: Pending</option>
                            <option value="IN_TRANSIT">Status: In Transit</option>
                            <option value="DELIVERED">Status: Delivered</option>
                        </select>
                    </h4>
                    <p className="text-[11px] text-stone-500 font-medium mt-1">Vendor assignment, equipment serial numbers and dispatch note.</p>
                </div>
                <div className="flex items-center gap-2">`;

content = content.replace(topBarOld, topBarNew);

fs.writeFileSync(file, content, 'utf8');
console.log("Added delivery status toggle to MaterialDeliveryTab.");
