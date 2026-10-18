// supabase/functions/trip-distance/helpers.test.ts
// Run: deno test --no-config supabase/functions/trip-distance/helpers.test.ts

import assert from 'node:assert/strict'
import {
  FIELD_MASK, MAX_ANSWER_BYTES, MAX_ROUTE_KM, NOT_CONFIGURED, PER_USER_PER_DAY, ROUTES_BASE, TOTAL_PER_DAY, answerFor,
  checkRoute, dayStartIST, limitRefusal, networkOutcome, parseDurationSeconds, parseRequest, readJsonCapped, readPoint,
  redactKey, routeOutcome, routesBase, routesBody, shouldRetryWithDrive, straightKm,
} from './helpers.ts'

const A = { lat: 23.8312, lng: 71.6043 }
const B = { lat: 23.6, lng: 71.9 }

Deno.test('readPoint keeps points inside India only', () => {
  assert.deepEqual(readPoint(A), A)
  assert.deepEqual(readPoint({ lat: '23.8312', lng: ' 71.6043 ' }), A)
  assert.deepEqual(readPoint({ lat: 23.12345678, lng: 72.98765432 }), { lat: 23.123457, lng: 72.987654 })
  assert.deepEqual(readPoint({ lat: 6, lng: 98 }), { lat: 6, lng: 98 })
  assert.equal(readPoint({ lat: 71.6, lng: 23.8 }), null) // swapped
  assert.equal(readPoint({ lat: 51.5, lng: -0.12 }), null)
  assert.equal(readPoint({ lat: 5.99, lng: 72 }), null)
  assert.equal(readPoint({ lat: 23, lng: 98.01 }), null)
  assert.equal(readPoint({ lat: NaN, lng: 72 }), null)
  assert.equal(readPoint({ lat: Infinity, lng: 72 }), null)
  assert.equal(readPoint({ lat: '', lng: 72 }), null)
  assert.equal(readPoint({ lat: null, lng: 72 }), null)
  assert.equal(readPoint({ lat: '23abc', lng: 72 }), null)
  assert.equal(readPoint({ lat: true, lng: 72 }), null)
  assert.equal(readPoint([23, 72]), null)
  assert.equal(readPoint('23,72'), null)
  assert.equal(readPoint(null), null)
})

Deno.test('parseRequest: both points, travel mode defaults to two-wheeler', () => {
  assert.deepEqual(parseRequest({ origin: A, destination: B }), { ok: true, origin: A, destination: B, travelMode: 'TWO_WHEELER' })
  assert.deepEqual(parseRequest({ origin: A, destination: B, travelMode: 'DRIVE' }), { ok: true, origin: A, destination: B, travelMode: 'DRIVE' })
  assert.deepEqual(parseRequest({ origin: A, destination: B, travelMode: '' }), { ok: true, origin: A, destination: B, travelMode: 'TWO_WHEELER' })
  const bad = (body: unknown) => {
    const r = parseRequest(body)
    assert.equal(r.ok, false)
    return r.ok ? '' : r.error
  }
  assert.match(bad(null), /start and the customer/)
  assert.match(bad({ origin: A }), /start and the customer/)
  assert.match(bad({ origin: { lat: 99, lng: 72 }, destination: B }), /start location/)
  assert.match(bad({ origin: A, destination: { lat: 23 } }), /customer location/)
  assert.match(bad({ origin: A, destination: B, travelMode: 'WALK' }), /TWO_WHEELER or DRIVE/)
  assert.match(bad({ origin: A, destination: B, travelMode: 'drive' }), /TWO_WHEELER or DRIVE/)
})

Deno.test('routesBase: Google, or a test server on this computer only', () => {
  assert.deepEqual(routesBase(''), { base: ROUTES_BASE, ignored: false })
  assert.deepEqual(routesBase('http://127.0.0.1:9999/'), { base: 'http://127.0.0.1:9999', ignored: false })
  assert.deepEqual(routesBase('http://localhost:8000'), { base: 'http://localhost:8000', ignored: false })
  assert.deepEqual(routesBase('http://[::1]:8000'), { base: 'http://[::1]:8000', ignored: false })
  assert.deepEqual(routesBase('https://evil.example.com'), { base: ROUTES_BASE, ignored: true })
  assert.deepEqual(routesBase('http://localhost.evil.com'), { base: ROUTES_BASE, ignored: true })
  assert.deepEqual(routesBase('http://127.0.0.1.nip.io'), { base: ROUTES_BASE, ignored: true })
  assert.deepEqual(routesBase('ftp://localhost'), { base: ROUTES_BASE, ignored: true })
  assert.deepEqual(routesBase('not a url'), { base: ROUTES_BASE, ignored: true })
})

Deno.test('routesBody: two-wheeler without routing preference, car traffic-unaware', () => {
  assert.deepEqual(routesBody(A, B, 'TWO_WHEELER'), {
    origin: { location: { latLng: { latitude: 23.8312, longitude: 71.6043 } } },
    destination: { location: { latLng: { latitude: 23.6, longitude: 71.9 } } },
    travelMode: 'TWO_WHEELER', regionCode: 'IN', units: 'METRIC', languageCode: 'en',
  })
  const drive = routesBody(A, B, 'DRIVE')
  assert.equal(drive.travelMode, 'DRIVE')
  assert.equal((drive as Record<string, unknown>).routingPreference, 'TRAFFIC_UNAWARE')
  assert.equal(FIELD_MASK, 'routes.distanceMeters,routes.duration')
})

