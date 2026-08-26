const fs = require('fs');

// Fix MaterialIntegrationTab.jsx
let matFile = 'src/components/modal-tabs/MaterialIntegrationTab.jsx';
let matContent = fs.readFileSync(matFile, 'utf8');
matContent = matContent.replace(/font-size: 16pt !important;/g, 'font-size: 13pt !important;'); // h1
matContent = matContent.replace(/font-size: 12pt !important;/g, 'font-size: 11pt !important;'); // h3
fs.writeFileSync(matFile, matContent, 'utf8');
console.log("Updated headings in MaterialIntegrationTab");

// Fix VendorPortal.jsx
let vendorFile = 'src/components/VendorPortal.jsx';
let vendorContent = fs.readFileSync(vendorFile, 'utf8');
vendorContent = vendorContent.replace(/font-size: 14pt !important;/g, 'font-size: 12pt !important;'); // headings
fs.writeFileSync(vendorFile, vendorContent, 'utf8');
console.log("Updated headings in VendorPortal");

