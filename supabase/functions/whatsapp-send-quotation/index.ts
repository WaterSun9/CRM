// supabase/functions/whatsapp-send-quotation/index.ts
//
// Sends a quotation PDF to the customer on WhatsApp (Meta Cloud API, no BSP), from the
// "WhatsApp" button in Quotation Maker. The app makes the PDF exactly as for Download and
// uploads it here; this function checks it, uploads it to Meta and sends the
// watersun_quotation template with the PDF on top.
//
//   POST multipart/form-data  quotationId (uuid), file (application/pdf, <= 10 MB),
//                             updatedAt (optional: the quotation's updated_at the PDF was made from)
//     -> 200 { ok: true, maskedPhone: '******3210', testMode }
//     -> 200 { ok: false, code, error }  code: wa_disabled | lost | superseded | changed | no_phone
//              | cooldown | limit (+ retryAfterSeconds, except when two sends raced each other)
//              | not_on_whatsapp | billing | token | send_failed (+ metaCode)
//     -> 404 { ok: false, code: 'not_found', error }  the caller cannot see this quotation
// Business-rule answers are 200 so the app can show `error` as it is.
// 400 bad input or bad file, 401 not signed in, 403 role cannot make quotations,
// 500 unexpected (plain message; the technical reason goes to the function logs only).
//
// Who may send: the quotation is read with the CALLER's token, so the quotations RLS
// decides (owner, or admin / sales), exactly as in the app. The caller must also still hold a
// Quotation Maker role and not be inactive. Log reads and writes use the service role.
// The app marks the quotation Issued (same call as Download) only after this returns ok.
//
// Limits: 3 per quotation per hour, and per person 10 per hour and 30 per day (the last
// 24 hours) (whatsapp_messages kind 'quotation', failed sends count too), and no second send
// of the same quotation within 60 s. Checked first for a clear answer, then again by
// sendTemplate after the log row is written, so parallel requests cannot all slip through.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), shared with service-otp:
//   WA_ENABLED, WA_TOKEN, WA_PHONE_NUMBER_ID, WA_GRAPH_VERSION, WA_TEMPLATE_LANG, WA_TEST_TO
//   (see supabase/functions/_shared/whatsapp.ts). While WA_TEST_TO is set every quotation
//   goes to that number instead of the customer.
//   WA_QUOTATION_TEMPLATE  optional, default watersun_quotation
//
// Meta template watersun_quotation (UTILITY; Meta may re-class it as MARKETING):
//   DOCUMENT header (the PDF), body {{1}} customer name, {{2}} quotation label (Quote-1023 or
//   Quote-1023-R1), {{3}} capacity number (the text has "kW" after it), {{4}} valid until
//   ('11 Oct 2026'). Texts in supabase/whatsapp/templates.json.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { cleanPhone, env, maskPhone, sendTemplate, templateParam, uploadMedia, waEnabled, waReady } from '../_shared/whatsapp.ts'
import {
  DAY_MS, HOUR_MS, MAX_BODY_BYTES, PER_PERSON_PER_DAY, PER_PERSON_PER_HOUR, PER_QUOTATION_PER_HOUR, QUOTATION_ROLES,
  RESEND_GAP_SECONDS, type QuotationRow, failureMessage, limitWait, minutesText, pdfFileName, pdfProblem, quotationValues,
  resendWait, sameVersion, sendRefusal, waitText,
} from './helpers.ts'

const ALLOWED_ORIGINS = ['https://crm.watersunsolar.com', 'https://watersun.deeprootsystems.in', 'https://watersun9.github.io']
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const WA_OFF = 'Sending quotations on WhatsApp is not switched on yet. Use Download or Share for now.'
const SERVER_ERROR = 'Something went wrong on the server. Please try again in a minute, or use Download or Share.'
const NOT_FOUND = { ok: false, code: 'not_found', error: 'This quotation was not found, or you cannot open it. Refresh the page.' }
const JUST_SENT = 'This quotation was just sent on WhatsApp. Please wait a minute before sending it again.'
const HOUR_LIMIT = `You can send ${PER_PERSON_PER_HOUR} quotations on WhatsApp in an hour.`
const DAY_LIMIT = `You can send ${PER_PERSON_PER_DAY} quotations on WhatsApp in a day.`
// Only what the WhatsApp text needs; the large template copy stays in the database.
const QUOTATION_COLUMNS = 'id,quotation_no,status,updated_at,customer_name,customer_phone,capacity_kw,valid_until,converted_lead_id,source_lead_id,' +
  'form:quotation_data->form,revision:quotation_data->revision,superseded_by:quotation_data->superseded_by'

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

const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
type Db = ReturnType<typeof serviceClient>

// Reads the upload but stops once it passes `max` bytes, so a huge body is never held in memory.
async function readLimited(req: Request, max: number): Promise<ArrayBuffer | null> {
  if (!req.body) return new ArrayBuffer(0)
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
  return out.buffer as ArrayBuffer
}

