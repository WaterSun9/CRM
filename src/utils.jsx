// ─── utils.jsx ────────────────────────────────────────────────────────────────
// Pure utility functions — no UI, no React state.
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from './supabase';
import { PRIMARY_STAGES, SUBSIDY_TAGS } from './constants';

// ─── Activity Logging ─────────────────────────────────────────────────────────
export async function logActivity(
    userId,
    action,
    message,
    details = '',
    customerId = null
) {
    if (customerId && String(customerId).startsWith('demo-')) return;
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

    const headers = [
        'Export Date',
        'CRN',
        'Customer Name',
        'Phone Number',
        'Email Address',
        'Consumer / EB Number',
        'Application Number',
        'Registration Number',
        'Registration By',
        'Application Date',
        'Company Branch',
        'Location',
        'Villages / Address',
        'Sub Division / Discom Division',
        'Channel Partner',
        'Current Stage',
        'Project Type',
        'System Capacity (kWp)',
        'Module Brand',
        'Module Wp',
        'Number of Modules',
        'Inverter Brand',
        'Inverter Capacity',
        'Inverter Serial No',
        'Meter Category',
        'Sanctioned Load',
        'DTR Code',
        'Net Metering',
        'Aadhar Number',
        'Payment Type',
        'Total Deal Amount (₹)',
        'Customer Contribution (₹)',
        'Subsidy Amount (₹)',
        'Bank Name',
        'Bank Account Number',
        'IFSC Code',
        'Loan Application Number',
        'Loan Tag',
        'Loan Date',
        'Loan Sanction Amount (₹)',
        'Loan Disbursed Amount (₹)',
        'Loan Disbursement Date',
        'Hold Procurement Status',
        'Hold Reason',
        'Material Status',
        'Material Delivery Date',
        'Driver Name',
        'Driver Phone Number',
        'Vehicle Number',
        'Delivery Challan No',
        'Installation Status',
        'Installation Date',
        'Vendor',
        'Installed By / Technician',
        'Meter Install Date',
        'Meter Number',
        'Discom Submission Date',
        'Discom Inspection Date',
        'Discom Inspector Name',
        'Subsidy Tag',
        'Subsidy Credited Date',
        'Subsidy Reference / Claim No',
        'Google Docs / Drive Link',
        'Remarks / Notes',
        'Created At',
        'Updated At'
    ];

    const rows = customers.map(c => {
        const stageLabel = PRIMARY_STAGES.find(s => s.id === c.stage)?.label || c.stage || '';
        const subsidyLabel = SUBSIDY_TAGS.find(f => f.id === c.subsidy_tag)?.label || c.subsidy_tag || '';

        return [
            currentTimestampStr,
            c.crn || '',
            c.customer_name || '',
            c.phone_number || '',
            c.email_address || '',
            c.consumer_no || c.eb_number || '',
            c.application_number || c.application_no || '',
            c.registration_no || '',
            c.registration_by || '',
            c.application_date || '',
            c.company_branch || c.branch || '',
            c.location || '',
            c.villages || '',
            c.sub_divisions || c.discom_division || '',
            c.channel_partner || '',
            stageLabel,
            c.project_type || '',
            c.system_capacity_kwp || '',
            c.module_brand || '',
            c.module_wp || '',
            c.no_of_modules || '',
            c.inverter_brand || '',
            c.inverter_capacity || '',
            c.inverter_serial_no || '',
            c.meter_category || '',
            c.sanctioned_load || '',
            c.dtr_code || '',
            c.net_metering || '',
            c.aadhar || '',
            c.payment_type || '',
            c.total_deal_amount || '',
            c.customer_contribution || '',
            c.subsidy_amount || '',
            c.bank_name || '',
            c.bank_account_number || '',
            c.ifsc_code || '',
            c.loan_application_number || '',
            c.loan_tag || '',
            c.loan_date || '',
            c.loan_sanction_amount || '',
            c.loan_disbursed_amount || '',
            c.loan_disbursement_date || '',
            c.hold_procurement || '',
            c.hold_reason || '',
            c.material_status || '',
            c.material_delivery_date || '',
            c.driver_name || '',
            c.driver_phone_number || '',
            c.vehicle_number || '',
            c.delivery_challan_no || '',
            c.installation_status || '',
            c.installation_date || '',
            c.vendor || '',
            c.installed_by || '',
            c.meter_install_date || '',
            c.meter_number || '',
            c.discom_submission_date || '',
            c.discom_inspection_date || '',
            c.discom_inspector_name || '',
            subsidyLabel,
            c.subsidy_credited_date || '',
            c.subsidy_reference_no || '',
            c.google_docs || '',
            c.remarks || '',
            c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
            c.updated_at ? new Date(c.updated_at).toLocaleDateString('en-IN') : ''
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
        const processedFile = await compressImage(file);
        const cleanName = processedFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const filePath = `${customerId}/${Date.now()}_${cleanName}`;

        const { error: uploadError } = await supabase.storage
            .from('customer-documents')
            .upload(filePath, processedFile, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) {
            console.error('Storage upload failed:', uploadError);
            throw new Error(uploadError.message || 'Storage upload failed');
        }

        let userId = passedUserId;
        if (!userId) {
            try {
                const { data: sessionData } = await supabase.auth.getSession();
                userId = sessionData?.session?.user?.id || null;
            } catch {
                userId = null;
            }
        }

        const { data, error } = await supabase
            .from('documents')
            .insert({
                customer_id: customerId,
                file_name: processedFile.name,
                storage_path: filePath,
                file_type: processedFile.type || 'image/jpeg',
                doc_type: docType,
                uploaded_by: userId
            })
            .select()
            .single();

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
    const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('customer_id', customerId)
        .order('uploaded_at', { ascending: false });

    if (error) console.error('Failed to fetch documents:', error);
    return data || [];
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