// supabase/functions/service-otp/helpers.test.ts
// Run: deno test supabase/functions/service-otp/helpers.test.ts

import assert from 'node:assert/strict'
import {
  PHOTO_KINDS, PHOTOS_NEEDED, cleanPhone, formatDateShort, hashCode, jobFailure, maskPhone, metaFailure, networkFailure,
  photosReady, randomCode, randomHex, sameHex, sendWait, sha256Hex, templateParam, todayIST, warrantyText,
} from './helpers.ts'

Deno.test('cleanPhone keeps 10-digit Indian mobiles only', () => {
  assert.equal(cleanPhone('+91 98765-43210'), '9876543210')
  assert.equal(cleanPhone('09876543210'), '9876543210')
  assert.equal(cleanPhone('919876543210'), '9876543210')
  assert.equal(cleanPhone('+91 09876543210'), '9876543210')
  assert.equal(cleanPhone('5876543210'), null)
  assert.equal(cleanPhone('12345'), null)
  assert.equal(cleanPhone(null), null)
})

Deno.test('maskPhone shows the last 4 digits only', () => {
  assert.equal(maskPhone('9876543210'), '******3210')
})

Deno.test('randomCode is always 6 digits', () => {
  for (let i = 0; i < 2000; i++) assert.match(randomCode(), /^\d{6}$/)
  assert.match(randomHex(16), /^[0-9a-f]{32}$/)
})

Deno.test('hashCode is SHA-256 of salt:issue:code', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  const issueId = '11111111-2222-3333-4444-555555555555'
  const hash = await hashCode('aa', issueId, '012345')
  assert.equal(hash, await sha256Hex(`aa:${issueId}:012345`))
  assert.notEqual(hash, await hashCode('aa', issueId, '012346'))
  assert.notEqual(hash, await hashCode('aa', '11111111-2222-3333-4444-555555555556', '012345'))
})

Deno.test('sameHex compares exactly, ignoring case', () => {
  assert.equal(sameHex('abc123', 'abc123'), true)
  assert.equal(sameHex('ABC123', 'abc123'), true)
  assert.equal(sameHex('abc123', 'abc124'), false)
  assert.equal(sameHex('abc12', 'abc123'), false)
  assert.equal(sameHex('', ''), true)
})

Deno.test('sendWait: 2 min cooldown, then 2 codes per hour', () => {
  const now = Date.parse('2026-10-12T10:00:00Z')
  const ago = (s: number) => new Date(now - s * 1000).toISOString()
  assert.equal(sendWait([], now), null)
  assert.equal(sendWait([ago(121)], now), null)
  const cool = sendWait([ago(10)], now)
  assert.equal(cool?.code, 'cooldown')
  assert.equal(cool?.retryAfterSeconds, 110)
  const limit = sendWait([ago(200), ago(3000)], now)
  assert.equal(limit?.code, 'limit')
  assert.equal(limit?.retryAfterSeconds, 600)
  assert.match(String(limit?.error), /Only 2 codes/)
  assert.match(String(limit?.error), /10 minutes/)
  assert.equal(sendWait([ago(200), ago(3700)], now), null)
})

Deno.test('photosReady needs at least one Before and one After photo', () => {
  assert.deepEqual([...PHOTO_KINDS], ['before', 'after'])
  assert.equal(photosReady({ before: 0, after: 0 }), false)
  assert.equal(photosReady({ before: 3, after: 0 }), false)
  assert.equal(photosReady({ before: 0, after: 2 }), false)
  assert.equal(photosReady({ before: 1, after: 1 }), true)
  assert.equal(photosReady({ before: 10, after: 10 }), true)
  // A count that did not come back is never taken as "photos are there".
  assert.equal(photosReady({ before: null, after: 1 }), false)
  assert.equal(photosReady({ before: 1, after: undefined }), false)
  assert.deepEqual({ ...PHOTOS_NEEDED }, {
    ok: false, code: 'photos_needed', error: 'Add at least one Before photo and one After photo first.',
  })
})

Deno.test('metaFailure maps the Meta error codes', () => {
  const meta = (code: number, extra = {}) => ({ error: { code, message: `(#${code}) problem`, ...extra } })
  assert.equal(metaFailure(meta(131026), 400).code, 'not_on_whatsapp')
  assert.equal(metaFailure(meta(131042), 400).code, 'billing')
  const token = metaFailure(meta(190, { error_subcode: 463 }), 401)
  assert.equal(token.code, 'token')
  assert.equal(token.metaCode, 190)
  assert.match(token.detail, /^Meta 190\/463: /)
  const other = metaFailure(meta(131030, { error_data: { details: 'Recipient phone number not in allowed list' } }), 400)
  assert.equal(other.code, 'send_failed')
  assert.match(other.detail, /allowed list/)
  const empty = metaFailure(null, 502)
  assert.equal(empty.code, 'send_failed')
  assert.equal(empty.metaCode, null)
  assert.equal(empty.detail, 'Meta HTTP 502')
})

Deno.test('job messages for the technician stay as before', () => {
  const meta = (code: number) => metaFailure({ error: { code, message: `(#${code}) problem` } }, 400).error
  assert.equal(meta(131026), 'This number is not on WhatsApp. Ask the office to close this job.')
  assert.equal(meta(131042), 'WhatsApp payment for Watersun is not set up. Ask the office to close this job.')
  assert.equal(meta(190), 'The CRM is not connected to WhatsApp any more. Ask the office to close this job.')
  assert.equal(meta(131030), 'This number is not on the WhatsApp test list. Ask the office to close this job.')
  assert.equal(meta(132001), 'The WhatsApp code message is not approved by Meta yet. Ask the office to close this job.')
  const generic = 'The code could not be sent on WhatsApp. Try again in a minute, or ask the office to close this job.'
  assert.equal(meta(100), generic)
  assert.equal(meta(133010), generic)
  assert.equal(networkFailure('reset').error, generic)
  assert.equal(networkFailure('reset').detail, 'Network: reset')
  // Failures from the shared sender (log not written, test number wrong) get the job wording too.
  assert.equal(jobFailure({ code: 'send_failed', error: 'x', metaCode: null, detail: 'Log: down' }).error, generic)
})

Deno.test('templateParam and warranty text', () => {
  assert.equal(templateParam('  Ramesh\n\tPatel     Bhai '), 'Ramesh Patel Bhai')
  assert.equal(templateParam(''), '-')
  assert.equal(templateParam(1001), '1001')
  assert.equal(formatDateShort('2031-10-11'), '11 Oct 2031')
  assert.equal(formatDateShort('2026-03-03'), '3 Mar 2026')
  assert.equal(formatDateShort('bad'), null)
  assert.equal(warrantyText('in_warranty', '2031-10-11', '2026-10-12'), 'valid until 11 Oct 2031')
  assert.equal(warrantyText('out_of_warranty', '2026-03-03', '2026-10-12'), 'ended on 3 Mar 2026')
  // Saved as in warranty, but it ended while the complaint was open.
  assert.equal(warrantyText('in_warranty', '2026-10-11', '2026-10-12'), 'ended on 11 Oct 2026')
  assert.equal(warrantyText('in_warranty', '2026-10-12', '2026-10-12'), 'valid until 12 Oct 2026')
  assert.equal(warrantyText('unknown', null), 'not recorded')
  assert.equal(warrantyText('in_warranty', null), 'not recorded')
  // 23:00 UTC on 11 Oct is already 12 Oct in India.
  assert.equal(todayIST(Date.parse('2026-10-11T23:00:00Z')), '2026-10-12')
})
