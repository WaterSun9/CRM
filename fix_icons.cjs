const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/Package, PauseCircle, Truck, Wrench, Camera, Send, Printer/g, 'Package, PauseCircle, Truck, Wrench, Camera, Send, Printer, FileText, FolderOpen');

fs.writeFileSync(file, content, 'utf8');
console.log('Added icons');
