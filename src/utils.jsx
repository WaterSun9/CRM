// ─── utils.jsx ────────────────────────────────────────────────────────────────
// Pure utility functions - no UI, no React state.
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import { PRIMARY_STAGES, SUBSIDY_TAGS, LOAN_TAGS } from './constants';

// ─── Activity Logging ─────────────────────────────────────────────────────────
export async function logActivity(
    userId,
    action,
    message,
    details = '',
    customerId = null
) {
    if (customerId && String(customerId).startsWith('demo-')) return;
    
    // UUID validation regex
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (userId && !uuidRegex.test(userId)) {
        console.warn('Skipping activity log: invalid user_id UUID (likely a fake test login)');
        return;
    }
    if (customerId && !uuidRegex.test(customerId)) {
        console.warn('Skipping activity log: invalid customer_id UUID');
        return;
    }

    try {
        const { error } = await supabase
            .from('activity_log')
            .insert({
                user_id: userId,
                customer_id: customerId,
                action,
                message,
                new_value: details,
                created_at: new Date().toISOString(),
            });

        if (error) {
            console.error('Activity log error:', error);
        }
    } catch (e) {
        console.error('Activity log error:', e);
    }
}

// ─── Metadata Hook ────────────────────────────────────────────────────────────
// Fetches the 'metadata' table once and returns a grouped object like:
// { company_branch: ['Delhi', 'Mumbai'], poc: ['Alice', 'Bob'], ... }
import { useState, useEffect } from 'react';

