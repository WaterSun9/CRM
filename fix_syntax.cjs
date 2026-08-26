const fs = require('fs');
let file = 'src/components/modal-tabs/InstallationStatusTab.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/const res = const res = await/g, 'const res = await');

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed syntax error.");
