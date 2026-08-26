const fs = require('fs');

const file = 'src/components/StampPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `const demoStampList = DEMO_CUSTOMERS.filter(c => c.stage === "DISCOM SUBMISSION");`;
const replacementStr = `const demoStampList = DEMO_CUSTOMERS.filter(c => c.discom_submission?.sent_to_stamp_maker === true && !c.discom_submission?.stamp_sent);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed demo logic in StampPortal");
}
