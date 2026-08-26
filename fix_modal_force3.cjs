const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    // Prevent any scenario where the active tab becomes COMPLETED or LOST PROJECT (since they were removed from the nav)
    useEffect(() => {
        if (activeTab === 'COMPLETED' || activeTab === 'LOST PROJECT' || activeTab === 'CUSTOMER_CARD') {
            setActiveTab('LEADS');
        }
    }, [activeTab]);`;

const replacementStr = `    // Prevent any scenario where the active tab becomes COMPLETED or CUSTOMER_CARD (since they were removed from the nav)
    // We allow LOST PROJECT because there is an explicit "Move to Lost Project" button that needs to open it.
    useEffect(() => {
        if (activeTab === 'COMPLETED' || activeTab === 'CUSTOMER_CARD') {
            setActiveTab('LEADS');
        }
    }, [activeTab]);`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Fixed sweeping useEffect to allow LOST PROJECT");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
