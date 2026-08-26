const fs = require('fs');
let file = 'src/utils/vendorNotification.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/let recipient = 'deeproot120@gmail\.com'; \/\/ fallback/g, "let recipient = ''; // no fallback");
// Also handle the edge case where recipient is empty
content = content.replace(/if \(!error && data\?\.success\) \{/g, `if (!recipient) {
            return { success: false, message: 'Vendor email not found in database.' };
        }
        if (!error && data?.success) {`);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated fallback in vendorNotification.js");
