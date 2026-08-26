const fs = require('fs');

const file = 'src/App.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            <DevRoleSwitcher
                currentUser={user}
                onSwitchUser={setUser}
                isOpen={devSwitcherOpen}
                onToggle={setDevSwitcherOpen}`;

const replacementStr = `            <DevRoleSwitcher
                currentUser={user}
                onSwitchUser={(newUser) => {
                    setUser(newUser);
                    setIsDemoMode(false);
                }}
                isOpen={devSwitcherOpen}
                onToggle={setDevSwitcherOpen}`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated App.jsx to setIsDemoMode(false) on switch");
} else {
    console.log("Target not found!");
}
