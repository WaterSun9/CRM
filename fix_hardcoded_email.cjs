const fs = require('fs');

function updateFile(file) {
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/Email sent to deeproot120@gmail\.com/g, 'Email sent to Vendor');
    content = content.replace(/\(deeproot120@gmail\.com\)/g, '(email sent to vendor)');
    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
}

updateFile('src/components/modal-tabs/InstallationStatusTab.jsx');
updateFile('src/components/modal-tabs/MaterialDeliveryTab.jsx');
