const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.jsx', 'utf8');

// 1. Rename const NavBtn = ... to const renderNavBtn = ...
content = content.replace(
    /const NavBtn = \({ view, stage, icon: Icon, label, count, redBadge }\) => \{/,
    'const renderNavBtn = ({ key, view, stage, icon: Icon, label, count, redBadge }) => {'
);

// 2. Add key={key} to the returned <button>
content = content.replace(
    /return \(\s*<button/,
    'return (\n            <button key={key}'
);

// 3. Replace <NavBtn ... /> with {renderNavBtn({ ... })}
// We can use a regex to match the props.
content = content.replace(/<NavBtn\s+([^>]+?)\s*\/>/g, (match, propsString) => {
    // propsString looks like: view="dashboard" icon={LayoutDashboard} label="Dashboard" count={0}
    // or: key={s.id} view="stages" stage={s.id} icon={s.icon} label={s.label} count={stageCounts[s.id] || 0}
    
    let objProps = [];
    
    // We need to parse things like view="dashboard" or icon={LayoutDashboard}
    // Regex to match propName="value" or propName={value} or booleanProp
    const propRegex = /([a-zA-Z0-9_]+)(?:=(?:"([^"]*)"|\{([^}]+)\}))?/g;
    
    let propMatch;
    while ((propMatch = propRegex.exec(propsString)) !== null) {
        const propName = propMatch[1];
        const stringVal = propMatch[2];
        const jsxVal = propMatch[3];
        
        if (stringVal !== undefined) {
            objProps.push(`${propName}: "${stringVal}"`);
        } else if (jsxVal !== undefined) {
            objProps.push(`${propName}: ${jsxVal}`);
        } else {
            objProps.push(`${propName}: true`);
        }
    }
    
    return `{renderNavBtn({ ${objProps.join(', ')} })}`;
});

fs.writeFileSync('src/components/Dashboard.jsx', content);
console.log("Fixed Dashboard.jsx");
