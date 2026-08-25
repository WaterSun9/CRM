const fs = require('fs');
const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const renderMatch = content.match(/    return \(\n        <div className="flex h-screen/);
if (!renderMatch) {
    console.error("Could not find exact main return start!");
    process.exit(1);
}
const renderStartIndex = renderMatch.index;
const renderEnd = '            {/* Unified Add Lead Modal */}';
const renderEndIndex = content.indexOf(renderEnd);

const newRenderBlock = `    return (
        <div className="flex flex-col min-h-screen bg-[#FCFBFA] text-stone-850 font-sans">
            {/* MOBILE HEADER */}
            <header className="bg-white border-b border-stone-200 px-4 py-3 shrink-0 sticky top-0 z-20 shadow-sm flex items-center justify-between">
                <div>
                    <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase flex items-center gap-2">
                        <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                            <Sun size={12} className="fill-white" />
                        </div>
                        Watersun
                    </h1>
                    <p className="text-[8px] font-bold text-amber-600 uppercase tracking-widest mt-1">
                        {isAgent2 ? 'Sub-Agent' : 'Channel Partner'}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-stone-700 truncate max-w-[80px]">{user.name}</span>
                    <button onClick={onLogout} className="p-1.5 text-stone-400 hover:text-red-500 rounded-lg bg-stone-50" title="Logout">
                        <LogOut size={14} />
                    </button>
                </div>
            </header>

            {/* STAGE SELECTOR (Horizontal Scroll) */}
            <div className="bg-white border-b border-stone-150 shrink-0 relative z-10">
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-stone-400">Pipeline Stages</p>
                        <span className="text-[9px] font-bold text-stone-400">Swipe <ChevronRight size={10} className="inline" /></span>
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide snap-x">
                        {PRIMARY_STAGES.map(stage => {
                            const count = getCustomersByStage(stage.id).length;
                            const StageIcon = stage.icon || Folder;
                            const isActive = activeWorkdeskTab === stage.id;
                            return (
                                <button
                                    key={stage.id}
                                    onClick={() => setActiveWorkdeskTab(stage.id)}
                                    className={\`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all cursor-pointer snap-start border \${
                                        isActive 
                                        ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20' 
                                        : 'bg-stone-50 border-stone-200 text-stone-600 hover:bg-stone-100'
                                    }\`}
                                >
                                    <StageIcon size={14} />
                                    <span className="text-[10px] font-bold tracking-wide">{stage.label}</span>
                                    <span className={\`text-[9px] font-black px-1.5 py-0.5 rounded-full \${
                                        isActive ? 'bg-white/20 text-white' : 'bg-stone-200 text-stone-600'
                                    }\`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SEARCH BAR */}
            <div className="px-4 py-3 bg-stone-50 shrink-0 sticky top-[60px] z-10 border-b border-stone-150 shadow-sm">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by name, phone..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-sm"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
                        >
                            <X size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* CUSTOMER LIST */}
            <main className="flex-1 p-4 pb-24">
                {loading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 text-amber-500 animate-spin" />
                    </div>
                ) : getWorkdeskCustomers(activeWorkdeskTab).length === 0 ? (
                    <div className="flex flex-col items-center justify-center text-center text-stone-400 bg-white border border-dashed border-stone-200 rounded-3xl p-6 mt-4 max-w-sm mx-auto">
                        <div className="w-12 h-12 bg-stone-50 rounded-2xl flex items-center justify-center mb-3">
                            <Users className="w-6 h-6 text-stone-300" />
                        </div>
                        <p className="text-xs font-bold text-stone-600">No customers</p>
                        <p className="text-[10px] text-stone-400 mt-1">
                            {searchQuery ? 'No matches found.' : 'No customers in this stage.'}
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3 max-w-sm mx-auto">
                        {getWorkdeskCustomers(activeWorkdeskTab).map((cust) => (
                            <div
                                key={cust.id}
                                onClick={() => handleSelectCustomerForStage(cust, activeWorkdeskTab)}
                                className="bg-white p-4 rounded-2xl border border-stone-200/80 shadow-sm active:border-amber-400 active:bg-stone-50 transition-all cursor-pointer space-y-3"
                            >
                                <div className="flex justify-between items-start gap-2">
                                    <h4 className="text-sm font-black text-stone-900 leading-snug">
                                        {cust.customer_name}
                                    </h4>
                                    <button className="shrink-0 w-6 h-6 bg-stone-50 text-stone-400 rounded-lg flex items-center justify-center shadow-2xs border border-stone-100">
                                        <ChevronRight size={14} />
                                    </button>
                                </div>
                                
                                <div className="space-y-1.5 text-[11px] text-stone-600">
                                    <div className="flex items-center gap-2">
                                        <Phone size={11} className="text-stone-400 shrink-0" />
                                        <span className="font-semibold">{cust.phone_number || '–'}</span>
                                    </div>
                                    {cust.villages && (
                                        <div className="flex items-start gap-2">
                                            <MapPin size={11} className="text-stone-400 shrink-0 mt-0.5" />
                                            <span className="font-medium text-stone-500 line-clamp-1">{cust.villages}</span>
                                        </div>
                                    )}
                                    {cust.consumer_no && (
                                        <div className="flex items-center gap-2">
                                            <Hash size={11} className="text-stone-400 shrink-0" />
                                            <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                                                #{cust.consumer_no}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                
                                <div className="pt-2 border-t border-stone-100 flex flex-wrap gap-1.5 items-center justify-between text-[10px]">
                                    {cust.system_capacity_kwp && (
                                        <div className="flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                                            <Zap size={10} />
                                            {cust.system_capacity_kwp} kWp
                                        </div>
                                    )}
                                    {cust.payment_type && (
                                        <span className="font-bold text-stone-500 bg-stone-50 border border-stone-100 px-2 py-0.5 rounded uppercase">
                                            {cust.payment_type}
                                        </span>
                                    )}
                                    {cust.discom_inspection === 'Yes' && activeWorkdeskTab === 'DISCOM_INSPECTION' && (
                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Inspected</span>
                                    )}
                                    {cust.meter_installation === 'Yes' && activeWorkdeskTab === 'METER_INSTALLATION' && (
                                        <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">Installed</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* FLOATING ACTION BUTTON (Add Lead) */}
            <button
                onClick={() => setShowAddLead(true)}
                className="fixed bottom-6 right-4 z-40 bg-amber-500 text-white w-12 h-12 rounded-full shadow-lg shadow-amber-500/40 flex items-center justify-center active:scale-95 transition-transform"
            >
                <Plus size={22} />
            </button>
\n`;

content = content.substring(0, renderStartIndex) + newRenderBlock + content.substring(renderEndIndex);

// Remove the desktop pl-[280px] padding from the Modal since the sidebar is gone
content = content.replace(
    /className="fixed inset-0 z-\[60\] bg-black\/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 pl-\[280px\]"/,
    'className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4"'
);

fs.writeFileSync(file, content, 'utf8');
console.log('Mobile Refactor complete');
