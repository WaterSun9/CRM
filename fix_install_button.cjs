const fs = require('fs');
let file = 'src/components/modal-tabs/InstallationStatusTab.jsx';
let content = fs.readFileSync(file, 'utf8');

const oldButton = `try {
                                                    await sendVendorLeadNotification({
                                                        customerId: customer.id,
                                                        customer: { ...customer, ...editData },
                                                        vendorName: editData.vendor
                                                    });
                                                    setInfoSentStatus('sent');
                                                    await logActivity(
                                                        user.id,
                                                        'email',
                                                        \`Vendor notification triggered for new vendor \${editData.vendor} (email sent to vendor)\`,
                                                        '',
                                                        customer.id
                                                    );
                                                    fetchLogs();
                                                } catch (err) {
                                                    console.error('Error invoking vendor notification:', err);
                                                    setInfoSentStatus('failed');
                                                } finally {
                                                    setSendingInfo(false);
                                                }
                                            }}
                                            className=\`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer \${
                                                sendingInfo
                                                    ? 'bg-stone-200 text-stone-400 cursor-wait'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/10'
                                            }\`
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            {sendingInfo ? 'Sending...' : 'Send Info to New Vendor'}
                                        </button>`;

const newButton = `try {
                                                    const res = await sendVendorLeadNotification({
                                                        customerId: customer.id,
                                                        customer: { ...customer, ...editData },
                                                        vendorName: editData.vendor
                                                    });
                                                    setInfoSentStatus('sent');
                                                    setInfoSentMessage(res.message || 'Email sent successfully');
                                                    await logActivity(
                                                        user.id,
                                                        'email',
                                                        \`Vendor notification triggered for new vendor \${editData.vendor} (\${res.recipient || 'no email found'})\`,
                                                        '',
                                                        customer.id
                                                    );
                                                    fetchLogs();
                                                } catch (err) {
                                                    console.error('Error invoking vendor notification:', err);
                                                    setInfoSentStatus('failed');
                                                } finally {
                                                    setSendingInfo(false);
                                                }
                                            }}
                                            className=\`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer \${
                                                sendingInfo
                                                    ? 'bg-stone-200 text-stone-400 cursor-wait'
                                                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/10'
                                            }\`
                                        >
                                            <Mail className="w-3.5 h-3.5" />
                                            {sendingInfo ? 'Sending...' : 'Resend Info to New Vendor'}
                                        </button>`;

if (content.includes(oldButton)) {
    content = content.replace(oldButton, newButton);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Fixed button in InstallationStatusTab.");
} else {
    console.log("Could not find the target button string.");
}

