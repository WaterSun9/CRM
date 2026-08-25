const fs = require('fs');

const file = 'src/utils.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    if (customerId && String(customerId).startsWith('demo-')) return;
    try {`;
const replacement = `    if (customerId && String(customerId).startsWith('demo-')) return;
    
    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (userId && !uuidRegex.test(userId)) {
        console.warn('Skipping activity log: invalid user_id UUID (likely a fake test login)');
        return;
    }
    if (customerId && !uuidRegex.test(customerId)) {
        console.warn('Skipping activity log: invalid customer_id UUID');
        return;
    }

    try {`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
