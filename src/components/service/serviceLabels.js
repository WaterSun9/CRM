// Labels, colours and small helpers shared by the complaint screens
// (ServiceIssuesView and the panels in this folder). No React and no Supabase
// here, so tests/complaintPhotos.test.mjs can load it with plain node.
import { WARRANTY_STATUS_LABELS } from '../../utils/warranty.js';

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
// Tabs for the office and partners, in the order a complaint moves through them.
// Visited / Second visit needed are the visit stage of a job that is still assigned
// (service_issues.visit_stage, 20261026120000_complaint_stages_history.sql).
export const OFFICE_FILTERS = [['raised', 'Raised'], ['in_process', 'In process'], ['visited', 'Visited'], ['second_visit', 'Second visit needed'], ['closed', 'Closed'], ['all', 'All']];
export const TECHNICIAN_FILTERS = [['open', 'Open jobs'], ['mine', 'My jobs']];

// Where a complaint is now: one of the tab keys above, or 'cancelled' (shown under Closed).
export function issueStage(issue) {
    if (!issue) return '';
    if (issue.status === 'open') return 'raised';
    if (issue.status === 'completed') return 'closed';
    if (issue.status === 'cancelled') return 'cancelled';
    if (issue.visit_stage === 'second_visit') return 'second_visit';
    // The code is sent once the work is done, so that job has been visited.
    if (issue.visit_stage === 'visited' || issue.status === 'completion_pending') return 'visited';
    return 'in_process';
}
export const STAGE_LABELS = { raised: 'Raised', in_process: 'In process', visited: 'Visited', second_visit: 'Second visit needed', closed: 'Closed', cancelled: 'Cancelled' };
export const STAGE_PILL = {
    raised: 'bg-sky-100 text-sky-800',
    in_process: 'bg-violet-100 text-violet-800',
    visited: 'bg-teal-100 text-teal-800',
    second_visit: 'bg-orange-100 text-orange-900',
    closed: 'bg-green-100 text-green-800',
    cancelled: 'bg-stone-200 text-stone-700'
};

// One line per step in a complaint's history (service_issue_events.event).
export const EVENT_LABELS = {
    raised: 'Raised',
    assigned: 'Assigned to technician',
    claimed: 'Claimed by technician',
    visited: 'Visited',
    second_visit: 'Second visit needed',
    code_sent: 'OTP sent to customer',
    completed: 'Closed',
    cancelled: 'Cancelled',
    reopened: 'Reopened',
    gave_up: 'Technician gave up',
    returned: 'Back in the open queue'
};
export const eventLabel = event => EVENT_LABELS[event] || event;
export const OVERRIDE_REASONS = ['Customer did not get the code', 'Confirmed by phone call', 'No network at site', 'Customer has no mobile', 'Other'];
// Same cooldown the service-otp function enforces between two codes.
export const RESEND_SECONDS = 45;

