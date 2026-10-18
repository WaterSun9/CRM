// supabase/functions/service-otp/index.ts
//
// Completion code for a service complaint, sent to the customer on WhatsApp
// (Meta Cloud API, no BSP). The technician taps "Work done - send code", the
// customer reads the 6-digit code out, the technician types it and the job closes.
// Both actions need the signed-in technician the job is assigned to:
//   POST { action: 'send', issueId }
//        -> { ok: true, maskedPhone, expiresInSeconds: 600, resendAfterSeconds: 45, testMode }
//        -> { ok: false, code, error }  code: wa_disabled | no_phone | cooldown | limit (both + retryAfterSeconds)
//           | not_on_whatsapp | billing | token | send_failed (+ metaCode) | not_assigned | closed
//   POST { action: 'verify', issueId, code: '482913' }
//        -> { ok: true, verified: true, noticeSent }
//        -> { ok: true, verified: false, reason: no_code | expired | locked | wrong_code, message, attemptsLeft? }
//        -> { ok: false, code: not_assigned | closed, error }
// Business-rule answers are 200 so the app can show `error` / `message` as they are.
// 400 bad input, 401 not signed in, 403 not a technician, 500 unexpected (plain message;
// the technical reason goes to the function logs only).
//
// Only a salted SHA-256 of the code is kept (public.service_completion_otps,
// migration 20261012190000); the code is never stored, logged or returned.
// Rules: 10-min expiry, 5 wrong tries per code, new code after 45 s, 3 codes per job per hour.
// All reads and writes use the service role; the caller's token only says who is asking.
//
// Every WhatsApp message (code and "work completed") goes through ../_shared/whatsapp.ts,
// which logs it in public.whatsapp_messages (migration 20261013090000_whatsapp_log.sql,
// run it before deploying this) without the code. A number flagged in the last week as
// not on WhatsApp (Meta error 131026) gets no code; the technician asks the office.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), never in the app or in chat.
// The agency that runs Watersun's Facebook hands over the token and phone number ID;
// the owner pastes them here (spaces and new lines around a pasted value are ignored).
//   WA_ENABLED          'true' to send codes. Anything else: the technician is told to ask the office.
//   WA_TOKEN            System user token with whatsapp_business_messaging
//   WA_PHONE_NUMBER_ID  Phone number ID from WhatsApp Manager > API Setup (not the number itself)
//   WA_GRAPH_VERSION    optional, default v23.0
//   WA_OTP_TEMPLATE     optional, default watersun_service_code
//   WA_DONE_TEMPLATE    optional. When set, the customer also gets the "work completed" message.
//   WA_TEMPLATE_LANG    optional, default en_US (used for both templates)
//   WA_TEST_TO          optional. When set, every message goes to this number instead of the
//                       customer (Meta's test number only delivers to its 5 registered phones).
//                       DELETE IT BEFORE GOING LIVE: while it is set, a job closes as "completed
//                       by code" on a code the customer never saw. Such jobs can be found later:
//                       service_completion_otps.phone differs from service_issues.otp_phone.
//
// Meta templates (WhatsApp Manager > Message templates):
//   watersun_service_code      AUTHENTICATION, "Copy code" button, 10-min expiry. Meta fixes the text
//                              ("482913 is your verification code."); body {{1}} and the button get the code.
//   service_completed_confirm  UTILITY (set WA_DONE_TEMPLATE to this name). "Hello {{1}}, technician {{2}} has
//                              completed the work on your Watersun Solar service request no. {{3}} today.
//                              Warranty status: {{4}}. Please confirm if the problem is solved."
//                              Quick replies: Yes, solved / Not solved. Never put the code in this one.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { env, isKnownNotOnWhatsapp, sendTemplate, waEnabled, waReady } from '../_shared/whatsapp.ts'
import {
  CODE_TTL_SECONDS, MAX_TRIES, RESEND_AFTER_SECONDS, cleanPhone, hashCode, jobFailure, maskPhone,
  randomCode, randomHex, sameHex, sendWait, templateParam, warrantyText,
} from './helpers.ts'

const ALLOWED_ORIGINS = ['https://crm.watersunsolar.com', 'https://watersun.deeprootsystems.in', 'https://watersun9.github.io']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ACTIVE = ['assigned', 'completion_pending']
const WA_OFF = 'WhatsApp codes are not switched on yet. Ask the office to close this job.'
const NOT_ASSIGNED = { ok: false, code: 'not_assigned', error: 'This job is not assigned to you any more. Refresh the page.' }
const CLOSED = { ok: false, code: 'closed', error: 'This job is already closed. Refresh the page.' }
const SERVER_ERROR = 'Something went wrong on the server. Please try again in a minute, or ask the office to close this job.'

