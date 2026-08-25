const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// Remove MOBILE DRAWER block
const drawerStart = content.indexOf('{/* MOBILE DRAWER */}');
const mainContentStart = content.indexOf('{/* MAIN CONTENT */}');
if (drawerStart !== -1 && mainContentStart !== -1) {
    content = content.substring(0, drawerStart) + content.substring(mainContentStart);
} else {
    console.error("Could not find MOBILE DRAWER or MAIN CONTENT");
}

// Remove hamburger menu button
content = content.replace(
    /<button onClick=\{\(\) => setIsSidebarOpen\(true\)\} className="md:hidden p-1\.5 text-stone-600 hover:bg-stone-100 rounded-lg transition-colors">\s*<svg.*<\/svg>\s*<\/button>\s*<div>/g,
    '<div>'
);

// Add Horizontal Swipeable Stage Selector (Dark Blue) for Mobile
const mobileSearchBarStart = content.indexOf('{/* MOBILE SEARCH BAR */}');
const horizontalSelector = `
                {/* MOBILE STAGE SELECTOR (Horizontal Scroll) */}
                <div className="md:hidden bg-slate-900 border-b border-slate-800 shrink-0 relative z-10 shadow-md">
                    <div className="px-4 py-3">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Pipeline Stages</p>
                            <span className="text-[9px] font-bold text-slate-400">Swipe <ChevronRight size={10} className="inline" /></span>
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x">
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
                                            ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-900/50' 
                                            : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white'
                                        }\`}
                                    >
                                        <StageIcon size={14} />
                                        <span className="text-[10px] font-bold tracking-wide">{stage.label}</span>
                                        <span className={\`text-[9px] font-black px-1.5 py-0.5 rounded-full \${
                                            isActive ? 'bg-white/20 text-white' : 'bg-slate-900 text-slate-400'
                                        }\`}>
                                            {count}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                `;

if (mobileSearchBarStart !== -1) {
    content = content.substring(0, mobileSearchBarStart) + horizontalSelector + content.substring(mobileSearchBarStart);
} else {
    console.error("Could not find MOBILE SEARCH BAR block");
}

fs.writeFileSync(file, content, 'utf8');
console.log('Restored phone view horizontal selector');
