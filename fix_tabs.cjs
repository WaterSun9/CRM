const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `    const customerStageNavigation = [
        { id: 'LEADS', label: 'Lead', icon: Users },
        { id: 'REGISTRATION', label: 'Registration', icon: ClipboardList },
        { id: 'MATERIAL ORDER', label: 'Material Order', icon: ShoppingBag },
        { id: 'MATERIAL INTEGRATION', label: 'Integration', icon: Package },
        { id: 'MATERIAL DELIVERY', label: 'Delivery', icon: Truck },
        { id: 'METER INSTALLATION', label: 'Meter', icon: Zap },
        { id: 'DISCOM INSPECTION', label: 'Inspection', icon: ClipboardCheck },
    ];`;

const replacement = `    const customerStageNavigation = PRIMARY_STAGES;`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed tabs to include all primary stages');
