const fs = require('fs');
let file = 'src/components/DeliveryBatchesView.jsx';
let content = fs.readFileSync(file, 'utf8');

// Helper function to insert
const helperFunc = `
    const checkMonthMatch = (dateStr, monthFilterStr) => {
        if (!monthFilterStr) return true;
        if (!dateStr) return false;
        
        // monthFilterStr is "YYYY-MM"
        // Try simple startsWith first
        if (dateStr.startsWith(monthFilterStr)) return true;
        
        // Try parsing the date
        try {
            // Handle DD-MM-YYYY manually if present
            let parsedDate = new Date(dateStr);
            if (isNaN(parsedDate.getTime()) && typeof dateStr === 'string' && dateStr.includes('-')) {
                const parts = dateStr.split('-');
                if (parts[0].length === 2 && parts[2].length === 4) {
                    parsedDate = new Date(\`\${parts[2]}-\${parts[1]}-\${parts[0]}\`);
                }
            }
            if (isNaN(parsedDate.getTime())) return false;
            
            const y = parsedDate.getFullYear();
            const m = String(parsedDate.getMonth() + 1).padStart(2, '0');
            return \`\${y}-\${m}\` === monthFilterStr;
        } catch (e) {
            return false;
        }
    };
`;

// Inject helper before eligibleProjects
content = content.replace(
    "const eligibleProjects = useMemo(() => {",
    helperFunc + "\n    const eligibleProjects = useMemo(() => {"
);

// Update eligibleProjects logic
content = content.replace(
    /const matchesMonth = !projectMonthFilter \|\| \(c\.material_delivery_date && c\.material_delivery_date\.startsWith\(projectMonthFilter\)\);/,
    "const matchesMonth = checkMonthMatch(c.material_delivery_date, projectMonthFilter);"
);

// Update filteredBatches logic
content = content.replace(
    /const matchesMonth = !monthFilter \|\| \(b\.dispatch_date && b\.dispatch_date\.startsWith\(monthFilter\)\);/,
    "const matchesMonth = checkMonthMatch(b.dispatch_date, monthFilter);"
);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated filter logic.");
