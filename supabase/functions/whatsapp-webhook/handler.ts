// supabase/functions/whatsapp-webhook/handler.ts
//
// What Meta sends to the webhook, kept apart from index.ts so it can be tested
// without a server. See index.ts for the secrets and the Meta settings.

import { cleanPhone, env, markNotOnWhatsapp, maskPhone, postToMeta, waEnabled, waReady, type Db } from '../_shared/whatsapp.ts'

const DAY_MS = 24 * 60 * 60 * 1000
// A reply typed without "swipe to reply" is linked to the last message we sent that number within this time.
const LINK_WITHOUT_CONTEXT_MS = 3 * DAY_MS
const MAX_BODY_BYTES = 3 * 1024 * 1024
const AUTO_REPLY_TIMEOUT_MS = 10_000
// Statuses only move forward: sending < sent < delivered < read. Failed ends it, except
// that a message already read stays read. Each new status lists where it may come from.
const MOVES_FROM: Record<string, string[]> = {
  sent: ['sending'],
  delivered: ['sending', 'sent'],
  read: ['sending', 'sent', 'delivered'],
  failed: ['sending', 'sent', 'delivered'],
}
// A thumbs-up on a message or a system notice does not need an answer.
const NO_AUTO_REPLY = new Set(['reaction', 'system', 'unsupported', 'request_welcome'])

type Json = Record<string, unknown>
const list = (value: unknown): Json[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object') as Json[] : []
const obj = (value: unknown): Json => (value && typeof value === 'object' ? value : {}) as Json
const text = (value: unknown, max: number) => typeof value === 'string' && value.trim() ? value.slice(0, max) : null

const toHex = (bytes: Uint8Array) => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')

// Compares every character, so the time taken does not hint at how much matched.
export function sameText(a: string, b: string) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// X-Hub-Signature-256 is 'sha256=' + hex HMAC-SHA256 of the raw body with the app secret.
export async function signatureOk(secret: string, raw: Uint8Array, header: string | null) {
  const given = /^sha256=([0-9a-f]{64})$/i.exec(String(header ?? '').trim())?.[1]
  if (!secret || !given) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, raw as BufferSource)))
  return sameText(mac, given.toLowerCase())
}

// Meta sends Unix seconds as a string. Anything unreadable or more than a day ahead is
// taken as now (a date past year 275760 would even make toISOString throw).
export function metaTime(value: unknown, nowMs = Date.now()) {
  const seconds = Number(value)
  const ms = Number.isFinite(seconds) && seconds > 1_000_000_000 ? seconds * 1000 : nowMs
  return new Date(ms > nowMs + DAY_MS ? nowMs : ms).toISOString()
}

// The raw body, refused once it passes `max` bytes even when no Content-Length was sent.
export async function readBody(req: Request, max: number): Promise<Uint8Array | null> {
  if (!req.body) return new Uint8Array(0)
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.byteLength }
  return out
}

// errors[0] of a failed status -> what the log keeps. Runs of 4+ digits in Meta's words are
// hidden: the technician who sent a completion code can read its row, and the text must never
// show the code (or a phone number). The error number itself is kept in front.
export function statusError(errors: unknown) {
  const err = list(errors)[0]
  if (!err) return null
  const code = Number(err.code) || null
  const words = [String(err.title ?? err.message ?? '').trim(), String(obj(err.error_data).details ?? '').trim()]
    .map(w => w.replace(/\d{4,}/g, '******'))
    .filter((w, i, all) => w && all.indexOf(w) === i)
  return { code, text: [`Meta ${code ?? '?'}`, ...words].join(': ').slice(0, 500) }
}

// The parts of an incoming message the CRM keeps.
export function inboundFields(message: Json) {
  const type = text(message.type, 40) ?? 'unknown'
  const interactive = obj(message.interactive)
  const buttonText = text(obj(message.button).text, 500)
    ?? text(obj(interactive.button_reply).title, 500)
    ?? text(obj(interactive.list_reply).title, 500)
  const caption = text(obj(message[type]).caption, 4000)
  const digits = String(message.from ?? '').replace(/\D/g, '')
  const phone = cleanPhone(digits)
  return {
    wamid: text(message.id, 200),
    phone, // 10-digit Indian mobile, or null for anyone else
    fromPhone: phone ?? digits.slice(0, 20),
    type,
    body: text(obj(message.text).body, 4000) ?? buttonText ?? caption,
    buttonText,
    contextWamid: text(obj(message.context).id, 200),
  }
}

const logError = (what: string, error: unknown) =>
  console.error(`whatsapp-webhook: ${what}: ${(error as { message?: unknown })?.message ?? String(error)}`)

