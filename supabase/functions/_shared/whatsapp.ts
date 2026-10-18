// supabase/functions/_shared/whatsapp.ts
//
// WhatsApp through the Meta Cloud API (no BSP), shared by the edge functions:
//   service-otp (completion code + "work completed"), send-lead-to-vendor,
//   whatsapp-send-quotation and whatsapp-webhook.
// Import with: import { sendTemplate, ... } from '../_shared/whatsapp.ts'
//
// Every template message is written to public.whatsapp_messages (migration
// 20261013090000_whatsapp_log.sql) BEFORE it goes to Meta, then marked sent or failed;
// the webhook moves it on to delivered / read. Template values are never stored, and
// the token and values never reach the logs.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets; spaces and new lines around a
// pasted value are ignored):
//   WA_ENABLED          'true' to send anything. Every sender checks it first.
//   WA_TOKEN            System user token (whatsapp_business_messaging)
//   WA_PHONE_NUMBER_ID  Phone number ID from WhatsApp Manager > API Setup (not the number)
//   WA_GRAPH_VERSION    optional, default v23.0
//   WA_TEMPLATE_LANG    optional, default en_US
//   WA_TEST_TO          optional. While set, EVERY template message goes to this number
//                       instead of the customer or vendor. Delete it before going live.
//   WA_GRAPH_BASE       tests only: a fake Meta server on this computer (http://localhost:...).
//                       Anything that is not localhost is ignored, so the token only goes to Meta.

export type SendKind = 'completion_code' | 'completion_notice' | 'vendor_lead' | 'quotation'
export type SendFailure = {
  // 'limit': refused by one of opts.limits (nothing went to Meta).
  code: 'not_on_whatsapp' | 'billing' | 'token' | 'send_failed' | 'limit'
  error: string // plain message for staff
  metaCode: number | null
  detail: string // for the log and the owner; never holds the token or template values
}
// A limit sendTemplate checks again AFTER writing this send's log row. A check made only
// before sending lets requests sent at the same moment all pass it; counting after the
// insert means each one sees the others, so at most `max` go out (a tie refuses both).
export type SendLimit = {
  filters: Record<string, string> // e.g. { quotation_id: id } (same kind as the send)
  max: number // allowed in the window, this send included
  windowMs?: number // default one hour
  ignoreFailed?: boolean // e.g. a short gap that a failed send should not trigger
  error: string // plain message for staff when refused
}
// Any service-role supabase-js client (only .from() is used).
// deno-lint-ignore no-explicit-any
export type Db = { from: (table: string) => any }

const HOUR_MS = 60 * 60 * 1000
// Meta's 131026 is also given for an old WhatsApp app or unaccepted terms, and the CRM has
// no button to clear the flag, so after a week the number is simply tried again.
export const NOT_ON_WHATSAPP_DAYS = 7
const SEND_TIMEOUT_MS = 15_000
const UPLOAD_TIMEOUT_MS = 30_000
const MASK = '******'

const TRY_AGAIN = 'The WhatsApp message could not be sent. Please try again in a minute.'
const NOT_ON = 'WhatsApp is switched off in the CRM.'
const NOT_SET_UP = 'WhatsApp is not set up in the CRM yet. Please tell the owner.'
const BAD_TEST_TO = 'WhatsApp test number setting is wrong'

// Secrets pasted into the dashboard often carry a stray space or new line.
export const env = (name: string) => (Deno.env.get(name) || '').trim()
export const waEnabled = () => env('WA_ENABLED').toLowerCase() === 'true'
export const waReady = () => Boolean(env('WA_TOKEN') && env('WA_PHONE_NUMBER_ID'))

// 10-digit Indian mobile, else null. Same rules as public.clean_indian_mobile, including "+91 0…".
export function cleanPhone(value: unknown): string | null {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 13 && digits.startsWith('910')) digits = digits.slice(3)
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

export const maskPhone = (phone: string) => MASK + String(phone ?? '').slice(-4)

// Meta rejects template values with new lines, tabs, long runs of spaces or nothing at all.
export const templateParam = (value: unknown) => String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, 200) || '-'

const failure = (code: SendFailure['code'], error: string, detail: string, metaCode: number | null = null): SendFailure =>
  ({ code, error, metaCode, detail: detail.slice(0, 500) })

