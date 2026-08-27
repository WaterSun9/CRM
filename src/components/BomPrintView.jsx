import React from 'react';

export default function BomPrintView({ customer, bom, bomItems, activeType }) {
    const toIndianCommas = (num) => {
        if (!num) return '';
        const numStr = num.toString();
        const lastThree = numStr.substring(numStr.length - 3);
        const otherNumbers = numStr.substring(0, numStr.length - 3);
        if (otherNumbers !== '') {
            return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + lastThree;
        }
        return lastThree;
    };

    return (
        <div className="w-full">
            {/* ================= PAGE 1 ================= */}
            <div className="print-page-1 flex flex-col justify-between min-h-[960px] pb-6">
                <div>
                    {/* Company Header */}
                    <div className="border-b-2 border-stone-900 pb-3 mb-5 text-center relative">
                        <h1 className="text-xl font-black uppercase tracking-wider text-stone-950">Watersun Electrical Solutions Pvt Ltd</h1>
                        <p className="text-xs font-semibold text-stone-600 mt-0.5">Solar PV Project Integration & Material Loading Checklist</p>
                        <div className="flex items-center justify-between mt-2.5">
                            <div className="px-3 py-1 bg-stone-100 border border-stone-300 rounded text-[11px] font-black uppercase tracking-widest text-stone-800">
                                BILL OF MATERIALS (BOM) — {activeType || bom?.bom_type || 'General'} TYPE
                            </div>
                            <div className="px-2.5 py-0.5 bg-stone-900 text-white font-black text-[10px] rounded uppercase tracking-wider">
                                Page 1 of 2
                            </div>
                        </div>
                    </div>

                    {/* Section 1: Customer & Site Details */}
                    <div className="mb-5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">1. Customer & Site Reference</h3>
                        <table className="w-full text-xs border border-stone-300">
                            <tbody>
                                <tr className="border-b border-stone-200">
                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Customer Name:</td>
                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{customer?.customer_name || '–'}</td>
                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Phone Number:</td>
                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{customer?.phone_number || '–'}</td>
                                </tr>
                                <tr className="border-b border-stone-200">
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Email Address:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.email_address || customer?.email || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Consumer No:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.consumer_no || '–'}</td>
                                </tr>
                                <tr className="border-b border-stone-200">
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Villages:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.villages || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Sub Division:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.sub_divisions || '–'}</td>
                                </tr>
                                <tr className="border-b border-stone-200">
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Channel Partner Name:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.channel_partner || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Sub Channel Partner Name:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.sub_channel_partner || '–'}</td>
                                </tr>
                                <tr className="border-b border-stone-200">
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">MODULE BRAND:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.module_brand || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">MODULE WP:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.module_wp || '–'}</td>
                                </tr>
                                <tr>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">No of Modules:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{customer?.no_of_modules || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">System Capacity (kWp):</td>
                                    <td className="p-1.5 font-bold text-stone-900">
                                        {customer?.system_capacity_kwp ? `${toIndianCommas(customer.system_capacity_kwp)} kWp` : '–'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 2: Material Order Specifications */}
                    <div className="mb-5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">2. Material Order Specifications</h3>
                        <table className="w-full text-xs border border-stone-300">
                            <tbody>
                                <tr className="border-b border-stone-200">
                                    <td className="w-1/4 p-2 bg-stone-50 font-bold text-stone-600">Roof / Shed:</td>
                                    <td className="w-1/4 p-2 font-bold text-stone-900">{customer?.roof_shed || '–'}</td>
                                    <td className="w-1/4 bg-stone-50 font-bold text-stone-600">Structure Leg Height:</td>
                                    <td className="w-1/4 p-2 font-bold text-stone-900">
                                        {customer?.structure_front_leg_height
                                            ? `Front: ${customer?.structure_front_leg_height} ft / Rear: ${customer?.structure_rear_leg_height || '–'} ft`
                                            : '–'}
                                    </td>
                                </tr>
                                <tr className="border-b border-stone-200">
                                    <td className="p-2 bg-stone-50 font-bold text-stone-600">DC Cable Length:</td>
                                    <td className="p-2 font-bold text-stone-900">{customer?.dc_cable ? `${customer.dc_cable} Meters` : '–'}</td>
                                    <td className="p-2 bg-stone-50 font-bold text-stone-600">AC Cable Length:</td>
                                    <td className="p-2 font-bold text-stone-900">{customer?.ac_cable ? `${customer.ac_cable} Meters` : '–'}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 bg-stone-50 font-bold text-stone-600">Estimated Invoice Value:</td>
                                    <td colSpan={3} className="p-2 font-bold text-stone-900">{customer?.invoice_value ? `₹ ${toIndianCommas(customer.invoice_value)}` : '–'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 3: Procurement Milestones */}
                    <div className="mb-5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">3. Procurement & Loading Milestones</h3>
                        <table className="w-full text-xs border border-stone-300">
                            <tbody>
                                <tr className="border-b border-stone-200">
                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Paper Prepared By:</td>
                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{bom?.paper_prepared_by || '–'}</td>
                                    <td className="w-1/4 p-1.5 bg-stone-50 font-bold text-stone-600">Paper Prepared Date:</td>
                                    <td className="w-1/4 p-1.5 font-bold text-stone-900">{bom?.paper_prepared_date || '–'}</td>
                                </tr>
                                <tr>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Material Loaded By:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{bom?.material_loaded_by || '–'}</td>
                                    <td className="p-1.5 bg-stone-50 font-bold text-stone-600">Material Loaded Date:</td>
                                    <td className="p-1.5 font-bold text-stone-900">{bom?.material_loaded_date || '–'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Section 4: Equipment Assignment */}
                    <div className="mb-5">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">4. Equipment Serial Assignment</h3>
                        <table className="w-full text-xs border border-stone-300">
                            <tbody>
                                <tr className="border-b border-stone-200">
                                    <td className="w-1/3 p-2 bg-stone-50 font-bold text-stone-600">Inverter Make / Brand:</td>
                                    <td className="w-2/3 p-2 font-bold text-stone-900">{customer?.inverter_make || '–'}</td>
                                </tr>
                                <tr>
                                    <td className="p-2 bg-stone-50 font-bold text-stone-600">Inverter Serial Number(s):</td>
                                    <td className="p-2 font-bold text-stone-900 font-mono tracking-wide">{customer?.inverter_serial_no || '–'}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Footer Section Page 1 */}
                <div className="mt-8 border-t border-stone-300 pt-4 flex justify-between text-[10px] text-stone-500 font-semibold">
                    <div>Ref: {customer?.consumer_no || customer?.folder_no || 'N/A'}</div>
                    <div>Generated via Watersun Electrical Solutions Portal</div>
                </div>
            </div>

            {/* ================= PAGE 2 ================= */}
            <div className="print-page-2 flex flex-col justify-between min-h-[960px] pt-6 pb-6 page-break-before">
                <div>
                    <div className="flex items-center justify-between mb-4 border-b-2 border-stone-900 pb-2">
                        <h2 className="text-sm font-black uppercase tracking-wider text-stone-950">Detailed Itemized BOM</h2>
                        <div className="px-2.5 py-0.5 bg-stone-900 text-white font-black text-[10px] rounded uppercase tracking-wider">
                            Page 2 of 2
                        </div>
                    </div>

                    <table className="w-full text-[10px] border border-stone-300">
                        <thead className="bg-stone-100 text-stone-700">
                            <tr>
                                <th className="p-2 border border-stone-300 text-left font-black w-8">#</th>
                                <th className="p-2 border border-stone-300 text-left font-black w-24">Item No</th>
                                <th className="p-2 border border-stone-300 text-left font-black">Description</th>
                                <th className="p-2 border border-stone-300 text-center font-black w-16">Qty Req</th>
                                <th className="p-2 border border-stone-300 text-center font-black w-16">Supplied</th>
                                <th className="p-2 border border-stone-300 text-center font-black w-20">Remaining</th>
                                <th className="p-2 border border-stone-300 text-left font-black w-24">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(bomItems && bomItems.length > 0) ? (
                                bomItems.map((item, idx) => (
                                    <tr key={idx} className="border-b border-stone-200">
                                        <td className="p-2 border-r border-stone-300 text-center font-bold text-stone-500">{idx + 1}</td>
                                        <td className="p-2 border-r border-stone-300 font-mono text-stone-600">{item.item_no || '–'}</td>
                                        <td className="p-2 border-r border-stone-300 font-semibold text-stone-900">{item.description || '–'}</td>
                                        <td className="p-2 border-r border-stone-300 text-center font-bold text-stone-700">{item.quantity_required ?? '–'}</td>
                                        <td className="p-2 border-r border-stone-300 text-center font-bold text-stone-700">{item.quantity_supplied ?? '0'}</td>
                                        <td className="p-2 border-r border-stone-300 text-center font-bold text-stone-900 bg-stone-50">
                                            {Number(item.quantity_required || 0) - Number(item.quantity_supplied || 0)}
                                        </td>
                                        <td className="p-2 text-stone-600">{item.remarks || ''}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="p-6 text-center text-stone-400 font-semibold italic border-t border-stone-300">
                                        No itemized BOM rows recorded yet.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                    <div className="mt-8 pt-4">
                        <h3 className="text-xs font-black uppercase tracking-wider text-stone-900 border-b border-stone-400 pb-1 mb-2">5. Verification Signatures</h3>
                        <div className="flex gap-8 mt-12">
                            <div className="flex-1 text-center">
                                <div className="border-b border-stone-400 w-3/4 mx-auto mb-2"></div>
                                <div className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">Authorized By (Signature)</div>
                            </div>
                            <div className="flex-1 text-center">
                                <div className="border-b border-stone-400 w-3/4 mx-auto mb-2"></div>
                                <div className="text-[10px] font-bold text-stone-600 uppercase tracking-widest">Received By (Signature)</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-8 border-t border-stone-300 pt-4 flex justify-between text-[10px] text-stone-500 font-semibold">
                    <div>Ref: {customer?.consumer_no || customer?.folder_no || 'N/A'}</div>
                    <div>Generated via Watersun Electrical Solutions Portal</div>
                </div>
            </div>
        </div>
    );
}
