const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `                        {[
                            { label: 'Total customers', value: customers.length, icon: Users, tone: 'bg-stone-100 text-stone-700' },
                            { label: 'Action queue', value: operationalQueueCount, icon: ClipboardCheck, tone: 'bg-amber-50 text-amber-700' },
                            { label: 'In progress', value: inProgressCount, icon: Layers, tone: 'bg-blue-50 text-blue-700' },
                            { label: 'Ready for inspection', value: inspPendingCount, icon: Zap, tone: 'bg-emerald-50 text-emerald-700' },
                        ]`;

const replacement = `                        {[
                            { label: 'Total customers', value: customers.length, icon: Users, tone: 'bg-stone-100 text-stone-700' },
                            { label: 'Material Orders', value: getCustomersByStage('MATERIAL ORDER').length, icon: ShoppingBag, tone: 'bg-amber-50 text-amber-700' },
                            { label: 'Discom Subs', value: getCustomersByStage('DISCOM SUBMISSION').length, icon: Send, tone: 'bg-blue-50 text-blue-700' },
                            { label: 'Meter Installs', value: getCustomersByStage('METER INSTALLATION').length, icon: Zap, tone: 'bg-emerald-50 text-emerald-700' },
                        ]`;

content = content.replace(target, replacement);

fs.writeFileSync(file, content, 'utf8');
console.log('KPI blocks updated');
