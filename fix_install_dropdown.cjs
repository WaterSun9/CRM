const fs = require('fs');
let file = 'src/components/modal-tabs/InstallationStatusTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldOnChange = `onChange={(e) => {
                                            const selectedVal = e.target.value;
                                            // Update local state instantly
                                            setEditData(prev => ({
                                                ...prev,
                                                vendor: selectedVal
                                            }));
                                            setInfoSentStatus(null);
                                            // Fire‑and‑forget backend update to avoid UI blocking
                                            onUpdate(customer.id, { vendor: selectedVal }).catch(console.error);
                                            logActivity(
                                                user.id,
                                                'update',
                                                \`\${customer.customer_name}: Assigned new vendor to \${selectedVal || 'None'}\`,
                                                '',
                                                customer.id
                                            ).catch(console.error);
                                            fetchLogs();
                                        }}`;

const newOnChange = `onChange={(e) => {
                                            const selectedVal = e.target.value;
                                            if (selectedVal) {
                                                setVendorConfirm({ isOpen: true, vendorName: selectedVal });
                                            } else {
                                                setEditData(prev => ({ ...prev, vendor: null }));
                                                setInfoSentStatus(null);
                                                onUpdate(customer.id, { vendor: null }).then(() => {
                                                    logActivity(
                                                        user.id,
                                                        'update',
                                                        \`\${customer.customer_name}: Removed assigned vendor\`,
                                                        '',
                                                        customer.id
                                                    ).then(fetchLogs);
                                                });
                                            }
                                        }}`;

if (content.includes(oldOnChange)) {
    content = content.replace(oldOnChange, newOnChange);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed InstallationStatusTab dropdown.");
} else {
    console.log("Could not find the target string.");
}

