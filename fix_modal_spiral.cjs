const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                            if (s.id === 'COMPLETED') return false;`;

const replacementStr = `                            if (s.id === 'COMPLETED' || s.id === 'LOST PROJECT') return false;`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Hidden COMPLETED and LOST PROJECT from modal tabs");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
