#!/usr/bin/env node
// scripts/whatsapp_templates.mjs
//
// Creates the WhatsApp message templates from supabase/whatsapp/templates.json on one
// WhatsApp Business Account (Meta Cloud API, no BSP). It lists what is already there and
// creates only the missing ones, so it is safe to run again: once on Meta's test account
// and once on the real one. Plain node 18+, no npm packages.
//
//   node scripts/whatsapp_templates.mjs --dry-run        check the file, print the payloads (no network, no env needed)
//   node scripts/whatsapp_templates.mjs                  list templates, create the missing ones
//   node scripts/whatsapp_templates.mjs --sample-pdf ~/Desktop/sample-quotation.pdf
//
// Environment (set in the terminal for this run only; never commit them, never paste them in chat):
//   WA_TOKEN          system user token with whatsapp_business_management
//   WA_WABA_ID        WhatsApp Business Account ID (App Dashboard > WhatsApp > API Setup)
//   WA_APP_ID         App ID (top of the App Dashboard). Only needed for watersun_quotation, see below.
//   WA_GRAPH_VERSION  optional, default v23.0 (same as the edge functions)
// The token and the ids are never printed; Meta error text has them masked.
//
// Why WA_APP_ID: Meta only accepts a template with a DOCUMENT header (watersun_quotation)
// together with a sample file handle from its Resumable Upload API
// (POST /{app-id}/uploads, then POST the bytes to the upload session). The script does
// this itself with a one-page sample PDF it makes in memory, or the file given with
// --sample-pdf (a dummy quotation only: Meta's reviewers see it, so no real customer).
// That keeps the wording identical to templates.json. Without WA_APP_ID the quotation
// template is skipped and the script prints how to create it by hand in WhatsApp Manager.
//
// Body values must stay in the order the edge functions send them:
//   service_completed_confirm  service-otp            customer name, technician name, ticket no, warranty text
//   watersun_vendor_lead       send-lead-to-vendor    vendor name, customer name, customer phone, address, system kW, file no.
//   watersun_quotation         whatsapp-send-quotation customer name, quotation label (Quote-1023), capacity kW, valid until (11 Oct 2026)
//   watersun_service_code      service-otp            the code (Meta fixes the text)
// Changing a template's text or values later means a new Meta review; change the function in the same release.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const TEMPLATES_FILE = new URL('../supabase/whatsapp/templates.json', import.meta.url)
const EXPECTED_BODY_VALUES = { service_completed_confirm: 4, watersun_vendor_lead: 6, watersun_quotation: 4 }
const EXPECTED_NAMES = ['watersun_service_code', ...Object.keys(EXPECTED_BODY_VALUES)]
const MAX_SAMPLE_BYTES = 10 * 1024 * 1024

// Secrets pasted into a terminal often carry a stray space or new line.
const env = name => (process.env[name] || '').trim()

// ---------- arguments ----------

function parseArgs(argv) {
  const opts = { dryRun: false, samplePdf: '', help: false }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') opts.dryRun = true
    else if (arg === '--help' || arg === '-h') opts.help = true
    else if (arg === '--sample-pdf') {
      opts.samplePdf = argv[++i] || ''
      if (!opts.samplePdf) throw new Error('--sample-pdf needs a file path')
    } else throw new Error(`Unknown option ${arg}. Use --dry-run, --sample-pdf <file> or --help.`)
  }
  return opts
}

// ---------- checks on templates.json (run before anything is sent) ----------

const VAR_RE = /\{\{\s*([^{}]*?)\s*\}\}/g
const findComponent = (t, type) => (t.components || []).find(c => String(c.type).toUpperCase() === type)

