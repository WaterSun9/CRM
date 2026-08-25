const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetEquipmentStr = `<div className="rounded-xl border border-stone-200/80 bg-white p-3 space-y-2 mt-4">
                                        <h6 className="border-b border-stone-100 pb-2 text-[9px] font-black uppercase tracking-widest text-stone-400">Inverter & Equipment Details</h6>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Inverter Make *</label>
                                                <input
                                                    type="text"
                                                    value={editData.inverter_make ?? selectedCust.inverter_make ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, inverter_make: e.target.value }))}
                                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Inverter Serial No. *</label>
                                                <input
                                                    type="text"
                                                    value={editData.inverter_serial_no ?? selectedCust.inverter_serial_no ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, inverter_serial_no: e.target.value }))}
                                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                                                />
                                            </div>
                                            <div className="md:col-span-2">
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Panel Serial Numbers</label>
                                                <textarea
                                                    value={editData.panel_serial_numbers ?? selectedCust.panel_serial_numbers ?? ''}
                                                    onChange={e => setEditData(prev => ({ ...prev, panel_serial_numbers: e.target.value }))}
                                                    className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-2 text-xs font-semibold text-stone-800 h-16"
                                                    placeholder="Enter serial numbers..."
                                                />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <button
                                                onClick={() => handleUpdateCustomer(selectedCust.id, { 
                                                    inverter_make: editData.inverter_make, 
                                                    inverter_serial_no: editData.inverter_serial_no, 
                                                    panel_serial_numbers: editData.panel_serial_numbers 
                                                })}
                                                disabled={saving}
                                                className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Save Equipment Details
                                            </button>
                                        </div>
                                    </div>`;

const newEquipmentStr = `<div className="flex items-center justify-between py-2 border-t border-stone-200/50 mt-2 pt-3">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Inverter Make</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.inverter_make || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Inverter Serial No</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.inverter_serial_no || '–'}</span>
                                        </div>
                                        <div className="flex flex-col gap-1 py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Panel Serial Numbers</span>
                                            <div className="font-semibold text-stone-700 bg-stone-100 p-2.5 rounded-lg text-[10px] whitespace-pre-wrap break-all min-h-[40px] border border-stone-200">
                                                {selectedCust.panel_serial_numbers || '–'}
                                            </div>
                                        </div>`;


const targetMDStr = `<div className="rounded-xl border border-stone-200/80 bg-white p-3 space-y-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Vendor Allotment *</label>
                                            <select
                                                value={editData.vendor || selectedCust.vendor || ''}
                                                onChange={e => setEditData(prev => ({ ...prev, vendor: e.target.value }))}
                                                className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                                            >
                                                <option value="">Select Vendor...</option>
                                                {meta.vendors?.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Invoice No *</label>
                                                <input type="text" value={editData.invoice_no ?? selectedCust.invoice_no ?? ''} onChange={e => setEditData(prev => ({ ...prev, invoice_no: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Delivery Date *</label>
                                                <input type="date" value={editData.delivery_date ?? selectedCust.delivery_date ?? ''} onChange={e => setEditData(prev => ({ ...prev, delivery_date: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Vehicle / Truck No</label>
                                                <input type="text" value={editData.truck_no ?? selectedCust.truck_no ?? ''} onChange={e => setEditData(prev => ({ ...prev, truck_no: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Driver Name *</label>
                                                <input type="text" value={editData.driver_name ?? selectedCust.driver_name ?? ''} onChange={e => setEditData(prev => ({ ...prev, driver_name: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="text-[10px] font-bold text-stone-500 uppercase tracking-wide block mb-1">Driver Phone Number *</label>
                                                <input type="text" value={editData.driver_phone ?? selectedCust.driver_phone ?? ''} onChange={e => setEditData(prev => ({ ...prev, driver_phone: e.target.value }))} className="w-full bg-stone-50 border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold" />
                                            </div>
                                        </div>
                                        <div className="pt-2">
                                            <button
                                                onClick={() => handleUpdateCustomer(selectedCust.id, { vendor: editData.vendor, invoice_no: editData.invoice_no, delivery_date: editData.delivery_date, truck_no: editData.truck_no, driver_name: editData.driver_name, driver_phone: editData.driver_phone })}
                                                disabled={saving}
                                                className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Save Delivery Details
                                            </button>
                                        </div>
                                    </div>`;

const newMDStr = `<div className="divide-y divide-stone-200/50 text-xs">
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Vendor Allotment</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.vendor || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice No</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_no || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Delivery Date</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.delivery_date || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Vehicle / Truck No</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.truck_no || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Driver Name</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.driver_name || '–'}</span>
                                        </div>
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Driver Phone Number</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.driver_phone || '–'}</span>
                                        </div>
                                    </div>`;


if (content.includes(targetEquipmentStr)) {
    content = content.replace(targetEquipmentStr, newEquipmentStr);
} else {
    console.log("Could not find Equipment target string");
}

if (content.includes(targetMDStr)) {
    content = content.replace(targetMDStr, newMDStr);
} else {
    console.log("Could not find MD target string");
}

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed to view only');
