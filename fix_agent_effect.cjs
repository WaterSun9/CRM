const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        fetchMetadata();
    }, []);`;

const replacementStr = `        fetchMetadata();
    }, [user?.id, user?.name, user?.channel_partner, isAgent2]);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated useEffect dependency array in AgentPortal");
} else {
    console.log("Target not found!");
}
