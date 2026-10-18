// supabase/functions/send-lead-to-vendor/index.ts
//
// Sends a customer's Material Delivery details to the vendor assigned on the
// customer card. Admin / Office only. POST { customer_id }.
//   200      { success: true, sent_to, whatsapp }
//   4xx/5xx  { error, details?, whatsapp }
// The email (Brevo) works exactly as before. After the email attempt, whether it
// worked or not, the vendor also gets the WhatsApp 'watersun_vendor_lead' on
// vendors.phone (migration 20261013100000), only while WA_ENABLED is 'true'.
// The WhatsApp never changes the email result; `whatsapp` only reports on it:
//   { sent, skipped?: 'off' | 'no_phone' | 'limit', error?, testMode?, maskedPhone? }
// At most 2 vendor WhatsApps per customer + vendor per hour (whatsapp_messages).
//
// Secrets: BREVO_API_KEY, SENDER_EMAIL for the email; WA_ENABLED, WA_TOKEN,
// WA_PHONE_NUMBER_ID (+ optional WA_GRAPH_VERSION, WA_TEMPLATE_LANG, WA_TEST_TO)
// for the WhatsApp, read by ../_shared/whatsapp.ts.
//
// Template watersun_vendor_lead (UTILITY), body values in this order:
//   {{1}} vendor name, {{2}} customer name, {{3}} customer phone, {{4}} address,
//   {{5}} system kW, {{6}} file no. (folder no., else consumer no.)

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  cleanPhone, countLastHour, maskPhone, sendTemplate, templateParam, waEnabled, waReady, type SendFailure,
} from '../_shared/whatsapp.ts'

const htmlEscapes: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}
const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, char => htmlEscapes[char])

// Same reason as add_user: the custom domain needs to be an allowed origin.
const ALLOWED_ORIGINS = ['https://crm.watersunsolar.com', 'https://watersun.deeprootsystems.in', 'https://watersun9.github.io']

