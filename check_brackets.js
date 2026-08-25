const fs = require('fs');
const code = fs.readFileSync('src/components/AgentPortal.jsx', 'utf8');

let stack = [];
const lines = code.split('\n');

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // extremely crude check, ignoring strings/comments
    for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '(' || char === '{' || char === '[') {
            stack.push({ char, line: i + 1, col: j + 1 });
        } else if (char === ')' || char === '}' || char === ']') {
            if (stack.length === 0) {
                console.log(`Unmatched closing ${char} at line ${i + 1}`);
                continue;
            }
            const last = stack.pop();
            const pairs = { '(': ')', '{': '}', '[': ']' };
            if (pairs[last.char] !== char) {
                console.log(`Mismatched bracket at line ${i + 1}: expected ${pairs[last.char]} but got ${char}`);
            }
        }
    }
}

if (stack.length > 0) {
    console.log("Unclosed brackets:");
    console.log(stack);
} else {
    console.log("All brackets balanced!");
}