// One delivery update for a message we sent.
async function applyStatus(db: Db, status: Json, nowMs: number) {
  const wamid = text(status.id, 200)
  const next = String(status.status ?? '')
  if (!wamid || !MOVES_FROM[next]) return
  const now = new Date(nowMs).toISOString()
  const patch: Json = { status: next, status_at: metaTime(status.timestamp, nowMs), updated_at: now }
  const error = statusError(status.errors)
  if (error) Object.assign(patch, { error_code: error.code, error_text: error.text })
  // One conditional update, so two webhooks arriving together cannot move a status back.
  const { data: moved, error: dbError } = await db.from('whatsapp_messages').update(patch)
    .eq('wamid', wamid).in('status', MOVES_FROM[next]).select('id')
  if (dbError) throw dbError
  if (!list(status.errors).some(e => Number(e.code) === 131026)) return
  // Flag only on news: a re-delivered old failure must not flag again a number that has
  // written to us since. A wamid we never saved (not logged yet, or the auto-reply) still flags.
  if (!moved?.length) {
    const { data: known, error: knownError } = await db.from('whatsapp_messages').select('id').eq('wamid', wamid).limit(1)
    if (knownError) throw knownError
    if (known?.length) return
  }
  await markNotOnWhatsapp(db, status.recipient_id, 131026)
}

// A message from a customer: saved once, linked to what they replied to.
// `toOurNumber`: false when it was written to another number of the same Meta app (e.g. the
// test number while the real one is live); the auto-reply only goes out from our own number.
async function saveInbound(db: Db, message: Json, nowMs: number, later: (task: Promise<unknown>) => void, toOurNumber = true) {
  const m = inboundFields(message)
  if (!m.wamid || !/^[0-9]{5,20}$/.test(m.fromPhone)) return
  type Sent = { id: string; issue_id: string | null; quotation_id: string | null }
  let replyTo: Sent | null = null
  let about: Sent | null = null
  if (m.contextWamid) {
    const { data, error } = await db.from('whatsapp_messages').select('id, issue_id, quotation_id')
      .eq('wamid', m.contextWamid).maybeSingle()
    if (error) throw error
    replyTo = data ?? null
    about = replyTo
  } else if (m.phone) {
    // Most people just type a reply, so link it to the complaint or quotation we last wrote to them about.
    const { data, error } = await db.from('whatsapp_messages').select('id, issue_id, quotation_id')
      .eq('to_phone', m.phone).neq('status', 'failed').gte('created_at', new Date(nowMs - LINK_WITHOUT_CONTEXT_MS).toISOString())
      .order('created_at', { ascending: false }).limit(1)
    if (error) throw error
    about = data?.[0] ?? null
  }
  const { data: saved, error } = await db.from('whatsapp_inbound').upsert({
    wamid: m.wamid, from_phone: m.fromPhone, message_type: m.type, body: m.body, button_text: m.buttonText,
    context_wamid: m.contextWamid, reply_to_message_id: replyTo?.id ?? null, issue_id: about?.issue_id ?? null,
    quotation_id: about?.quotation_id ?? null, received_at: metaTime(message.timestamp, nowMs),
  }, { onConflict: 'wamid', ignoreDuplicates: true }).select('id')
  if (error) throw error
  // Meta sends the same message again when it is unsure we got it: nothing more to do.
  if (!saved?.length || !m.phone) return
  const now = new Date(nowMs).toISOString()
  // They just wrote to us, so they are on WhatsApp now.
  const { error: clearError } = await db.from('whatsapp_contacts').update({ not_on_whatsapp_at: null, updated_at: now })
    .eq('phone', m.phone).not('not_on_whatsapp_at', 'is', null)
  if (clearError) logError(`could not clear the not-on-WhatsApp flag for ${maskPhone(m.phone)}`, clearError)
  if (toOurNumber && !NO_AUTO_REPLY.has(m.type)) later(autoReply(db, m.phone, nowMs))
}

