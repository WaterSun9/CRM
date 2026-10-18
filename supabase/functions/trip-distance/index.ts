// supabase/functions/trip-distance/index.ts
//
// Real road km between two points from the Google Routes API, for the office's
// "Record a visit payment" form when the developer has switched the app to the "pro"
// km mode (TRIP_DISTANCE_MODE = 'pro' in src/constants.js; 'simple' by default, and then
// this function is never called). Any answer other than ok: true means the app falls
// back to the straight-line estimate, so a missing key or a Google problem never stops
// the office saving a visit.
//
//   POST { origin: { lat, lng }, destination: { lat, lng }, travelMode?: 'TWO_WHEELER' | 'DRIVE' }
//     -> 200 { ok: true, distanceKm: 23.4, durationMinutes: 41, travelModeUsed: 'TWO_WHEELER' | 'DRIVE' }
//          distanceKm is one way, 1 decimal. A two-wheeler request with no route, or one
//          Google refuses as a travel mode, is tried once more by car (travelModeUsed 'DRIVE');
//          that is a second Google request. Google gets 15 s per request, 18 s for both.
//     -> 200 { ok: false, code, error }  code: not_configured | no_route | google_error | limit
//          google_error also covers an answer that cannot be a road km (much shorter than the
//          straight line, over 4000 km, or bigger than 64 KB).
// Business-rule answers are 200 so the app can show `error` as it is (it always ends with
// "Using the estimate."). 400 bad input, 401 not signed in, 403 not office (admin / sales)
// or switched off, 500 unexpected (plain message; the reason goes to the function logs only).
//
// Points must be inside India's rough box (6-37 N, 68-98 E), the same rule as the database.
// Limits per India day (midnight IST): 200 lookups per person, 1000 for the whole office.
// Every lookup is one row in public.trip_distance_lookups (migration
// 20261013120000_customer_sites.sql, run it before deploying this): written before Google
// is called and counted with it, so lookups sent together cannot pass the limit. The rows
// hold who, when, travel mode and the result only - no points, no key. Refused calls (limit,
// not set up) are logged too but do not count. Admin can read the table.
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), never in the app, git or chat:
//   GOOGLE_MAPS_API_KEY  Google Cloud API key restricted to the "Routes API" only. A server
//                        key: NO HTTP-referrer (website) restriction, because Supabase calls
//                        Google, not the browser. Also set a daily quota cap for Compute Routes
//                        and a budget alert in Google Cloud. Empty or unset = not_configured.
//                        Steps: docs/GOOGLE_ROUTES_SETUP.md.
//   GOOGLE_ROUTES_BASE   tests only: a fake Google server on this computer (http://localhost:...).
//                        Anything that is not localhost is ignored, so the key only goes to Google.
//                        Never set it on Supabase.
//
// Deploy: supabase functions deploy trip-distance
// The key is never returned, logged or stored; Google's error text is logged with it masked.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  FIELD_MASK, GOOGLE_TIMEOUT_MS, GOOGLE_TOTAL_MS, MIN_RETRY_MS, NOT_CONFIGURED, ROUTES_PATH, type Point, type RouteOutcome,
  type TravelMode, answerFor, checkRoute, dayStartIST, limitRefusal, networkOutcome, parseRequest, readJsonCapped, redactKey,
  routeOutcome, routesBase, routesBody, shouldRetryWithDrive,
} from './helpers.ts'

const ALLOWED_ORIGINS = ['https://crm.watersunsolar.com', 'https://watersun.deeprootsystems.in', 'https://watersun9.github.io']
const OFFICE_ROLES = ['admin', 'sales']
const SERVER_ERROR = 'Road distance is not available right now. Using the estimate.'
// Rows that never reached Google; they do not use up the daily lookups.
const NOT_COUNTED = '(limit,not_configured)'

// Secrets pasted into the dashboard often carry a stray space or new line.
const env = (name: string) => (Deno.env.get(name) || '').trim()

// Limit counts and the lookup log only; the caller's token only says who is asking.
const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
type Db = ReturnType<typeof serviceClient>

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  let allowed = ALLOWED_ORIGINS.includes(origin)
  try {
    const url = new URL(origin)
    if (url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) allowed = true
  } catch { /* no origin */ }
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    // The allowed origin is echoed back, so caches must keep one copy per origin.
    Vary: 'Origin',
  }
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })

// Lookups today (India day) that reached or may reach Google, this one included.
async function countToday(db: Db, userId: string | null) {
  let query = db.from('trip_distance_lookups').select('id', { count: 'exact', head: true })
    .gte('created_at', dayStartIST()).or(`error_code.is.null,error_code.not.in.${NOT_COUNTED}`)
  if (userId) query = query.eq('requested_by', userId)
  const { count, error } = await query
  if (error) throw error
  return Number(count) || 0
}

