// supabase/functions/whatsapp-webhook/index.ts
//
// Meta calls this URL with WhatsApp events (no Supabase login, so deploy it with
// `supabase functions deploy whatsapp-webhook --no-verify-jwt`):
//   GET  ?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...
//        Meta's one-time check when the callback URL is saved: answers the challenge
//        only when the token matches WA_VERIFY_TOKEN, else 403.
//   POST events, signed by Meta (X-Hub-Signature-256 = HMAC-SHA256 of the body with
//        WA_APP_SECRET). Anything unsigned or wrongly signed gets 401. A signed payload
//        always gets 200, even if some items could not be saved, so Meta does not keep
//        resending it; the reason goes to the function logs.
//        - statuses: whatsapp_messages moves on to delivered / read / failed (never back).
//          Meta error 131026 flags the number in whatsapp_contacts as not on WhatsApp (a
//          re-sent old failure does not flag it again), and for a week service-otp then
//          asks the technician to get the office to close the job.
//          Bodies are read with a 3 MB cap, Content-Length or not.
//        - messages: saved once in whatsapp_inbound ("Yes, solved" / "Not solved" and
//          typed replies), linked to the complaint or quotation they answer. A message
//          from a number clears its not-on-WhatsApp flag. Optional auto-reply below.
// Message text and phone numbers never go to the logs (numbers are masked).
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets):
//   WA_APP_SECRET       App secret (Meta app > App settings > Basic). Without it every POST is refused.
//   WA_VERIFY_TOKEN     Any long random text; type the same text in Meta > WhatsApp > Configuration.
//   WA_AUTO_REPLY_TEXT  optional. When set (and WA_ENABLED is 'true'), anyone who writes to the
//                       Watersun number gets this text back, at most once a day per number.
//                       Write \n for a new line. While WA_TEST_TO is set only that number gets it.
//                       Messages to another number of the same Meta app (e.g. the test number
//                       after going live) are saved but get no auto-reply.
//   plus WA_ENABLED, WA_TOKEN, WA_PHONE_NUMBER_ID (see ../_shared/whatsapp.ts) for the auto-reply.
// Meta app > WhatsApp > Configuration: callback URL
//   https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook, subscribe to "messages".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleWebhook } from './handler.ts'

// All reads and writes go through the service role; Meta's signature says who is calling.
const serviceClient = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Supabase keeps the function alive for work handed to waitUntil, so the auto-reply
// can go out after Meta already has its 200.
// deno-lint-ignore no-explicit-any
const runtime = (globalThis as any).EdgeRuntime as { waitUntil?: (task: Promise<unknown>) => void } | undefined
const later = typeof runtime?.waitUntil === 'function' ? (task: Promise<unknown>) => runtime.waitUntil!(task) : undefined

Deno.serve(async (req) => {
  try {
    return await handleWebhook(req, serviceClient, later)
  } catch (error) {
    // Only reached before the signature is checked (e.g. the body could not be read).
    console.error(`whatsapp-webhook: request failed: ${(error as { message?: unknown })?.message ?? String(error)}`)
    return new Response('Bad request', { status: 400 })
  }
})
