const fs = require('fs');

function applyReadonlyTrick(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace the search inputs to include the readOnly trick
    // We will look for <input type="search" ... /> and inject the trick.

    // Using a regex to find all <input type="search" ... />
    const inputRegex = /<input\s+type="search"([^>]+)>/g;
    
    const newContent = content.replace(inputRegex, (match, p1) => {
        // If it already has readOnly, don't replace
        if (p1.includes('readOnly')) return match;
        
        // Inject readOnly and onFocus
        // We need to carefully add these props
        return `<input type="text" readOnly onFocus={(e) => e.target.removeAttribute('readonly')} ${p1}>`;
    });

    if (newContent !== content) {
        fs.writeFileSync(filePath, newContent, 'utf8');
        console.log(`Updated ${filePath}`);
    } else {
        console.log(`No changes made to ${filePath}`);
    }
}

applyReadonlyTrick('src/components/UserManagementView.jsx');
applyReadonlyTrick('src/components/Dashboard.jsx');