export function useMetadata() {
    const [meta, setMeta] = useState({});
    useEffect(() => {
        supabase.from('metadata').select('category, label').then(({ data }) => {
            if (!data) return;
            const grouped = {};
            data.forEach(({ category, label }) => {
                if (!grouped[category]) grouped[category] = [];
                grouped[category].push(label);
            });
            setMeta(grouped);
        });
    }, []);
    return meta;
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
export function exportAllToCSV(customers) {
    if (!customers || customers.length === 0) {
        alert('No customer records available to export.');
        return;
    }

    const currentDateStr = new Date().toISOString().split('T')[0];
    const currentTimestampStr = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

    const escapeCSV = (val) => {
        if (val === null || val === undefined) return '""';
        let str = typeof val === 'object' ? JSON.stringify(val) : String(val);
        // Prevent CSV Formula Injection
        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }
        // Escape double quotes and wrap in quotes
        return `"${str.replace(/"/g, '""')}"`;
    };

    // Rebuilt against the current live `admin` schema - the previous
    // version of this list dated back to an older column structure and
    // many of those columns (application_number, meter_category,
    // sanctioned_load, bank_name, loan_sanction_amount, etc.) no longer
    // exist. Every field below is confirmed still in active use
    // elsewhere in the app (models.jsx's DEFAULT_LEAD_FORM, or read/write
    // in a modal tab).
    const yn = (val) => val === true ? 'Yes' : val === false ? 'No' : (val || '');

    // Some jsonb columns come back as a JSON string on older rows - normalise
    // both shapes before flattening so nothing silently exports as blank.
    const asObj = (val) => {
        if (!val) return {};
        if (typeof val === 'object') return val;
        try { return JSON.parse(val) || {}; } catch { return {}; }
    };
    const asArr = (val) => {
        if (!val) return [];
        if (Array.isArray(val)) return val;
        if (typeof val === 'string') {
            try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
        }
        return [];
    };
    // stages_remarks is a { STAGE_ID: 'remark' } map - flatten to one cell
    const flattenStageRemarks = (val) => Object.entries(asObj(val))
        .filter(([key, text]) => key !== 'discom_agreement_date' && String(text || '').trim())
        .map(([key, text]) => `${PRIMARY_STAGES.find(st => st.id === key)?.label || key}: ${text}`)
        .join(' | ');
    // loan_history / subsidy_history are [{ status, date, remark }] - flatten to one cell
    const flattenHistory = (val) => asArr(val)
        .map(e => [e?.date, e?.status, e?.remark].filter(Boolean).join(' - '))
        .filter(Boolean)
        .join(' | ');

    const headers = [
        'Export Date',
        'Customer Name',
        'Phone Number',
        'Email Address',
        'Consumer No',
        'Villages / Address',
        'Sub Division',
        'Channel Partner',
        'Dealer',
        'Current Stage',
        'Payment Type',
        'System Capacity (kWp)',
        'Module Brand',
        'Module Wp',
        'Number of Modules',
        'Folder No',
        'Registration Date',
        'Registration By',
        'Registration No',
        'Feasibility No',
        'Jansamarth Application No',
        'Aadhaar Card Front',
        'Aadhaar Card Back',
        'PAN Card',
        'Index-2',
        'Light Bill',
        'Bank Details',
        'House Geo Tag Photo',
        'Extra Docs',
        'Feasibility Document',
        'Subsidy Token Photo',
        'Application Acknowledgment',
        'Vendor Feasibility',
        'Site Feasibility',
        'Digital Certificate',
        'Loan Tag',
        'Cash Total Amount (₹)',
        'Roof / Shed',
        'DC Cable (m)',
        'AC Cable (m)',
        'Structure Front Leg Height',
        'Structure Rear Leg Height',
        'Invoice No',
        'Invoice Value (₹)',
        'Material Order Notes',
        'Inverter Make',
        'Inverter Serial No',
        'Panel Serial Numbers',
        'Vendor',
        'Driver Name',
        'Driver Phone Number',
        'Vehicle Number',
        'Material Delivery Date',
        'Delivery Status',
        'Vendor Payment Status',
        'Vendor Quote (₹)',
        'Vendor Paid Date',
        'Installation Status',
        'Installation Date',
        'Installation Note',
        'Geo Tag Status',
        'Meter Installation',
        'Discom Inspection',
        'PM Surya Ghar Stamp',
        'Subsidy Tag',
        'Warranty Card',
        'Insurance Status',
        'Hold Procurement',
        'Internal Remarks',
        'Stage Remarks',
        'Created At',
        'Updated At',
        // ── Previously missing columns ──────────────────────────────────
        'Vendor Note / Give-up Reason',
        'Vendor Give-Up Approved',
        'Vendor Paid By',
        'Delivery Batch No',
        'DCR Certificate',
        'Signature Pic',
        'Stamp',
        'SFDC Photo',
        'Meter Installation Photo',
        'Geo Tag Image',
        'Discom Submitted By',
        'Discom Submission Date',
        'Agreement First Party',
        'Agreement Second Party',
        'Agreement Purchased Party',
        'Agreement Execution Date',
        'Stamp Value',
        'Stamp Description',
        'Sent to Stamp Maker',
        'Sent to Stamp Maker By',
        'Stamp Sent',
        'Stamp Approved',
        'Stamp Approved By',
        'Stamp Completed At',
        'Stamp Completed By',
        'Stamp Remark',
        'Stamp Send-back Remark',
        'Stamp Send-back By',
        'Loan History',
        'Subsidy History'
    ];

    const rows = customers.map(c => {
        const stageLabel = PRIMARY_STAGES.find(s => s.id === c.stage)?.label || c.stage || '';
        const subsidyLabel = SUBSIDY_TAGS.find(f => f.id === c.subsidy_tag)?.label || c.subsidy_tag || '';
        const loanLabel = LOAN_TAGS.find(f => f.id === c.loan_tag)?.label || c.loan_tag || '';
        const panelSerials = Array.isArray(c.panel_serial_no)
            ? c.panel_serial_no.filter(Boolean).join('; ')
            : (c.panel_serial_no || '');
        const ds = asObj(c.discom_submission);
        const sr = asObj(c.stages_remarks);

        return [
            currentTimestampStr,
            c.customer_name || '',
            c.phone_number || '',
            c.email_address || '',
            c.consumer_no || '',
            c.villages || '',
            c.sub_divisions || '',
            c.channel_partner || '',
            c.sub_channel_partner || '',
            stageLabel,
            c.payment_type || '',
            c.system_capacity_kwp || '',
            c.module_brand || '',
            c.module_wp || '',
            c.no_of_modules || '',
            c.folder_no || '',
            c.registration_date || '',
            c.registration_by || '',
            c.registration_no || '',
            c.feasibility_no || '',
            c.jansamarth_application_no || '',
            yn(c.adhaar_card_front),
            yn(c.adhaar_card_back),
            yn(c.pan_card),
            yn(c.index_2),
            yn(c.light_bill),
            yn(c.bank_details),
            yn(c.house_geo_tag_photo),
            yn(c.extra_docs),
            yn(c.feasibilty_document),
            yn(c.subsidy_token_photo),
            yn(c.application_acknowledgment),
            yn(c.vendor_feasibility),
            yn(c.site_feasibility),
            yn(c.digital_certificate),
            loanLabel,
            c.cash_details?.total_amount || '',
            c.roof_shed || '',
            c.dc_cable || '',
            c.ac_cable || '',
            c.structure_front_leg_height || '',
            c.structure_rear_leg_height || '',
            c.invoice_no || '',
            c.invoice_value || '',
            c.material_order_notes || '',
            c.inverter_make || '',
            c.inverter_serial_no || '',
            panelSerials,
            c.vendor || '',
            c.driver_name || '',
            c.driver_phone_number || '',
            c.vehicle_number || '',
            c.material_delivery_date || '',
            c.delivery_status || '',
            c.vendor_payment_status || '',
            c.vendor_quote || '',
            c.vendor_paid_date || '',
            c.installation_status || '',
            c.installation_date || '',
            c.installation_note || '',
            c.geo_tag_status || '',
            c.meter_installation || '',
            c.discom_inspection || '',
            yn(c.pm_surya_ghar_stamp),
            subsidyLabel,
            yn(c.warranty_card),
            yn(c.insurance_status),
            c.hold_procurement || '',
            c.internal_remarks || '',
            flattenStageRemarks(c.stages_remarks),
            c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
            c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-IN') : '',
            // ── Previously missing columns ──────────────────────────────
            c.vendor_note || '',
            yn(c.vendor_give_up_approved),
            c.vendor_paid_by || '',
            c.delivery_batch_id || '',
            yn(c.dcr_certificate),
            yn(c.signature_pic),
            yn(c.stamp),
            yn(c.sfdc_photo),
            yn(c.meter_installation_photo),
            yn(c.geo_tag_image),
            ds.submitted_by || '',
            ds.date || '',
            ds.first_party || '',
            ds.second_party || '',
            ds.purchased_party || '',
            sr.discom_agreement_date || '',
            ds.stamp_value || '',
            ds.stamp_description || '',
            yn(ds.sent_to_stamp_maker),
            ds.sent_to_stamp_maker_by || '',
            yn(ds.stamp_sent),
            yn(ds.stamp_approved),
            ds.stamp_approved_by || '',
            ds.stamp_completed_at || '',
            ds.stamp_completed_by || '',
            ds.stamp_remark || '',
            ds.stamp_sendback_remark || '',
            ds.stamp_sendback_by || '',
            flattenHistory(c.loan_history),
            flattenHistory(c.subsidy_history)
        ].map(escapeCSV).join(',');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCSV).join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watersun_crm_export_${currentDateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ─── Indian Number System Formatters ──────────────────────────────────────────
// Indian comma system: 1,00,000  (lakhs), 1,00,00,000 (crores)

/** Format a number with Indian commas (no ₹ symbol). e.g. 123456 → "1,23,456" */
export function toIndianCommas(val) {
    const n = Number(String(val).replace(/,/g, ''));
    if (isNaN(n) || val === '' || val == null) return '';
    const [intPart, decPart] = n.toString().split('.');
    // Indian grouping: last 3 digits, then groups of 2
    const lastThree = intPart.slice(-3);
    const rest = intPart.slice(0, -3);
    const formatted = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + (rest ? ',' : '') + lastThree;
    return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

/** Format as ₹ with Indian commas. e.g. 123456 → "₹1,23,456". Returns '–' for empty. */
export function formatINR(val) {
    const n = Number(val);
    if (!val || isNaN(n)) return '–';
    return '₹' + toIndianCommas(n);
}

/** Compact Indian format: ₹1.23L, ₹2.50Cr. Falls back to full ₹ format for < 1L. */
export function formatINRCompact(val) {
    const n = Number(val) || 0;
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}k`;
    return '₹' + toIndianCommas(n);
}

/** Strip commas from an Indian-formatted string → raw number for DB storage. */
export function parseIndianNumber(str) {
    if (str === '' || str == null) return '';
    const cleaned = String(str).replace(/,/g, '');
    const n = Number(cleaned);
    return isNaN(n) ? '' : n;
}

/** Live-format a typed value with Indian commas. Used in onChange for money inputs. */
export function formatInputValue(val) {
    const str = String(val).replace(/[^0-9.]/g, '');
    if (str === '' || str === '.') return str;
    // Don't format if user is still typing decimals
    if (str.endsWith('.')) return toIndianCommas(str.split('.')[0]) + '.';
    return toIndianCommas(str);
}

// ─── Date / Number Formatters ─────────────────────────────────────────────────
export function formatLogDate(dateStr) {
    return new Date(dateStr).toLocaleString('en-IN', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
    });
}

export function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('en-IN');
}

export function formatDateToDDMMYYYY(dateStr) {
    if (!dateStr) return "";
    const str = String(dateStr);
    const datePart = str.includes("T") ? str.split("T")[0] : str;
    const parts = datePart.split("-");
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return str;
}

/**
 * High-speed client-side image compression
 * Automatically downscales large phone/camera images (5-15MB) to ~200-400KB
 * Keeps PDFs and non-image files untouched.
 */
export async function compressImage(file, { maxWidth = 1920, maxHeight = 1920, quality = 0.82 } = {}) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
        return file;
    }

    // Skip SVGs or tiny images
    if (file.type === 'image/svg+xml' || file.size < 300 * 1024) {
        return file;
    }

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width <= maxWidth && height <= maxHeight && file.size < 800 * 1024) {
                    return resolve(file);
                }

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob || blob.size >= file.size) {
                            return resolve(file);
                        }
                        const cleanExt = file.name.replace(/\.[^/.]+$/, '.jpg');
                        const compressedFile = new File([blob], cleanExt, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}

export const uploadDocument = async (file, customerId, docType = null, passedUserId = null) => {
    try {
        if (!customerId || String(customerId).startsWith('demo-')) {
            return {
                id: 'demo-doc-' + Date.now(),
                customer_id: customerId,
                file_name: file.name,
                storage_path: 'mock/' + file.name,
                file_type: file.type || 'application/pdf',
                doc_type: docType,
                uploaded_by: passedUserId || 'demo-user',
                uploaded_at: new Date().toISOString()
            };
        }

        const isImage = file.type && file.type.startsWith('image/');
        const processedFile = isImage ? await compressImage(file) : file;
        const cleanName = processedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uuidPrefix = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const filePath = `${customerId}/${uuidPrefix}_${cleanName}`;

        // Validate UUID for uploaded_by column
        const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
        
        let sessionPromise = null;
        if (!isUUID(passedUserId)) {
            sessionPromise = supabase.auth.getSession().catch(() => null);
        }

        const uploadPromise = supabase.storage
            .from('customer-documents')
            .upload(filePath, processedFile, {
                cacheControl: '3600',
                upsert: true,
                contentType: processedFile.type || 'application/octet-stream'
            });

        const [uploadRes, sessionData] = await Promise.all([uploadPromise, sessionPromise]);
        
        if (uploadRes.error) {
            console.error('Storage upload failed:', uploadRes.error);
            throw new Error(uploadRes.error.message || 'Storage upload failed');
        }

        let validUserId = isUUID(passedUserId) ? passedUserId : null;
        if (!validUserId && sessionData) {
            const sessionUserId = sessionData?.data?.session?.user?.id;
            if (isUUID(sessionUserId)) {
                validUserId = sessionUserId;
            }
        }

        const insertPayload = {
            customer_id: customerId,
            file_name: processedFile.name,
            storage_path: filePath,
            file_type: processedFile.type || (isImage ? 'image/jpeg' : 'application/pdf'),
            doc_type: docType,
            uploaded_by: validUserId
        };

        let { data, error } = await supabase
            .from('documents')
            .insert(insertPayload)
            .select()
            .single();

        // Fallback retry without uploaded_by if schema constraint error occurs
        if (error && validUserId) {
            console.warn('Retrying document insert without uploaded_by:', error);
            delete insertPayload.uploaded_by;
            const retryRes = await supabase
                .from('documents')
                .insert(insertPayload)
                .select()
                .single();
            data = retryRes.data;
            error = retryRes.error;
        }

        if (error) {
            console.error('Failed to record document in DB:', error);
            throw new Error(error.message || 'Database insert failed');
        }
        return data;
    } catch (err) {
        console.error('Error in uploadDocument:', err);
        throw err;
    }
};

export const getCustomerDocuments = async (customerId) => {
    if (!customerId) return [];
    if (String(customerId).startsWith('demo-')) {
        return [
            { id: 'demo-doc-1', doc_type: 'adhaar_card_front', file_name: 'adhaar_card_front.pdf', file_type: 'application/pdf', storage_path: 'mock/adhaar_front.pdf' },
            { id: 'demo-doc-2', doc_type: 'adhaar_card_back', file_name: 'adhaar_card_back.pdf', file_type: 'application/pdf', storage_path: 'mock/adhaar_back.pdf' },
            { id: 'demo-doc-3', doc_type: 'electricity_bill', file_name: 'electricity_bill.pdf', file_type: 'application/pdf', storage_path: 'mock/electricity_bill.pdf' },
            { id: 'demo-doc-4', doc_type: 'passport_photo', file_name: 'passport_photo.pdf', file_type: 'application/pdf', storage_path: 'mock/passport_photo.pdf' },
            { id: 'demo-doc-5', doc_type: 'cancelled_cheque', file_name: 'cancelled_cheque.pdf', file_type: 'application/pdf', storage_path: 'mock/cancelled_cheque.pdf' },
            { id: 'demo-doc-6', doc_type: 'geo_tag_photo', file_name: 'geo_tag_photo.jpg', file_type: 'image/jpeg', storage_path: 'mock/geo_tag_photo.jpg' },
            { id: 'demo-doc-7', doc_type: 'meter_photo', file_name: 'meter_installation_photo.jpg', file_type: 'image/jpeg', storage_path: 'mock/meter_photo.jpg' },
        ];
    }
    const allDocuments = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
            .from('documents')
            .select('*')
            .eq('customer_id', customerId)
            .order('uploaded_at', { ascending: false })
            .range(from, from + pageSize - 1);

        if (error) {
            console.error('Failed to fetch documents:', error);
            break;
        }
        const page = data || [];
        allDocuments.push(...page);
        if (page.length < pageSize) break;
    }
    return allDocuments;
};

export const getViewUrl = async (storagePath) => {
    if (!storagePath) return null;
    if (storagePath.startsWith('mock/') || storagePath.startsWith('http')) {
        return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&q=80';
    }
    const { data, error } = await supabase.storage
        .from('customer-documents')
        .createSignedUrl(storagePath, 3600);

    if (error) console.error('Failed to get view URL:', error);
    return data?.signedUrl || null;
};

export const getDownloadUrl = async (storagePath, fileName) => {
    if (!storagePath) return null;
    if (storagePath.startsWith('mock/') || storagePath.startsWith('http')) {
        return 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&q=80';
    }
    const { data, error } = await supabase.storage
        .from('customer-documents')
        .createSignedUrl(storagePath, 3600, { download: fileName || true });

    if (error) console.error('Failed to get download URL:', error);
    return data?.signedUrl || null;
};

export const deleteDocument = async (documentId, storagePath) => {
    const id = typeof documentId === 'object' && documentId !== null ? documentId.id : documentId;
    const path = typeof documentId === 'object' && documentId !== null ? documentId.storage_path : storagePath;
    if (path) {
        await supabase.storage.from('customer-documents').remove([path]);
    }
    if (id) {
        const { error } = await supabase.from('documents').delete().eq('id', id);
        if (error) console.error('Failed to delete document:', error);
    }
};

export const updateDocumentRemark = async (documentId, remark) => {
    if (!documentId) return null;
    const { data, error } = await supabase
        .from('documents')
        .update({ remark: remark || '' })
        .eq('id', documentId)
        .select()
        .single();

    if (error) console.error('Failed to update document remark:', error);
    return data;
};

export async function fetchAgent2SubAgents(branchName) {
    const clean = (branchName || '').trim();
    if (!clean) return [];
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('name')
            // New Channel Partners use agent2. Older accounts used agent,
            // so include both while the saved profiles are being aligned.
            .in('user_type', ['agent2', 'agent'])
            .ilike('channel_partner', clean);
        if (error || !data) return [];
        return [...new Set(data.map(p => (p.name || '').trim()).filter(Boolean))]
            .sort((a, b) => a.localeCompare(b));
    } catch (err) {
        console.error('Error fetching sub-agents:', err);
        return [];
    }
}

// ─── Tag Normalizers ──────────────────────────────────────────────────────────
export const normalizeLoanTag = (tag) => {
    if (!tag) return null;
    const s = String(tag).trim().toLowerCase();
    if (s === 'all clear' || s === 'all_clear' || s === 'allclear' || s === 'clear') return 'All Clear';
    if (s === 'in progress' || s === 'in_progress' || s === 'inprogress' || s === 'pending') return 'In Progress';
    if (s === 'processed' || s.includes('process')) return 'Processed';
    if (s.includes('1st') || s.includes('first')) return '1st Payment';
    if (s.includes('2nd') || s.includes('second')) return '2nd Payment';
    if (s.includes('sanc') || s.includes('approved')) return 'Sanctioned';
    if (s.includes('return')) return 'Returned';
    if (s.includes('reject') || s.includes('decline')) return 'Rejected';
    return tag.trim();
};

export const normalizeSubsidyTag = (tag) => {
    if (!tag) return null;
    const s = String(tag).trim().toLowerCase();
    if (s === 'received' || s.includes('receiv') || s.includes('claim') || s.includes('credit')) return 'Received';
    if (s === 'in process' || s === 'in_process' || s === 'inprocess' || s.includes('process')) return 'In Process';
    if (s === 'redeemed' || s.includes('redeem')) return 'Redeemed';
    if (s === 'return' || s === 'returned' || s.includes('return')) return 'Returned';
    if (s === 'approved' || s.includes('approv')) return 'Approved';
    if (s === 'rejected' || s.includes('reject')) return 'Rejected';
    return tag.trim();
};

export const normalizeInstallationStatus = (status) => {
    if (!status) return null;
    const s = String(status).trim().toLowerCase();
    if (s === 'give up' || s === 'giveup' || s === 'given up' || s === 'cancelled') return 'Give Up';
    if (s === 'yes' || s === 'completed' || s === 'done' || s === 'installed') return 'Yes';
    if (s === 'proceed' || s === 'process' || s === 'processing' || s === 'in progress' || s === 'wip') return 'Process';
    if (s === 'pending' || s === 'no' || s === 'waiting' || s === 'not started') return 'Pending';
    return 'Pending';
};

// ─── Dynamic Import with Auto-Reload on Stale Chunks ─────────────────────────
import { lazy } from 'react';

export function lazyWithRetry(componentImport) {
    return lazy(async () => {
        const pageHasBeenForceRefreshed = window.sessionStorage.getItem('retry-lazy-refreshed') === 'true';
        try {
            const component = await componentImport();
            window.sessionStorage.setItem('retry-lazy-refreshed', 'false');
            return component;
        } catch (error) {
            console.warn('Dynamic import failed (likely stale build chunk after new deploy), reloading latest bundle...', error);
            if (!pageHasBeenForceRefreshed) {
                window.sessionStorage.setItem('retry-lazy-refreshed', 'true');
                window.location.reload();
                return { default: () => null };
            }
            throw error;
        }
    });
}
