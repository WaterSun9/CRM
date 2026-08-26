const fs = require('fs');
const file = 'src/components/StampPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        ["Purchased By", subDetails.purchased_party],
        ["Description", subDetails.stamp_description],`;

const replacementStr = `        ["Purchased By", subDetails.purchased_party],
        ["Stamp Value", subDetails.stamp_value ? \`₹\${subDetails.stamp_value}\` : ''],
        ["Description", subDetails.stamp_description],`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated StampPortal to show stamp_value");
} else {
    console.log("Target not found in StampPortal.jsx");
}
