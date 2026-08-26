const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `setActiveCustomerStage(selectedCust.stage);`;
const replacement1 = `setActiveCustomerStage(selectedCust.stage === 'COMPLETED' ? 'LEADS' : selectedCust.stage);`;

const target2 = `    const handleSelectCustomerForStage = (cust, stageTab) => {
        setEditData({});
        setActiveCustomerStage(stageTab);
        setSelectedCust(cust);
    };`;
const replacement2 = `    const handleSelectCustomerForStage = (cust, stageTab) => {
        setEditData({});
        setActiveCustomerStage(stageTab === 'COMPLETED' ? 'LEADS' : stageTab);
        setSelectedCust(cust);
    };`;


let changed = false;
if (content.includes(target1)) {
    content = content.replace(target1, replacement1);
    changed = true;
}

if (content.includes(target2)) {
    content = content.replace(target2, replacement2);
    changed = true;
}

if (changed) {
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed AgentPortal completed default tab");
} else {
    console.log("Failed to find targets");
}
