const fs = require('fs');
const file = 'src/components/Dashboard.jsx';
let content = fs.readFileSync(file, 'utf8');

const globalSearchRegex = /<input\s+type="text"\s+placeholder=\{isChannelPartnerOffice \? \`Search \$\{partnerName\} leads\.\.\.\` : "Search all stages\.\.\."\}\s+value=\{globalSearch\}\s+onChange=\{e => setGlobalSearch\(e\.target\.value\)\}/g;
const globalSearchReplace = `<input type="search" name="crm_dash_global_search_unique" autoComplete="off" autoCorrect="off" spellCheck="false" placeholder={isChannelPartnerOffice ? \`Search \$\{partnerName\} leads...\` : "Search all stages..."} value={globalSearch} onChange={e => setGlobalSearch(e.target.value)}`;

const stageSearchRegex = /<input type="text" placeholder="Filter this stage\.\.\." value=\{stageSearch\}\s+onChange=\{e => setStageSearch\(e\.target\.value\)\}/g;
const stageSearchReplace = `<input type="search" name="crm_dash_stage_search_unique" autoComplete="off" autoCorrect="off" spellCheck="false" placeholder="Filter this stage..." value={stageSearch} onChange={e => setStageSearch(e.target.value)}`;

if (globalSearchRegex.test(content) || stageSearchRegex.test(content)) {
    content = content.replace(globalSearchRegex, globalSearchReplace);
    content = content.replace(stageSearchRegex, stageSearchReplace);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated Dashboard.jsx search inputs");
} else {
    console.log("Target not found in Dashboard.jsx!");
}
