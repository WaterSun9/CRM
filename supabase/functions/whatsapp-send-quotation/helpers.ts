// supabase/functions/whatsapp-send-quotation/helpers.ts
//
// Pure helpers for sending a quotation PDF on WhatsApp (no network, no database),
// kept apart so helpers.test.ts can check them with `deno test`.

export const MAX_PDF_BYTES = 10 * 1024 * 1024
// The multipart wrapper (boundaries, the id field, part headers) adds a little on top of the PDF.
export const MAX_BODY_BYTES = MAX_PDF_BYTES + 64 * 1024
export const PER_QUOTATION_PER_HOUR = 3
// Per person (sent_by): both rules apply. "A day" is the last 24 hours, like the shared sender.
export const PER_PERSON_PER_HOUR = 10
export const PER_PERSON_PER_DAY = 30
// A second tap right after a send would give the customer the same PDF twice.
export const RESEND_GAP_SECONDS = 60
// Same list as QUOTATION_ROLES in src/quotations/model.js (who can open Quotation Maker).
export const QUOTATION_ROLES = ['agent', 'agent2', 'channel_partner_office', 'admin', 'sales']
export const HOUR_MS = 60 * 60 * 1000
export const DAY_MS = 24 * HOUR_MS

type Json = Record<string, unknown>
export type QuotationRow = {
  id: string; quotation_no: number | string | null; status: string; updated_at: string | null
  customer_name: string | null; customer_phone: string | null; capacity_kw: number | string | null
  valid_until: string | null; converted_lead_id?: string | null; source_lead_id?: string | null
  form?: Json | null; revision?: Json | null; superseded_by?: Json | null
}

// The app (model.js fromRow) lets the saved form win over the table columns, and the PDF
// is drawn from the form, so the WhatsApp text reads the same place.
function formValue(row: QuotationRow, key: 'customer_name' | 'customer_phone' | 'capacity_kw' | 'valid_until') {
  const form = row.form && typeof row.form === 'object' ? row.form : {}
  return form[key] !== undefined && form[key] !== null ? form[key] : row[key]
}

// Same as quoteLabel in src/quotations/model.js: Quote-1023, or Quote-1023-R1 for a revision.
export function quoteLabel(row: QuotationRow) {
  const revision = row.revision && typeof row.revision === 'object' ? row.revision : null
  const baseNo = revision ? revision.base_no : row.quotation_no
  const n = revision ? Number(revision.n) || 0 : 0
  if (baseNo == null || baseNo === '') return 'Quote-DRAFT'
  return n ? `Quote-${baseNo}-R${n}` : `Quote-${baseNo}`
}