async function finishLog(db: Db, logId: string, fields: { ok: boolean; error_code: string | null; travel_mode?: TravelMode }) {
  const { error } = await db.from('trip_distance_lookups').update(fields).eq('id', logId)
  // Not fatal: the answer is ready. The row stays 'pending' and still counts.
  if (error) console.error(`trip-distance: lookup ${logId} not updated: ${error.message}`)
}

// One computeRoutes call, waiting at most timeoutMs (the answer included). Never throws.
async function askGoogle(key: string, base: string, origin: Point, destination: Point, mode: TravelMode,
  timeoutMs: number): Promise<RouteOutcome> {
  try {
    const res = await fetch(`${base}${ROUTES_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELD_MASK },
      body: JSON.stringify(routesBody(origin, destination, mode)),
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'error',
    })
    const data = await readJsonCapped(res)
    return checkRoute(routeOutcome(res.status, data), origin, destination)
  } catch (error) {
    return networkOutcome(error)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json(req, 405, { error: 'POST only' })

  let logId = ''
  let db: Db | null = null
  const key = env('GOOGLE_MAPS_API_KEY')
  try {
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    if (!token) return json(req, 401, { error: 'Sign in required' })
    // Who is asking: the token is checked by Supabase Auth, so the anon key alone
    // (no user inside) is refused. The token is used for nothing else.
    const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user } } = await asUser.auth.getUser(token)
    if (!user) return json(req, 401, { error: 'Sign in required' })
    db = serviceClient()

    const { data: me, error: meError } = await db.from('profiles').select('user_type, status').eq('id', user.id).maybeSingle()
    if (meError) throw meError
    if (!OFFICE_ROLES.includes(String(me?.user_type || '').toLowerCase()) || me?.status === 'inactive') {
      return json(req, 403, { ok: false, code: 'not_allowed', error: 'Only office staff can look up road distance.' })
    }

    const parsed = parseRequest(await req.json().catch(() => null))
    if (!parsed.ok) return json(req, 400, { ok: false, code: 'bad_input', error: parsed.error })
    const { origin, destination, travelMode } = parsed

    if (!key) {
      // Best effort, so the developer can see "pro" is on without a key. Never blocks the answer.
      const { error } = await db.from('trip_distance_lookups')
        .insert({ requested_by: user.id, travel_mode: travelMode, ok: false, error_code: 'not_configured' })
      if (error) console.error(`trip-distance: not set up, and the lookup log could not be written: ${error.message}`)
      return json(req, 200, NOT_CONFIGURED)
    }

    // Logged first, then counted with this row in, so lookups sent together all see each other.
    const { data: row, error: logError } = await db.from('trip_distance_lookups')
      .insert({ requested_by: user.id, travel_mode: travelMode, ok: false, error_code: 'pending' }).select('id').single()
    if (logError || !row?.id) throw new Error(`lookup log not written: ${logError?.message ?? 'no id'}`)
    logId = String(row.id)
    const refusal = limitRefusal(await countToday(db, user.id), await countToday(db, null))
    if (refusal) {
      await finishLog(db, logId, { ok: false, error_code: 'limit' })
      return json(req, 200, refusal)
    }

    const route = routesBase(env('GOOGLE_ROUTES_BASE'))
    if (route.ignored) console.error('trip-distance: GOOGLE_ROUTES_BASE ignored (only a test server on this computer is allowed)')
    let modeUsed: TravelMode = travelMode
    const deadline = Date.now() + GOOGLE_TOTAL_MS
    let outcome = await askGoogle(key, route.base, origin, destination, travelMode, GOOGLE_TIMEOUT_MS)
    const left = deadline - Date.now()
    if (shouldRetryWithDrive(travelMode, outcome) && left >= MIN_RETRY_MS) {
      console.error(`trip-distance: two-wheeler route not found (${redactKey(outcome.kind === 'ok' ? '' : outcome.detail, key)}), trying by car`)
      modeUsed = 'DRIVE'
      outcome = await askGoogle(key, route.base, origin, destination, 'DRIVE', Math.min(GOOGLE_TIMEOUT_MS, left))
    }
    const { body, logCode } = answerFor(outcome, modeUsed)
    if (outcome.kind !== 'ok') console.error(`trip-distance: lookup ${logId} (${modeUsed}) failed: ${redactKey(outcome.detail, key)}`)
    await finishLog(db, logId, { ok: outcome.kind === 'ok', error_code: logCode, travel_mode: modeUsed })
    return json(req, 200, body)
  } catch (error) {
    // Database wording stays in the logs (key masked); the office gets a plain message.
    const message = (error as { message?: unknown })?.message
    console.error(`trip-distance: failed${logId ? ` (lookup ${logId})` : ''}: ${redactKey(String(message ?? error), key)}`)
    if (db && logId) await finishLog(db, logId, { ok: false, error_code: 'server_error' }).catch(() => {})
    return json(req, 500, { ok: false, code: 'server_error', error: SERVER_ERROR })
  }
})
