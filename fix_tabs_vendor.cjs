const fs = require('fs');

const files = [
    'src/components/modal-tabs/InstallationStatusTab.jsx',
    'src/components/modal-tabs/MaterialDeliveryTab.jsx'
];

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // We want to remove: vendorEmail: 'deeproot120@gmail.com'
    // It might have a trailing comma or not, it might be indented differently.
    const regex = /,\s*vendorEmail:\s*'deeproot120@gmail\.com'/g;
    
    if (regex.test(content)) {
        content = content.replace(regex, '');
        fs.writeFileSync(file, content, 'utf8');
        console.log(`Updated ${file}`);
    } else {
        console.log(`Target not found in ${file}`);
    }
});
