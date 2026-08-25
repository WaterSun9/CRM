const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = '{customerStageNavigation.map(stage => {';
const replacementStr = `{customerStageNavigation.filter(stage => {
                                    const pType = (selectedCust?.payment_type || '').trim().toLowerCase();
                                    if (stage.id === 'LOAN' && pType === 'cash') return false;
                                    if (stage.id === 'CASH' && pType === 'loan') return false;
                                    return true;
                                }).map(stage => {`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed tabs loan/cash');
