import { supabase } from '../supabase';

const withFullStop = (text) => {
    const t = String(text || '').trim();
    return !t || /[.!?]$/.test(t) ? t : `${t}.`;
};

/**
 * One plain sentence about the vendor's WhatsApp copy, from the `whatsapp`
 * field send-lead-to-vendor adds to every answer. '' while WhatsApp is switched
 * off (or the function is an older version), so the office sees exactly the
 * old email message until it goes live.
 *
 * @param {{sent?: boolean, skipped?: 'off'|'no_phone'|'limit', error?: string, testMode?: boolean, maskedPhone?: string}|undefined} whatsapp
 */
export function vendorWhatsAppNote(whatsapp) {
    if (!whatsapp || typeof whatsapp !== 'object' || whatsapp.skipped === 'off') return '';
    if (whatsapp.sent) {
        // Test mode: it went to the developer's test phone, not the vendor.
        return whatsapp.testMode
            ? 'WhatsApp sent to the test number (testing, not the vendor).'
            : `WhatsApp sent to ${whatsapp.maskedPhone || 'the vendor'}.`;
    }
    if (whatsapp.skipped === 'no_phone') {
        return 'WhatsApp not sent: no WhatsApp number is saved for this vendor (Admin can add it in Operations > Vendors Allotment).';
    }
    if (whatsapp.skipped === 'limit') {
        return 'WhatsApp not sent: it was already sent to this vendor twice in the last hour.';
    }
    if (whatsapp.error) {
        return `WhatsApp not sent: ${withFullStop(whatsapp.error)}`;
    }
    return '';
}

const joinSentences = (first, second) => (second ? `${withFullStop(first)} ${second}` : first);

/**
 * Sends a vendor notification email through the Supabase Edge Function. Once
 * WhatsApp is switched on, the same function also sends the vendor a WhatsApp;
 * the result is added to the message (and returned as `whatsapp`).
 *
 * @param {Object} params
 * @param {string} params.customerId
 * @param {Object} params.customer
 * @param {string} params.vendorName
 * @returns {Promise<{success: true, method: 'edge_function', recipient: string, message: string, whatsapp: Object|null}>}
 */
export async function sendVendorLeadNotification({
    customerId,
    customer,
    vendorName
}) {
    const cust = customer || {};
    const targetVendor = (vendorName || cust.vendor || '').trim();
    if (!targetVendor) {
        throw new Error('No vendor is allotted to this customer, so no notification can be sent.');
    }
    let recipient = ''; // no fallback

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
    }

    if (!recipient) {
        throw new Error(`No email address is saved for vendor "${targetVendor}".`);
    }

    // Material Delivery email must be sent by the server-side Edge Function.
    try {
        const { data, error } = await supabase.functions.invoke('send-lead-to-vendor', {
            // vendor_name / vendor_email kept for the edge function version
            // that is live now; the updated function ignores them and looks
            // the vendor up itself. Safe with either version.
            body: {
                customer_id: customerId,
                vendor_name: targetVendor,
                vendor_email: recipient
            }
        });

        if (error) {
            let detail = error.message || 'Edge Function request failed';
            let whatsappNote = '';
            try {
                const payload = await error.context?.json();
                detail = payload?.error || payload?.details || detail;
                // The email failed, but the WhatsApp may still have gone.
                whatsappNote = vendorWhatsAppNote(payload?.whatsapp);
            } catch {
                // Keep the original Supabase error message.
            }
            if (/failed to send a request|failed to fetch|functionsfetcherror/i.test(detail)) {
                const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'this website';
                detail = `The vendor email Edge Function could not be reached from ${currentOrigin}. Deploy the latest send-lead-to-vendor function so its CORS settings allow this website.`;
            }
            throw new Error(joinSentences(detail, whatsappNote));
        }
        if (!data?.success) {
            throw new Error(joinSentences(
                data?.error || 'The email service did not confirm delivery.',
                vendorWhatsAppNote(data?.whatsapp)
            ));
        }

        const sentTo = data.sent_to || recipient;
        return {
            success: true,
            method: 'edge_function',
            recipient: sentTo,
            message: joinSentences(`Email sent to ${sentTo}`, vendorWhatsAppNote(data.whatsapp)),
            whatsapp: data.whatsapp || null
        };
    } catch (err) {
        console.error('[VendorNotification] Edge Function failed:', err);
        throw err;
    }
}
