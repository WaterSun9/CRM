const fs = require('fs');

const file = 'src/components/modal-tabs/DiscomSubmissionTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const target1 = `    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview,
    onUpdateRemark
}) {`;

const replacement1 = `    documents = [],
    onFileUpload,
    onFileDelete,
    onFilePreview,
    onUpdateRemark,
    meta = {}
}) {`;

content = content.replace(target1, replacement1);

const target2 = `    React.useEffect(() => {
        supabase.from('meta').select('label').eq('category', 'integration_by').order('label').then(({ data }) => {
            if (data) setStaffList(data.map(d => d.label).filter(Boolean));
        });
    }, []);`;

const replacement2 = `    React.useEffect(() => {
        const staff = meta['registration_by'] || [];
        setStaffList(staff);
    }, [meta]);`;

content = content.replace(target2, replacement2);

fs.writeFileSync(file, content, 'utf8');
console.log("Updated DiscomSubmissionTab to use meta['registration_by']");
