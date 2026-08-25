const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove Horizontal Swipeable Stage Selector
const horizStart = content.indexOf('{/* MOBILE STAGE SELECTOR (Horizontal Scroll) */}');
const horizEnd = content.indexOf('{/* MOBILE SEARCH BAR */}');
if (horizStart !== -1 && horizEnd !== -1) {
    content = content.substring(0, horizStart) + content.substring(horizEnd);
}

// 2. We need to add the Drawer back, right after DESKTOP SIDEBAR closing tag
const desktopSidebarEnd = content.indexOf('</aside>', content.indexOf('{/* DESKTOP SIDEBAR */}')) + '</aside>'.length;
const drawerCode = `
            {/* MOBILE DRAWER */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] flex md:hidden">
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    <aside className="relative w-[280px] h-full bg-slate-900 flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 z-10">
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
                    </aside>
                </div>
            )}
`;
content = content.substring(0, desktopSidebarEnd) + drawerCode + content.substring(desktopSidebarEnd);

// 3. Add a "Stages" button to the mobile header
const headerTitleStart = content.indexOf('<div>\n                            <h2 className="text-sm md:text-lg');
if (headerTitleStart !== -1) {
    const stagesButton = `<button onClick={() => setIsSidebarOpen(true)} className="md:hidden flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-white rounded-lg text-[10px] uppercase tracking-wide font-black shadow-sm active:scale-95 transition-transform">
                            <Layers size={14} /> Stages
                        </button>\n                        `;
    content = content.substring(0, headerTitleStart) + stagesButton + content.substring(headerTitleStart);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Restored drawer with Stages button');
