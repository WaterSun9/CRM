const fs = require('fs');

const file = 'src/components/AgentPortal.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Delete the Desktop Sidebar entirely
const dSidebarStart = content.indexOf('{/* DESKTOP SIDEBAR */}');
const dSidebarEnd = content.indexOf('</aside>', dSidebarStart) + '</aside>'.length;
if (dSidebarStart !== -1) {
    content = content.substring(0, dSidebarStart) + content.substring(dSidebarEnd);
}

// 2. Make the Drawer available on all screens (remove md:hidden)
content = content.replace(/<div className="fixed inset-0 z-\[100\] flex md:hidden">/g, '<div className="fixed inset-0 z-[100] flex">');
content = content.replace(/<button onClick=\{\(\) => setIsSidebarOpen\(false\)\} className="md:hidden p-1.5/g, '<button onClick={() => setIsSidebarOpen(false)} className="p-1.5');

// 3. Make the Stages button available on all screens (remove md:hidden)
content = content.replace(/<button onClick=\{\(\) => setIsSidebarOpen\(true\)\} className="md:hidden flex items-center/g, '<button onClick={() => setIsSidebarOpen(true)} className="flex items-center');

// 4. Center the workdesk layout and constrain it to max-w-md
content = content.replace(
    /<div className="flex h-screen bg-\[\#FCFBFA\] text-stone-850 font-sans overflow-hidden">/g,
    '<div className="flex h-screen bg-stone-100 justify-center text-stone-850 font-sans overflow-hidden"><div className="w-full max-w-md bg-[#FCFBFA] h-full shadow-2xl relative flex flex-col">'
);
content = content.replace(
    /            \}\)\}\n        <\/>\n    \);\n\}/g,
    '            })}\n        </div></div>\n        </>\n    );\n}'
);

// 5. Remove the desktop search bar that's hidden on mobile, and the mobile search bar restriction
content = content.replace(/<div className="hidden sm:block relative w-56 md:w-80">/g, '<div className="hidden">');
content = content.replace(/<div className="sm:hidden px-4 py-3 bg-white border-b border-stone-200 shrink-0">/g, '<div className="px-4 py-3 bg-white border-b border-stone-200 shrink-0">');

// 6. Make grid cols 1 always for workdesk customers
content = content.replace(/<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 auto-rows-max">/g, '<div className="grid grid-cols-1 gap-3 auto-rows-max">');

fs.writeFileSync(file, content, 'utf8');
console.log('Enforced strict mobile layout universally');

