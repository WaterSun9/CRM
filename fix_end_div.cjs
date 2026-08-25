const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/            <\/main>\n            <\/div>\n            \)}/g, '            </main>\n            </div></div>\n            )}');

fs.writeFileSync(file, content, 'utf8');
