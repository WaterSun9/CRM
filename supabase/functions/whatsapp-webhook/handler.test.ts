// supabase/functions/whatsapp-webhook/handler.test.ts
// Run: deno test --allow-env supabase/functions/whatsapp-webhook/handler.test.ts

import assert from 'node:assert/strict'
import { inboundFields, metaTime, readBody, sameText, signatureOk, statusError } from './handler.ts'

const hmacHex = async (secret: string, body: string) => {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))), b => b.toString(16).padStart(2, '0')).join('')
}

Deno.test('signatureOk checks the HMAC of the raw body', async () => {
  const body = '{"object":"whatsapp_business_account","entry":[]}'
  const raw = new TextEncoder().encode(body)
  const good = await hmacHex('app-secret', body)
  assert.equal(await signatureOk('app-secret', raw, `sha256=${good}`), true)
  assert.equal(await signatureOk('app-secret', raw, `sha256=${good.toUpperCase()}`), true)
  assert.equal(await signatureOk('other-secret', raw, `sha256=${good}`), false)
  assert.equal(await signatureOk('app-secret', new TextEncoder().encode(body + ' '), `sha256=${good}`), false)
  assert.equal(await signatureOk('app-secret', raw, good), false)
  assert.equal(await signatureOk('app-secret', raw, `sha1=${good}`), false)
  assert.equal(await signatureOk('app-secret', raw, null), false)
  assert.equal(await signatureOk('', raw, `sha256=${good}`), false)
})

Deno.test('sameText', () => {
  assert.equal(sameText('abc', 'abc'), true)
  assert.equal(sameText('abc', 'abd'), false)
  assert.equal(sameText('abc', 'abcd'), false)
})

Deno.test('metaTime reads Unix seconds, else now', () => {
  assert.equal(metaTime('1760263200'), '2025-10-12T10:00:00.000Z')
  const now = Date.parse('2026-10-12T10:00:00Z')
  assert.equal(metaTime(undefined, now), '2026-10-12T10:00:00.000Z')
  assert.equal(metaTime('abc', now), '2026-10-12T10:00:00.000Z')
  // Far future (would make toISOString throw) or more than a day ahead -> now.
  assert.equal(metaTime('99999999999999999', now), '2026-10-12T10:00:00.000Z')
  assert.equal(metaTime('1e300', now), '2026-10-12T10:00:00.000Z')
  assert.equal(metaTime(String(now / 1000 + 2 * 86400), now), '2026-10-12T10:00:00.000Z')
})

Deno.test('readBody stops at the cap even without a Content-Length', async () => {
  let pulled = 0
  const endless = new ReadableStream({ pull(c) { pulled++; c.enqueue(new Uint8Array(64 * 1024)) } })
  assert.equal(await readBody(new Request('http://x', { method: 'POST', body: endless }), 1024 * 1024), null)
  assert.ok(pulled <= 20, `pulled ${pulled} chunks`)
  const small = await readBody(new Request('http://x', { method: 'POST', body: 'hello' }), 10)
  assert.equal(new TextDecoder().decode(small!), 'hello')
  assert.equal((await readBody(new Request('http://x', { method: 'POST', body: 'x'.repeat(11) }), 10)), null)
  assert.equal((await readBody(new Request('http://x', { method: 'POST' }), 10))?.length, 0)
})

Deno.test('statusError keeps the first error', () => {
  assert.equal(statusError(undefined), null)
  assert.deepEqual(statusError([{ code: 131026, title: 'Message undeliverable', error_data: { details: 'Message Undeliverable.' } }]),
    { code: 131026, text: 'Meta 131026: Message undeliverable: Message Undeliverable.' })
  assert.deepEqual(statusError([{ code: 131047, title: 'Re-engagement message', message: 'Re-engagement message' }]),
    { code: 131047, text: 'Meta 131047: Re-engagement message' })
  assert.equal(statusError([{ title: 'x'.repeat(900) }])?.text.length, 500)
  // A code or phone number quoted by Meta never reaches the log; the error number stays.
  assert.deepEqual(statusError([{ code: 131000, title: 'Failed', error_data: { details: 'Param 482913 for 919876543210 (#131000)' } }]),
    { code: 131000, text: 'Meta 131000: Failed: Param ****** for ****** (#******)' })
})

Deno.test('inboundFields reads text, quick replies and captions', () => {
  const text = inboundFields({ from: '919876543210', id: 'wamid.A', timestamp: '1760263200', type: 'text', text: { body: 'Panel is not working' } })
  assert.deepEqual(text, { wamid: 'wamid.A', phone: '9876543210', fromPhone: '9876543210', type: 'text', body: 'Panel is not working', buttonText: null, contextWamid: null })
  const button = inboundFields({ from: '919876543210', id: 'wamid.B', type: 'button', button: { text: 'Not solved', payload: 'Not solved' }, context: { from: '15550000000', id: 'wamid.OUT' } })
  assert.deepEqual([button.body, button.buttonText, button.contextWamid], ['Not solved', 'Not solved', 'wamid.OUT'])
  const interactive = inboundFields({ from: '919876543210', id: 'wamid.C', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'y', title: 'Yes, solved' } } })
  assert.deepEqual([interactive.body, interactive.buttonText], ['Yes, solved', 'Yes, solved'])
  const image = inboundFields({ from: '447700900123', id: 'wamid.D', type: 'image', image: { id: 'm1', caption: 'Broken wire' } })
  assert.deepEqual([image.phone, image.fromPhone, image.body], [null, '447700900123', 'Broken wire'])
  const long = inboundFields({ from: '919876543210', id: 'wamid.E', type: 'text', text: { body: 'x'.repeat(5000) } })
  assert.equal(long.body?.length, 4000)
  const odd = inboundFields({ id: 'wamid.F' })
  assert.deepEqual([odd.type, odd.fromPhone, odd.body], ['unknown', '', null])
})
