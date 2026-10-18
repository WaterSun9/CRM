// supabase/functions/trip-distance/helpers.ts
//
// Pure helpers for the road-distance lookup (no network, no database), kept apart so
// helpers.test.ts can check them with `deno test`.

export const TRAVEL_MODES = ['TWO_WHEELER', 'DRIVE'] as const
export type TravelMode = typeof TRAVEL_MODES[number]
export type Point = { lat: number; lng: number }

// Lookups per person and for the whole office per India day (midnight to midnight IST).
export const PER_USER_PER_DAY = 200
export const TOTAL_PER_DAY = 1000
// One Google call waits at most 15 s, and a two-wheeler call plus its car retry together
// at most 18 s, so the app (which gives up after 20 s) still gets the answer.
export const GOOGLE_TIMEOUT_MS = 15_000
export const GOOGLE_TOTAL_MS = 18_000
// The retry by car is skipped when less than this is left of GOOGLE_TOTAL_MS.
export const MIN_RETRY_MS = 3_000
// A field-masked answer is a few hundred bytes; anything far bigger is not a route.
export const MAX_ANSWER_BYTES = 64 * 1024
// Longest one-way road km taken as real (Gujarat to the far end of India is under 4000 km).
export const MAX_ROUTE_KM = 4000
// Google moves each point to the nearest road, so a road km a little under the straight
// line is normal; this much shorter means the answer is wrong.
const SHORTER_THAN_LINE_KM = 3
export const ROUTES_BASE = 'https://routes.googleapis.com'
export const ROUTES_PATH = '/directions/v2:computeRoutes'
// Only what the km needs; Google bills by the fields asked for.
export const FIELD_MASK = 'routes.distanceMeters,routes.duration'
const MASK = '******'
const IST_OFFSET_MS = 330 * 60 * 1000

export const NOT_CONFIGURED = { ok: false, code: 'not_configured', error: 'Road distance is not set up. Using the estimate.' }

// Same box as the trip points in the database (service_trips, customer_sites).
const inIndia = (lat: number, lng: number) => lat >= 6 && lat <= 37 && lng >= 68 && lng <= 98

const toNumber = (value: unknown) => {
  if (typeof value === 'number') return value
  if (typeof value === 'string' && value.trim() !== '') return Number(value.trim())
  return NaN
}

// { lat, lng } inside India's rough box, rounded to 6 decimals (about 10 cm), else null.
export function readPoint(value: unknown): Point | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const lat = toNumber((value as Record<string, unknown>).lat)
  const lng = toNumber((value as Record<string, unknown>).lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inIndia(lat, lng)) return null
  return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 }
}

export type ParsedRequest =
  | { ok: true; origin: Point; destination: Point; travelMode: TravelMode }
  | { ok: false; error: string }

// The POST body. travelMode is optional and defaults to TWO_WHEELER (most technicians ride one).
export function parseRequest(body: unknown): ParsedRequest {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  if (b.origin == null || b.destination == null) return { ok: false, error: 'Send the start and the customer location.' }
  const origin = readPoint(b.origin)
  if (!origin) return { ok: false, error: 'The start location is not a valid point in India.' }
  const destination = readPoint(b.destination)
  if (!destination) return { ok: false, error: 'The customer location is not a valid point in India.' }
  const mode = b.travelMode == null || b.travelMode === '' ? 'TWO_WHEELER' : b.travelMode
  if (!TRAVEL_MODES.includes(mode as TravelMode)) return { ok: false, error: 'travelMode must be TWO_WHEELER or DRIVE.' }
  return { ok: true, origin, destination, travelMode: mode as TravelMode }
}

// GOOGLE_ROUTES_BASE is for tests only: a fake Google server on this computer. Anything else
// is ignored, so the API key only ever goes to Google.
export function routesBase(override: string): { base: string; ignored: boolean } {
  const value = String(override ?? '').trim()
  if (!value) return { base: ROUTES_BASE, ignored: false }
  try {
    const url = new URL(value)
    if (['http:', 'https:'].includes(url.protocol) && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      return { base: value.replace(/\/+$/, ''), ignored: false }
    }
  } catch { /* not a URL */ }
  return { base: ROUTES_BASE, ignored: true }
}

