const fs = require('fs');
const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/GUJRAT ENERGY DEVLOPEMENT AGENCY/g, 'WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED');

fs.writeFileSync(file, content, 'utf8');
console.log("Updated Second Party to WATERSUN ELECTRICAL SOLUTIONS PRIVATE LIMITED");