// The fixed auto-reply (secret WA_AUTO_REPLY_TEXT): one per number per 24 h. Free-form text
// is allowed because the customer has just written to us.
export async function autoReply(db: Db, phone: string, nowMs = Date.now()) {
  const reply = env('WA_AUTO_REPLY_TEXT').replace(/\\n/g, '\n').slice(0, 4096)
  if (!reply || !waEnabled() || !waReady()) return false
  // While testing, only the test phone gets anything from us.
  const testTo = env('WA_TEST_TO')
  if (testTo && cleanPhone(testTo) !== phone) return false
  try {
    const now = new Date(nowMs).toISOString()
    const { error: rowError } = await db.from('whatsapp_contacts')
      .upsert({ phone, updated_at: now }, { onConflict: 'phone', ignoreDuplicates: true })
    if (rowError) throw rowError
    // Taking the 24 h slot is one conditional update, so two messages sent together get one reply.
    const { data: claimed, error: claimError } = await db.from('whatsapp_contacts')
      .update({ auto_reply_at: now, updated_at: now }).eq('phone', phone)
      .or(`auto_reply_at.is.null,auto_reply_at.lt.${new Date(nowMs - DAY_MS).toISOString()}`).select('phone')
    if (claimError) throw claimError
    if (!claimed?.length) return false
    const res = await postToMeta('messages', JSON.stringify({
      messaging_product: 'whatsapp', recipient_type: 'individual', to: `91${phone}`, type: 'text',
      text: { body: reply, preview_url: false },
    }), AUTO_REPLY_TIMEOUT_MS).catch((error: unknown) => ({ ok: false, status: 0, data: { error: { message: String(error) } } }))
    if (res.ok) return true
    const err = obj(obj(res.data).error)
    console.error(`whatsapp-webhook: auto-reply to ${maskPhone(phone)} failed: Meta ${Number(err.code) || `HTTP ${res.status}`}: ${String(err.message ?? '').slice(0, 200)}`)
    // Give the slot back so the next message can try again.
    await db.from('whatsapp_contacts').update({ auto_reply_at: null }).eq('phone', phone).eq('auto_reply_at', now)
    return false
  } catch (error) {
    logError(`auto-reply to ${maskPhone(phone)} skipped`, error)
    return false
  }
}

// Every status and message in a signed payload. One bad item never stops the rest.
export async function processPayload(db: Db, payload: unknown, nowMs = Date.now(), later: (task: Promise<unknown>) => void = () => {}) {
  const counts = { statuses: 0, messages: 0, failed: 0 }
  for (const entry of list(obj(payload).entry)) {
    for (const change of list(entry.changes)) {
      if (change.field !== 'messages') continue
      const value = obj(change.value)
      const numberId = String(obj(value.metadata).phone_number_id ?? '').trim()
      const toOurNumber = !numberId || numberId === env('WA_PHONE_NUMBER_ID')
      for (const status of list(value.statuses)) {
        try { await applyStatus(db, status, nowMs); counts.statuses++ } catch (error) { counts.failed++; logError(`status ${String(status.id ?? '-')} not saved`, error) }
      }
      for (const message of list(value.messages)) {
        try { await saveInbound(db, message, nowMs, later, toOurNumber); counts.messages++ } catch (error) { counts.failed++; logError(`message ${String(message.id ?? '-')} not saved`, error) }
      }
    }
  }
  return counts
}

// GET: Meta's one-time check of the callback URL. POST: signed events.
export async function handleWebhook(req: Request, db: () => Db, later?: (task: Promise<unknown>) => void) {
  if (req.method === 'GET') {
    const url = new URL(req.url)
    const expected = env('WA_VERIFY_TOKEN')
    const token = url.searchParams.get('hub.verify_token') ?? ''
    const challenge = url.searchParams.get('hub.challenge') ?? ''
    if (url.searchParams.get('hub.mode') === 'subscribe' && expected && sameText(token, expected) && /^[A-Za-z0-9._-]{1,200}$/.test(challenge)) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } })
    }
    return new Response('Forbidden', { status: 403 })
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const secret = env('WA_APP_SECRET')
  if (!secret) {
    console.error('whatsapp-webhook: WA_APP_SECRET is not set, so no event can be trusted')
    return new Response('Unauthorized', { status: 401 })
  }
  if (Number(req.headers.get('Content-Length') || 0) > MAX_BODY_BYTES) return new Response('Too large', { status: 413 })
  // Read with a cap: a chunked body has no Content-Length to check first.
  const raw = await readBody(req, MAX_BODY_BYTES)
  if (!raw) return new Response('Too large', { status: 413 })
  if (!await signatureOk(secret, raw, req.headers.get('X-Hub-Signature-256'))) {
    console.error('whatsapp-webhook: refused a request with a missing or wrong signature')
    return new Response('Unauthorized', { status: 401 })
  }
  let payload: unknown
  try {
    payload = JSON.parse(new TextDecoder().decode(raw))
  } catch {
    return new Response('Bad request', { status: 400 })
  }
  // Always 200 for a signed payload, or Meta keeps sending it again for days.
  // Auto-replies run after the answer when the runtime allows it (index.ts), else before it.
  const tasks: Promise<unknown>[] = []
  try {
    const counts = await processPayload(db(), payload, Date.now(), later ?? (task => tasks.push(task)))
    if (counts.failed) console.error(`whatsapp-webhook: ${counts.failed} item(s) not saved, ${counts.statuses + counts.messages} saved`)
  } catch (error) {
    logError('payload not processed', error)
  }
  await Promise.allSettled(tasks)
  return new Response('ok', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}