const latLng = (p: Point) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } })

// Body for computeRoutes. Two-wheeler takes no routing preference; car is asked without
// live traffic (cheaper tier, and the km does not depend on traffic). languageCode is 'en':
// Google's language list has no 'en-IN', and only distance and duration are asked for.
export function routesBody(origin: Point, destination: Point, travelMode: TravelMode) {
  return {
    origin: latLng(origin),
    destination: latLng(destination),
    travelMode,
    ...(travelMode === 'DRIVE' ? { routingPreference: 'TRAFFIC_UNAWARE' } : {}),
    regionCode: 'IN',
    units: 'METRIC',
    languageCode: 'en',
  }
}

// Google sends durations as "1234s" (fields at zero are left out).
export function parseDurationSeconds(value: unknown): number | null {
  if (value == null) return 0
  const m = /^(\d+(?:\.\d+)?)s$/.exec(String(value).trim())
  return m ? Number(m[1]) : null
}

export type RouteOutcome =
  | { kind: 'ok'; distanceKm: number; durationMinutes: number }
  | { kind: 'no_route'; detail: string }
  | { kind: 'error'; code: 'google_error' | 'limit'; logCode: 'google_error' | 'google_limit'; error: string; detail: string; unsupportedMode: boolean }

const GOOGLE_FAILED = 'Google could not work out the road distance. Using the estimate.'
const GOOGLE_DOWN = 'Google road distance did not answer. Using the estimate.'
const GOOGLE_KEY = 'Google refused the road distance key. Using the estimate. Please tell the developer.'
const GOOGLE_QUOTA = 'Google road distance limit is used up for now. Using the estimate. Please tell the developer.'

const googleError = (error: string, detail: string, unsupportedMode = false): RouteOutcome =>
  ({ kind: 'error', code: 'google_error', logCode: 'google_error', error, detail: detail.slice(0, 300), unsupportedMode })

// One computeRoutes answer -> what happened.
export function routeOutcome(httpStatus: number, payload: unknown): RouteOutcome {
  const data = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload as Record<string, unknown> : null
  if (httpStatus >= 200 && httpStatus < 300) {
    if (!data) return googleError(GOOGLE_FAILED, `Google HTTP ${httpStatus}: answer was not JSON`)
    const routes = Array.isArray(data.routes) ? data.routes : []
    const route = routes[0] as Record<string, unknown> | undefined
    if (!route || typeof route !== 'object') return { kind: 'no_route', detail: `Google HTTP ${httpStatus}: no route` }
    // Proto3 JSON leaves zero values out: a missing distance is 0 m (same start and end).
    const meters = route.distanceMeters == null ? 0 : Number(route.distanceMeters)
    const seconds = parseDurationSeconds(route.duration)
    if (!Number.isFinite(meters) || meters < 0 || seconds === null) {
      return googleError(GOOGLE_FAILED, `Google HTTP ${httpStatus}: route without a usable distance or duration`)
    }
    return { kind: 'ok', distanceKm: Math.round(meters / 100) / 10, durationMinutes: Math.round(seconds / 60) }
  }
  const err = (data?.error && typeof data.error === 'object' ? data.error : {}) as Record<string, unknown>
  const status = String(err.status ?? '').trim()
  const message = String(err.message ?? '').replace(/\s+/g, ' ').trim()
  const detail = [`Google HTTP ${httpStatus}${status ? ` ${status}` : ''}`, message].filter(Boolean).join(': ')
  if (httpStatus === 429 || status === 'RESOURCE_EXHAUSTED') {
    return { kind: 'error', code: 'limit', logCode: 'google_limit', error: GOOGLE_QUOTA, detail: detail.slice(0, 300), unsupportedMode: false }
  }
  if (httpStatus === 401 || httpStatus === 403 || status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') {
    return googleError(GOOGLE_KEY, detail)
  }
  if (httpStatus === 400 || status === 'INVALID_ARGUMENT' || status === 'FAILED_PRECONDITION') {
    // e.g. two-wheeler routing not offered for these points.
    const unsupported = /two.?wheeler|travel.?mode|not supported|unsupported/i.test(message)
    return googleError(GOOGLE_FAILED, detail, unsupported)
  }
  return googleError(httpStatus >= 500 ? GOOGLE_DOWN : GOOGLE_FAILED, detail)
}

