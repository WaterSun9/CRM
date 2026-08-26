const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove state declarations
content = content.replace(
    /const \[projectMonthFilter, setProjectMonthFilter\] = useState\(''\);\n\s*const \[appliedProjectMonth, setAppliedProjectMonth\] = useState\(''\);/,
    ""
);

// 2. Remove logic from eligibleProjects
const oldLogic = `const matchesStage = projectStageFilter === 'ALL' || c.stage === projectStageFilter;
            const matchesMonth = checkMonthMatch(c.material_delivery_date, appliedProjectMonth);
            return matchesQuery && matchesStage && matchesMonth;`;
const newLogic = `const matchesStage = projectStageFilter === 'ALL' || c.stage === projectStageFilter;
            return matchesQuery && matchesStage;`;
content = content.replace(oldLogic, newLogic);

// Remove dependency
content = content.replace(
    /\[customers, projectSearchQuery, projectStageFilter, appliedProjectMonth\]/,
    "[customers, projectSearchQuery, projectStageFilter]"
);

// 3. Remove UI
const uiRegex = /<div className="flex items-center gap-1\.5 bg-stone-50 border border-stone-200 rounded-lg px-2 py-0\.5">[\s\S]*?<\/div>/;
content = content.replace(uiRegex, "");

fs.writeFileSync(file, content, 'utf8');
console.log("Removed project month filter from modal.");
