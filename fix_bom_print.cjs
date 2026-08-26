const fs = require('fs');
const file = 'src/components/modal-tabs/MaterialIntegrationTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// I will just use replace to bump up font sizes
content = content.replace(/font-size: 11\.5pt !important;/g, 'font-size: 16pt !important;'); // h1
content = content.replace(/font-size: 7\.5pt !important;/g, 'font-size: 12pt !important;'); // h3
content = content.replace(/font-size: 6\.8pt !important;/g, 'font-size: 11pt !important;'); // table, th
// Let's also add body font size
content = content.replace(/#native-print-portal p \{ line-height/g, '#native-print-portal p { font-size: 11pt !important; line-height');

// Also remove height restraints if it overflows!
content = content.replace(/height: 285mm !important;/g, '/* height: 285mm !important; */');
content = content.replace(/max-height: 285mm !important;/g, '/* max-height: 285mm !important; */');
content = content.replace(/overflow: hidden !important;/g, '/* overflow: hidden !important; */');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated MaterialIntegrationTab print styles");