function isAllowedOrigin(origin: string) {
  if (ALLOWED_ORIGINS.includes(origin)) return true
  try {
    const url = new URL(origin)
    return url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
}

// ---------------------------------------------------------------- WhatsApp

type WhatsAppResult = {
  sent: boolean
  skipped?: 'off' | 'no_phone' | 'limit'
  error?: string
  testMode?: boolean
  maskedPhone?: string
}

const VENDOR_LEAD_TEMPLATE = 'watersun_vendor_lead'
const VENDOR_LEAD_PER_HOUR = 2

// For answers given before the WhatsApp step (bad request, wrong role, no
// vendor...): nothing was tried. 'off' lets the app keep its old wording.
const notTried = (): WhatsAppResult => (waEnabled() ? { sent: false } : { sent: false, skipped: 'off' })

// First value that is not blank ('0' counts as filled).
function firstFilled(...values: unknown[]) {
  for (const v of values) {
    if (v !== null && v !== undefined && String(v).trim() !== '') return v
  }
  return ''
}

// The office reads this, so point at the vendor's number where that is the fix.
// Anything worded for a technician ("Ask the office to close this job") is cut.
function vendorFailureText(failure: SendFailure) {
  if (failure.code === 'not_on_whatsapp') return "This number is not on WhatsApp. Check the vendor's number."
  if (failure.metaCode === 131030) return "The vendor's number is not on the WhatsApp test list."
  const text = String(failure.error || '').replace(/\s*Ask the office to close this job\.?\s*$/i, '').trim()
  return text || 'The WhatsApp message could not be sent. Please try again in a minute.'
}

async function sendVendorWhatsApp(
  db: SupabaseClient,
  // deno-lint-ignore no-explicit-any
  lead: Record<string, any>,
  vendorId: string,
  vendorName: string,
  callerId: string,
): Promise<WhatsAppResult> {
  if (!waEnabled()) return { sent: false, skipped: 'off' }
  try {
    if (!waReady()) {
      console.error('vendor WhatsApp: WA_ENABLED is true but WA_TOKEN or WA_PHONE_NUMBER_ID is missing')
      return { sent: false, error: 'WhatsApp is not set up in the CRM yet. Please tell the owner.' }
    }

    // Read on its own, not in the email lookup above, so the email keeps working
    // even if this function goes live before vendors.phone exists.
    const { data: row, error: phoneError } = await db
      .from('vendors')
      .select('phone')
      .eq('id', vendorId)
      .maybeSingle()
    if (phoneError) {
      console.error('vendor WhatsApp: phone lookup failed', phoneError.code, phoneError.message)
      return { sent: false, error: "Could not read the vendor's WhatsApp number. Please try again." }
    }
    const phone = cleanPhone(row?.phone)
    if (!phone) return { sent: false, skipped: 'no_phone' }
    const maskedPhone = maskPhone(phone)

    // Failed tries count too, so a wrong number is not hammered. If the count
    // cannot be read, nothing is sent (the limit must not be skipped).
    let sentLastHour: number
    try {
      sentLastHour = await countLastHour(db, 'vendor_lead', { customer_id: String(lead.id), vendor_id: vendorId })
    } catch (countError) {
      console.error('vendor WhatsApp: limit check failed', (countError as { code?: string })?.code, (countError as Error)?.message)
      return { sent: false, error: 'Could not check the WhatsApp limit. Please try again.', maskedPhone }
    }
    if (sentLastHour >= VENDOR_LEAD_PER_HOUR) return { sent: false, skipped: 'limit', maskedPhone }

    const address = firstFilled(
      lead.full_address,
      [lead.villages, lead.sub_divisions, lead.district].map(v => String(v ?? '').trim()).filter(Boolean).join(', '),
    )
    const values = [
      vendorName,
      lead.customer_name,
      cleanPhone(lead.phone_number) || lead.phone_number,
      address,
      lead.system_capacity_kwp,
      firstFilled(lead.folder_no, lead.consumer_no),
    ]
    const result = await sendTemplate(db, {
      to: phone,
      template: VENDOR_LEAD_TEMPLATE,
      components: [{ type: 'body', parameters: values.map(v => ({ type: 'text', text: templateParam(v) })) }],
      kind: 'vendor_lead',
      customerId: lead.id,
      vendorId,
      sentBy: callerId,
      // Counted again once this send is logged, so two clicks at the same moment
      // cannot both pass the check above.
      limits: [{
        filters: { customer_id: String(lead.id), vendor_id: vendorId }, max: VENDOR_LEAD_PER_HOUR,
        error: 'This vendor already got this customer on WhatsApp twice in the last hour.',
      }],
    })
    if (result.ok) return { sent: true, testMode: result.testMode, maskedPhone }
    if (result.failure.code === 'limit') return { sent: false, skipped: 'limit', maskedPhone }
    console.error('vendor WhatsApp: not sent', result.failure.code, result.failure.metaCode)
    return { sent: false, error: vendorFailureText(result.failure), testMode: result.testMode, maskedPhone }
  } catch (err) {
    console.error('vendor WhatsApp: unexpected error', (err as Error)?.message)
    return { sent: false, error: 'WhatsApp could not be sent. Please try again later.' }
  }
}

// ---------------------------------------------------------------- handler

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Filled in once the WhatsApp step has run, so even a late crash reports it.
  let whatsapp: WhatsAppResult | null = null

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required', whatsapp: notTried() }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const customer_id = body.customer_id

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id is required', whatsapp: notTried() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: userError } = await authClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired session', whatsapp: notTried() }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .maybeSingle()
    if (!['admin', 'sales'].includes(String(callerProfile?.user_type || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Only Admin or Office can send Material Delivery emails', whatsapp: notTried() }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1. Fetch the lead/customer record
    const { data: lead, error: leadError } = await supabase
      .from('admin')
      .select('*')
      .eq('id', customer_id)
      .single()

    if (leadError || !lead) {
      return new Response(JSON.stringify({ error: 'Lead not found', details: leadError, whatsapp: notTried() }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Resolve the recipient from the saved assignment. A caller-supplied email
    // must not redirect a customer's details to an arbitrary address.
    if (!lead.vendor?.trim()) {
      return new Response(JSON.stringify({ error: 'No vendor is assigned to this customer', whatsapp: notTried() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    // id is only for the WhatsApp step; the phone is read there, separately.
    const { data: vendor, error: vendorError } = await supabase
      .from('vendors')
      .select('id, name, email')
      .ilike('name', lead.vendor.trim())
      .maybeSingle()
    if (vendorError || !vendor?.email) {
      return new Response(JSON.stringify({ error: 'Assigned vendor email not found', whatsapp: notTried() }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const targetVendorEmail = vendor.email
    const targetVendorName = vendor.name || lead.vendor

    // 3. Build the email body from lead data
    const rows = [
      ['Customer Name', lead.customer_name],
      ['Phone Number', lead.phone_number],
      ['Email', lead.email_address],
      ['Villages', lead.villages],
      ['Folder No', lead.folder_no],
      ['Channel Partner', lead.channel_partner],
      ['Sub Channel Partner', lead.sub_channel_partner],
      ['System Capacity (kWp)', lead.system_capacity_kwp],
      ['Module Brand', lead.module_brand],
      ['Module WP', lead.module_wp],
      ['Sub Division', lead.sub_divisions],
      ['Consumer No', lead.consumer_no],
      ['Payment Type', lead.payment_type],
      ['Invoice No', lead.invoice_no],
      ['Delivery Date', lead.material_delivery_date],
      ['Vehicle / Truck No', lead.vehicle_number || lead.delivery_vehicle_no],
      ['Driver Name', lead.driver_name],
      ['Driver Phone Number', lead.driver_phone_number],
    ]
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px;border:1px solid #e5e5e5;font-weight:600;background:#fafafa;">${escapeHtml(label)}</td><td style="padding:6px 12px;border:1px solid #e5e5e5;">${escapeHtml(value)}</td></tr>`
      )
      .join('')

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#333;">Material Delivery Assigned: ${escapeHtml(lead.customer_name || 'N/A')}</h2>
        <table style="border-collapse:collapse;width:100%;">${rows}</table>
        <p>Please log in to the Vendor Portal to review the delivery and installation work.</p>
      </div>
    `

    // 4. Send via Brevo transactional email API. A failure is held, not returned
    // straight away, so the vendor still gets the WhatsApp; the answer is the
    // same status and fields as before, plus `whatsapp`.
    let emailFailure: { status: number; body: Record<string, unknown> } | null = null
    try {
      const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': Deno.env.get('BREVO_API_KEY')!,
        },
        body: JSON.stringify({
          sender: { name: 'Watersun Solar Operations', email: Deno.env.get('SENDER_EMAIL') || 'deeproot120@gmail.com' },
          to: [{ email: targetVendorEmail, name: targetVendorName }],
          subject: `Material Delivery: ${lead.customer_name || 'Unnamed'} (${lead.folder_no || lead.consumer_no || 'No Reference'})`,
          htmlContent,
        }),
      })

      if (!brevoRes.ok) {
        const errText = await brevoRes.text()
        emailFailure = { status: 502, body: { error: 'Brevo send failed', details: errText } }
      }
    } catch (err) {
      // Same 500 the outer catch gave for a network error before.
      emailFailure = { status: 500, body: { error: (err as Error)?.message } }
    }

    // 5. WhatsApp copy (never throws).
    whatsapp = await sendVendorWhatsApp(supabase, lead, vendor.id, targetVendorName, user.id)

    if (emailFailure) {
      return new Response(JSON.stringify({ ...emailFailure.body, whatsapp }), {
        status: emailFailure.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, sent_to: targetVendorEmail, whatsapp }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error)?.message, whatsapp: whatsapp ?? notTried() }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
