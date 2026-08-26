const fs = require('fs');

const file = 'src/components/CustomerCard.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = '<div className={`rounded-2xl border shadow-sm hover:shadow-md transition-all border-l-4 group flex flex-col ${isCompleted ? \'bg-stone-50/80 border-stone-200 border-l-emerald-500 opacity-80\' : \'bg-white border-stone-100 border-l-amber-400\'}`}>';
const replacementStr = '<div className={`rounded-2xl border shadow-sm hover:shadow-md transition-all border-l-4 group flex flex-col relative ${showStageMenu ? \'z-50\' : \'z-10\'} ${isCompleted ? \'bg-stone-50/80 border-stone-200 border-l-emerald-500\' : \'bg-white border-stone-100 border-l-amber-400\'} ${isCompleted && !showStageMenu ? \'opacity-80\' : \'\'}`}>';

content = content.replace(targetStr, replacementStr);
fs.writeFileSync(file, content, 'utf8');
console.log('Fixed z-index');
