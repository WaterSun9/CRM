const fs = require('fs');

const file = 'src/components/CustomerDetailModal.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `    useEffect(() => {
        if (typeof window !== 'undefined' && activeTab) {
            window.sessionStorage.setItem('watersun_modal_active_tab', activeTab);
        }
    }, [activeTab]);`;

const replacementStr = `    useEffect(() => {
        if (typeof window !== 'undefined' && activeTab) {
            window.sessionStorage.setItem('watersun_modal_active_tab', activeTab);
        }
    }, [activeTab]);

    // Force completed customers to ALWAYS open LEADS initially, catching any edge cases
    useEffect(() => {
        if ((customer?.stage || '').trim().toUpperCase() === 'COMPLETED' && activeTab === 'COMPLETED') {
            setActiveTab('LEADS');
        }
    }, [customer?.stage, activeTab]);
`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    console.log("Added useEffect to force LEADS for COMPLETED stage");
} else {
    console.log("Could not find the target block in CustomerDetailModal");
}

fs.writeFileSync(file, content, 'utf8');
