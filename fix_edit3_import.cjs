const fs = require('fs');
let file = 'src/components/modal-tabs/MaterialDeliveryTab.jsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
    /import \{ Building2, Mail, Zap, Trash2, Plus, Copy, Check, ClipboardPaste, Layers, Printer, Truck, User \} from 'lucide-react';/,
    "import { Building2, Mail, Zap, Trash2, Plus, Copy, Check, ClipboardPaste, Layers, Printer, Truck, User, Edit3 } from 'lucide-react';"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Added Edit3 to imports.");
