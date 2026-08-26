const fs = require('fs');

const file = 'src/components/UserManagementView.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `                    <input
                        type="text"
                        placeholder="Search users by name, email, role, or channel partner..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-stone-400"
                    />`;

const replacementStr = `                    <input
                        type="search"
                        name="crm_global_user_search_unique"
                        autoComplete="off"
                        autoCorrect="off"
                        spellCheck="false"
                        placeholder="Search users by name, role, or channel partner..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-white border border-stone-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-1 focus:ring-amber-500 placeholder:text-stone-400"
                    />`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated UserManagementView.jsx search input");
} else {
    console.log("Target not found!");
}
