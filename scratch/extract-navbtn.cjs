const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

// 1. Remove renderNavBtn definition from inside Dashboard
content = content.replace(/const renderNavBtn = \(\{ key, view, stage, icon: Icon, label, count, redBadge \}\) => \{[\s\S]*?return \([\s\S]*?<\/button>\s*\);\s*\};\n/m, '');

// 2. Define NavBtn at the top of the file, after imports
const navBtnCode = `
// ── NavBtn ────────────────────────────────────────────────────────────────────
const NavBtn = ({ view, stage, icon: Icon, label, count, redBadge, currentView, selectedStage, setCurrentView, setSelectedStage, setSidebarOpen }) => {
    const isActive = view === 'stages'
        ? (currentView === 'stages' && selectedStage === stage)
        : currentView === view;
    return (
        <button
            onClick={() => {
                if (view === 'stages') { setCurrentView('stages'); setSelectedStage(stage); }
                else setCurrentView(view);
                setSidebarOpen(false);
            }}
            className={\`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold mb-0.5 transition-colors \${isActive ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-100'}\`}>
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 text-left truncate">{label}</span>
            {count > 0 && (
                <span className={\`text-[10px] px-1.5 py-0.5 rounded-full min-w-[20px] text-center font-bold \${isActive ? 'bg-white/20 text-white' : redBadge ? 'bg-red-100 text-red-500' : 'bg-stone-100 text-stone-500'}\`}>
                    {count}
                </span>
            )}
        </button>
    );
};
`;

content = content.replace(/(import .*;\n\n)/, `$1${navBtnCode}\n`);

// 3. Replace {renderNavBtn(...)} with <NavBtn ... /> and pass the extra props
// The extra props are: currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen}
const extraProps = `currentView={currentView} selectedStage={selectedStage} setCurrentView={setCurrentView} setSelectedStage={setSelectedStage} setSidebarOpen={setSidebarOpen}`;

content = content.replace(/\{renderNavBtn\(\{ (.*?) \}\)\}/g, (match, propsString) => {
    // propsString looks like: view: "dashboard", icon: LayoutDashboard, label: "Dashboard", count: 0
    // We need to convert it back to JSX syntax!
    // regex to match prop: value
    let jsxProps = [];
    const propRegex = /([a-zA-Z0-9_]+):\s*([^,]+)/g;
    let propMatch;
    while ((propMatch = propRegex.exec(propsString)) !== null) {
        const propName = propMatch[1].trim();
        const propVal = propMatch[2].trim();
        if (propVal.startsWith('"') || propVal.startsWith("'")) {
            jsxProps.push(`${propName}=${propVal}`);
        } else if (propVal === 'true') {
            jsxProps.push(`${propName}`);
        } else {
            jsxProps.push(`${propName}={${propVal}}`);
        }
    }
    
    return `<NavBtn ${jsxProps.join(' ')} ${extraProps} />`;
});

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("Extracted NavBtn");
