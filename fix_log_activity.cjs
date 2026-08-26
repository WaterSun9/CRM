const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

// The block is:
/*
                await logActivity(
                    user.id,
                    'update',
                    `Uploaded document: ${file.name}`,
                    '',
                    customer.id
                );
*/

const targetStr = `                await logActivity(
                    user.id,
                    'update',
                    \`Uploaded document: \${file.name}\`,
                    '',
                    customer.id
                );`;
                
const replacementStr = `                logActivity(
                    user.id,
                    'update',
                    \`Uploaded document: \${file.name}\`,
                    '',
                    customer.id
                ).catch(console.error);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed logActivity await in CustomerDetailModal");
} else {
    console.log("Could not find logActivity target");
}
