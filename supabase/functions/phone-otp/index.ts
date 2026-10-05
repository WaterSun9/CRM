// supabase/functions/phone-otp/index.ts
//
// Phone OTP through Message Central VerifyNow (India, no DLT needed - it uses
// Message Central's registered route). Two actions, both need a signed-in user:
//   POST { action: 'send',   phone: '9876543210', channel?: 'SMS' | 'WhatsApp' }
//        -> { ok: true, requestId }
//   POST { action: 'verify', requestId, code: '1234' }
//        -> { ok: true, verified: true | false }
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), never in the app:
//   MC_CUSTOMER_ID   Message Central customer ID (e.g. C-XXXXXXXX)
//   MC_PASSWORD      the Message Central account password (sent Base64 as their API asks)
// Every request is logged in public.phone_otp_requests (migration 20261006090000),
// which also limits sends to 5 per phone number per hour to protect the credit.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const MC_BASE = 'https://cpaas.messagecentral.com'
const MAX_SENDS_PER_HOUR = 5
const ALLOWED_ORIGINS = ['https://watersun.deeprootsystems.in', 'https://watersun9.github.io']

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

// Message Central token, reused while this function instance is warm.
let cachedToken: { value: string; at: number } | null = null
async function mcToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < 50 * 60 * 1000) return cachedToken.value
  const customerId = Deno.env.get('MC_CUSTOMER_ID')
  const password = Deno.env.get('MC_PASSWORD')
  if (!customerId || !password) throw new Error('OTP is not set up yet (MC_CUSTOMER_ID / MC_PASSWORD missing).')
  const params = new URLSearchParams({ customerId, key: btoa(password), scope: 'NEW', country: '91' })
  const res = await fetch(`${MC_BASE}/auth/v1/authentication/token?${params}`, { headers: { accept: '*/*' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.token) throw new Error(`OTP provider login failed (${res.status}).`)
  cachedToken = { value: data.token, at: Date.now() }
  return data.token
}

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

      const token = await mcToken()
      // Message Central spells the flow types in capitals (SMS / WHATSAPP).
      const params = new URLSearchParams({ countryCode: '91', mobileNumber: phone, flowType: channel.toUpperCase(), otpLength: '4' })
      const res = await fetch(`${MC_BASE}/verification/v3/send?${params}`, { method: 'POST', headers: { authToken: token } })
      const data = await res.json().catch(() => ({}))
      const verificationId = data?.data?.verificationId
      if (!res.ok || !verificationId) {
        if (res.status === 401) cachedToken = null
        return json(req, 502, { error: data?.message || `The code could not be sent (${res.status}).` })
      }
      const { data: row, error } = await admin.from('phone_otp_requests')
        .insert({ phone, channel, verification_id: String(verificationId), requested_by: user.id })
        .select('id').single()
      if (error) throw error
      return json(req, 200, { ok: true, requestId: row.id, timeoutSeconds: Number(data?.data?.timeout) || 60 })
    }

    if (body.action === 'verify') {
      const code = String(body.code ?? '').trim()
      if (!body.requestId || !/^\d{4,8}$/.test(code)) return json(req, 400, { error: 'Enter the code you received.' })
      const { data: row } = await admin.from('phone_otp_requests')
        .select('id, verification_id, channel, verified_at, attempts, requested_by').eq('id', body.requestId).maybeSingle()
      if (!row || row.requested_by !== user.id) return json(req, 404, { error: 'This code request was not found. Send a new code.' })
      if (row.verified_at) return json(req, 200, { ok: true, verified: true })
      if ((row.attempts ?? 0) >= 5) return json(req, 429, { error: 'Too many wrong tries. Send a new code.' })

      const token = await mcToken()
      const params = new URLSearchParams({ verificationId: row.verification_id, code, flowType: String(row.channel).toUpperCase() })
      const res = await fetch(`${MC_BASE}/verification/v3/validateOtp?${params}`, { headers: { authToken: token } })
      const data = await res.json().catch(() => ({}))
      const verified = res.ok && data?.data?.verificationStatus === 'VERIFICATION_COMPLETED'
      if (res.status === 401) cachedToken = null
      await admin.from('phone_otp_requests').update({
        attempts: (row.attempts ?? 0) + 1,
        ...(verified ? { verified_at: new Date().toISOString() } : {}),
      }).eq('id', row.id)
      if (verified) return json(req, 200, { ok: true, verified: true })
      // Why it failed, in words the app can show (Message Central: 702 wrong code, 705 expired).
      const status = String(data?.data?.verificationStatus || data?.message || '')
      const code702 = data?.responseCode === 702 || /WRONG/i.test(status)
      const code705 = data?.responseCode === 705 || /EXPIRED/i.test(status)
      const code800 = data?.responseCode === 800 || /MAXIMUM_LIMIT/i.test(status)
      if (code800) return json(req, 200, { ok: true, verified: false, reason: 'limit', message: 'Too many tries. Send a new code.' })
      const reason = code705 ? 'expired' : code702 ? 'wrong_code' : 'failed'
      const message = code705 ? 'This code has expired. Send a new code.'
        : code702 ? 'Wrong code. Please check and try again.'
        : `The code could not be checked (${data?.responseCode ?? res.status} ${status}).`
      return json(req, 200, { ok: true, verified: false, reason, message })
    }

    return json(req, 400, { error: "action must be 'send' or 'verify'" })
  } catch (error) {
    return json(req, 500, { error: error instanceof Error ? error.message : 'OTP failed' })
  }
})
