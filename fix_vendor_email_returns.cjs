const fs = require('fs');

// 1. Update vendorNotification.js to return recipient
let vnFile = 'src/utils/vendorNotification.js';
let vnContent = fs.readFileSync(vnFile, 'utf8');
vnContent = vnContent.replace(/method: 'edge_function',/g, "method: 'edge_function',\n                recipient,");
vnContent = vnContent.replace(/method: 'mailto',/g, "method: 'mailto',\n        recipient,");
fs.writeFileSync(vnFile, vnContent, 'utf8');

// 2. Update MaterialDeliveryTab.jsx
let mdFile = 'src/components/modal-tabs/MaterialDeliveryTab.jsx';
let mdContent = fs.readFileSync(mdFile, 'utf8');

// Add infoSentMessage state
mdContent = mdContent.replace(
    'const [infoSentStatus, setInfoSentStatus] = useState(null);',
    "const [infoSentStatus, setInfoSentStatus] = useState(null);\n    const [infoSentMessage, setInfoSentMessage] = useState('');"
);

// Update click handler
const mdClickTarget = `setInfoSentStatus('sent');
                                        await logActivity(
                                            user.id,
                                            'email',
                                            \`Vendor notification triggered for \${editData.vendor} (email sent to vendor)\`,
                                            '',
                                            customer.id
                                        );`;
const mdClickReplacement = `setInfoSentStatus('sent');
                                        setInfoSentMessage(res.message || 'Email sent successfully');
                                        await logActivity(
                                            user.id,
                                            'email',
                                            \`Vendor notification triggered for \${editData.vendor} (\${res.recipient || 'no email found'})\`,
                                            '',
                                            customer.id
                                        );`;
mdContent = mdContent.replace(mdClickTarget, mdClickReplacement);

// Update UI
const mdUiTarget = `<p className="text-[8px] font-bold text-emerald-600 mt-0.5 animate-in fade-in duration-200">
                                    Email sent to Vendor
                                </p>`;
const mdUiReplacement = `<p className="text-[8px] font-bold text-emerald-600 mt-0.5 animate-in fade-in duration-200">
                                    {infoSentMessage}
                                </p>`;
mdContent = mdContent.replace(mdUiTarget, mdUiReplacement);
fs.writeFileSync(mdFile, mdContent, 'utf8');

// 3. Update InstallationStatusTab.jsx
let isFile = 'src/components/modal-tabs/InstallationStatusTab.jsx';
let isContent = fs.readFileSync(isFile, 'utf8');

// Add infoSentMessage state
isContent = isContent.replace(
    'const [infoSentStatus, setInfoSentStatus] = useState(null);',
    "const [infoSentStatus, setInfoSentStatus] = useState(null);\n    const [infoSentMessage, setInfoSentMessage] = useState('');"
);

// Update click handler
const isClickTarget = `setInfoSentStatus('sent');
                                                        await logActivity(
                                                            user.id,
                                                            'email',
                                                            \`Vendor notification triggered for new vendor \${editData.vendor} (email sent to vendor)\`,
                                                            '',
                                                            customer.id
                                                        );`;
const isClickReplacement = `setInfoSentStatus('sent');
                                                        setInfoSentMessage(res.message || 'Email sent successfully');
                                                        await logActivity(
                                                            user.id,
                                                            'email',
                                                            \`Vendor notification triggered for new vendor \${editData.vendor} (\${res.recipient || 'no email found'})\`,
                                                            '',
                                                            customer.id
                                                        );`;
isContent = isContent.replace(isClickTarget, isClickReplacement);

// Update UI
const isUiTarget = `<p className="text-[8px] font-bold text-emerald-600 mt-0.5 animate-in fade-in duration-200">
                                                Email sent to Vendor
                                            </p>`;
const isUiReplacement = `<p className="text-[8px] font-bold text-emerald-600 mt-0.5 animate-in fade-in duration-200">
                                                {infoSentMessage}
                                            </p>`;
isContent = isContent.replace(isUiTarget, isUiReplacement);
fs.writeFileSync(isFile, isContent, 'utf8');

console.log("Updated vendor email UI and logs to be dynamic.");
