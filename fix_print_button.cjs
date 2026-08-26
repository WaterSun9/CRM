const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/onClick=\{handlePrintChallan\}/g, "onClick={handlePrintBatch}");

fs.writeFileSync(file, content, 'utf8');
console.log("Fixed button onClick.");
