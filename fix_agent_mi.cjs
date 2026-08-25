const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetMIStr = `                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_value ? \`₹\${toIndianCommas(selectedCust.invoice_value)}\` : '–'}</span>
                                        </div>
                                    </div>`;

const newMIStr = `                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wide">Invoice Value</span>
                                            <span className="font-semibold text-stone-900">{selectedCust.invoice_value ? \`₹\${toIndianCommas(selectedCust.invoice_value)}\` : '–'}</span>
                                        </div>
                                    </div>

                                    <div className="rounded-xl border border-stone-200/80 bg-white p-3 space-y-2 mt-4">
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
                                                onClick={() => handleUpdateCustomerField(selectedCust.id, { 
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

content = content.replace(targetMIStr, newMIStr);

// 2. Material Delivery Details
const targetMDStr = `                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Truck size={11} /> Material Delivery Details
                                        </h5>
                                    </div>`;

const newMDStr = `                                <div className="bg-stone-50/80 p-4 rounded-2xl border border-stone-150/70 space-y-4">
                                    <div className="flex items-center justify-between gap-3 border-b border-stone-150 pb-2 mb-1">
                                        <h5 className="text-[9px] font-black text-stone-400 uppercase tracking-widest flex items-center gap-1.5">
                                            <Truck size={11} /> Material Delivery Details
                                        </h5>
                                    </div>
                                    
                                    <div className="rounded-xl border border-stone-200/80 bg-white p-3 space-y-3">
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
                                                onClick={() => handleUpdateCustomerField(selectedCust.id, { vendor: editData.vendor, invoice_no: editData.invoice_no, delivery_date: editData.delivery_date, truck_no: editData.truck_no, driver_name: editData.driver_name, driver_phone: editData.driver_phone })}
                                                disabled={saving}
                                                className="bg-blue-600 hover:bg-blue-700 text-white py-1.5 px-3 rounded-lg text-xs font-bold transition-all"
                                            >
                                                Save Delivery Details
                                            </button>
                                        </div>
                                    </div>`;

content = content.replace(targetMDStr, newMDStr);

// 3. SFDC Photo Checklist
const targetSFDCStr = `<label className="flex items-center gap-2 mt-3 p-2 bg-stone-50 rounded-lg border border-stone-100 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editData.geo_tag_photo_checked || false}
                                            onChange={(e) => setEditData(prev => ({ ...prev, geo_tag_photo_checked: e.target.checked }))}
                                            className="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold text-stone-700">Geo Tag Photo Available</span>
                                    </label>`;

const newSFDCStr = `<label className="flex items-center gap-2 mt-3 p-2 bg-stone-50 rounded-lg border border-stone-100 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editData.geo_tag_photo_checked || false}
                                            onChange={(e) => setEditData(prev => ({ ...prev, geo_tag_photo_checked: e.target.checked }))}
                                            className="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold text-stone-700">Geo Tag Photo Available</span>
                                    </label>
                                    <label className="flex items-center gap-2 mt-2 p-2 bg-stone-50 rounded-lg border border-stone-100 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editData.sfdc_photo || false}
                                            onChange={(e) => {
                                                setEditData(prev => ({ ...prev, sfdc_photo: e.target.checked }));
                                                handleUpdateCustomerField(selectedCust.id, { sfdc_photo: e.target.checked });
                                            }}
                                            className="w-4 h-4 rounded border-stone-300 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-xs font-bold text-stone-700">SFDC Photo Available</span>
                                    </label>`;

content = content.replace(targetSFDCStr, newSFDCStr);

fs.writeFileSync(file, content, 'utf8');
console.log('Added MI, MD, and SFDC fields');
