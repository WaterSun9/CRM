const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialIntegrationTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// The goal is to shrink fonts and padding just enough to prevent spillage to page 3.
// Reduce font sizes:
// h1: 13pt -> 12pt
// h3: 11pt -> 9.5pt
// table/th/td/p: 11pt -> 8.5pt

content = content.replace(/font-size: 13pt !important;/g, 'font-size: 12pt !important;');
content = content.replace(/font-size: 11pt !important;/g, 'font-size: 8.5pt !important;'); 

// The original table size was 6.8pt. 8.5pt is a 25% increase and should be much more legible while saving space.

// Let's also restore the height and overflow restrictions if they help force page breaks properly,
// but actually they might be what's CAUSING the weird page 3 spillage if it overflows the hidden box but prints anyway?
// Wait, I commented out overflow: hidden earlier. Let's put it back to ensure page 1 is strictly page 1, page 2 is strictly page 2.
content = content.replace(/\/\* height: 285mm !important; \*\//g, 'height: 285mm !important;');
content = content.replace(/\/\* max-height: 285mm !important; \*\//g, 'max-height: 285mm !important;');
content = content.replace(/\/\* overflow: hidden !important; \*\//g, 'overflow: hidden !important;');

// Let's check margins and paddings
content = content.replace(/margin-bottom: 2mm !important;/g, 'margin-bottom: 1.5mm !important;');
content = content.replace(/margin-bottom: 2\.5mm !important;/g, 'margin-bottom: 1.5mm !important;');
content = content.replace(/padding-bottom: 4mm !important;/g, 'padding-bottom: 2mm !important;');
content = content.replace(/padding-top: 3mm !important;/g, 'padding-top: 1.5mm !important;');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated MaterialIntegrationTab print styles for better fit.");

