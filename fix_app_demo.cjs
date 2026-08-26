const fs = require('fs');

const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                onSwitchUser={(newUser) => {
                    setUser(newUser);
                    setDevSwitcherOpen(false);
                }}`;

const replacementStr = `                onSwitchUser={(newUser) => {
                    setUser(newUser);
                    setIsDemoMode(false);
                    setDevSwitcherOpen(false);
                }}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated App.jsx to setIsDemoMode(false) on switch");
} else {
    console.log("Target not found!");
}
