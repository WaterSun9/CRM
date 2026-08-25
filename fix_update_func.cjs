const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/handleUpdateCustomerField/g, 'handleUpdateCustomer');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed handleUpdateCustomer function call');
