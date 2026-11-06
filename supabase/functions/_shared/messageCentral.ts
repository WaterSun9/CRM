// supabase/functions/_shared/messageCentral.ts
//
// Message Central VerifyNow (India). It sends the code over its own DLT-registered
// route, so Watersun needs no DLT registration of its own. Message Central makes
// the code; we only keep its verificationId and ask it whether a typed code is right.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), never in the app:
//   MC_CUSTOMER_ID   Message Central customer ID (e.g. C-XXXXXXXX)
//   MC_PASSWORD      the Message Central account password (sent Base64 as their API asks)

const MC_BASE = 'https://cpaas.messagecentral.com'

export type McChannel = 'SMS' | 'WhatsApp'
export type McSend = { ok: true; verificationId: string; timeoutSeconds: number } | { ok: false; status: number; error: string }
export type McCheck = { verified: true } | { verified: false; reason: 'wrong_code' | 'expired' | 'limit' | 'failed'; detail: string }

export const mcReady = () => Boolean(Deno.env.get('MC_CUSTOMER_ID')?.trim() && Deno.env.get('MC_PASSWORD')?.trim())

// Message Central token, reused while this function instance is warm.
let cachedToken: { value: string; at: number } | null = null
async function mcToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedToken.at < 50 * 60 * 1000) return cachedToken.value
  const customerId = Deno.env.get('MC_CUSTOMER_ID')?.trim()
  const password = Deno.env.get('MC_PASSWORD')?.trim()
  if (!customerId || !password) throw new Error('OTP is not set up yet (MC_CUSTOMER_ID / MC_PASSWORD missing).')
  const params = new URLSearchParams({ customerId, key: btoa(password), scope: 'NEW', country: '91' })
  const res = await fetch(`${MC_BASE}/auth/v1/authentication/token?${params}`, { headers: { accept: '*/*' } })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.token) throw new Error(`OTP provider login failed (${res.status}).`)
  cachedToken = { value: data.token, at: Date.now() }
  return data.token
}

// phone: 10-digit Indian mobile, already cleaned.
export async function mcSendOtp(phone: string, channel: McChannel, otpLength = 4): Promise<McSend> {
  const token = await mcToken()
  // Message Central spells the flow types in capitals (SMS / WHATSAPP).
  const params = new URLSearchParams({ countryCode: '91', mobileNumber: phone, flowType: channel.toUpperCase(), otpLength: String(otpLength) })
  const res = await fetch(`${MC_BASE}/verification/v3/send?${params}`, { method: 'POST', headers: { authToken: token } })
  const data = await res.json().catch(() => ({}))
  const verificationId = data?.data?.verificationId
  if (!res.ok || !verificationId) {
    if (res.status === 401) cachedToken = null
    return { ok: false, status: res.status, error: String(data?.message || `The code could not be sent (${res.status}).`) }
  }
  return { ok: true, verificationId: String(verificationId), timeoutSeconds: Number(data?.data?.timeout) || 60 }
}

export async function mcCheckOtp(verificationId: string, code: string, channel: McChannel): Promise<McCheck> {
  const token = await mcToken()
  const params = new URLSearchParams({ verificationId, code, flowType: channel.toUpperCase() })
  const res = await fetch(`${MC_BASE}/verification/v3/validateOtp?${params}`, { headers: { authToken: token } })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401) cachedToken = null
  if (res.ok && data?.data?.verificationStatus === 'VERIFICATION_COMPLETED') return { verified: true }
  // Message Central: 702 wrong code, 705 expired, 800 too many tries.
  const status = String(data?.data?.verificationStatus || data?.message || '')
  const reason = data?.responseCode === 800 || /MAXIMUM_LIMIT/i.test(status) ? 'limit'
    : data?.responseCode === 705 || /EXPIRED/i.test(status) ? 'expired'
    : data?.responseCode === 702 || /WRONG/i.test(status) ? 'wrong_code'
    : 'failed'
  return { verified: false, reason, detail: `${data?.responseCode ?? res.status} ${status}`.trim() }
}
