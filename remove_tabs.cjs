const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{customerStageNavigation.filter(stage => {
                                    const pType = (selectedCust?.payment_type || '').trim().toLowerCase();
                                    if (stage.id === 'LOAN' && pType === 'cash') return false;
                                    if (stage.id === 'CASH' && pType === 'loan') return false;
                                    return true;
                                }).concat([
                                    { id: 'CUSTOMER_CARD', label: 'Customer Card', icon: User },
                                    { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen }
                                ]).map(stage => {`;

const replacement = `{customerStageNavigation.filter(stage => {
                                    const pType = (selectedCust?.payment_type || '').trim().toLowerCase();
                                    if (stage.id === 'LOAN' && pType === 'cash') return false;
                                    if (stage.id === 'CASH' && pType === 'loan') return false;
                                    if (stage.id === 'COMPLETED' || stage.id === 'LOST PROJECT') return false;
                                    return true;
                                }).concat([
                                    { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen }
                                ]).map(stage => {`;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    console.log("Successfully removed the tabs from the list.");
} else {
    console.log("Could not find the target block.");
}

fs.writeFileSync(file, content, 'utf8');
