const fs = require('fs');

const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `supabase.from('meta').select('name').eq('category', 'integration_by').order('name').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.name).filter(Boolean));
        });`;

const replacementStr = `supabase.from('meta').select('label').eq('category', 'integration_by').order('label').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.label).filter(Boolean));
        });`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed meta column to 'label'");
} else {
    console.log("Could not find the fetch block");
}
