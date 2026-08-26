const assert = require('assert');

function getInitialTab(customer, defaultTab, sessionStorageVal) {
    if (defaultTab) return defaultTab;
    
    // Force completed customers to open on the LEADS tab by default
    if (customer?.stage === 'COMPLETED') return 'LEADS';
    
    if (sessionStorageVal) return sessionStorageVal;
    
    return customer?.stage || 'LEADS';
}

console.log(getInitialTab({stage: 'COMPLETED'}, null, 'COMPLETED')); // Expected 'LEADS'
console.log(getInitialTab({stage: 'Completed'}, null, 'COMPLETED')); // Expected 'COMPLETED' (because of case mismatch!)
