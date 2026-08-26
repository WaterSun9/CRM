const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            if (isAgent2) {
                // Agent 2 (Sub-Agent) filters strictly by sub_channel_partner
                const subFilter = user.name;
                query = query.eq('sub_channel_partner', subFilter);
            } else {
                // Main Channel Partner / Agent
                const cpFilter = user.channel_partner || user.name;
                query = query.eq('channel_partner', cpFilter);
            }`;

const replacementStr = `            if (isAgent2) {
                // Agent 2 (Sub-Agent) filters strictly by sub_channel_partner
                const subFilter = (user.name || '').trim();
                query = query.ilike('sub_channel_partner', subFilter);
            } else {
                // Main Channel Partner / Agent
                const cpFilter = (user.channel_partner || user.name || '').trim();
                query = query.ilike('channel_partner', cpFilter);
            }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated AgentPortal to use ilike for channel partner filtering");
} else {
    console.log("Could not find the filtering block in AgentPortal");
}