// Meta Cloud API error -> plain message for staff. `detail` keeps Meta's own words for the log.
export function metaFailure(payload: unknown, httpStatus: number): SendFailure {
  const err = ((payload as { error?: Record<string, unknown> } | null)?.error ?? {}) as {
    code?: unknown; error_subcode?: unknown; message?: unknown; error_data?: { details?: unknown }
  }
  const metaCode = Number(err.code) || null
  const subcode = Number(err.error_subcode) || null
  const detail = [
    `Meta ${metaCode ?? `HTTP ${httpStatus}`}${subcode ? `/${subcode}` : ''}`,
    String(err.message ?? '').trim(),
    String(err.error_data?.details ?? '').trim(),
  ].filter(Boolean).join(': ')
  if (metaCode === 131026) return failure('not_on_whatsapp', 'This number is not on WhatsApp.', detail, metaCode)
  if (metaCode === 131042) return failure('billing', 'WhatsApp payment for Watersun is not set up. Please tell the owner.', detail, metaCode)
  if (metaCode === 190) return failure('token', 'The CRM is not connected to WhatsApp any more. Please tell the owner.', detail, metaCode)
  const error = metaCode === 131030 ? 'This number is not on the WhatsApp test list.'
    : metaCode === 132001 ? 'This WhatsApp message is not approved by Meta yet. Please tell the owner.'
    : metaCode === 133010 ? 'The Watersun WhatsApp number is not registered yet. Please tell the owner.'
    : TRY_AGAIN
  return failure('send_failed', error, detail, metaCode)
}

export const networkFailure = (message: string): SendFailure => failure('send_failed', TRY_AGAIN, `Network: ${message}`)

// Replaces every secret (longest first) with ******. The leading "Meta 131026: " style
// label is left alone so the error number stays readable.
export function redactText(text: string, secrets: unknown[]) {
  const list = [...new Set(secrets.map(s => String(s ?? '')).filter(Boolean))].sort((a, b) => b.length - a.length)
  const all = String(text ?? '')
  const label = /^(?:Meta [^:]{1,40}|Network|Log): /.exec(all)?.[0] ?? ''
  let out = all.slice(label.length)
  for (const secret of list) out = out.split(secret).join(MASK)
  return label + out
}

// Template values in a components array. Meta's error text can quote them, and they must
// never be stored. Short values ('5', '-', ticket no. 1001) are skipped so the text stays
// readable; 6+ digit numbers (codes, phones) are always included.
export function paramValues(components: unknown[]): string[] {
  const out: string[] = []
  for (const component of Array.isArray(components) ? components : []) {
    const params = (component as { parameters?: unknown })?.parameters
    for (const p of Array.isArray(params) ? params : []) {
      const doc = (p as { document?: Record<string, unknown> })?.document
      for (const v of [p?.text, p?.payload, p?.coupon_code, doc?.filename, doc?.link]) {
        const value = typeof v === 'string' ? v.trim() : ''
        if (value.length >= 6 || (value.length >= 4 && !/^\d+$/.test(value))) out.push(value)
      }
    }
  }
  return out
}

// Fake Meta server for tests only: loopback addresses are the only override allowed.
export function graphBase() {
  const base = env('WA_GRAPH_BASE')
  if (base) {
    try {
      const url = new URL(base)
      if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        return base.replace(/\/+$/, '')
      }
    } catch { /* not a URL */ }
    console.error('whatsapp: WA_GRAPH_BASE ignored (only a test server on this computer is allowed)')
  }
  return 'https://graph.facebook.com'
}

// "23.0" and "v23.0" both work.
const graphVersion = () => env('WA_GRAPH_VERSION').replace(/^v?(?=\d)/i, 'v') || 'v23.0'

// One call to the phone number's Cloud API endpoint ('messages' or 'media').
// Throws only on network problems and timeouts.
export async function postToMeta(path: 'messages' | 'media', body: BodyInit, timeoutMs: number) {
  const res = await fetch(`${graphBase()}/${graphVersion()}/${encodeURIComponent(env('WA_PHONE_NUMBER_ID'))}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('WA_TOKEN')}`,
      ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
    },
    body,
    signal: AbortSignal.timeout(timeoutMs),
  })
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

const errorMessage = (error: unknown) => error instanceof Error ? error.message : String(error)

