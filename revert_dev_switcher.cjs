const fs = require('fs');
const file = 'src/components/DevRoleSwitcher.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `        // Explicitly operate on the REAL Supabase website & database (disable sandbox demo)
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_demo_mode', 'false');
            window.sessionStorage.setItem('watersun_user', JSON.stringify({
                id: \`dev-\${mockRole.id}\`,
                email: mockRole.email,
                userType: mockRole.userType,
                role: mockRole.role,
                name: mockRole.name,
                channel_partner: mockRole.channel_partner,
                isDevRole: true
            }));
            window.location.reload();
            return;
        }`;

const replacementStr = `        // Explicitly operate on the REAL Supabase website & database (disable sandbox demo)
        if (typeof window !== 'undefined') {
            window.sessionStorage.setItem('watersun_demo_mode', 'false');
        }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Reverted DevRoleSwitcher reload");
} else {
    console.log("Target not found in DevRoleSwitcher.jsx");
}
