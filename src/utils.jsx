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
    const headers = [
        'CRN', 'Customer Name', 'Phone', 'Email', 'Location', 'Branch',
        'Capacity (kWp)', 'Project Type', 'Channel Partner', 'Stage',
        'Payment Type', 'Bank Name', 'Account #', 'IFSC', 'Loan Application #',
        'Meter Category', 'EB Number', 'DTR Code', 'Sanctioned Load',
        'DISCOM Division', 'Net Metering', 'Vendor', 'Aadhar',
        'Application #', 'Application Date', 'Google Docs', 'Subsidy Status', 'Created At',
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
            subsidyLabel,
            c.created_at ? new Date(c.created_at).toLocaleDateString('en-IN') : '',
        ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
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
