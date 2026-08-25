const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the Next Best Action block
const textIdx = content.indexOf('Next best action');
if (textIdx !== -1) {
    const btnStart = content.lastIndexOf('<button', textIdx);
    const btnEnd = content.indexOf('</button>', textIdx) + '</button>'.length;
    content = content.substring(0, btnStart) + content.substring(btnEnd);
}

const workdeskStartIdx = content.indexOf('    return (\n            \n        <div className="flex flex-col min-h-screen bg-[#FCFBFA] text-stone-850 font-sans">');
const currentRenderEndIdx = content.indexOf('            {/* Unified Add Lead Modal */}');

const sidebarInner = `
                    <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
                        <div>
                            <h1 className="text-xs font-black tracking-widest text-white uppercase flex items-center gap-2">
                                <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                    <Sun size={12} className="fill-white" />
                                </div>
                                Watersun
                            </h1>
                        </div>
                        <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg">
                            <X size={16} />
                        </button>
                    </div>
                    
                    <div className="p-3 border-b border-slate-800 shrink-0">
                        <button onClick={() => setView('menu')} className="w-full flex items-center gap-3 p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer group shadow-sm">
                            <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center text-white group-hover:scale-105 transition-transform shadow-md shadow-amber-500/20">
                                <Home size={14} />
                            </div>
                            <div className="flex flex-col items-start">
                                <span className="text-[11px] font-bold">Home Page</span>
                                <span className="text-[9px] text-slate-400 font-medium">Return to dashboard</span>
                            </div>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        <div className="mb-2 px-1 pt-2">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pipeline Stages</span>
                        </div>
                        {PRIMARY_STAGES.map(stage => {
                            const count = getCustomersByStage(stage.id).length;
                            const StageIcon = stage.icon || Folder;
                            const isActive = activeWorkdeskTab === stage.id;
                            return (
                                <button
                                    key={stage.id}
                                    onClick={() => { setActiveWorkdeskTab(stage.id); setIsSidebarOpen(false); }}
                                    className={\`w-full flex items-center justify-between p-2.5 rounded-xl transition-all cursor-pointer \${
                                        isActive 
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                        : 'hover:bg-slate-800 text-slate-300 hover:text-white'
                                    }\`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <StageIcon size={16} />
                                        <span className="text-[11px] font-bold tracking-wide">{stage.label}</span>
                                    </div>
                                    <span className={\`text-[10px] font-black px-2 py-0.5 rounded-full \${
                                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                                    }\`}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
`;

