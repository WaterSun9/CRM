const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace "await logActivity(" with "logActivity(" inside handleFileUpload, and we'll just add .catch(console.error) to it.
// Actually, it's easier to just do a global replace for that specific `await logActivity` block if we find it.

let newContent = content;
const lines = newContent.split('\n');
let insideHandleFileUpload = false;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('const handleFileUpload = async')) {
        insideHandleFileUpload = true;
    }
    if (insideHandleFileUpload && lines[i].includes('await logActivity(')) {
        lines[i] = lines[i].replace('await logActivity(', 'logActivity(');
    }
    // Need to find the closing bracket of logActivity to add .catch
    if (insideHandleFileUpload && lines[i].includes('                );') && lines[i-1].includes('customer.id')) {
        lines[i] = lines[i].replace('                );', '                ).catch(console.error);');
        insideHandleFileUpload = false; // we found it, can stop caring
    }
}

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log("Fixed logActivity await via lines");