Deno.test('parseDurationSeconds reads "1234s"', () => {
  assert.equal(parseDurationSeconds('1234s'), 1234)
  assert.equal(parseDurationSeconds('90.5s'), 90.5)
  assert.equal(parseDurationSeconds(undefined), 0)
  assert.equal(parseDurationSeconds('12 minutes'), null)
  assert.equal(parseDurationSeconds('-5s'), null)
})

Deno.test('routeOutcome: success, zero distance, no route', () => {
  assert.deepEqual(routeOutcome(200, { routes: [{ distanceMeters: 23449, duration: '2460s' }] }),
    { kind: 'ok', distanceKm: 23.4, durationMinutes: 41 })
  assert.deepEqual(routeOutcome(200, { routes: [{ distanceMeters: 23450, duration: '2489s' }] }),
    { kind: 'ok', distanceKm: 23.5, durationMinutes: 41 })
  assert.deepEqual(routeOutcome(200, { routes: [{}] }), { kind: 'ok', distanceKm: 0, durationMinutes: 0 })
  assert.equal(routeOutcome(200, {}).kind, 'no_route')
  assert.equal(routeOutcome(200, { routes: [] }).kind, 'no_route')
  const odd = routeOutcome(200, { routes: [{ distanceMeters: 'lots', duration: '10s' }] })
  assert.equal(odd.kind === 'error' && odd.code, 'google_error')
  const notJson = routeOutcome(200, null)
  assert.equal(notJson.kind === 'error' && notJson.code, 'google_error')
})

Deno.test('routeOutcome: Google errors in plain words', () => {
  const err = (status: number, gStatus: string, message: string) => routeOutcome(status, { error: { code: status, status: gStatus, message } })
  const key = err(403, 'PERMISSION_DENIED', 'Routes API has not been used in project 123 before or it is disabled.')
  assert.ok(key.kind === 'error')
  if (key.kind !== 'error') return
  assert.equal(key.code, 'google_error')
  assert.match(key.error, /refused the road distance key.*Using the estimate/)
  assert.match(key.detail, /^Google HTTP 403 PERMISSION_DENIED: Routes API has not been used/)
  assert.equal(key.unsupportedMode, false)
  const quota = err(429, 'RESOURCE_EXHAUSTED', 'Quota exceeded')
  assert.ok(quota.kind === 'error' && quota.code === 'limit' && quota.logCode === 'google_limit')
  const mode = err(400, 'INVALID_ARGUMENT', 'Travel mode TWO_WHEELER is not supported for this request.')
  assert.ok(mode.kind === 'error' && mode.code === 'google_error' && mode.unsupportedMode)
  const plain400 = err(400, 'INVALID_ARGUMENT', 'Invalid JSON payload received.')
  assert.ok(plain400.kind === 'error' && !plain400.unsupportedMode)
  const down = routeOutcome(503, null)
  assert.ok(down.kind === 'error' && down.code === 'google_error' && /did not answer/.test(down.error))
  assert.equal(down.kind === 'error' && down.detail, 'Google HTTP 503')
  for (const o of [key, quota, mode, plain400, down]) assert.ok(o.kind === 'error' && o.error.endsWith('.'))
})

Deno.test('networkOutcome: timeout and network failure', () => {
  const timeout = networkOutcome(new DOMException('Signal timed out.', 'TimeoutError'))
  assert.ok(timeout.kind === 'error' && timeout.code === 'google_error' && /15 s/.test(timeout.detail))
  const refused = networkOutcome(new TypeError('error sending request: connection refused'))
  assert.ok(refused.kind === 'error' && /^Network: /.test(refused.detail))
})

Deno.test('shouldRetryWithDrive: only a two-wheeler with no route or an unsupported mode', () => {
  const noRoute = routeOutcome(200, {})
  const unsupported = routeOutcome(400, { error: { status: 'INVALID_ARGUMENT', message: 'TWO_WHEELER travel mode is not supported' } })
  const keyRefused = routeOutcome(403, { error: { status: 'PERMISSION_DENIED', message: 'API key not valid' } })
  const ok = routeOutcome(200, { routes: [{ distanceMeters: 1000, duration: '60s' }] })
  assert.equal(shouldRetryWithDrive('TWO_WHEELER', noRoute), true)
  assert.equal(shouldRetryWithDrive('TWO_WHEELER', unsupported), true)
  assert.equal(shouldRetryWithDrive('TWO_WHEELER', keyRefused), false)
  assert.equal(shouldRetryWithDrive('TWO_WHEELER', ok), false)
  assert.equal(shouldRetryWithDrive('DRIVE', noRoute), false)
  assert.equal(shouldRetryWithDrive('DRIVE', unsupported), false)
})