// Upload a file (the quotation PDF) so a template can carry it as a document header.
export async function uploadMedia(bytes: Uint8Array, mime: string, filename: string):
  Promise<{ ok: true; mediaId: string } | { ok: false; failure: SendFailure }> {
  if (!waEnabled()) return { ok: false, failure: failure('send_failed', NOT_ON, 'WA_ENABLED is not true') }
  if (!waReady()) return { ok: false, failure: failure('send_failed', NOT_SET_UP, 'WA_TOKEN or WA_PHONE_NUMBER_ID missing') }
  const name = String(filename ?? '').replace(/[\p{Cc}/\\"]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'document'
  const form = new FormData()
  form.append('messaging_product', 'whatsapp')
  form.append('type', mime)
  form.append('file', new Blob([bytes as BlobPart], { type: mime }), name)
  try {
    const res = await postToMeta('media', form, UPLOAD_TIMEOUT_MS)
    const mediaId = (res.data as { id?: unknown } | null)?.id
    if (res.ok && mediaId) return { ok: true, mediaId: String(mediaId) }
    const result = metaFailure(res.data, res.status)
    console.error(`whatsapp: file upload failed: ${redactText(result.detail, [name])}`)
    return { ok: false, failure: { ...result, detail: redactText(result.detail, [name]) } }
  } catch (error) {
    console.error(`whatsapp: file upload failed: ${errorMessage(error)}`)
    return { ok: false, failure: networkFailure(errorMessage(error)) }
  }
}

// Flags a number Meta says is not on WhatsApp (error 131026), so the next send can be skipped.
export async function markNotOnWhatsapp(db: Db, phone: unknown, metaCode = 131026) {
  const clean = cleanPhone(phone)
  if (!clean) return
  const now = new Date().toISOString()
  const { error } = await db.from('whatsapp_contacts')
    .upsert({ phone: clean, not_on_whatsapp_at: now, last_error_code: metaCode, updated_at: now }, { onConflict: 'phone' })
  if (error) console.error(`whatsapp: could not flag ${maskPhone(clean)} as not on WhatsApp: ${error.message}`)
}

// True when Meta told us in the last week that this number is not on WhatsApp (and they
// have not written to us since).
export async function isKnownNotOnWhatsapp(db: Db, phone: unknown, nowMs = Date.now()): Promise<boolean> {
  const clean = cleanPhone(phone)
  if (!clean) return false
  const since = new Date(nowMs - NOT_ON_WHATSAPP_DAYS * 24 * HOUR_MS).toISOString()
  const { data, error } = await db.from('whatsapp_contacts').select('phone')
    .eq('phone', clean).gte('not_on_whatsapp_at', since).limit(1)
  if (error) {
    // A lookup problem must not block sending; Meta will answer 131026 again if needed.
    console.error(`whatsapp: could not check ${maskPhone(clean)}: ${error.message}`)
    return false
  }
  return Boolean(data?.length)
}

type SendOptions = {
  to: string // 10-digit mobile of the customer / vendor
  template: string
  components: unknown[]
  kind: SendKind
  issueId?: string | null
  customerId?: string | null
  quotationId?: string | null
  vendorId?: string | null
  sentBy?: string | null
  redact?: string[] // e.g. the completion code: never stored or logged, even inside Meta's error text
  limits?: SendLimit[] // checked again after the log row is written (see SendLimit)
}
export type SendResult =
  | { ok: true; messageId: string; logId: string; testMode: boolean; sentTo: string }
  | { ok: false; failure: SendFailure; logId: string | null; testMode: boolean }

// One template message: logged as 'sending', sent, then marked 'sent' (+ wamid) or 'failed'.
export async function sendTemplate(db: Db, opts: SendOptions): Promise<SendResult> {
  const testTo = env('WA_TEST_TO')
  const testMode = Boolean(testTo)
  const fail = (f: SendFailure, logId: string | null = null): SendResult => ({ ok: false, failure: f, logId, testMode })
  if (!waEnabled()) return fail(failure('send_failed', NOT_ON, 'WA_ENABLED is not true'))
  if (!waReady()) return fail(failure('send_failed', NOT_SET_UP, 'WA_TOKEN or WA_PHONE_NUMBER_ID missing'))

  const intended = cleanPhone(opts.to)
  // While testing on Meta's test number everything goes to WA_TEST_TO. A wrong test number
  // never falls back to the real customer or vendor.
  const to = testMode ? cleanPhone(testTo) : intended
  if (testMode && !to) {
    console.error('whatsapp: WA_TEST_TO is set but is not a valid 10-digit Indian mobile number')
    return fail(failure('send_failed', BAD_TEST_TO, 'WA_TEST_TO is not a valid mobile number'))
  }
  if (!to) return fail(failure('send_failed', 'This mobile number is not valid for WhatsApp.', 'No valid 10-digit mobile number'))

  const secrets = [...(opts.redact ?? []), ...paramValues(opts.components)]
  const row = {
    kind: opts.kind, template: opts.template, to_phone: to, intended_phone: intended ?? '', test_mode: testMode,
    issue_id: opts.issueId ?? null, customer_id: opts.customerId ?? null, quotation_id: opts.quotationId ?? null,
    vendor_id: opts.vendorId ?? null, sent_by: opts.sentBy ?? null, status: 'sending',
  }
  let logId = ''
  // Two tries: sends that raced each other all refuse (none can tell which came first), so
  // each waits a random moment and tries once more; the first one back then goes alone.
  for (let attempt = 1; ; attempt++) {
    const { data: logRow, error: logError } = await db.from('whatsapp_messages').insert(row).select('id').single()
    if (logError || !logRow?.id) {
      // No log, no message: the limits count the log, and the owner must be able to see every send.
      console.error(`whatsapp: ${opts.kind} not sent, the message log could not be written: ${logError?.message ?? 'no id'}`)
      return fail(failure('send_failed', TRY_AGAIN, `Log: ${logError?.message ?? 'no id'}`))
    }
    logId = String(logRow.id)
    let refused: SendFailure | null
    try {
      refused = await limitRefusal(db, opts.kind, opts.limits ?? [])
    } catch (error) {
      await dropLogRow(db, logId)
      console.error(`whatsapp: ${opts.kind} not sent, the limit could not be checked: ${errorMessage(error)}`)
      return fail(failure('send_failed', TRY_AGAIN, 'Log: limit check failed'))
    }
    if (!refused) break
    await dropLogRow(db, logId)
    if (attempt >= 2) return fail(refused)
    await new Promise(resolve => setTimeout(resolve, 150 + Math.floor(Math.random() * 600)))
  }

  let result: SendFailure
  try {
    const res = await postToMeta('messages', JSON.stringify({
      messaging_product: 'whatsapp', to: `91${to}`, type: 'template',
      template: { name: opts.template, language: { code: env('WA_TEMPLATE_LANG') || 'en_US' }, components: opts.components },
    }), SEND_TIMEOUT_MS)
    const messageId = (res.data as { messages?: { id?: unknown }[] } | null)?.messages?.[0]?.id
    if (res.ok && messageId) {
      const now = new Date().toISOString()
      const { error } = await db.from('whatsapp_messages')
        .update({ wamid: String(messageId), status: 'sent', status_at: now, updated_at: now })
        .eq('id', logId).eq('status', 'sending')
      // Not fatal: the message is already on its way.
      if (error) console.error(`whatsapp: ${opts.kind} sent but log ${logId} not updated: ${error.message}`)
      return { ok: true, messageId: String(messageId), logId, testMode, sentTo: to }
    }
    result = metaFailure(res.data, res.status)
  } catch (error) {
    // A timeout can still mean Meta sent it; the log says failed because we cannot tell.
    result = networkFailure(errorMessage(error))
  }
  result = { ...result, detail: redactText(result.detail, secrets).slice(0, 500) }
  console.error(`whatsapp: ${opts.kind} not sent to ${maskPhone(to)} (log ${logId}): ${result.detail}`)
  const now = new Date().toISOString()
  const { error } = await db.from('whatsapp_messages').update({
    status: 'failed', error_code: result.metaCode, error_text: result.detail, status_at: now, updated_at: now,
  }).eq('id', logId).eq('status', 'sending')
  if (error) console.error(`whatsapp: log ${logId} not marked failed: ${error.message}`)
  if (result.metaCode === 131026) await markNotOnWhatsapp(db, to)
  return fail(result, logId)
}

// Counted with this send's row already in, so a send racing it is seen (and sees it).
async function limitRefusal(db: Db, kind: SendKind, limits: SendLimit[]): Promise<SendFailure | null> {
  for (const limit of limits) {
    const count = await countRecent(db, kind, limit.filters, limit.windowMs ?? HOUR_MS, Boolean(limit.ignoreFailed))
    if (count > limit.max) return failure('limit', limit.error, `Limit: ${count} of ${limit.max}`)
  }
  return null
}

// A send refused by a limit never reached Meta, so its row goes (it must not count against
// the next try). If the delete fails it is closed as failed rather than left 'sending'.
async function dropLogRow(db: Db, logId: string) {
  const { error } = await db.from('whatsapp_messages').delete().eq('id', logId)
  if (!error) return
  const now = new Date().toISOString()
  await db.from('whatsapp_messages').update({ status: 'failed', error_text: 'Not sent: limit', status_at: now, updated_at: now })
    .eq('id', logId).eq('status', 'sending')
}

// How many messages of a kind matched the filter within the window. Failed sends count too
// (so a failing number cannot be hammered) unless ignoreFailed.
export async function countRecent(db: Db, kind: SendKind, filters: Record<string, string>, windowMs = HOUR_MS,
  ignoreFailed = false, nowMs = Date.now()) {
  let query = db.from('whatsapp_messages').select('id', { count: 'exact', head: true })
    .eq('kind', kind).gte('created_at', new Date(nowMs - windowMs).toISOString())
  for (const [column, value] of Object.entries(filters)) query = query.eq(column, value)
  if (ignoreFailed) query = query.neq('status', 'failed')
  const { count, error } = await query
  if (error) throw error
  return Number(count) || 0
}

// How many messages of a kind matched the filter in the last hour (for the per-hour limits).
export const countLastHour = (db: Db, kind: SendKind, filters: Record<string, string>, nowMs = Date.now()) =>
  countRecent(db, kind, filters, HOUR_MS, false, nowMs)
