const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialIntegrationTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace grid-cols-5 with grid-cols-4
content = content.replace(/<div className="grid grid-cols-5 gap-1\.5 text-xs">/g, '<div className="grid grid-cols-4 gap-2 text-xs">');

// Update CSS
content = content.replace(/#native-print-portal \.grid-cols-5 \{/g, '#native-print-portal .grid-cols-4 {');
content = content.replace(/grid-template-columns: repeat\(5, 1fr\) !important;/g, 'grid-template-columns: repeat(4, 1fr) !important;');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated MaterialIntegrationTab grid columns for serial numbers.");
