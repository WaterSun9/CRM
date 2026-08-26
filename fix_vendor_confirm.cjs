const fs = require('fs');

function updateTab(file) {
    let content = fs.readFileSync(file, 'utf8');

    // 1. Add state for the confirmation modal
    content = content.replace(
        "const [infoSentMessage, setInfoSentMessage] = useState('');",
        "const [infoSentMessage, setInfoSentMessage] = useState('');\n    const [vendorConfirm, setVendorConfirm] = useState({ isOpen: false, vendorName: '' });"
    );

    // 2. Add the modal JSX just before the final </div> of the component (or inside it)
    // Both tabs end with `</div>\n    );\n}`
    const modalJsx = `
            {vendorConfirm.isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="bg-stone-50 border-b border-stone-100 p-4">
                            <h3 className="font-bold text-stone-800 text-sm flex items-center gap-2">
                                <Building2 size={16} className="text-blue-500" />
                                Confirm Vendor Assignment
                            </h3>
                        </div>
                        <div className="p-5 space-y-4">
                            <p className="text-xs text-stone-600 leading-relaxed">
                                You are about to assign <strong className="text-stone-900">{vendorConfirm.vendorName}</strong> to this project.
                            </p>
                            <p className="text-xs text-stone-600 leading-relaxed">
                                This will automatically assign them in the database and send an email notification with the project details. Do you want to proceed?
                            </p>
                        </div>
                        <div className="p-4 bg-stone-50 border-t border-stone-100 flex gap-2 justify-end">
                            <button
                                type="button"
                                onClick={() => setVendorConfirm({ isOpen: false, vendorName: '' })}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-stone-600 bg-white border border-stone-200 hover:bg-stone-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={async () => {
                                    const selectedVal = vendorConfirm.vendorName;
                                    setVendorConfirm({ isOpen: false, vendorName: '' });
                                    setSendingInfo(true);
                                    setInfoSentStatus(null);
                                    
                                    setEditData(prev => ({ ...prev, vendor: selectedVal }));
                                    await onUpdate(customer.id, { vendor: selectedVal });
                                    
                                    await logActivity(
                                        user.id,
                                        'update',
                                        \`\${customer.customer_name}: Assigned vendor to \${selectedVal}\`,
                                        '',
                                        customer.id
                                    );
                                    
                                    try {
                                        const res = await sendVendorLeadNotification({
                                            customerId: customer.id,
                                            customer: { ...customer, ...editData, vendor: selectedVal },
                                            vendorName: selectedVal
                                        });

                                        setInfoSentStatus('sent');
                                        setInfoSentMessage(res.message || 'Email sent successfully');
                                        await logActivity(
                                            user.id,
                                            'email',
                                            \`Vendor notification triggered for \${selectedVal} (\${res.recipient || 'no email found'})\`,
                                            '',
                                            customer.id
                                        );
                                    } catch (err) {
                                        console.error('Error sending vendor notification:', err);
                                        setInfoSentStatus('failed');
                                    } finally {
                                        setSendingInfo(false);
                                        fetchLogs();
                                    }
                                }}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition flex items-center gap-1.5 cursor-pointer"
                            >
                                <Mail size={14} />
                                Confirm & Send Email
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>`;
    content = content.replace(/<\/div>\s*\);\s*}/g, modalJsx + '\n    );\n}');

    // 3. Update the dropdown onChange handler
    const oldOnChangeRegex = /onChange=\{async \(e\) => \{[\s\S]*?fetchLogs\(\);\s*\}\}/g;
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
    content = content.replace(oldOnChangeRegex, newOnChange);

    // 4. Change "Send Info" to "Resend Info" since it's now mostly a fallback
    content = content.replace(/\{sendingInfo \? 'Sending\.\.\.' : 'Send Info'\}/g, "{sendingInfo ? 'Sending...' : 'Resend Info'}");

    fs.writeFileSync(file, content, 'utf8');
    console.log(`Updated ${file}`);
}

updateTab('src/components/modal-tabs/MaterialDeliveryTab.jsx');
updateTab('src/components/modal-tabs/InstallationStatusTab.jsx');