// A 500 whose message is safe to show the technician as it is; any other error gets SERVER_ERROR.
class PlainError extends Error {}

// All reads and writes go through this service-role client.
const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
type Db = ReturnType<typeof serviceClient>
type Issue = {
  id: string; ticket_no: number | null; status: string; assigned_to: string | null; otp_phone: string | null
  customer_id: string | null
  customer_name: string; warranty_status: string | null; warranty_end: string | null
  completion_method: string | null; completed_by: string | null
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  let allowed = ALLOWED_ORIGINS.includes(origin)
  try {
    const url = new URL(origin)
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) allowed = true
  } catch { /* no origin */ }
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // The allowed origin is echoed back, so caches must keep one copy per origin.
    Vary: 'Origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

// A code row that must not be used: removed so it does not eat into the hourly limit,
// or at least retired if the delete fails.
async function discardCode(db: Db, id: string) {
  const { error } = await db.from('service_completion_otps').delete().eq('id', id)
  if (error) await db.from('service_completion_otps').update({ superseded_at: new Date().toISOString() }).eq('id', id)
}

async function sendCode(req: Request, db: Db, userId: string, issue: Issue) {
  if (!waEnabled()) return json(req, 200, { ok: false, code: 'wa_disabled', error: WA_OFF })
  if (!waReady()) {
    console.error('service-otp: WA_ENABLED is true but WA_TOKEN or WA_PHONE_NUMBER_ID is missing')
    return json(req, 200, { ok: false, code: 'wa_disabled', error: WA_OFF })
  }
  // While testing on Meta's test number every code goes to WA_TEST_TO, never to a real customer.
  const testTo = env('WA_TEST_TO')
  const phone = cleanPhone(testTo || issue.otp_phone)
  if (testTo && !phone) {
    // Never fall back to the real customer while a test number is meant to be set.
    console.error('service-otp: WA_TEST_TO is set but is not a valid 10-digit Indian mobile number')
    return json(req, 200, { ok: false, code: 'wa_disabled', error: WA_OFF })
  }
  if (!phone) return json(req, 200, { ok: false, code: 'no_phone', error: 'This customer has no valid mobile number. Ask the office to close this job.' })
  // Meta already said this number is not on WhatsApp: no code row, no message.
  if (await isKnownNotOnWhatsapp(db, issue.otp_phone)) {
    return json(req, 200, { ok: false, code: 'not_on_whatsapp', error: 'This customer is not on WhatsApp. Ask the office to close this job.' })
  }

  // Every code made for this job counts, sent or not, so failures cannot be hammered either.
  const { data: recent, error: recentError } = await db.from('service_completion_otps').select('created_at')
    .eq('issue_id', issue.id).gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
  if (recentError) throw recentError
  const wait = sendWait((recent ?? []).map(r => String(r.created_at)))
  if (wait) return json(req, 200, wait)

  const code = randomCode()
  const salt = randomHex(16)
  const { data: row, error: insertError } = await db.from('service_completion_otps').insert({
    issue_id: issue.id, phone, code_salt: salt, code_hash: await hashCode(salt, issue.id, code),
    expires_at: new Date(Date.now() + CODE_TTL_SECONDS * 1000).toISOString(), requested_by: userId,
  }).select('id').single()
  if (insertError) throw insertError

  // Double tap on a slow phone: two requests can pass the check above together. Only the
  // earliest new row goes out, otherwise the customer gets two codes and reads out the wrong one.
  const { data: first, error: firstError } = await db.from('service_completion_otps').select('id')
    .eq('issue_id', issue.id).gte('created_at', new Date(Date.now() - RESEND_AFTER_SECONDS * 1000).toISOString())
    .order('created_at', { ascending: true }).order('id', { ascending: true }).limit(1)
  if (firstError) throw firstError
  if (first?.[0] && first[0].id !== row.id) {
    await discardCode(db, row.id)
    return json(req, 200, { ok: false, code: 'cooldown', retryAfterSeconds: RESEND_AFTER_SECONDS, error: 'A code was just sent. Please wait before sending a new one.' })
  }

  // In test mode the shared sender sends to WA_TEST_TO, the same number as `phone` above.
  const sent = await sendTemplate(db, {
    to: issue.otp_phone || '', template: env('WA_OTP_TEMPLATE') || 'watersun_service_code', kind: 'completion_code',
    issueId: issue.id, customerId: issue.customer_id, sentBy: userId, redact: [code],
    components: [
      { type: 'body', parameters: [{ type: 'text', text: code }] },
      { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
    ],
  })
  const now = new Date().toISOString()
  if (!sent.ok) {
    const failure = jobFailure(sent.failure)
    // Meta's error text can quote a template value; make sure the code never reaches the logs or the table.
    const detail = failure.detail.split(code).join('******')
    console.error(`service-otp: code not sent for issue ${issue.id}: ${detail}`)
    // Kept for the owner to see why; superseded so it can never be verified.
    await db.from('service_completion_otps').update({ send_error: detail, superseded_at: now }).eq('id', row.id)
    return json(req, 200, { ok: false, code: failure.code, error: failure.error, metaCode: failure.metaCode })
  }

  const { error: idError } = await db.from('service_completion_otps').update({ wa_message_id: sent.messageId }).eq('id', row.id)
  if (idError) console.error(`service-otp: could not save the WhatsApp message id for issue ${issue.id}: ${idError.message}`)
  // Older codes are retired only now, so a failed resend leaves the previous code working.
  // Not fatal: the code is already on the customer's phone, and verify only checks the newest code.
  const { error: oldError } = await db.from('service_completion_otps').update({ superseded_at: now })
    .eq('issue_id', issue.id).neq('id', row.id).is('verified_at', null).is('superseded_at', null)
  if (oldError) console.error(`service-otp: could not retire older codes for issue ${issue.id}: ${oldError.message}`)

  const { data: moved, error: moveError } = await db.from('service_issues')
    .update({ status: 'completion_pending', completion_requested_at: now, updated_at: now })
    .eq('id', issue.id).eq('assigned_to', userId).in('status', ACTIVE).select('id')
  if (moveError) throw moveError
  if (!moved?.length) {
    // The office moved, closed or cancelled the job while the message was going out.
    await db.from('service_completion_otps').update({ superseded_at: now }).eq('id', row.id)
    const { data: latest } = await db.from('service_issues').select('status').eq('id', issue.id).maybeSingle()
    return json(req, 200, latest?.status === 'completed' || latest?.status === 'cancelled' ? CLOSED : NOT_ASSIGNED)
  }
  return json(req, 200, {
    ok: true, maskedPhone: maskPhone(phone), expiresInSeconds: CODE_TTL_SECONDS,
    resendAfterSeconds: RESEND_AFTER_SECONDS, testMode: Boolean(testTo),
  })
}

// Best effort: the job is already closed, so a failed notice is only logged.
// Goes to the number the verified code went to.
async function sendDoneNotice(db: Db, phone: string, issue: Issue, userId: string, technicianName: string) {
  const template = env('WA_DONE_TEMPLATE')
  if (!template || !waEnabled() || !waReady()) return false
  const values = [issue.customer_name, technicianName, issue.ticket_no, warrantyText(issue.warranty_status, issue.warranty_end)]
  const sent = await sendTemplate(db, {
    to: phone, template, kind: 'completion_notice', issueId: issue.id, customerId: issue.customer_id, sentBy: userId,
    components: [{ type: 'body', parameters: values.map(value => ({ type: 'text', text: templateParam(value) })) }],
  })
  if (!sent.ok) console.error(`service-otp: completed notice not sent for issue ${issue.id}: ${sent.failure.detail}`)
  return sent.ok
}

// For a verify that lost a race: a double tap with the right code, or the office closing the job.
async function closedMeanwhile(req: Request, db: Db, issueId: string, userId: string) {
  const { data } = await db.from('service_issues').select('status, completion_method, completed_by').eq('id', issueId).maybeSingle()
  if (data?.status === 'completed' && data.completion_method === 'otp' && data.completed_by === userId) {
    return json(req, 200, { ok: true, verified: true, noticeSent: false })
  }
  return data?.status === 'completed' || data?.status === 'cancelled' ? json(req, 200, CLOSED) : null
}

async function verifyCode(req: Request, db: Db, userId: string, technicianName: string, issue: Issue, code: string) {
  // Each round either uses up one try or finds that a parallel request used one, so this ends.
  for (let round = 0; round <= MAX_TRIES; round++) {
    // Codes belong to the technician who asked for them; a reassigned job needs a new code.
    const { data: row, error } = await db.from('service_completion_otps')
      .select('id, phone, code_salt, code_hash, expires_at, attempts')
      .eq('issue_id', issue.id).eq('requested_by', userId).is('verified_at', null).is('superseded_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw error
    if (!row) {
      return await closedMeanwhile(req, db, issue.id, userId)
        ?? json(req, 200, { ok: true, verified: false, reason: 'no_code', message: 'Send a new code.' })
    }
    if (Date.parse(row.expires_at) <= Date.now()) {
      return json(req, 200, { ok: true, verified: false, reason: 'expired', message: 'This code has expired. Send a new code.' })
    }
    const attempts = Number(row.attempts) || 0
    if (attempts >= MAX_TRIES) {
      return json(req, 200, { ok: true, verified: false, reason: 'locked', message: 'Too many wrong tries. Send a new code.' })
    }

    // Count the try before comparing, and only if nobody counted one meanwhile,
    // so guesses sent in parallel cannot get past the 5-try limit.
    const { data: counted, error: countError } = await db.from('service_completion_otps')
      .update({ attempts: attempts + 1 })
      .eq('id', row.id).eq('attempts', attempts).is('verified_at', null).is('superseded_at', null).select('id')
    if (countError) throw countError
    if (!counted?.length) continue

    if (!sameHex(await hashCode(row.code_salt, issue.id, code), row.code_hash)) {
      const attemptsLeft = MAX_TRIES - attempts - 1
      return json(req, 200, {
        ok: true, verified: false, reason: 'wrong_code', attemptsLeft,
        message: attemptsLeft > 0 ? 'Wrong code. Check with the customer and try again.' : 'Wrong code. No tries left. Send a new code.',
      })
    }

    const now = new Date().toISOString()
    const { error: usedError } = await db.from('service_completion_otps').update({ verified_at: now }).eq('id', row.id).is('verified_at', null)
    if (usedError) throw usedError
    const { data: closed, error: closeError } = await db.from('service_issues')
      .update({ status: 'completed', completion_method: 'otp', completed_at: now, completed_by: userId, updated_at: now })
      .eq('id', issue.id).eq('assigned_to', userId).in('status', ACTIVE).select('id')
    if (closeError) throw closeError
    if (!closed?.length) return await closedMeanwhile(req, db, issue.id, userId) ?? json(req, 200, NOT_ASSIGNED)
    await db.from('service_completion_otps').update({ superseded_at: now })
      .eq('issue_id', issue.id).is('verified_at', null).is('superseded_at', null)
    const noticeSent = await sendDoneNotice(db, row.phone, issue, userId, technicianName).catch(() => false)
    return json(req, 200, { ok: true, verified: true, noticeSent })
  }
  throw new PlainError('The code could not be checked. Please try again.')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' })

  let action: unknown
  let issueId = ''
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json(req, 401, { error: 'Sign in required' })
    // Who is asking: the token is checked by Supabase Auth, so the anon key alone
    // (no user inside) is refused. The token is used for nothing else.
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await asUser.auth.getUser(token)
    if (!user) return json(req, 401, { error: 'Sign in required' })
    const db = serviceClient()

    const body = await req.json().catch(() => null)
    action = body?.action
    issueId = typeof body?.issueId === 'string' ? body.issueId.trim() : ''
    if (action !== 'send' && action !== 'verify') return json(req, 400, { error: "action must be 'send' or 'verify'" })
    if (!UUID_RE.test(issueId)) return json(req, 400, { error: 'issueId is required' })
    const code = String(body?.code ?? '').replace(/\s/g, '')
    if (action === 'verify' && !/^\d{6}$/.test(code)) return json(req, 400, { error: 'Enter the 6-digit code.' })

    const { data: me, error: meError } = await db.from('profiles').select('name, user_type, status').eq('id', user.id).maybeSingle()
    if (meError) throw meError
    if (String(me?.user_type || '').toLowerCase() !== 'technician' || me?.status === 'inactive') {
      return json(req, 403, { error: 'Only the technician on this job can do this.' })
    }

    const { data: issue, error: issueError } = await db.from('service_issues')
      .select('id, ticket_no, status, assigned_to, otp_phone, customer_id, customer_name, warranty_status, warranty_end, completion_method, completed_by')
      .eq('id', issueId).maybeSingle()
    if (issueError) throw issueError
    if (!issue || issue.assigned_to !== user.id) return json(req, 200, NOT_ASSIGNED)
    if (!ACTIVE.includes(issue.status)) {
      // A second tap after the job closed with this technician's code is still a success.
      if (action === 'verify' && issue.status === 'completed' && issue.completion_method === 'otp' && issue.completed_by === user.id) {
        return json(req, 200, { ok: true, verified: true, noticeSent: false })
      }
      return json(req, 200, issue.status === 'completed' || issue.status === 'cancelled' ? CLOSED : NOT_ASSIGNED)
    }

    if (action === 'send') return await sendCode(req, db, user.id, issue as Issue)
    return await verifyCode(req, db, user.id, String(me?.name || ''), issue as Issue, code)
  } catch (error) {
    // Database wording stays in the logs; the technician gets a plain message.
    const message = (error as { message?: unknown })?.message
    console.error(`service-otp: ${String(action ?? 'request')} failed for issue ${issueId || '-'}: ${String(message ?? error)}`)
    return json(req, 500, { error: error instanceof PlainError ? error.message : SERVER_ERROR })
  }
})
