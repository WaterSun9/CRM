const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace vendor with rent_amount and car_rent_paid in handleOpenCreateModal
content = content.replace(
    /vendor: vendorsList\[0\] \|\| '',/g,
    "rent_amount: '',\n            car_rent_paid: '',"
);

// Replace vendor with rent_amount and car_rent_paid in handleOpenEditModal
content = content.replace(
    /vendor: batch\.vendor \|\| '',/g,
    "rent_amount: batch.rent_amount || '',\n            car_rent_paid: batch.car_rent_paid || '',"
);

// Fix print layout where batch.vendor is displayed
content = content.replace(
    /batch\.vendor \|\| '–'/g,
    "batch.rent_amount ? `₹ ${toIndianCommas(batch.rent_amount)}` : '–'"
);
// In print, "Allotted Vendor:" label to "Rent Amount:"
content = content.replace(
    /Allotted Vendor:/g,
    "Rent Amount:"
);
// Maybe another label
content = content.replace(
    /<span className="text-stone-400">Warehouse:<\/span> <span className="font-bold text-stone-900">\{batch.vendor \|\| '–'\}<\/span>/g,
    '<span className="text-stone-400">Rent Amount:</span> <span className="font-bold text-stone-900">{batch.rent_amount ? `₹ ${toIndianCommas(batch.rent_amount)}` : \'–\'}</span>'
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated form state.");