const newWorkdeskBlock = `    return (
        <div className="flex h-screen bg-[#FCFBFA] text-stone-850 font-sans overflow-hidden">
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex flex-col w-[280px] bg-slate-900 border-r border-slate-800 z-20 shrink-0">
${sidebarInner}
            </aside>

            {/* MOBILE DRAWER */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] flex md:hidden">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <aside className="relative w-[280px] h-full bg-slate-900 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 z-10">
${sidebarInner}
                    </aside>
                </div>
            )}

            {/* MAIN CONTENT */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden bg-stone-50/50 relative">
                {/* HEADER */}
                <header className="bg-white border-b border-stone-200 px-4 md:px-6 py-3 md:py-4 shrink-0 flex items-center justify-between shadow-sm z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setIsSidebarOpen(true)} className="md:hidden p-1.5 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
                        </button>
                        <div>
                            <h2 className="text-sm md:text-lg font-black text-stone-900 uppercase tracking-tight flex items-center gap-2">
                                {PRIMARY_STAGES.find(s => s.id === activeWorkdeskTab)?.label || activeWorkdeskTab}
                            </h2>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-2 md:gap-4">
                        <div className="hidden sm:block relative w-56 md:w-80">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Search by name, phone..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-stone-50 hover:bg-stone-100 focus:bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500 transition-all"
                            />
                            {searchQuery && (
                                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-0.5 rounded-full cursor-pointer">
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div className="flex items-center gap-1 md:gap-2">
                            <button onClick={onLogout} className="p-1.5 md:p-2 text-stone-400 hover:text-red-500 rounded-xl hover:bg-stone-100 transition-colors" title="Logout">
                                <LogOut size={16} />
                            </button>
                            <button
                                onClick={() => setShowAddLead(true)}
                                className="hidden sm:flex shrink-0 px-3 md:px-4 py-1.5 md:py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold items-center gap-2 shadow-md transition-all cursor-pointer active:scale-[0.98]"
                            >
                                <Plus size={14} /> Add Lead
                            </button>
                        </div>
                    </div>
                </header>

                {/* MOBILE SEARCH BAR */}
                <div className="sm:hidden px-4 py-3 bg-white border-b border-stone-150 shrink-0 shadow-sm z-10">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-stone-50 focus:bg-white border border-stone-200 rounded-xl pl-9 pr-8 py-2 text-xs font-semibold text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        {searchQuery && (
                            <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1">
                                <X size={13} />
                            </button>
                        )}
                    </div>
                </div>

                {/* CUSTOMER LIST */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
                    {loading ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
                        </div>
                    ) : getWorkdeskCustomers(activeWorkdeskTab).length === 0 ? (
                        <div className="flex flex-col items-center justify-center text-center text-stone-400 bg-white border border-dashed border-stone-200 rounded-3xl p-6 md:p-8 mt-4 max-w-sm md:max-w-lg mx-auto">
                            <div className="w-12 h-12 md:w-16 md:h-16 bg-stone-50 rounded-2xl flex items-center justify-center mb-3 md:mb-4">
                                <Users className="w-6 h-6 md:w-8 md:h-8 text-stone-300" />
                            </div>
                            <p className="text-xs md:text-sm font-bold text-stone-600">No customers</p>
                            <p className="text-[10px] md:text-[11px] text-stone-400 mt-1">
                                {searchQuery ? 'No matches found.' : 'No customers in this stage.'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 auto-rows-max">
                            {getWorkdeskCustomers(activeWorkdeskTab).map((cust) => (
                                <div
                                    key={cust.id}
                                    onClick={() => handleSelectCustomerForStage(cust, activeWorkdeskTab)}
                                    className="bg-white p-4 md:p-5 rounded-2xl border border-stone-200/80 shadow-sm hover:border-blue-400 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99] flex flex-col justify-between"
                                >
                                    <div>
                                        <div className="flex justify-between items-start gap-2 mb-3">
                                            <h4 className="text-sm font-black text-stone-900 group-hover:text-blue-600 transition-colors leading-snug">
                                                {cust.customer_name}
                                            </h4>
                                            <button type="button" className="shrink-0 w-6 h-6 md:w-7 md:h-7 bg-stone-50 group-hover:bg-blue-600 group-hover:text-white text-stone-400 rounded-lg transition-all flex items-center justify-center shadow-2xs border border-stone-100 group-hover:border-blue-600">
                                                <ChevronRight size={14} />
                                            </button>
                                        </div>
                                        
                                        <div className="space-y-1.5 md:space-y-2 text-[11px] md:text-xs text-stone-600">
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
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="font-bold text-stone-700 bg-stone-100 px-1.5 py-0.5 rounded text-[10px]">
                                                        #{cust.consumer_no}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    <div className="mt-3 md:mt-4 pt-3 border-t border-stone-100 flex flex-wrap gap-1.5 items-center justify-between text-[10px] md:text-[11px]">
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
                </div>

                {/* MOBILE FLOATING ACTION BUTTON */}
                <button
                    onClick={() => setShowAddLead(true)}
                    className="sm:hidden fixed bottom-6 right-4 z-40 bg-blue-600 text-white w-12 h-12 rounded-full shadow-lg shadow-blue-500/40 flex items-center justify-center active:scale-95 transition-transform"
                >
                    <Plus size={22} />
                </button>
            </main>
\n`;

content = content.substring(0, workdeskStartIdx) + newWorkdeskBlock + content.substring(currentRenderEndIdx);

fs.writeFileSync(file, content, 'utf8');
console.log('Sidebar UI completely revamped to dark blue + responsive');
