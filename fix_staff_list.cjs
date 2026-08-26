const fs = require('fs');

const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const stateTarget = `    React.useEffect(() => {
        supabase.from('profiles').select('name').order('name').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.name).filter(Boolean));
        });
    }, []);`;

const stateReplacement = `    React.useEffect(() => {
        supabase.from('meta').select('name').eq('category', 'integration_by').order('name').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.name).filter(Boolean));
        });
    }, []);`;

if (content.includes(stateTarget)) {
    content = content.replace(stateTarget, stateReplacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated staff list to fetch from meta where category = integration_by");
} else {
    console.log("Target not found!");
}
