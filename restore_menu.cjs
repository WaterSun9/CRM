const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Restore the 'view' state
content = content.replace(
    /const \[activeWorkdeskTab, setActiveWorkdeskTab\] = useState\('LEADS'\);/,
    `const [view, setView] = useState('menu');\n    const [activeWorkdeskTab, setActiveWorkdeskTab] = useState('LEADS');\n    const [isSidebarOpen, setIsSidebarOpen] = useState(false);`
);

// 2. Wrap the current return block in the workdesk view, and prepend the menu view.
// First, extract the original menu code from AgentPortal_original.jsx
const origContent = fs.readFileSync('src/components/AgentPortal_original.jsx', 'utf8');
const origMenuStart = origContent.indexOf("{/* Menu View (Clean Action Cards) */}");
const origMenuEnd = origContent.indexOf("{/* Stage Workdesk View");
if (origMenuStart === -1 || origMenuEnd === -1) {
    console.error("Could not extract original menu view");
    process.exit(1);
}
let menuCode = origContent.substring(origMenuStart, origMenuEnd);

// Modify the menuCode slightly to redirect Customer Directory to the new unified view
// We no longer have 'my_customers' view, so click goes to workdesk with LEADS tab or just workdesk.
menuCode = menuCode.replace(
    /onClick=\{\(\) => setView\('my_customers'\)\}/,
    `onClick={() => { setActiveWorkdeskTab('LEADS'); setView('workdesk'); }}`
);

// We need to grab the header block that belongs to the menu.
const headerStart = origContent.indexOf('<header className="bg-white border-b');
const headerEnd = origContent.indexOf('</header>') + '</header>'.length;
const origHeader = origContent.substring(headerStart, headerEnd);

// Now, in our current file, we want to replace the single return block with a wrapper that switches.
const currentRenderMatch = content.match(/    return \(\n        <div className="flex flex-col min-h-screen/);
const currentRenderStartIdx = currentRenderMatch.index;

const currentRenderEndIdx = content.indexOf('            {/* Unified Add Lead Modal */}');
const currentRenderBlock = content.substring(currentRenderStartIdx, currentRenderEndIdx);

// The currentRenderBlock starts with `    return (\n        <div ...>`
// We want to replace it with:
// return (
//     <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col">
//         {view === 'menu' && ( <> origHeader + menuCode </> )}
//         {view === 'workdesk' && ( currentRenderBlockWithoutReturn )}
//     </div>
// )

// Let's rip off the `return (` from the currentRenderBlock.
let workdeskBlock = currentRenderBlock.replace(/    return \(\n/, '');
// workdeskBlock ends with an unclosed `</div>` because the original return block had its closing div at the end of the file.
// We will just let it be, but wrap it cleanly. Wait! The current file has the final closing div at the end.
// We can just leave the final closing div alone!

// Let's add the Hamburger Menu button to the Mobile Header of the workdesk block.
workdeskBlock = workdeskBlock.replace(
    / Watersun\n                    <\/h1>/,
    ` Watersun\n                    </h1>`
).replace(
    /<div className="flex items-center gap-3">/,
    `<div className="flex items-center gap-2">\n                    <button onClick={() => setIsSidebarOpen(true)} className="p-1.5 text-stone-600 rounded-lg bg-stone-100">\n                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>\n                    </button>`
).replace(
    /<button onClick=\{onLogout\}/,
    `<button onClick={() => setView('menu')} className="p-1.5 text-stone-500 rounded-lg bg-stone-50 mr-1" title="Back to Menu">\n                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>\n                    </button>\n                    <button onClick={onLogout}`
);

// We need to add the Mobile Drawer Sidebar to the workdesk block.
// The user wanted "the left side bar even for mobile".
// So we insert an off-canvas drawer just after the workdesk header.
const drawerCode = `
            {/* MOBILE SIDEBAR DRAWER */}
            {isSidebarOpen && (
                <div className="fixed inset-0 z-[100] flex">
                    {/* Backdrop */}
                    <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
                    {/* Drawer */}
                    <aside className="relative w-[280px] h-full bg-white flex flex-col shadow-2xl animate-in slide-in-from-left duration-300 z-10">
                        <div className="p-4 border-b border-stone-100 flex items-center justify-between">
                            <div>
                                <h1 className="text-xs font-black tracking-widest text-stone-900 uppercase flex items-center gap-2">
                                    <div className="w-6 h-6 bg-amber-500 rounded-lg flex items-center justify-center text-white">
                                        <Sun size={12} className="fill-white" />
                                    </div>
                                    Watersun
                                </h1>
                            </div>
                            <button onClick={() => setIsSidebarOpen(false)} className="p-1.5 text-stone-400 hover:text-stone-700 bg-stone-100 rounded-lg">
                                <X size={16} />
                            </button>
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
                                        onClick={() => { setActiveWorkdeskTab(stage.id); setIsSidebarOpen(false); }}
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
                </div>
            )}
`;

// Insert the drawer code right after the Mobile Header.
workdeskBlock = workdeskBlock.replace(
    /<\/header>/,
    `</header>\n${drawerCode}`
);


const newReturnBlock = `    return (
        <div className="flex flex-col min-h-screen bg-[#FCFBFA] text-stone-850 font-sans">
            {view === 'menu' && (
                <>
                    ${origHeader}
                    ${menuCode}
                </>
            )}
            
            {view === 'workdesk' && (
                <div className="flex-1 flex flex-col h-full">
${workdeskBlock}
                </div>
            )}
`;

// wait, workdeskBlock starts with `<div className="flex flex-col min-h-screen bg-[#FCFBFA] text-stone-850 font-sans">`.
// But I wrapped it inside `<div className="flex flex-col min-h-screen bg-[#FCFBFA] text-stone-850 font-sans">` above!
// This will mean nested divs that duplicate the min-h-screen. 
// Let's strip the outer div from workdeskBlock, or just replace my `newReturnBlock` to not have the wrapper.

const finalReturnBlock = `    return (
        <>
            {view === 'menu' && (
                <div className="min-h-screen bg-[#FCFBFA] text-stone-850 font-sans flex flex-col pb-8">
                    ${origHeader}
                    ${menuCode}
                </div>
            )}
            
            {view === 'workdesk' && (
${workdeskBlock}
            )}
`;

content = content.substring(0, currentRenderStartIdx) + finalReturnBlock + content.substring(currentRenderEndIdx);

fs.writeFileSync(file, content, 'utf8');
console.log('Restored menu and added sidebar drawer');
