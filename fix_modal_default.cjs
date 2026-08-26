const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        if (customer?.stage === 'COMPLETED') return 'LEADS';`;

const replacementStr = `        if ((customer?.stage || '').trim().toUpperCase() === 'COMPLETED') return 'LEADS';`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Fixed default tab for completed customers to be case insensitive");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
