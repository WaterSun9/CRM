const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/await deleteDocument/g, 'deleteDocument');
content = content.replace(/await onUpdate\(customer\.id, \{ \[docType\]: true \}\);/g, 'onUpdate(customer.id, { [docType]: true }).catch(console.error);');
// We need to be careful with logActivity as well, but wait, there are multiple await logActivity calls.
// Let's just manually fix the exact block by slicing.

const lines = content.split('\n');
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('await deleteDocument(oldDoc.id, oldDoc.storage_path);')) {
        lines[i] = lines[i].replace('await deleteDocument', 'deleteDocument(oldDoc.id, oldDoc.storage_path).catch(console.error); //');
    }
    if (lines[i].includes('await onUpdate(customer.id, { [docType]: true });')) {
        lines[i] = lines[i].replace('await onUpdate', 'onUpdate(customer.id, { [docType]: true }).catch(console.error); //');
    }
}

content = lines.join('\n');
fs.writeFileSync(file, content, 'utf8');
console.log("Updated CustomerDetailModal.jsx lines");

