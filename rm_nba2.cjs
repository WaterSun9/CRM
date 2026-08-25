const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const startStr = `<button
                            type="button"
                            onClick={() => { setActiveWorkdeskTab(priorityWorkdeskTab); setView('workdesk'); }}`;
const endStr = `</button>

                        <div className="grid gap-3">`;

const startIndex = content.indexOf(startStr);
const endIndex = content.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
    content = content.substring(0, startIndex) + `<div className="grid gap-3">` + content.substring(endIndex + endStr.length);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Removed Next Best Action correctly");
} else {
    console.error("Could not find start or end bounds for NBA block");
}

