// supabase/functions/service-otp/helpers.ts
//
// Pure helpers for the completion code (no network, no database), kept apart so
// helpers.test.ts can check them with `deno test`. The WhatsApp basics (phone
// cleaning, Meta errors) live in ../_shared/whatsapp.ts and are re-exported here.

import {
  cleanPhone, maskPhone, metaFailure as waMetaFailure, networkFailure as waNetworkFailure, templateParam,
  type SendFailure,
} from '../_shared/whatsapp.ts'

export { cleanPhone, maskPhone, templateParam, type SendFailure }

export const CODE_TTL_SECONDS = 600
export const RESEND_AFTER_SECONDS = 45
export const MAX_CODES_PER_HOUR = 3
export const MAX_TRIES = 5
const HOUR_MS = 60 * 60 * 1000

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

export const randomHex = (byteCount: number) => toHex(crypto.getRandomValues(new Uint8Array(byteCount)))

// 6 digits from the CSPRNG. Values in the top sliver of the 32-bit range are
// thrown away so every code from 000000 to 999999 is equally likely.
export function randomCode(): string {
  const limit = Math.floor(0x1_0000_0000 / 1_000_000) * 1_000_000
  const buf = new Uint32Array(1)
  do crypto.getRandomValues(buf); while (buf[0] >= limit)
  return String(buf[0] % 1_000_000).padStart(6, '0')
}

export async function sha256Hex(text: string) {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))))
}

// The issue id is part of the hash so a stored hash is useless for any other job.
export const hashCode = (salt: string, issueId: string, code: string) => sha256Hex(`${salt}:${issueId}:${code}`)

// Compares every character, so the time taken does not hint at how much matched.
export function sameHex(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  const x = a.toLowerCase()
  const y = b.toLowerCase()
  let diff = 0
  for (let i = 0; i < x.length; i++) diff |= x.charCodeAt(i) ^ y.charCodeAt(i)
  return diff === 0
}

// Cooldown and hourly limit from the created_at of this job's codes in the last hour.
// Returns the 200 body to send back, or null when a new code may go out.
export function sendWait(createdAts: string[], nowMs = Date.now()) {
  const times = createdAts.map(t => Date.parse(t)).filter(Number.isFinite).sort((a, b) => b - a)
  const lastHour = times.filter(t => nowMs - t < HOUR_MS)
  if (lastHour.length >= MAX_CODES_PER_HOUR) {
    // A slot frees up when the 3rd newest code is an hour old.
    const retryAfterSeconds = Math.max(1, Math.ceil((lastHour[MAX_CODES_PER_HOUR - 1] + HOUR_MS - nowMs) / 1000))
    const minutes = Math.ceil(retryAfterSeconds / 60)
    return {
      ok: false, code: 'limit', retryAfterSeconds,
      error: `Only ${MAX_CODES_PER_HOUR} codes can be sent for one job in an hour. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}, or ask the office to close this job.`,
    }
  }
  if (times.length && nowMs - times[0] < RESEND_AFTER_SECONDS * 1000) {
    const retryAfterSeconds = Math.min(RESEND_AFTER_SECONDS, Math.max(1, Math.ceil((times[0] + RESEND_AFTER_SECONDS * 1000 - nowMs) / 1000)))
    return { ok: false, code: 'cooldown', retryAfterSeconds, error: `Please wait ${retryAfterSeconds} seconds before sending a new code.` }
  }
  return null
}

// The technician's photos (service_issue_files.kind) that must be there before a code goes
// out and before a job closes by code. The office's "Completed without code" needs none.
export const PHOTO_KINDS = ['before', 'after'] as const
export const PHOTOS_NEEDED = { ok: false, code: 'photos_needed', error: 'Add at least one Before photo and one After photo first.' } as const

// Counts from the database; a count that did not come back (null) counts as no photos.
export const photosReady = (counts: { before: number | null | undefined; after: number | null | undefined }) =>
  (Number(counts.before) || 0) >= 1 && (Number(counts.after) || 0) >= 1

const SEND_FAILED = 'The code could not be sent on WhatsApp. Try again in a minute, or ask the office to close this job.'

// The shared Meta error, worded for a technician standing at the customer's site.
export function jobFailure(failure: SendFailure): SendFailure {
  const error = failure.code === 'not_on_whatsapp' ? 'This number is not on WhatsApp. Ask the office to close this job.'
    : failure.code === 'billing' ? 'WhatsApp payment for Watersun is not set up. Ask the office to close this job.'
    : failure.code === 'token' ? 'The CRM is not connected to WhatsApp any more. Ask the office to close this job.'
    : failure.metaCode === 131030 ? 'This number is not on the WhatsApp test list. Ask the office to close this job.'
    : failure.metaCode === 132001 ? 'The WhatsApp code message is not approved by Meta yet. Ask the office to close this job.'
    : SEND_FAILED
  return { ...failure, error }
}

// Meta Cloud API error -> what the app shows. `detail` is saved on the code row for the owner.
export const metaFailure = (payload: unknown, httpStatus: number) => jobFailure(waMetaFailure(payload, httpStatus))

export const networkFailure = (message: string) => jobFailure(waNetworkFailure(message))

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// '2031-10-11' -> '11 Oct 2031' (same look as formatWarrantyDate in the app).
export function formatDateShort(iso: unknown) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso ?? ''))
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return null
  return `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]} ${m[1]}`
}

// Today's date in India, 'YYYY-MM-DD'.
export const todayIST = (nowMs = Date.now()) => new Date(nowMs + 330 * 60 * 1000).toISOString().slice(0, 10)

// Warranty line for the "work completed" message. Judged against today, not the status saved
// when the complaint was raised: a warranty can end while the complaint is still open.
export function warrantyText(status: unknown, end: unknown, today = todayIST()) {
  const endText = formatDateShort(end)
  if (!endText || status === 'unknown') return 'not recorded'
  return String(end).slice(0, 10) >= today ? `valid until ${endText}` : `ended on ${endText}`
}
