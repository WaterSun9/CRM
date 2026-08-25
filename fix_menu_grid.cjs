const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

const startTarget = '<section className="grid grid-cols-2 gap-3">\n                        {[';
const endTarget = '                    <section className="space-y-3">';

const startIndex = content.indexOf(startTarget);
const endIndex = content.indexOf(endTarget);

if (startIndex !== -1 && endIndex !== -1) {
    const newGrid = `<section className="grid grid-cols-2 gap-3">
                        {PRIMARY_STAGES.map(stage => {
                            const count = getCustomersByStage(stage.id).length;
                            const StageIcon = stage.icon || Folder;
                            return (
                                <button 
                                    key={stage.id} 
                                    onClick={() => { setActiveWorkdeskTab(stage.id); setView('workdesk'); }}
                                    className="rounded-2xl border border-stone-200/80 bg-white p-4 shadow-sm text-left hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer active:scale-[0.98]"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                            <StageIcon size={15} />
                                        </div>
                                        <ChevronRight size={14} className="text-stone-300 group-hover:text-blue-500 transition-transform group-hover:translate-x-1" />
                                    </div>
                                    <p className="mt-3 text-2xl font-black tracking-tight text-stone-900 group-hover:text-blue-700 transition-colors">{count}</p>
                                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-stone-500 truncate">{stage.label}</p>
                                </button>
                            );
                        })}
                    </section>

`;
    content = content.substring(0, startIndex) + newGrid + content.substring(endIndex);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated home page grid with all stages!");
} else {
    console.error("Could not find the grid block in AgentPortal");
}

