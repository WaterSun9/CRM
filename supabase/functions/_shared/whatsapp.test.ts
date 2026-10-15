// supabase/functions/_shared/whatsapp.test.ts
// Run: deno test --allow-env supabase/functions/_shared/whatsapp.test.ts

import assert from 'node:assert/strict'
import {
  cleanPhone, env, graphBase, maskPhone, metaFailure, networkFailure, paramValues, redactText, templateParam,
  waEnabled, waReady,
} from './whatsapp.ts'

const withEnv = (values: Record<string, string | null>, fn: () => void) => {
  const before = Object.fromEntries(Object.keys(values).map(k => [k, Deno.env.get(k) ?? null]))
  const apply = (v: Record<string, string | null>) => {
    for (const [k, x] of Object.entries(v)) x === null ? Deno.env.delete(k) : Deno.env.set(k, x)
  }
  apply(values)
  try { fn() } finally { apply(before) }
}

Deno.test('env trims pasted secrets; WA_ENABLED is case-insensitive', () => {
  withEnv({ WA_ENABLED: ' TRUE\n', WA_TOKEN: '  tok \n', WA_PHONE_NUMBER_ID: ' 123 ' }, () => {
    assert.equal(env('WA_TOKEN'), 'tok')
    assert.equal(waEnabled(), true)
    assert.equal(waReady(), true)
  })
  withEnv({ WA_ENABLED: 'yes', WA_TOKEN: 'tok', WA_PHONE_NUMBER_ID: '  ' }, () => {
    assert.equal(waEnabled(), false)
    assert.equal(waReady(), false)
  })
  withEnv({ WA_ENABLED: null, WA_TOKEN: null, WA_PHONE_NUMBER_ID: null }, () => {
    assert.equal(env('WA_ENABLED'), '')
    assert.equal(waEnabled(), false)
    assert.equal(waReady(), false)
  })
})

Deno.test('cleanPhone keeps 10-digit Indian mobiles only', () => {
  assert.equal(cleanPhone('+91 98765-43210'), '9876543210')
  assert.equal(cleanPhone('09876543210'), '9876543210')
  assert.equal(cleanPhone('919876543210'), '9876543210')
  assert.equal(cleanPhone('+91 09876543210'), '9876543210')
  assert.equal(cleanPhone(9876543210), '9876543210')
  assert.equal(cleanPhone('5876543210'), null)
  assert.equal(cleanPhone('98765 4321'), null)
  assert.equal(cleanPhone('447700900123'), null)
  assert.equal(cleanPhone(''), null)
  assert.equal(cleanPhone(undefined), null)
})

Deno.test('maskPhone and templateParam', () => {
  assert.equal(maskPhone('9876543210'), '******3210')
  assert.equal(templateParam('  Ramesh\n\tPatel     Bhai '), 'Ramesh Patel Bhai')
  assert.equal(templateParam(''), '-')
  assert.equal(templateParam(null), '-')
  assert.equal(templateParam(3.3), '3.3')
  assert.equal(templateParam('x'.repeat(300)).length, 200)
})

Deno.test('metaFailure maps Meta error codes to plain messages', () => {
  const meta = (code: number, extra = {}) => ({ error: { code, message: `(#${code}) problem`, ...extra } })
  const notOn = metaFailure(meta(131026), 400)
  assert.deepEqual([notOn.code, notOn.metaCode, notOn.error], ['not_on_whatsapp', 131026, 'This number is not on WhatsApp.'])
  assert.equal(metaFailure(meta(131042), 400).code, 'billing')
  const token = metaFailure(meta(190, { error_subcode: 463 }), 401)
  assert.deepEqual([token.code, token.metaCode], ['token', 190])
  assert.match(token.detail, /^Meta 190\/463: \(#190\) problem$/)
  const test = metaFailure(meta(131030, { error_data: { details: 'Recipient phone number not in allowed list' } }), 400)
  assert.equal(test.code, 'send_failed')
  assert.match(test.error, /test list/)
  assert.match(test.detail, /allowed list$/)
  assert.match(metaFailure(meta(132001), 404).error, /not approved by Meta/)
  assert.match(metaFailure(meta(133010), 400).error, /not registered/)
  assert.match(metaFailure(meta(100), 400).error, /try again in a minute/i)
  const empty = metaFailure(null, 502)
  assert.deepEqual([empty.code, empty.metaCode, empty.detail], ['send_failed', null, 'Meta HTTP 502'])
  assert.equal(metaFailure({ error: { code: 1, message: 'x'.repeat(900) } }, 400).detail.length, 500)
  const net = networkFailure('timed out')
  assert.deepEqual([net.code, net.metaCode, net.detail], ['send_failed', null, 'Network: timed out'])
})

Deno.test('redactText hides secrets but keeps the Meta error number', () => {
  assert.equal(redactText('Meta 131009: bad value 482913 in body', ['482913']), 'Meta 131009: bad value ****** in body')
  // A code that happens to equal the error number is still hidden in the text, not in the label.
  assert.equal(redactText('Meta 131026: 131026 is not valid', ['131026']), 'Meta 131026: ****** is not valid')
  assert.equal(redactText('Ramesh Patel and Ramesh', ['Ramesh', 'Ramesh Patel']), '****** and ******')
  assert.equal(redactText('nothing here', []), 'nothing here')
  assert.equal(redactText('Network: x', ['', null]), 'Network: x')
})

Deno.test('paramValues collects template values worth hiding', () => {
  const values = paramValues([
    { type: 'header', parameters: [{ type: 'document', document: { id: '1', filename: 'Quotation Q-1023.pdf' } }] },
    { type: 'body', parameters: [{ type: 'text', text: 'Ramesh Patel' }, { type: 'text', text: '1001' }, { type: 'text', text: '5' }, { type: 'text', text: '9876543210' }] },
    { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: '482913' }] },
    { type: 'body' },
  ])
  assert.deepEqual(values, ['Quotation Q-1023.pdf', 'Ramesh Patel', '9876543210', '482913'])
  assert.deepEqual(paramValues(null as unknown as unknown[]), [])
})

Deno.test('graphBase only allows a local test server', () => {
  withEnv({ WA_GRAPH_BASE: null }, () => assert.equal(graphBase(), 'https://graph.facebook.com'))
  withEnv({ WA_GRAPH_BASE: 'http://127.0.0.1:9999/' }, () => assert.equal(graphBase(), 'http://127.0.0.1:9999'))
  withEnv({ WA_GRAPH_BASE: 'http://localhost:8080' }, () => assert.equal(graphBase(), 'http://localhost:8080'))
  const quiet = console.error
  console.error = () => {}
  try {
    withEnv({ WA_GRAPH_BASE: 'https://evil.example' }, () => assert.equal(graphBase(), 'https://graph.facebook.com'))
    withEnv({ WA_GRAPH_BASE: 'http://localhost.evil.example' }, () => assert.equal(graphBase(), 'https://graph.facebook.com'))
    withEnv({ WA_GRAPH_BASE: 'not a url' }, () => assert.equal(graphBase(), 'https://graph.facebook.com'))
  } finally {
    console.error = quiet
  }
})
