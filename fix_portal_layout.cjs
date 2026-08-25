const fs = require('fs');

const origFile = 'src/components/AgentPortal_original.jsx';
const origContent = fs.readFileSync(origFile, 'utf8');

const currFile = 'src/components/AgentPortal.jsx';
let currContent = fs.readFileSync(currFile, 'utf8');

// 1. Extract the beautiful original Menu View (header + menu content)
const origHeaderStart = origContent.indexOf('<header className="bg-white border-b border-stone-100');
const origHeaderEnd = origContent.indexOf('</header>') + '</header>'.length;
const origHeader = origContent.substring(origHeaderStart, origHeaderEnd);

const origMenuStart = origContent.indexOf("{/* Menu View (Clean Action Cards) */}");
const origMenuEnd = origContent.indexOf("{/* Stage Workdesk View (Vendor-style Top Filter Cards & Customer List) */}");
// Wait, origMenuStart is right before `{view === 'menu' && (`
let origMenuCode = origContent.substring(origMenuStart, origMenuEnd);

// Modify the 'my_customers' reference
origMenuCode = origMenuCode.replace(
    /onClick=\{\(\) => setView\('my_customers'\)\}/,
    "onClick={() => { setActiveWorkdeskTab('LEADS'); setView('workdesk'); }}"
);
// Also modify Next Best Action block to go to workdesk properly
origMenuCode = origMenuCode.replace(
    /onClick=\{\(\) => \{ setActiveWorkdeskTab\(priorityWorkdeskTab\); setView\('workdesk'\); \}\}/,
    "onClick={() => { setActiveWorkdeskTab(priorityWorkdeskTab); setView('workdesk'); }}"
);


// 2. Extract the current Workdesk view from AgentPortal.jsx
const currWorkdeskStart = currContent.indexOf('<div className="flex h-screen bg-[#FCFBFA] text-stone-850 font-sans overflow-hidden">');
const currWorkdeskEnd = currContent.indexOf('            {/* Unified Add Lead Modal */}');
const currWorkdeskCode = currContent.substring(currWorkdeskStart, currWorkdeskEnd);

// 3. Build the new Top Level Return
const newReturn = `    return (
        <>
            {view === 'menu' && (
                <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
                    ${origHeader}
                    ${origMenuCode.replace("{view === 'menu' && (", "").replace(/            \)}\n\s*$/, "")}
                </div>
            )}
            
            {view === 'workdesk' && (
                ${currWorkdeskCode.trim()}
            )}

`;

// 4. Find where the current early return for 'menu' starts and replace it all the way down to AddLeadModal
const currMenuStartIdx = currContent.indexOf("    if (view === 'menu') {");
if (currMenuStartIdx !== -1) {
    currContent = currContent.substring(0, currMenuStartIdx) + newReturn + currContent.substring(currWorkdeskEnd);
} else {
    console.error("Could not find current menu start");
    process.exit(1);
}

fs.writeFileSync(currFile, currContent, 'utf8');
console.log('Restored home page design and fixed Add Lead Modal rendering');

