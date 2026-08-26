const fs = require('fs');
let file = 'src/components/VendorPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/font-size: 11pt !important;/g, 'font-size: 8.5pt !important;');
content = content.replace(/font-size: 12pt !important;/g, 'font-size: 10pt !important;');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated VendorPortal print styles.");
