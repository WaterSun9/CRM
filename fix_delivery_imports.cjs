const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    "import { formatINR, toIndianCommas, logActivity } from '../utils';",
    "import { formatINR, toIndianCommas, logActivity, formatInputValue, parseIndianNumber } from '../utils';"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated imports.");
