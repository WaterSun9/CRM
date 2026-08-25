const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Replace the state block at the top
content = content.replace(
    /const \[view, setView\] = useState\('menu'\); \/\/ 'menu', 'my_customers', 'workdesk'[\s\S]*?'LEADS': true\n    }\);/,
    `const [activeWorkdeskTab, setActiveWorkdeskTab] = useState('LEADS');\n    const [customers, setCustomers] = useState([]);\n    const [loading, setLoading] = useState(false);\n    const [showAddLead, setShowAddLead] = useState(false);\n    const [searchQuery, setSearchQuery] = useState('');`
);

// 2. Remove the old activeWorkdeskTab declaration around line 457
content = content.replace(
    /const \[activeWorkdeskTab, setActiveWorkdeskTab\] = useState\('MATERIAL_ORDER'\); \/\/ Material views, Meter Installation, Discom Inspection/,
    `// State moved to top`
);

// 3. Simplify getWorkdeskCustomers to just use the exact stage ID
content = content.replace(
    /const getWorkdeskCustomers = \(stageTab\) => \{[\s\S]*?return filteredCustomers.filter\(c => c.stage === targetStage\);\n    \};/,
    `const getWorkdeskCustomers = (stageTab) => {\n        return filteredCustomers.filter(c => c.stage === stageTab);\n    };`
);

