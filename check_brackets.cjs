const fs = require('fs');
const code = fs.readFileSync('src/components/AgentPortal.jsx', 'utf8');

let cleanCode = code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    // Replace strings with empty string so we don't count brackets inside them
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""')
    .replace(/`[^`]*`/g, '``');

const lines = cleanCode.split('\n');
let stack = [];
for (let i = 0; i < lines.length; i++) {
    for (let j = 0; j < lines[i].length; j++) {
        const char = lines[i][j];
        if (char === '(' || char === '{' || char === '[') {
            stack.push({char, line: i + 1});
        } else if (char === ')' || char === '}' || char === ']') {
            stack.pop();
        }
    }
}
console.log("Unclosed brackets:", stack);
