// supabase/functions/phone-otp/index.ts
//
// Phone OTP through Message Central VerifyNow (India, no DLT needed - it uses
// Message Central's registered route). Two actions, both need a signed-in Admin
// or Office user (user_type admin / sales / office2, not inactive), so a partner,
// vendor or technician login cannot spend the SMS credit:
//   POST { action: 'send',   phone: '9876543210', channel?: 'SMS' | 'WhatsApp' }
//        -> { ok: true, requestId }
//   POST { action: 'verify', requestId, code: '1234' }
//        -> { ok: true, verified: true | false }
//
// Secrets: MC_CUSTOMER_ID and MC_PASSWORD (see ../_shared/messageCentral.ts).
// Every request is logged in public.phone_otp_requests (migration 20261006090000),
// which also limits sends to 5 per phone number per hour to protect the credit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { mcCheckOtp, mcSendOtp } from '../_shared/messageCentral.ts'

const MAX_SENDS_PER_HOUR = 5
const STAFF_TYPES = ['admin', 'sales', 'office2']
const ALLOWED_ORIGINS = ['https://crm.watersunsolar.com', 'https://watersun.deeprootsystems.in', 'https://watersun9.github.io']

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
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

const cleanPhone = (value: unknown) => {
  let digits = String(value ?? '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2)
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1)
  return /^[6-9]\d{9}$/.test(digits) ? digits : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const authHeader = req.headers.get('Authorization') || ''
  // Who is asking: must be a signed-in CRM user.
  const asUser = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
  const { data: { user } } = await asUser.auth.getUser()
  if (!user) return json(req, 401, { error: 'Sign in required' })
  const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: me } = await admin.from('profiles').select('user_type, status').eq('id', user.id).maybeSingle()
  if (!STAFF_TYPES.includes(String(me?.user_type || '').toLowerCase()) || me?.status === 'inactive') {
    return json(req, 403, { error: 'Only Admin or Office can send codes.' })
  }

  const body = await req.json().catch(() => ({}))
  try {
    if (body.action === 'send') {
      const phone = cleanPhone(body.phone)
      if (!phone) return json(req, 400, { error: 'Enter a valid 10-digit Indian mobile number.' })
      const channel = body.channel === 'WhatsApp' ? 'WhatsApp' : 'SMS'

      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const { count } = await admin.from('phone_otp_requests').select('id', { count: 'exact', head: true })
        .eq('phone', phone).gte('created_at', since)
      if ((count ?? 0) >= MAX_SENDS_PER_HOUR) return json(req, 429, { error: 'Too many codes sent to this number. Try again in an hour.' })

      const sent = await mcSendOtp(phone, channel, 4)
      if (!sent.ok) return json(req, 502, { error: sent.error })
      const { data: row, error } = await admin.from('phone_otp_requests')
        .insert({ phone, channel, verification_id: sent.verificationId, requested_by: user.id })
        .select('id').single()
      if (error) throw error
      return json(req, 200, { ok: true, requestId: row.id, timeoutSeconds: sent.timeoutSeconds })
    }

    if (body.action === 'verify') {
      const code = String(body.code ?? '').trim()
      if (!body.requestId || !/^\d{4,8}$/.test(code)) return json(req, 400, { error: 'Enter the code you received.' })
      const { data: row } = await admin.from('phone_otp_requests')
        .select('id, verification_id, channel, verified_at, attempts, requested_by').eq('id', body.requestId).maybeSingle()
      if (!row || row.requested_by !== user.id) return json(req, 404, { error: 'This code request was not found. Send a new code.' })
      if (row.verified_at) return json(req, 200, { ok: true, verified: true })
      if ((row.attempts ?? 0) >= 5) return json(req, 429, { error: 'Too many wrong tries. Send a new code.' })

      const check = await mcCheckOtp(row.verification_id, code, row.channel === 'WhatsApp' ? 'WhatsApp' : 'SMS')
      await admin.from('phone_otp_requests').update({
        attempts: (row.attempts ?? 0) + 1,
        ...(check.verified ? { verified_at: new Date().toISOString() } : {}),
      }).eq('id', row.id)
      if (check.verified) return json(req, 200, { ok: true, verified: true })
      if (check.reason === 'limit') return json(req, 200, { ok: true, verified: false, reason: 'limit', message: 'Too many tries. Send a new code.' })
      const reason = check.reason
      const message = reason === 'expired' ? 'This code has expired. Send a new code.'
        : reason === 'wrong_code' ? 'Wrong code. Please check and try again.'
        : `The code could not be checked (${check.detail}).`
      return json(req, 200, { ok: true, verified: false, reason, message })
    }

    return json(req, 400, { error: "action must be 'send' or 'verify'" })
  } catch (error) {
    return json(req, 500, { error: error instanceof Error ? error.message : 'OTP failed' })
  }
})