// Google's answer as JSON, read only up to `max` bytes (a huge or endless answer is cut off
// instead of filling the function's memory). null when it is too big or not JSON.
export async function readJsonCapped(res: Response, max = MAX_ANSWER_BYTES): Promise<unknown> {
  if (!res.body) return null
  const declared = Number(res.headers.get('Content-Length'))
  if (Number.isFinite(declared) && declared > max) {
    await res.body.cancel().catch(() => {})
    return null
  }
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > max) {
      await reader.cancel().catch(() => {})
      return null
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.byteLength }
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

// Straight-line km between two points (haversine).
export function straightKm(a: Point, b: Point) {
  const rad = (d: number) => d * Math.PI / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(h)))
}

// A road km far shorter than the straight line, or longer than any road in India, is a
// broken answer: the app then uses the estimate instead of paying a wrong km.
export function checkRoute(outcome: RouteOutcome, origin: Point, destination: Point): RouteOutcome {
  if (outcome.kind !== 'ok') return outcome
  const line = straightKm(origin, destination)
  if (outcome.distanceKm > MAX_ROUTE_KM || outcome.distanceKm < line - SHORTER_THAN_LINE_KM) {
    return googleError(GOOGLE_FAILED, `Google road km ${outcome.distanceKm} does not fit the straight line ${Math.round(line * 10) / 10} km`)
  }
  return outcome
}

// fetch threw: no answer, or the 15 s timeout.
export function networkOutcome(error: unknown): RouteOutcome {
  const name = (error as { name?: unknown })?.name
  const message = error instanceof Error ? error.message : String(error)
  const timedOut = name === 'TimeoutError' || name === 'AbortError'
  return googleError(GOOGLE_DOWN, timedOut ? 'Google: no answer within 15 s' : `Network: ${message}`)
}

// Two-wheeler with no route, or refused as a travel mode: one more try by car.
export const shouldRetryWithDrive = (mode: TravelMode, outcome: RouteOutcome) =>
  mode === 'TWO_WHEELER' && (outcome.kind === 'no_route' || (outcome.kind === 'error' && outcome.unsupportedMode))

// The key (and anything shaped like a Google key) never reaches a log line or an answer.
export function redactKey(text: string, key: string) {
  let out = String(text ?? '')
  const k = String(key ?? '').trim()
  if (k) out = out.split(k).join(MASK)
  return out.replace(/AIza[0-9A-Za-z_-]{20,}/g, MASK)
}

// Midnight IST of the current India day, as an ISO time (the daily limits restart then).
export function dayStartIST(nowMs = Date.now()) {
  const istMidnight = Math.floor((nowMs + IST_OFFSET_MS) / 86_400_000) * 86_400_000
  return new Date(istMidnight - IST_OFFSET_MS).toISOString()
}

// Counts include this request's own log row. Returns the 200 body to send back, or null.
export function limitRefusal(mine: number, total: number) {
  if (mine > PER_USER_PER_DAY) {
    return { ok: false, code: 'limit', error: `You have used today's ${PER_USER_PER_DAY} road distance lookups. Using the estimate.` }
  }
  if (total > TOTAL_PER_DAY) {
    return { ok: false, code: 'limit', error: `Today's ${TOTAL_PER_DAY} road distance lookups for the office are used up. Using the estimate.` }
  }
  return null
}

const NO_ROUTE = 'Google found no road route between these two points. Using the estimate.'

// What the app gets back, and the error_code for the lookup log (null on success).
export function answerFor(outcome: RouteOutcome, travelModeUsed: TravelMode) {
  if (outcome.kind === 'ok') {
    return {
      body: { ok: true, distanceKm: outcome.distanceKm, durationMinutes: outcome.durationMinutes, travelModeUsed },
      logCode: null,
    }
  }
  if (outcome.kind === 'no_route') return { body: { ok: false, code: 'no_route', error: NO_ROUTE }, logCode: 'no_route' }
  return { body: { ok: false, code: outcome.code, error: outcome.error }, logCode: outcome.logCode }
}
