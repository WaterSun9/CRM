const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialIntegrationTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// I need to specifically target h3 and make it 9.5pt
// Let's look for `#native-print-portal h3 { font-size: 8.5pt !important;`
content = content.replace(/#native-print-portal h3 \{ font-size: 8\.5pt !important;/g, '#native-print-portal h3 { font-size: 9.5pt !important;');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated h3 font size in MaterialIntegrationTab.");
