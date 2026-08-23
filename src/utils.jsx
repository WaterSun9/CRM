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
    const escapeCSV = (val) => {
        let str = String(val ?? '');
        // Prevent CSV Formula Injection
        if (/^[=+\-@]/.test(str)) {
            str = "'" + str;
        }
        // Escape double quotes and wrap in quotes
        return `"${str.replace(/"/g, '""')}"`;
    };

    const headers = [
        'CRN', 'Customer Name', 'Phone', 'Email', 'Location', 'Branch',
        'Capacity (kWp)', 'Project Type', 'Channel Partner', 'Stage',
        'Payment Type', 'Bank Name', 'Account #', 'IFSC', 'Loan Application #',
        'Meter Category', 'EB Number', 'DTR Code', 'Sanctioned Load',
        'DISCOM Division', 'Net Metering', 'Vendor', 'Aadhar',
        'Application #', 'Application Date', 'Google Docs', 'Registration No', 'Subsidy Status', 'Created At',
    ];
    const rows = customers.map(c => {
        const subsidyLabel = SUBSIDY_TAGS.find(f => f.id === c.subsidy_tag)?.label || c.subsidy_tag || '';
        return [
            c.crn || '', c.customer_name || '', c.phone_number || '', c.email_address || '',
            c.location || '', c.company_branch || '', c.system_capacity_kwp || '',
            c.project_type || '', c.channel_partner || '',
            PRIMARY_STAGES.find(s => s.id === c.stage)?.label || c.stage || '',
            c.payment_type || '', c.bank_name || '', c.bank_account_number || '',
            c.ifsc_code || '', c.loan_application_number || '', c.meter_category || '',
            c.eb_number || '', c.dtr_code || '', c.sanctioned_load || '',
            c.discom_division || '', c.net_metering || '', c.vendor || '',
            c.aadhar || '', c.application_number || '', c.application_date || '',
            c.google_docs || '',
            c.registration_no || '',
            subsidyLabel,
            c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
        ].map(escapeCSV).join(',');
    });
    const csv = [headers.map(escapeCSV).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `watersun_customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
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
    const { data, error } = await supabase.storage
        .from('customer-documents')
        .createSignedUrl(storagePath, 3600);

    if (error) console.error('Failed to get view URL:', error);
    return data?.signedUrl || null;
};

export const getDownloadUrl = async (storagePath, fileName) => {
    if (!storagePath) return null;
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

// ─── Installation Status Normalizer ──────────────────────────────────────────
export const normalizeInstallationStatus = (status) => {
    if (!status) return null;
    const s = String(status).trim().toLowerCase();
    if (s === 'give up' || s === 'giveup' || s === 'given up') return 'Give Up';
    if (s === 'yes') return 'Yes';
    if (s === 'proceed' || s === 'completed' || s === 'done' || s === 'installed' || s === 'process') return 'Process';
    if (s === 'pending' || s === 'in progress' || s === 'waiting') return 'Pending';
    return 'Pending';
};