// Meta's review rules, plus the usual reasons for a rejection, checked here so a typo does
// not cost a review round: numbered values {{1}}..{{n}} used once each, no value at the very
// start or end, no two values side by side, enough fixed words per value, matching examples.
function checkBody(name, body, problems) {
  const text = String(body?.text || '')
  if (!text) return problems.push(`${name}: BODY text is missing`)
  if (text.length > 1024) problems.push(`${name}: BODY is ${text.length} characters (Meta allows 1024)`)
  const vars = [...text.matchAll(VAR_RE)].map(m => m[1])
  if (vars.some(v => !/^\d+$/.test(v))) problems.push(`${name}: values must be numbered like {{1}}`)
  const nums = vars.map(Number)
  if (nums.some((n, i) => n !== i + 1)) problems.push(`${name}: values must be {{1}}, {{2}}, ... in order, each used once`)
  if (/^[\s\p{P}]*\{\{/u.test(text)) problems.push(`${name}: BODY must not start with a value`)
  if (/\}\}[\s\p{P}]*$/u.test(text)) problems.push(`${name}: BODY must not end with a value`)
  if (/\}\}[\s\p{P}]*\{\{/u.test(text)) problems.push(`${name}: two values are side by side; put words between them`)
  const words = text.replace(VAR_RE, ' ').split(/\s+/).filter(w => /[A-Za-z0-9]/.test(w)).length
  if (words < 3 * vars.length + 1) problems.push(`${name}: ${words} fixed words for ${vars.length} values; Meta rejects value-heavy messages`)
  const example = body?.example?.body_text?.[0]
  if (vars.length && (!Array.isArray(example) || example.length !== vars.length || example.some(v => typeof v !== 'string' || !v.trim()))) {
    problems.push(`${name}: example.body_text must be [[${vars.length} sample values]]`)
  }
  const expected = EXPECTED_BODY_VALUES[name]
  if (expected !== undefined && vars.length !== expected) {
    problems.push(`${name}: has ${vars.length} values but the edge function sends ${expected}`)
  }
}

function checkTemplate(t) {
  const problems = []
  const name = String(t?.name || '?')
  if (!/^[a-z0-9_]{1,512}$/.test(name)) problems.push(`${name}: name must be lowercase letters, digits and _`)
  if (!t.language) problems.push(`${name}: language is missing`)
  const category = String(t.category || '').toUpperCase()
  if (!['AUTHENTICATION', 'UTILITY', 'MARKETING'].includes(category)) problems.push(`${name}: category must be AUTHENTICATION, UTILITY or MARKETING`)

  if (category === 'AUTHENTICATION') {
    // Meta writes the text itself ("482913 is your verification code."); only the options are ours.
    const body = findComponent(t, 'BODY')
    const footer = findComponent(t, 'FOOTER')
    const button = findComponent(t, 'BUTTONS')?.buttons?.[0]
    if (!body || body.text) problems.push(`${name}: an AUTHENTICATION BODY has no text, only add_security_recommendation`)
    const minutes = Number(footer?.code_expiration_minutes)
    if (!(minutes >= 1 && minutes <= 90)) problems.push(`${name}: FOOTER code_expiration_minutes must be 1-90`)
    if (String(button?.type).toUpperCase() !== 'OTP' || String(button?.otp_type).toUpperCase() !== 'COPY_CODE') {
      problems.push(`${name}: needs one OTP button with otp_type COPY_CODE`)
    }
    const ttl = Number(t.message_send_ttl_seconds)
    if (t.message_send_ttl_seconds !== undefined && !(ttl >= 30 && ttl <= 900)) problems.push(`${name}: message_send_ttl_seconds must be 30-900`)
    return problems
  }

  checkBody(name, findComponent(t, 'BODY'), problems)
  const header = findComponent(t, 'HEADER')
  if (header && String(header.format).toUpperCase() === 'DOCUMENT' && header.example?.header_handle?.length !== 1) {
    problems.push(`${name}: a DOCUMENT header needs example.header_handle with one entry (filled in at run time)`)
  }
  for (const b of findComponent(t, 'BUTTONS')?.buttons || []) {
    if (String(b.type).toUpperCase() === 'QUICK_REPLY' && !(b.text && b.text.length <= 25)) {
      problems.push(`${name}: quick reply "${b.text}" must be 1-25 characters`)
    }
  }
  return problems
}

function loadTemplates() {
  const list = JSON.parse(readFileSync(TEMPLATES_FILE, 'utf8'))
  if (!Array.isArray(list)) throw new Error('templates.json must be an array')
  const problems = list.flatMap(checkTemplate)
  const names = list.map(t => t?.name)
  for (const n of EXPECTED_NAMES) if (!names.includes(n)) problems.push(`${n}: missing from templates.json`)
  if (new Set(names).size !== names.length) problems.push('templates.json has the same name twice')
  return { list, problems }
}

const hasDocumentHeader = t => String(findComponent(t, 'HEADER')?.format || '').toUpperCase() === 'DOCUMENT'
const bodyValueCount = t => [...String(findComponent(t, 'BODY')?.text || '').matchAll(VAR_RE)].length

// ---------- sample PDF for the document header ----------

