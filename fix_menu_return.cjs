const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// I need to find the `return (\n        <>\n            {view === 'menu' && (` and fix it to return early.
const startIdx = content.indexOf("    return (\n        <>\n            {view === 'menu' && (");
if (startIdx !== -1) {
    const endOfMenuIdx = content.indexOf("            {view === 'workdesk' && (");
    
    // We will extract the menu code
    const menuBlock = content.substring(startIdx, endOfMenuIdx);
    
    const newMenuBlock = menuBlock
        .replace("    return (\n        <>\n            {view === 'menu' && (", "    if (view === 'menu') {\n        return (")
        .replace("                </div>\n            )}", "                </div>\n        );\n    }\n\n    return (");
        
    let newContent = content.substring(0, startIdx) + newMenuBlock + content.substring(endOfMenuIdx);
    
    // Now remove the `{view === 'workdesk' && (` wrapper.
    newContent = newContent.replace("            {view === 'workdesk' && (\n", "");
    
    // We also need to remove the closing `)}` that belongs to view === 'workdesk'.
    // Where is it? It was in `finalReturnBlock`: `\n            )}\n` right before `            {/* Unified Add Lead Modal */}`
    newContent = newContent.replace("            )}\n            {/* Unified Add Lead Modal */}", "            {/* Unified Add Lead Modal */}");
    
    fs.writeFileSync(file, newContent, 'utf8');
    console.log("Fixed early return");
} else {
    console.log("Could not find startIdx");
}