// Per-quotation and per-person limits and the double-tap gap. Returns the 200 body to send back, or null.
async function limitAnswer(db: Db, quotationId: string, userId: string) {
  const hourAgo = new Date(Date.now() - HOUR_MS).toISOString()
  const { data: forQuote, error: quoteError } = await db.from('whatsapp_messages').select('created_at, status')
    .eq('kind', 'quotation').eq('quotation_id', quotationId).gte('created_at', hourAgo)
  if (quoteError) throw quoteError
  const recent = (forQuote ?? []).map(r => ({ created_at: String(r.created_at), status: String(r.status) }))
  const gap = resendWait(recent)
  if (gap) {
    return { ok: false, code: 'cooldown', retryAfterSeconds: gap, error: JUST_SENT }
  }
  const quoteWait = limitWait(recent.map(r => r.created_at), PER_QUOTATION_PER_HOUR)
  if (quoteWait) {
    return {
      ok: false, code: 'limit', retryAfterSeconds: quoteWait,
      error: `One quotation can be sent on WhatsApp only ${PER_QUOTATION_PER_HOUR} times in an hour. Try again in ${minutesText(quoteWait)}, or use Download or Share.`,
    }
  }
  // The newest sends of the last 24 hours cover both per-person rules.
  const { data: mine, error: mineError } = await db.from('whatsapp_messages').select('created_at')
    .eq('kind', 'quotation').eq('sent_by', userId).gte('created_at', new Date(Date.now() - DAY_MS).toISOString())
    .order('created_at', { ascending: false }).limit(PER_PERSON_PER_DAY)
  if (mineError) throw mineError
  const myTimes = (mine ?? []).map(r => String(r.created_at))
  const dayWait = limitWait(myTimes, PER_PERSON_PER_DAY, Date.now(), DAY_MS)
  if (dayWait) {
    return { ok: false, code: 'limit', retryAfterSeconds: dayWait, error: `${DAY_LIMIT} Try again in ${waitText(dayWait)}, or use Download or Share.` }
  }
  const hourWait = limitWait(myTimes, PER_PERSON_PER_HOUR)
  if (hourWait) {
    return { ok: false, code: 'limit', retryAfterSeconds: hourWait, error: `${HOUR_LIMIT} Try again in ${waitText(hourWait)}, or use Download or Share.` }
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' })

  let quotationId = ''
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json(req, 401, { error: 'Sign in required' })
    // The caller's own client: says who is asking, and reads the quotation under their RLS.
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user } } = await asUser.auth.getUser(token)
    if (!user) return json(req, 401, { error: 'Sign in required' })
    const db = serviceClient()

    const { data: me, error: meError } = await db.from('profiles').select('user_type, status').eq('id', user.id).maybeSingle()
    if (meError) throw meError
    if (!QUOTATION_ROLES.includes(String(me?.user_type || '').toLowerCase()) || me?.status === 'inactive') {
      return json(req, 403, { error: 'Only staff who make quotations can send them on WhatsApp.' })
    }

    // The upload: checked fully here, before anything goes to Meta.
    const contentType = req.headers.get('Content-Type') || ''
    if (!/^multipart\/form-data\s*;/i.test(contentType)) return json(req, 400, { error: 'Send the quotation PDF as a file upload.' })
    const declared = Number(req.headers.get('Content-Length'))
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return json(req, 400, { error: 'The quotation PDF is too big to send on WhatsApp (10 MB at most).' })
    }
    const raw = await readLimited(req, MAX_BODY_BYTES)
    if (!raw) return json(req, 400, { error: 'The quotation PDF is too big to send on WhatsApp (10 MB at most).' })
    const form = await new Response(raw, { headers: { 'Content-Type': contentType } }).formData().catch(() => null)
    if (!form) return json(req, 400, { error: 'The upload could not be read. Please try again.' })
    const idField = form.get('quotationId')
    quotationId = typeof idField === 'string' ? idField.trim() : ''
    if (!UUID_RE.test(quotationId)) return json(req, 400, { error: 'quotationId is required' })
    const file = form.get('file')
    if (!(file instanceof File)) return json(req, 400, { error: 'Attach the quotation PDF.' })
    const sizeProblem = pdfProblem(file)
    if (sizeProblem) return json(req, 400, { error: sizeProblem })
    const bytes = new Uint8Array(await file.arrayBuffer())
    const fileProblem = pdfProblem({ size: bytes.byteLength, type: file.type }, bytes)
    if (fileProblem) return json(req, 400, { error: fileProblem })
    const seenField = form.get('updatedAt')
    const seenVersion = typeof seenField === 'string' ? seenField.trim() : ''

    if (!waEnabled()) return json(req, 200, { ok: false, code: 'wa_disabled', error: WA_OFF })
    if (!waReady()) {
      console.error('whatsapp-send-quotation: WA_ENABLED is true but WA_TOKEN or WA_PHONE_NUMBER_ID is missing')
      return json(req, 200, { ok: false, code: 'wa_disabled', error: WA_OFF })
    }
    const testTo = env('WA_TEST_TO')
    if (testTo && !cleanPhone(testTo)) {
      // Checked before the upload; the shared sender would refuse it anyway, never using the real number.
      console.error('whatsapp-send-quotation: WA_TEST_TO is set but is not a valid 10-digit Indian mobile number')
      return json(req, 200, { ok: false, code: 'send_failed', error: 'The WhatsApp test number setting is wrong. Use Download or Share for now, and tell the office.' })
    }

    // RLS decides: the owner, or admin / sales. Anything else looks like a missing quotation.
    const { data: row, error: rowError } = await asUser.from('quotations').select(QUOTATION_COLUMNS).eq('id', quotationId).maybeSingle()
    if (rowError) throw rowError
    if (!row) return json(req, 404, NOT_FOUND)
    const quotation = row as unknown as QuotationRow
    const refusal = sendRefusal(quotation)
    if (refusal) return json(req, 200, refusal)
    // The PDF was made from the version the app read; never send an older copy than what is saved.
    if (!sameVersion(seenVersion, quotation.updated_at)) {
      return json(req, 200, { ok: false, code: 'changed', error: 'This quotation was changed while the PDF was being made. Please try again.' })
    }
    const values = quotationValues(quotation)
    const phone = cleanPhone(values.phone)
    if (!phone) return json(req, 200, { ok: false, code: 'no_phone', error: 'This quotation has no valid customer mobile number.' })

    const wait = await limitAnswer(db, quotationId, user.id)
    if (wait) return json(req, 200, wait)

    const filename = pdfFileName(quotation)
    const media = await uploadMedia(bytes, 'application/pdf', filename)
    if (!media.ok) {
      console.error(`whatsapp-send-quotation: PDF upload failed for quotation ${quotationId}: ${media.failure.code} ${media.failure.metaCode ?? '-'}`)
      return json(req, 200, { ok: false, code: media.failure.code, error: failureMessage(media.failure), metaCode: media.failure.metaCode })
    }

    const sent = await sendTemplate(db, {
      to: phone,
      template: env('WA_QUOTATION_TEMPLATE') || 'watersun_quotation',
      components: [
        { type: 'header', parameters: [{ type: 'document', document: { id: media.mediaId, filename } }] },
        {
          type: 'body',
          parameters: [values.customerName, values.label, values.capacity, values.validUntil]
            .map(value => ({ type: 'text', text: templateParam(value) })),
        },
      ],
      kind: 'quotation',
      quotationId,
      // The lead this quotation came from or became, so the customer's WhatsApp history shows it too.
      customerId: quotation.converted_lead_id || quotation.source_lead_id || null,
      sentBy: user.id,
      // The same four rules as limitAnswer, counted again once this send is logged, so
      // requests sent together (two tabs, a script) cannot all pass the check above.
      limits: [
        { filters: { quotation_id: quotationId }, max: 1, windowMs: RESEND_GAP_SECONDS * 1000, ignoreFailed: true, error: JUST_SENT },
        {
          filters: { quotation_id: quotationId }, max: PER_QUOTATION_PER_HOUR,
          error: `One quotation can be sent on WhatsApp only ${PER_QUOTATION_PER_HOUR} times in an hour. Use Download or Share for now.`,
        },
        { filters: { sent_by: user.id }, max: PER_PERSON_PER_HOUR, error: `${HOUR_LIMIT} Use Download or Share for now.` },
        { filters: { sent_by: user.id }, max: PER_PERSON_PER_DAY, windowMs: DAY_MS, error: `${DAY_LIMIT} Use Download or Share for now.` },
      ],
    })
    if (!sent.ok) {
      console.error(`whatsapp-send-quotation: not sent for quotation ${quotationId}: ${sent.failure.code} ${sent.failure.metaCode ?? '-'}`)
      if (sent.failure.code === 'limit') return json(req, 200, { ok: false, code: 'limit', error: sent.failure.error })
      return json(req, 200, { ok: false, code: sent.failure.code, error: failureMessage(sent.failure), metaCode: sent.failure.metaCode })
    }
    return json(req, 200, { ok: true, maskedPhone: maskPhone(sent.sentTo), testMode: sent.testMode })
  } catch (error) {
    // Database wording stays in the logs; the salesperson gets a plain message.
    const message = (error as { message?: unknown })?.message
    console.error(`whatsapp-send-quotation: failed for quotation ${quotationId || '-'}: ${String(message ?? error)}`)
    return json(req, 500, { error: SERVER_ERROR })
  }
})
