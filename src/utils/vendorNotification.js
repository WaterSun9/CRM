import { supabase } from '../supabase';

/**
 * Sends a vendor notification email via Supabase Edge Function with graceful fallbacks.
 *
 * @param {Object} params
 * @param {string} params.customerId
 * @param {Object} params.customer
 * @param {string} params.vendorName
 * @param {string} params.vendorEmail
 * @returns {Promise<{success: boolean, method: 'edge_function' | 'mailto' | 'simulated', message?: string, mailtoUrl?: string}>}
 */
export async function sendVendorLeadNotification({
    customerId,
    customer,
    vendorName = 'Test Vendor (Solar Tech)',
    vendorEmail = 'deeproot120@gmail.com'
}) {
    const cust = customer || {};
    const recipient = vendorEmail || 'deeproot120@gmail.com';
    const targetVendor = vendorName || 'Test Vendor';

    // 1. Try invoking the Supabase Edge Function
    try {
        const { data, error } = await supabase.functions.invoke('send-lead-to-vendor', {
            body: {
                customer_id: customerId,
                vendor_name: targetVendor,
                vendor_email: recipient
            }
        });

        if (!error && data?.success) {
            return {
                success: true,
                method: 'edge_function',
                message: `Email dispatched to ${recipient}`
            };
        }
        
        if (error) {
            console.warn('[VendorNotification] Edge function call returned error (likely not deployed yet):', error);
        }
    } catch (err) {
        console.warn('[VendorNotification] Edge function network error:', err);
    }

    // 2. Fallback: Pre-formatted mailto trigger with full customer details
    const subject = encodeURIComponent(`Watersun CRM - New Project Assigned: ${cust.customer_name || 'Customer'} (${cust.folder_no || cust.consumer_no || 'CRN'})`);
    const bodyText = encodeURIComponent(
`Hello ${targetVendor},

A new solar installation project has been assigned to you.

--- PROJECT DETAILS ---
Customer Name: ${cust.customer_name || 'N/A'}
Contact Phone: ${cust.phone_number || 'N/A'}
Folder No: ${cust.folder_no || 'N/A'}
Consumer No: ${cust.consumer_no || 'N/A'}
Village / Address: ${cust.village || cust.villages || 'N/A'}
Sub Division: ${cust.sub_division || cust.sub_divisions || 'N/A'}
System Capacity: ${cust.system_capacity_kwp || 'N/A'} kWp
Module Brand: ${cust.module_brand || 'N/A'} (${cust.module_wp || ''} Wp)
Payment Type: ${cust.payment_type || 'N/A'}
Delivery Date: ${cust.material_delivery_date || 'N/A'}
Vehicle No: ${cust.delivery_vehicle_no || cust.vehicle_number || 'N/A'}
Driver: ${cust.driver_name || 'N/A'} (${cust.driver_phone_number || 'N/A'})

Please log in to your Vendor Portal to review dispatch items and update installation progress.

Watersun Solar Operations`
    );

    const mailtoUrl = `mailto:${recipient}?subject=${subject}&body=${bodyText}`;

    // Open mail client immediately if browser allows
    if (typeof window !== 'undefined') {
        const link = document.createElement('a');
        link.href = mailtoUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    return {
        success: true,
        method: 'mailto',
        mailtoUrl,
        message: `Prepared email for ${recipient}`
    };
}
