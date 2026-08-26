const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace "Allotted Vendor / Point:" in print layout
content = content.replace(
    /<td className="p-2 bg-stone-50 font-bold text-stone-600">Allotted Vendor \/ Point:<\/td>\s*<td className="p-2 font-bold text-stone-900">\{printingBatch\.vendor \|\| '–'\}<\/td>/,
    `<td className="p-2 bg-stone-50 font-bold text-stone-600">Rent Amount:</td>
                                            <td className="p-2 font-bold text-stone-900">{printingBatch.rent_amount ? \`₹ \${toIndianCommas(printingBatch.rent_amount)}\` : '–'}</td>`
);

// We should also add Car Rent Paid to the print layout. Maybe under Total Sites. Let's add a new row.
content = content.replace(
    /<td className="p-2 bg-stone-50 font-bold text-stone-600">Total Sites:<\/td>\s*<td className="p-2 font-bold text-stone-900">\{\(printingBatch\.project_ids \|\| \[\]\)\.length\} Drop-off Locations<\/td>\s*<\/tr>/,
    `<td className="p-2 bg-stone-50 font-bold text-stone-600">Total Sites:</td>
                                            <td className="p-2 font-bold text-stone-900">{(printingBatch.project_ids || []).length} Drop-off Locations</td>
                                        </tr>
                                        <tr>
                                            <td className="p-2 bg-stone-50 font-bold text-stone-600">Car Rent Paid:</td>
                                            <td className="p-2 font-bold text-stone-900" colSpan={3}>{printingBatch.car_rent_paid || '–'}</td>
                                        </tr>`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated print layout.");
