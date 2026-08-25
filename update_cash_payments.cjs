const fs = require('fs');

const file = 'src/components/modal-tabs/CashTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = "const defaultPaymentNames = ['Down Payment', '1st Payment', '2nd Payment'];";
const replacement = "const defaultPaymentNames = ['1st Payment', '2nd Payment', '3rd Payment'];";

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Updated CashTab payment names');