// Same as pdfName in src/quotations/model.js, so the customer gets the file name the
// salesperson would have downloaded ("Ramesh Kumar Patel.pdf", "... (R1).pdf").
export function pdfFileName(row: QuotationRow) {
  const name = String(formValue(row, 'customer_name') || 'Quotation').replace(/[\\/:*?"<>|]+/g, ' ')
    // Control characters would break the multipart header Meta reads the name from.
    // deno-lint-ignore no-control-regex
    .replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Quotation'
  const n = row.revision && typeof row.revision === 'object' ? Number(row.revision.n) || 0 : 0
  return `${name}${n ? ` (R${n})` : ''}.pdf`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// '2026-10-11' -> '11 Oct 2026'
export function formatDateShort(iso: unknown) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12 || Number(m[3]) < 1 || Number(m[3]) > 31) return null
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

// 3.48 -> '3.48', '5.00' -> '5'. The template has the "kW" after the value.
export function capacityText(value: unknown) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? String(Math.round(n * 100) / 100) : null
}

// The four body values of watersun_quotation, in template order.
export function quotationValues(row: QuotationRow) {
  return {
    customerName: String(formValue(row, 'customer_name') ?? ''),
    phone: formValue(row, 'customer_phone'),
    label: quoteLabel(row),
    capacity: capacityText(formValue(row, 'capacity_kw')) ?? '-',
    validUntil: formatDateShort(formValue(row, 'valid_until')) ?? 'the date given in the quotation',
  }
}

// Same rule as the app: Download (and so WhatsApp) is not offered for a lost quotation,
// and a revised one is replaced by its newer version.
export function sendRefusal(row: QuotationRow) {
  if (row.status === 'lost') {
    return { ok: false, code: 'lost', error: 'This quotation is marked Lost. Reopen it before sending it.' }
  }
  const newer = row.superseded_by && typeof row.superseded_by === 'object' ? row.superseded_by : null
  if (newer) {
    const label = typeof newer.label === 'string' && newer.label ? newer.label : 'a newer version'
    return { ok: false, code: 'superseded', error: `This quotation was replaced by ${label}. Send the newest version instead.` }
  }
  return null
}

// updated_at as the app saw it when it made the PDF, against the row now. PostgREST sends
// the same text both times; Date.parse is only a fallback for a differently formatted copy.
export function sameVersion(seen: string, current: unknown) {
  if (!seen) return true
  const now = String(current ?? '')
  if (seen === now) return true
  const a = Date.parse(seen), b = Date.parse(now)
  return Number.isFinite(a) && a === b && micros(seen) === micros(now)
}
const micros = (text: string) => (/\.(\d+)/.exec(text)?.[1] ?? '').padEnd(6, '0').slice(0, 6)

export function isPdfBytes(bytes: Uint8Array) {
  // "%PDF-"
  return bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d
}

// Checks the uploaded file before anything goes to Meta. Returns the 400 message, or null.
export function pdfProblem(file: { size: number; type: string }, bytes?: Uint8Array) {
  if (!file.size) return 'The quotation PDF is empty. Please try again.'
  if (file.size > MAX_PDF_BYTES) return 'The quotation PDF is too big to send on WhatsApp (10 MB at most).'
  if (String(file.type || '').split(';')[0].trim().toLowerCase() !== 'application/pdf') return 'Only a PDF quotation can be sent.'
  if (bytes && !isPdfBytes(bytes)) return 'This file is not a PDF. Please try again.'
  return null
}

// Limit over a sliding window (default one hour) from the created_at of earlier messages.
// Returns seconds to wait, or 0.
export function limitWait(createdAts: string[], max: number, nowMs = Date.now(), windowMs = HOUR_MS) {
  const times = createdAts.map(t => Date.parse(t)).filter(Number.isFinite).filter(t => nowMs - t < windowMs).sort((a, b) => b - a)
  if (times.length < max) return 0
  // A slot frees up when the max-th newest message leaves the window.
  return Math.max(1, Math.ceil((times[max - 1] + windowMs - nowMs) / 1000))
}

// Seconds until another send is allowed after a recent one that did not fail, or 0.
export function resendWait(recent: { created_at: string; status: string }[], nowMs = Date.now()) {
  const last = recent.filter(r => r.status !== 'failed').map(r => Date.parse(r.created_at)).filter(Number.isFinite).sort((a, b) => b - a)[0]
  if (last === undefined || nowMs - last >= RESEND_GAP_SECONDS * 1000) return 0
  return Math.min(RESEND_GAP_SECONDS, Math.max(1, Math.ceil((last + RESEND_GAP_SECONDS * 1000 - nowMs) / 1000)))
}

export const minutesText = (seconds: number) => {
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`
}

// "45 minutes" (up to "60 minutes"), or "3 hours" once the wait is longer than an hour.
export function waitText(seconds: number) {
  if (seconds <= 60 * 60) return minutesText(seconds)
  const hours = Math.ceil(seconds / 3600)
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`
}

const FALLBACK = 'Use Download or Share for now.'
// Meta failure (shared module codes) -> what the salesperson sees. The shared module's own
// wording is about service jobs, so quotations get their own lines.
export function failureMessage(failure: { code?: string; metaCode?: number | null }) {
  if (failure.code === 'not_on_whatsapp') return `This customer's number is not on WhatsApp. ${FALLBACK}`
  if (failure.code === 'billing') return `WhatsApp payment for Watersun is not set up. ${FALLBACK} Please tell the office.`
  if (failure.code === 'token') return `The CRM is not connected to WhatsApp any more. ${FALLBACK} Please tell the office.`
  if (failure.metaCode === 131030) return `This number is not on the WhatsApp test list. ${FALLBACK}`
  if (failure.metaCode === 133010) return `The Watersun WhatsApp number is not registered yet. ${FALLBACK} Please tell the office.`
  if (failure.metaCode === 132001) return `The WhatsApp quotation message is not approved by Meta yet. ${FALLBACK}`
  // 132000: the approved template has a different number of blanks than the CRM fills.
  if (failure.metaCode === 132000) return `The WhatsApp quotation message on Meta does not match the CRM. ${FALLBACK} Please tell the office.`
  return 'The quotation could not be sent on WhatsApp. Try again in a minute, or use Download or Share.'
}
