const fs = require('fs');

const file = 'src/mock/demoData.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(`name: 'Sub-Agent (Agent 2)',
        title: 'Rahul Sharma (Field Agent)',`, `name: 'Rahul Sharma',
        title: 'Rahul Sharma (Field Agent)',`);

content = content.replace(`name: 'Channel Partner (Agent)',
        title: 'Om Solar (Direct CP)',`, `name: 'Om Solar Direct',
        title: 'Om Solar (Direct CP)',`);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated mock role names to match real test names");
