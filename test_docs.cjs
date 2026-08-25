const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const navTarget = `                                }).map(stage => {`;
const navReplacement = `                                }).concat([
                                    { id: 'CUSTOMER_CARD', label: 'Customer Card', icon: User },
                                    { id: 'DOCUMENTS', label: 'Documents', icon: FolderOpen }
                                ]).map(stage => {`;

if (content.includes(navTarget)) {
    content = content.replace(navTarget, navReplacement);
    console.log("Replaced navigation");
}

fs.writeFileSync(file, content, 'utf8');
