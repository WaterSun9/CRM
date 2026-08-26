const fs = require('fs');

const file = 'src/utils/vendorNotification.js';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `export async function sendVendorLeadNotification({
    customerId,
    customer,
    vendorName = 'Test Vendor (Solar Tech)',
    vendorEmail = 'deeproot120@gmail.com'
}) {
    const cust = customer || {};
    const recipient = vendorEmail || 'deeproot120@gmail.com';
    const targetVendor = vendorName || 'Test Vendor';`;

const replacementStr = `export async function sendVendorLeadNotification({
    customerId,
    customer,
    vendorName
}) {
    const cust = customer || {};
    const targetVendor = vendorName || cust.vendor || 'Test Vendor';
    let recipient = 'deeproot120@gmail.com'; // fallback

    // Lookup real vendor email from database
    try {
        if (targetVendor) {
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('email')
                .ilike('name', targetVendor.trim())
                .maybeSingle();
                
            if (vendorData && vendorData.email) {
                recipient = vendorData.email;
            }
        }
    } catch (err) {
        console.warn('[VendorNotification] Failed to lookup vendor email:', err);
    }`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Rewrote vendorNotification.js to fetch real email");
} else {
    console.log("Target not found!");
}