// One A4 page with one line of Helvetica text, built by hand so no PDF library is needed.
function samplePdf() {
  const line = 'Watersun Solar - sample quotation for WhatsApp template review'
  const stream = `BT /F1 16 Tf 50 780 Td (${line}) Tj ET`
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = objects.map((obj, i) => {
    const at = pdf.length
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`
    return at
  })
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  pdf += offsets.map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return { bytes: new Uint8Array(Buffer.from(pdf, 'latin1')), fileName: 'watersun-sample-quotation.pdf' }
}

function readSamplePdf(path) {
  const bytes = new Uint8Array(readFileSync(path))
  if (bytes.length > MAX_SAMPLE_BYTES) throw new Error('The sample PDF is bigger than 10 MB')
  if (Buffer.from(bytes.subarray(0, 5)).toString('latin1') !== '%PDF-') throw new Error('The --sample-pdf file is not a PDF')
  return { bytes, fileName: basename(path) }
}

// ---------- Graph API ----------

class MetaError extends Error {
  constructor(status, payload) {
    const e = payload?.error || {}
    const code = Number(e.code) || null
    const sub = Number(e.error_subcode) || null
    const text = [e.error_user_title, e.error_user_msg || e.message].filter(Boolean).join(': ') || `HTTP ${status}`
    super(`Meta ${code ?? `HTTP ${status}`}${sub ? `/${sub}` : ''}: ${text}`)
    this.code = code
    this.subcode = sub
  }
}

function makeGraph({ token, version, wabaId, appId }) {
  const base = `https://graph.facebook.com/${version}`
  // Meta's messages can quote an id back; mask everything that came from the environment.
  const mask = value => {
    let s = String(value)
    for (const [secret, label] of [[token, '***'], [wabaId, '<WA_WABA_ID>'], [appId, '<WA_APP_ID>']]) {
      if (secret) s = s.split(secret).join(label)
    }
    return s
  }
  // The upload step wants "OAuth <token>" instead of "Bearer <token>".
  async function call(method, pathOrUrl, { body, headers = {}, json, scheme = 'Bearer' } = {}) {
    const url = pathOrUrl.startsWith('https://') ? pathOrUrl : `${base}/${pathOrUrl}`
    // The token only ever goes to Meta, even if a paging link pointed elsewhere.
    if (!url.startsWith('https://graph.facebook.com/')) throw new Error('Refusing to call a non-Meta URL')
    const res = await fetch(url, {
      method,
      headers: { Authorization: `${scheme} ${token}`, ...(json ? { 'Content-Type': 'application/json' } : {}), ...headers },
      body: json ? JSON.stringify(json) : body,
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok || data?.error) throw new MetaError(res.status, data)
    return data
  }
  return { call, mask }
}

async function listTemplates(graph, wabaId) {
  const found = []
  let next = `${wabaId}/message_templates?fields=name,language,status,category,components&limit=200`
  for (let page = 0; next && page < 20; page++) {
    const data = await graph.call('GET', next)
    found.push(...(data?.data || []))
    next = data?.paging?.next || ''
  }
  return found
}

// Resumable Upload API: start a session on the app, send the bytes, get back the handle "4::...".
async function uploadSample(graph, appId, { bytes, fileName }) {
  const query = new URLSearchParams({ file_name: fileName, file_length: String(bytes.length), file_type: 'application/pdf' })
  const session = await graph.call('POST', `${appId}/uploads?${query}`)
  const sessionId = String(session?.id || '')
  // The id already carries its own "?sig=..." part, so it is used as it is.
  if (!sessionId.startsWith('upload:')) throw new Error('Meta did not start the sample PDF upload')
  const done = await graph.call('POST', sessionId, { body: bytes, scheme: 'OAuth', headers: { file_offset: '0' } })
  if (!done?.h) throw new Error('Meta did not return a handle for the sample PDF')
  return String(done.h)
}

const withHandle = (t, handle) => ({
  ...t,
  components: t.components.map(c => (String(c.type).toUpperCase() === 'HEADER' ? { ...c, example: { header_handle: [handle] } } : c)),
})

const sameText = (a, b) => String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim()

const MANUAL_QUOTATION_STEPS = [
  'Create it by hand instead (WhatsApp Manager > Message templates > Create template):',
  '  Category Utility, name watersun_quotation, language English (US).',
  '  Header: Document. Body: copy the text from supabase/whatsapp/templates.json exactly.',
  '  Variable samples: the example values from the same file. Upload a dummy PDF (no real customer). Submit.',
  'Or set WA_APP_ID and run this script again.',
]

// A next step for the usual setup mistakes, printed under Meta's own message.
function hint(error) {
  if (error?.code === 190) return 'The token is wrong or expired. Make a new system user token.'
  if ((error?.code === 100 && error?.subcode === 33) || error?.code === 10 || error?.code === 200) {
    return 'Check WA_WABA_ID / WA_APP_ID, and that the system user has Full control of this WhatsApp account and the app.'
  }
  if (error?.code === 80008 || error?.code === 4) return 'Meta rate limit. Wait an hour and run again.'
  return ''
}
const withHint = error => [error?.message, hint(error)].filter(Boolean).join('\n  ')

// ---------- main ----------

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    console.log('Usage: node scripts/whatsapp_templates.mjs [--dry-run] [--sample-pdf <file>]\nSee the comment at the top of this file.')
    return 0
  }

  const { list, problems } = loadTemplates()
  if (problems.length) {
    console.error('templates.json has problems, nothing was sent:')
    for (const p of problems) console.error(`  - ${p}`)
    return 1
  }
  console.log(`templates.json: ${list.length} templates, all checks passed.`)

  if (opts.dryRun) {
    for (const t of list) {
      const extra = hasDocumentHeader(t) ? ', header_handle is uploaded at run time' : ''
      console.log(`\n--- ${t.name} (${t.category}, ${bodyValueCount(t)} body values${extra})`)
      console.log(JSON.stringify(t, null, 2))
    }
    console.log('\nDry run: nothing was sent to Meta.')
    return 0
  }

  const token = env('WA_TOKEN')
  const wabaId = env('WA_WABA_ID')
  const appId = env('WA_APP_ID')
  const version = env('WA_GRAPH_VERSION').replace(/^v?(?=\d)/i, 'v') || 'v23.0'
  const missing = [!token && 'WA_TOKEN', !wabaId && 'WA_WABA_ID'].filter(Boolean)
  if (missing.length) {
    console.error(`Set ${missing.join(' and ')} first (see docs/WHATSAPP_DEV_SETUP.md). Use --dry-run to only check the file.`)
    return 1
  }
  if (!/^\d+$/.test(wabaId)) { console.error('WA_WABA_ID must be digits only.'); return 1 }
  if (appId && !/^\d+$/.test(appId)) { console.error('WA_APP_ID must be digits only.'); return 1 }
  if (!/^v\d+\.\d+$/.test(version)) { console.error('WA_GRAPH_VERSION must look like v23.0.'); return 1 }
  // Read the sample before any network call, so a wrong path fails early.
  const sample = opts.samplePdf ? readSamplePdf(opts.samplePdf) : null

  const graph = makeGraph({ token, version, wabaId, appId })
  let failures = 0

  let existing
  try {
    existing = await listTemplates(graph, wabaId)
  } catch (error) {
    console.error(`Could not list templates.\n  ${graph.mask(withHint(error))}`)
    return 1
  }
  console.log(`\nTemplates already on this account: ${existing.length}`)
  for (const e of existing) console.log(`  ${e.name}  ${e.language}  ${e.status}  ${e.category}`)
  console.log('')

  for (const t of list) {
    const have = existing.find(e => e.name === t.name && e.language === t.language)
    if (have) {
      console.log(`${t.name}: already there (${have.status}, ${have.category})`)
      if (have.status === 'REJECTED') console.log('  Rejected: open it in WhatsApp Manager, fix the text to match templates.json and submit again.')
      if (String(t.category).toUpperCase() !== 'AUTHENTICATION'
        && !sameText(findComponent(have, 'BODY')?.text, findComponent(t, 'BODY')?.text)) {
        console.log('  Warning: its text is not the same as templates.json. The CRM sends values for the text in templates.json.')
      }
      continue
    }
    try {
      let payload = t
      if (hasDocumentHeader(t)) {
        if (!appId) {
          failures++
          console.log(`${t.name}: SKIPPED. A document header needs a sample PDF uploaded with WA_APP_ID set.`)
          for (const line of MANUAL_QUOTATION_STEPS) console.log(`  ${line}`)
          continue
        }
        payload = withHandle(t, await uploadSample(graph, appId, sample || samplePdf()))
      }
      const made = await graph.call('POST', `${wabaId}/message_templates`, { json: payload })
      console.log(`${t.name}: created, status ${made?.status || '?'}, category ${made?.category || '?'}`)
      if (made?.category && String(made.category).toUpperCase() !== String(t.category).toUpperCase()) {
        console.log(`  Meta put it under ${made.category}, not ${t.category}. That changes the price per message; tell the owner.`)
      }
    } catch (error) {
      failures++
      console.log(`${t.name}: NOT created.\n  ${graph.mask(withHint(error))}`)
    }
  }

  console.log(failures
    ? `\n${failures} template(s) not created. Fix the reason above and run again; existing ones are left alone.`
    : '\nDone. Run again later to see the review status (PENDING -> APPROVED).')
  return failures ? 1 : 0
}

main().then(code => { process.exitCode = code }).catch(error => {
  const token = env('WA_TOKEN')
  const message = String(error?.message || error)
  console.error(token ? message.split(token).join('***') : message)
  process.exitCode = 1
})
