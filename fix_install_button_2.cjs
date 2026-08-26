const fs = require('fs');
let file = 'src/components/modal-tabs/InstallationStatusTab.jsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the await sendVendorLeadNotification call
content = content.replace(
    /await sendVendorLeadNotification\(/g,
    'const res = await sendVendorLeadNotification('
);

// Fix setInfoSentStatus and setInfoSentMessage
content = content.replace(
    /setInfoSentStatus\('sent'\);\s*await logActivity\([\s\S]*?'email',[\s\S]*?\`Vendor notification triggered for new vendor \$\{editData.vendor\} \(email sent to vendor\)\`,[\s\S]*?'',[\s\S]*?customer.id\s*\);/g,
    `setInfoSentStatus('sent');\n                                                    setInfoSentMessage(res.message || 'Email sent successfully');\n                                                    await logActivity(\n                                                        user.id,\n                                                        'email',\n                                                        \`Vendor notification triggered for new vendor \${editData.vendor} (\${res.recipient || 'no email found'})\`,\n                                                        '',\n                                                        customer.id\n                                                    );`
);

// Fix button text
content = content.replace(
    /\{sendingInfo \? 'Sending\.\.\.' : 'Send Info to New Vendor'\}/g,
    "{sendingInfo ? 'Sending...' : 'Resend Info to New Vendor'}"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed InstallationStatusTab UI button.");
