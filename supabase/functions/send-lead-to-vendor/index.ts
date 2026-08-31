// supabase/functions/send-lead-to-vendor/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Same reason as add_user: the custom domain needs to be an allowed origin.
const ALLOWED_ORIGINS = ['https://watersun.deeprootsystems.in', 'https://watersun9.github.io']

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

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const customer_id = body.customer_id
    const passedVendorEmail = body.vendor_email
    const passedVendorName = body.vendor_name

    if (!customer_id) {
      return new Response(JSON.stringify({ error: 'customer_id is required' }), {
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
      return new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: callerProfile } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', user.id)
      .maybeSingle()
    if (!['admin', 'sales', 'office'].includes(String(callerProfile?.user_type || '').toLowerCase())) {
      return new Response(JSON.stringify({ error: 'Only Admin or Office can send Material Delivery emails' }), {
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
      return new Response(JSON.stringify({ error: 'Lead not found', details: leadError }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Resolve vendor email
    let targetVendorEmail = passedVendorEmail
    let targetVendorName = passedVendorName || lead.vendor || 'Vendor'

    if (!targetVendorEmail && lead.vendor) {
      const { data: vendor } = await supabase
        .from('vendors')
        .select('name, email')
        .ilike('name', lead.vendor.trim())
        .maybeSingle()

      if (vendor?.email) {
        targetVendorEmail = vendor.email
        targetVendorName = vendor.name || targetVendorName
      }
    }

    if (!targetVendorEmail) {
      return new Response(JSON.stringify({ error: 'Vendor email not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 3. Build the email body from lead data
    const rows = [
      ['Customer Name', lead.customer_name],
      ['Phone Number', lead.phone_number],
      ['Email', lead.email],
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
          `<tr><td style="padding:6px 12px;border:1px solid #e5e5e5;font-weight:600;background:#fafafa;">${label}</td><td style="padding:6px 12px;border:1px solid #e5e5e5;">${value}</td></tr>`
      )
      .join('')

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#333;">Material Delivery Assigned: ${lead.customer_name || 'N/A'}</h2>
        <table style="border-collapse:collapse;width:100%;">${rows}</table>
        <p>Please log in to the Vendor Portal to review the delivery and installation work.</p>
      </div>
    `

    // 4. Send via Brevo transactional email API
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
      return new Response(JSON.stringify({ error: 'Brevo send failed', details: errText }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: true, sent_to: targetVendorEmail }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