// 4. Update Document restriction - restrict upload/delete to Leads/Registration or active operational stage
content = content.replace(
    /const handleUploadDocForCustomer = async \(e, docType\) => \{/,
    `const handleUploadDocForCustomer = async (e, docType) => {
        // Enforce document edit permissions
        if (!['LEADS', 'REGISTRATION'].includes(activeCustomerStage) && 
            !(['METER INSTALLATION'].includes(activeCustomerStage) && docType.includes('meter')) &&
            !(['DISCOM SUBMISSION', 'DISCOM INSPECTION'].includes(activeCustomerStage) && (docType.includes('signature') || docType.includes('stamp') || docType.includes('dcr')))) {
            setCustomAlert({ title: 'Permission Denied', message: 'You can only upload lead documents during the Leads and Registration stages.', type: 'error' });
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }`
);

content = content.replace(
    /const handleDeleteDoc = async \(doc\) => \{/,
    `const handleDeleteDoc = async (doc) => {
        // Enforce document edit permissions
        if (!['LEADS', 'REGISTRATION'].includes(activeCustomerStage) && 
            !(['METER INSTALLATION'].includes(activeCustomerStage) && doc.doc_type.includes('meter')) &&
            !(['DISCOM SUBMISSION', 'DISCOM INSPECTION'].includes(activeCustomerStage) && (doc.doc_type.includes('signature') || doc.doc_type.includes('stamp') || doc.doc_type.includes('dcr')))) {
            setCustomAlert({ title: 'Permission Denied', message: 'You can only delete lead documents during the Leads and Registration stages.', type: 'error' });
            return;
        }`
);

// 5. Replace the entire render block up to AddLeadModal
const renderStart = '    return (';
const renderEnd = '            {/* Unified Add Lead Modal */}';

const newRenderBlock = `    return (
        <div className="flex h-screen bg-[#FCFBFA] text-stone-850 font-sans overflow-hidden">
            {/* LEFT SIDEBAR - Stages List */}
            <aside className="w-[280px] bg-white border-r border-stone-200 flex flex-col z-20 shrink-0">
                <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                    <div>
                        <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase flex items-center gap-2">
                            <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                <Sun size={12} className="fill-white" />
                            </div>
                            Watersun
                        </h1>
                        <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                            {isAgent2 ? 'Sub-Agent Portal' : 'Channel Partner'}
                        </p>
                    </div>
                </div>
                <div className="p-4 border-b border-stone-100 bg-stone-50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700 truncate max-w-[120px]">{user.name}</span>
                        <button onClick={onLogout} className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg hover:bg-white transition-colors" title="Logout">
                            <LogOut size={14} />
                        </button>
                    </div>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                    <div className="mb-2 px-1 pt-2">
                        <span className="text-[9px] font-black uppercase tracking-widest text-stone-400">Pipeline Stages</span>
                    </div>
                    {PRIMARY_STAGES.map(stage => {
                        const count = getCustomersByStage(stage.id).length;
                        const StageIcon = stage.icon || Folder;
                        const isActive = activeWorkdeskTab === stage.id;
                        return (
                            <button
                                key={stage.id}
                                onClick={() => setActiveWorkdeskTab(stage.id)}
                                className={\`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer \${
                                    isActive 
                                    ? 'bg-amber-500 text-white shadow-md shadow-amber-500/20' 
                                    : 'hover:bg-stone-50 text-stone-600 hover:text-stone-900'
                                }\`}
                            >
                                <div className="flex items-center gap-2.5">
                                    <StageIcon size={16} />
                                    <span className="text-[11px] font-bold tracking-wide">{stage.label}</span>
                                </div>
                                <span className={\`text-[10px] font-black px-2 py-0.5 rounded-full \${
                                    isActive ? 'bg-white/20 text-white' : 'bg-stone-100 text-stone-500'
                                }\`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </aside>

            {/* RIGHT MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-stone-50/50 relative">
                <header className="bg-white border-b border-stone-200 px-6 py-5 shrink-0 flex items-center justify-between shadow-sm z-10">
                    <div>
                        <h2 className="text-lg font-black text-stone-900 uppercase tracking-tight">
                            {PRIMARY_STAGES.find(s => s.id === activeWorkdeskTab)?.label || activeWorkdeskTab}
                        </h2>
                        <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                            Manage and view customers currently in this stage.
                        </p>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <div className="relative w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, phone, consumer no..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-stone-50 hover:bg-stone-100 focus:bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                            {searchQuery && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer"
                                    title="Clear search"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <button
                            onClick={() => setShowAddLead(true)}
                            className="shrink-0 px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
                        >
                            <Plus size={14} /> Add Lead
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        </div>
                    ) : getWorkdeskCustomers(activeWorkdeskTab).length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-center text-stone-400 bg-white border border-dashed border-stone-200 rounded-3xl p-8 max-w-lg mx-auto">
                            <div className="w-16 h-16 bg-stone-50 rounded-2xl flex items-center justify-center mb-4">
                                <Users className="w-8 h-8 text-stone-300" />
                            </div>
                            <p className="text-sm font-bold text-stone-600">No customers in this stage</p>
                            <p className="text-[11px] text-stone-400 mt-1">
                                {searchQuery 
                                    ? 'No matches found for your search query.' 
                                    : 'Customers assigned to you that enter this stage will appear here.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 auto-rows-max">
                            {getWorkdeskCustomers(activeWorkdeskTab).map((cust) => (
                                <div
                                    key={cust.id}
                                    onClick={() => handleSelectCustomerForStage(cust, activeWorkdeskTab)}
                                    className="bg-white p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:border-amber-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-2 mb-3">
                                            <h4 className="text-sm font-black text-stone-900 group-hover:text-amber-600 transition-colors leading-snug">
                                                {cust.customer_name}
                                            </h4>
                                            <button
                                                type="button"
                                                className="shrink-0 w-7 h-7 bg-stone-50 group-hover:bg-amber-500 group-hover:text-white text-stone-400 rounded-lg transition-all flex items-center justify-center cursor-pointer shadow-2xs border border-stone-100 group-hover:border-amber-500"
                                            >
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-2 text-xs text-stone-600">
                                            <div className="flex items-center gap-2">
                                                <Phone size={12} className="text-stone-400 shrink-0" />
                                                <span className="font-semibold">{cust.phone_number || '–'}</span>
                                            </div>
                                            {cust.villages && (
                                                <div className="flex items-start gap-2">
                                                    <MapPin size={12} className="text-stone-400 shrink-0 mt-0.5" />
                                                    <span className="font-medium text-stone-500 line-clamp-1">{cust.villages}</span>
                                                </div>
                                            )}
                                            {cust.consumer_no && (
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        #{cust.consumer_no}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-1.5 items-center justify-between text-[11px]">
                                        {cust.system_capacity_kwp && (
                                            <div className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                                <Zap size={10} />
                                                {cust.system_capacity_kwp} kWp
                                            </div>
                                        )}
                                        {cust.payment_type && (
                                            <span className="font-bold text-stone-500 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded uppercase text-[9px]">
                                                {cust.payment_type}
                                            </span>
                                        )}
                                        {cust.discom_inspection === 'Yes' && activeWorkdeskTab === 'DISCOM_INSPECTION' && (
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9px]">Inspected</span>
                                        )}
                                        {cust.meter_installation === 'Yes' && activeWorkdeskTab === 'METER_INSTALLATION' && (
                                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[9px]">Installed</span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Unified Add Lead Modal */}`;

const renderStartIndex = content.indexOf(renderStart);
const renderEndIndex = content.indexOf(renderEnd);

if (renderStartIndex === -1 || renderEndIndex === -1) {
    console.error("Could not find render block boundaries");
    process.exit(1);
}

content = content.substring(0, renderStartIndex) + newRenderBlock + content.substring(renderEndIndex + renderEnd.length);

// Make sure Modal is constrained
content = content.replace(
    /className="fixed inset-0 z-50 bg-black\/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"/,
    'className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pl-[280px]"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Refactor complete');