Deno.test('redactKey masks the key and anything shaped like a Google key', () => {
  const key = 'AIzaSyTESTKEY-1234567890abcdefghij'
  assert.equal(redactKey(`API key ${key} not valid`, key), 'API key ****** not valid')
  assert.equal(redactKey('API key AIzaSyOTHERKEY_1234567890abcdefgh is bad', key), 'API key ****** is bad')
  assert.equal(redactKey('short-key used', 'short-key'), '****** used')
  assert.equal(redactKey('nothing here', ''), 'nothing here')
})

Deno.test('dayStartIST: the India day starts at 18:30 UTC', () => {
  assert.equal(dayStartIST(Date.parse('2026-10-12T10:00:00Z')), '2026-10-11T18:30:00.000Z')
  assert.equal(dayStartIST(Date.parse('2026-10-12T18:29:59Z')), '2026-10-11T18:30:00.000Z')
  assert.equal(dayStartIST(Date.parse('2026-10-12T18:30:00Z')), '2026-10-12T18:30:00.000Z')
  assert.equal(dayStartIST(Date.parse('2026-10-12T23:59:00Z')), '2026-10-12T18:30:00.000Z')
})

Deno.test('limitRefusal: 200 per person, 1000 in total (this lookup included)', () => {
  assert.equal(limitRefusal(1, 1), null)
  assert.equal(limitRefusal(PER_USER_PER_DAY, TOTAL_PER_DAY), null)
  const mine = limitRefusal(PER_USER_PER_DAY + 1, 300)
  assert.equal(mine?.code, 'limit')
  assert.match(String(mine?.error), /today's 200 road distance lookups\. Using the estimate\./)
  const all = limitRefusal(5, TOTAL_PER_DAY + 1)
  assert.equal(all?.code, 'limit')
  assert.match(String(all?.error), /1000 road distance lookups for the office are used up/)
})

Deno.test('answerFor: the app answer and the log code', () => {
  assert.deepEqual(answerFor({ kind: 'ok', distanceKm: 23.4, durationMinutes: 41 }, 'DRIVE'), {
    body: { ok: true, distanceKm: 23.4, durationMinutes: 41, travelModeUsed: 'DRIVE' }, logCode: null,
  })
  const none = answerFor(routeOutcome(200, {}), 'DRIVE')
  assert.equal(none.body.ok, false)
  assert.equal((none.body as { code: string }).code, 'no_route')
  assert.equal(none.logCode, 'no_route')
  const quota = answerFor(routeOutcome(429, null), 'TWO_WHEELER')
  assert.equal((quota.body as { code: string }).code, 'limit')
  assert.equal(quota.logCode, 'google_limit')
  assert.deepEqual(NOT_CONFIGURED, { ok: false, code: 'not_configured', error: 'Road distance is not set up. Using the estimate.' })
})

Deno.test('readJsonCapped: JSON up to the cap, else null', async () => {
  assert.deepEqual(await readJsonCapped(Response.json({ routes: [{ distanceMeters: 5 }] })), { routes: [{ distanceMeters: 5 }] })
  assert.equal(await readJsonCapped(new Response('not json')), null)
  assert.equal(await readJsonCapped(new Response(null, { status: 204 })), null)
  // Declared too big: not read at all.
  assert.equal(await readJsonCapped(new Response('{}', { headers: { 'Content-Length': String(MAX_ANSWER_BYTES + 1) } })), null)
  // Too big without a length (streamed): cut off.
  const big = new ReadableStream<Uint8Array>({
    start(c) { for (let i = 0; i < 100; i++) c.enqueue(new Uint8Array(4096).fill(32)); c.close() },
  })
  assert.equal(await readJsonCapped(new Response(big)), null)
  assert.deepEqual(await readJsonCapped(new Response(' {"a":1} '), 16), { a: 1 })
  assert.equal(await readJsonCapped(new Response('{"a":"0123456789"}'), 16), null)
})

Deno.test('straightKm and checkRoute: a road km that cannot be right becomes google_error', () => {
  const line = straightKm(A, B)
  assert.ok(line > 39.5 && line < 39.7, String(line))
  assert.equal(straightKm(A, A), 0)
  const ok = (km: number) => ({ kind: 'ok' as const, distanceKm: km, durationMinutes: 30 })
  assert.deepEqual(checkRoute(ok(41.2), A, B), ok(41.2))
  assert.deepEqual(checkRoute(ok(37), A, B), ok(37), 'a little under the line is fine (points moved to the road)')
  assert.deepEqual(checkRoute(ok(0), A, A), ok(0), 'same point: 0 km is right')
  assert.deepEqual(checkRoute(ok(0.4), A, { lat: A.lat + 0.01, lng: A.lng }), ok(0.4))
  for (const km of [0, 12, 36, MAX_ROUTE_KM + 1]) {
    const bad = checkRoute(ok(km), A, B)
    assert.ok(bad.kind === 'error' && bad.code === 'google_error' && !bad.unsupportedMode, String(km))
    assert.match(bad.kind === 'error' ? bad.error : '', /Using the estimate\.$/)
  }
  const noRoute = routeOutcome(200, {})
  assert.equal(checkRoute(noRoute, A, B), noRoute)
})
