const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    // Force completed customers to ALWAYS open LEADS initially, catching any edge cases
    useEffect(() => {
        if ((customer?.stage || '').trim().toUpperCase() === 'COMPLETED' && activeTab === 'COMPLETED') {
            setActiveTab('LEADS');
        }
    }, [customer?.stage, activeTab]);`;

const replacementStr = `    // Prevent any scenario where the active tab becomes COMPLETED or LOST PROJECT (since they were removed from the nav)
    useEffect(() => {
        if (activeTab === 'COMPLETED' || activeTab === 'LOST PROJECT' || activeTab === 'CUSTOMER_CARD') {
            setActiveTab('LEADS');
        }
    }, [activeTab]);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Added sweeping useEffect to prevent invalid tabs");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