export function matchesFilter(issue, filter, userId) {
    if (filter === 'mine') return issue.assigned_to === userId;
    if (filter === 'closed') return issue.status === 'completed' || issue.status === 'cancelled';
    if (['raised', 'in_process', 'visited', 'second_visit'].includes(filter)) return issueStage(issue) === filter;
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

// Who is who on a complaint. Channel partners see every complaint of the
// customers they can see; they comment but never upload photos or change the job.
export const PARTNER_TYPES = ['channel_partner_office', 'channel_partner_office_manager', 'office2', 'agent', 'agent2'];
export const OFFICE_TYPES = ['admin', 'sales'];
const OPEN_JOB_STATUSES = ['assigned', 'completion_pending'];

// Photos on a complaint (service_issue_files.kind). Only the technician on the
// job adds Before / After photos; 'problem' is an older file from the raise form.
export const PHOTO_KINDS = ['before', 'after'];
export const PHOTO_LIMIT = 10;
export const PHOTO_KIND_LABELS = { before: 'Before', after: 'After' };
export const PHOTO_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
// The storage bucket refuses files over 10 MB.
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
// About 1600 px on the long side keeps a phone photo near 300 KB.
export const PHOTO_LONG_SIDE = 1600;
export const PHOTOS_NEEDED_TEXT = 'Add at least one Before and one After photo first.';

export function groupIssueFiles(files) {
    const groups = { before: [], after: [], problem: [] };
    for (const file of files || []) (groups[file?.kind] || groups.problem).push(file);
    return groups;
}
export function photoCounts(files) {
    const groups = groupIssueFiles(files);
    return { before: groups.before.length, after: groups.after.length };
}
export const hasCompletionPhotos = counts => Boolean(counts && counts.before >= 1 && counts.after >= 1);
export const photoCountLabel = (kind, count) => `${PHOTO_KIND_LABELS[kind] || kind} ${count}/${PHOTO_LIMIT}`;
export const photoSlotsLeft = count => Math.max(0, PHOTO_LIMIT - (Number(count) || 0));

// Of the chosen files, the ones that still fit under the limit; the rest are skipped.
export function pickPhotos(files, count) {
    const list = [...(files || [])];
    const slots = photoSlotsLeft(count);
    return { take: list.slice(0, slots), skipped: list.slice(slots) };
}

export const isOpenJobFor = (issue, userId) => Boolean(userId && issue?.assigned_to === userId && OPEN_JOB_STATUSES.includes(issue?.status));
export const canUploadPhotos = (issue, userId, userType) => userType === 'technician' && isOpenJobFor(issue, userId);
export function canDeletePhoto(file, issue, userId, userType) {
    if (OFFICE_TYPES.includes(userType)) return true;
    return userType === 'technician' && file?.uploaded_by === userId && isOpenJobFor(issue, userId);
}

export const isPhotoType = type => Object.prototype.hasOwnProperty.call(PHOTO_TYPES, type);
// {issueId}/{uid}/{kind}-{uuid}.jpg - the storage rules read the first two parts.
export const photoPath = (issueId, userId, kind, id, type = 'image/jpeg') => `${issueId}/${userId}/${kind}-${id}.${PHOTO_TYPES[type] || 'jpg'}`;

// An error already in plain words: photoError shows it as it is.
export const plainError = message => Object.assign(new Error(message), { plain: true });

// Upload and save failures in words a technician can act on.
export function photoError(failure) {
    const message = String(failure?.message || failure || '');
    if (failure?.plain && message) return message;
    if (/failed to fetch|network|load failed|timed? ?out/i.test(message)) return 'No internet. Try again.';
    if (/at most|limit of/i.test(message) && !/size/i.test(message)) return `Only ${PHOTO_LIMIT} photos of each kind can be added.`;
    if (/too large|maximum allowed size|payload|413/i.test(message)) return 'The photo is too large.';
    if (/mime|type|jpeg|png|webp/i.test(message)) return 'Only JPG, PNG or WebP photos can be added.';
    if (/row-level security|permission|not allowed|unauthori[sz]ed|403|violates/i.test(message)) return 'This job is not open for you any more. Refresh the page.';
    return message || 'Could not add the photo.';
}

// Comments on a complaint. Author name and role are filled by the database.
export const COMMENT_MAX = 2000;
export const COMMENT_TYPES = [...OFFICE_TYPES, ...PARTNER_TYPES, 'technician'];
export const canComment = userType => COMMENT_TYPES.includes(userType);
export const canDeleteComment = userType => userType === 'admin';
export const cleanComment = text => String(text ?? '').trim();
export const commentFits = text => { const body = cleanComment(text); return body.length >= 1 && body.length <= COMMENT_MAX; };
// The comment table may not exist yet on an old database.
export const missingTable = failure => failure?.code === '42P01' || failure?.code === 'PGRST205' || /does not exist|could not find the table/i.test(failure?.message || '');
export function commentError(failure) {
    const message = failure?.message || '';
    if (missingTable(failure)) return 'Comments are not set up yet. Ask the office.';
    if (failure?.code === '23514' || /check constraint|body/i.test(message)) return `Write a comment of 1 to ${COMMENT_MAX} characters.`;
    if (failure?.code === '42501' || /row-level security|permission/i.test(message)) return 'You cannot comment on this complaint.';
    if (/failed to fetch|network/i.test(message)) return 'No internet. Try again.';
    return message || 'Could not add the comment.';
}

// Panel serial numbers on the customer card: a JSON array, or text split by new
// lines, commas or semicolons. -> ['ABC1', 'ABC2']
export function serialList(value) {
    if (value === null || value === undefined) return [];
    let list = value;
    if (typeof value === 'string') {
        const text = value.trim();
        if (!text || text === 'null' || text === '[]') return [];
        try { list = JSON.parse(text); } catch { list = text; }
    }
    if (typeof list === 'string') list = list.split(/[\n,;]+/);
    if (!Array.isArray(list)) list = [String(list)];
    return list.flat().map(item => String(item ?? '').trim()).filter(Boolean);
}

// A 10-digit Indian mobile from whatever was typed ("+91 98765-43210" -> 9876543210), or ''.
export function cleanMobile(value) {
    let digits = String(value ?? '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
    return /^[6-9]\d{9}$/.test(digits) ? digits : '';
}

// Splits a combined trip's km and amount: the first complaint carries the whole trip,
// the others 0, so the technician's totals add up to what was paid.
export function combinedVisitRows(issueIds, { km, amount }) {
    return (issueIds || []).map((issueId, index) => ({ issue_id: issueId, kilometers: index === 0 ? km : 0, amount_inr: index === 0 ? amount : 0 }));
}
