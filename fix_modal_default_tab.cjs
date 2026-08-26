const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        if (defaultTab) return defaultTab;
        if (typeof window !== 'undefined') {
            const saved = window.sessionStorage.getItem('watersun_modal_active_tab');
            if (saved) return saved;
        }
        return customer?.stage || 'LEADS';`;

const replacementStr = `        if (defaultTab) return defaultTab;
        
        // Force completed customers to open on the LEADS tab by default
        if (customer?.stage === 'COMPLETED') return 'LEADS';
        
        if (typeof window !== 'undefined') {
            const saved = window.sessionStorage.getItem('watersun_modal_active_tab');
            if (saved) return saved;
        }
        return customer?.stage || 'LEADS';`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Fixed default tab for completed customers");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
