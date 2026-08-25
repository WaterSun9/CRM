// supabase/functions/send-lead-to-vendor/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = ['https://watersun9.github.io', 'http://localhost:5173', 'http://localhost:3000']

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
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
        .eq('name', lead.vendor)
        .maybeSingle()

      if (vendor?.email) {
        targetVendorEmail = vendor.email
        targetVendorName = vendor.name || targetVendorName
      }
    }

    if (!targetVendorEmail) {
      targetVendorEmail = 'deeproot120@gmail.com'
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
    ]
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(
        ([label, value]) =>
          `<tr><td style="padding:6px 12px;border:1px solid #e5e5e5;font-weight:600;background:#fafafa;">${label}</td><td style="padding:6px 12px;border:1px solid #e5e5e5;">${value}</td></tr>`
      )
      .join('')

    const htmlContent = `
      <div style="font-family:Arial,sans-serif;max-width:600px;">
        <h2 style="color:#333;">New Lead Assigned: ${lead.customer_name || 'N/A'}</h2>
        <table style="border-collapse:collapse;width:100%;">${rows}</table>
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
        sender: { name: 'Deeproot Systems', email: Deno.env.get('SENDER_EMAIL') || 'deeproot120@gmail.com' },
        to: [{ email: targetVendorEmail, name: targetVendorName }],
        subject: `New Lead: ${lead.customer_name || 'Unnamed'} (${lead.folder_no || 'No Folder No'})`,
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
