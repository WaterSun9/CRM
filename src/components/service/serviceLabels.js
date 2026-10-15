// Labels, colours and small helpers shared by the complaint screens
// (ServiceIssuesView and the panels in this folder). No React here.
import { supabase } from '../../supabase';
import { WARRANTY_STATUS_LABELS } from '../../utils/warranty';

export const STATUS_LABELS = {
    open: 'Open',
    assigned: 'Assigned',
    completion_pending: 'Waiting for code',
    completed: 'Completed',
    cancelled: 'Cancelled'
};
export const STATUS_PILL = {
    open: 'bg-sky-100 text-sky-800',
    assigned: 'bg-violet-100 text-violet-800',
    completion_pending: 'bg-amber-100 text-amber-900',
    completed: 'bg-green-100 text-green-800',
    cancelled: 'bg-stone-200 text-stone-700'
};
// Same colours as WarrantyBadge, without the dates (list rows stay short).
export const WARRANTY_PILL = {
    in_warranty: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    out_of_warranty: 'border-red-200 bg-red-50 text-red-700',
    unknown: 'border-amber-200 bg-amber-50 text-amber-800'
};
export const warrantyLabel = status => WARRANTY_STATUS_LABELS[status] || WARRANTY_STATUS_LABELS.unknown;

export const ACTIVE_STATUSES = ['open', 'assigned', 'completion_pending'];
export const OFFICE_FILTERS = [['all', 'All'], ['open', 'Open'], ['assigned', 'Assigned'], ['completed', 'Completed'], ['cancelled', 'Cancelled']];
export const TECHNICIAN_FILTERS = [['open', 'Open jobs'], ['mine', 'My jobs']];
export const OVERRIDE_REASONS = ['Customer has no WhatsApp', 'Confirmed by phone call', 'No network at site', 'WhatsApp not live yet', 'Other'];
// Same cooldown the service-otp function enforces between two codes.
export const RESEND_SECONDS = 45;

export function matchesFilter(issue, filter, userId) {
    if (filter === 'mine') return issue.assigned_to === userId;
    // "Assigned" for the office also covers jobs waiting for the customer's code.
    if (filter === 'assigned') return issue.status === 'assigned' || issue.status === 'completion_pending';
    return filter === 'all' || issue.status === filter;
}

export const ticketLabel = issue => (issue?.ticket_no ? `#${issue.ticket_no}` : '');

export const todayLocal = () => { const date = new Date(); return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; };
export const money = value => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value) || 0);
export function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const acceptedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);
export const validFiles = files => files.length <= 5 && files.every(file => file.size <= 10 * 1024 * 1024 && acceptedTypes.has(file.type));

export async function uploadIssueFiles(issueId, files, userId) {
    const failed = [];
    for (const file of files) {
        const path = `${issueId}/${userId}/${crypto.randomUUID()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        const uploaded = await supabase.storage.from('service-issues').upload(path, file, { upsert: false, contentType: file.type });
        if (uploaded.error) { failed.push(file.name); continue; }
        const recorded = await supabase.from('service_issue_files').insert({ issue_id: issueId, storage_path: path, file_name: file.name, mime_type: file.type, uploaded_by: userId });
        if (recorded.error) { await supabase.storage.from('service-issues').remove([path]); failed.push(file.name); }
    }
    return failed;
}

// Database messages the office can act on, in plain words.
export function complaintError(failure) {
    const message = failure?.message || '';
    if (failure?.code === '23505' || /already open/i.test(message)) {
        const ticket = message.match(/#(\d+)/)?.[1];
        return `A complaint is already open for this customer${ticket ? ` (#${ticket})` : ''}.`;
    }
    if (/only be raised for completed/i.test(message)) return message;
    if (/consumer_no_check/i.test(message)) return 'This customer has no consumer number. Add it on the customer record first.';
    return message || 'Could not save the change.';
}

// Calls the service-otp edge function. Business-rule answers come back as
// 200 { ok: false, error }; a non-2xx reply is read for its { error } text.
export async function callServiceOtp(body) {
    const { data, error } = await supabase.functions.invoke('service-otp', { body });
    if (!error) return data || {};
    let detail = error.message || 'The completion code service did not answer.';
    try {
        const payload = await error.context?.json?.();
        if (payload?.ok === false) return payload;
        detail = payload?.error || payload?.message || detail;
    } catch {
        // Keep the original Supabase error message.
    }
    if (/failed to send a request|failed to fetch|functionsfetcherror/i.test(detail)) {
        detail = 'Could not reach the server. Check the internet connection and try again.';
    }
    throw new Error(detail);
}
