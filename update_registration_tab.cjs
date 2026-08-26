const fs = require('fs');
let file = 'src/components/modal-tabs/RegistrationTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const target = `<CheckboxRemarkItem
                            label="Feasibility Document *"
                            field="feasibilty_document"`;

const replacement = `<CheckboxRemarkItem
                            label="Application Acknowledgment *"
                            field="application_acknowledgment"
                            value={editData.application_acknowledgment}
                            onChange={handleChange}
                            isEditing={isEditable}
                            documents={documents}
                            onUpload={onFileUpload}
                            onDelete={onFileDelete}
                            onPreview={onFilePreview}
                            onUpdateRemark={onUpdateRemark}
                        />
                        <CheckboxRemarkItem
                            label="Feasibility Document *"
                            field="feasibilty_document"`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log("Updated RegistrationTab.jsx");
