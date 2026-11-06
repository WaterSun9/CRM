# Google road distance ("pro" km) - setup

For the developer. The CRM works out a technician's km in one of two ways, chosen by `TRIP_DISTANCE_MODE` in `src/constants.js`:

| Mode | Km on "Record a visit payment" | Needs |
|---|---|---|
| `'simple'` (default, live today) | Straight line x 1.3 x 2 + 5 km grace | Nothing |
| `'pro'` | Real road km from Google x 2 + 5 km grace | A Google key in Supabase, the `trip-distance` function, `20261013120000_customer_sites.sql` |

In `'pro'` mode the app falls back to the simple estimate whenever Google is not available (no key, Google error, daily limit). The office sees a grey note "Road distance not available, using the estimate" and can still save the visit.

The client's live CRM stays on `'simple'` until you have tested `'pro'` and the client has its own Google key. Test first with your own Google account and card (steps 1-10), then repeat steps 1-6 with the client's account (step 12).

**Never in git, chat or screenshots:** the API key. Keep it in a password manager.

## Cost

- About 200 lookups a month are expected (one per visit payment, a few more when the office reopens the form). The function allows at most 200 per person and 1000 in total per day (India time).
- Google gives a free number of Routes requests every month, per pricing tier. This volume should stay inside it, so the bill should be Rs 0, but Google needs a card on file anyway.
- Two-wheeler routes (`TRIP_TRAVEL_MODE = 'TWO_WHEELER'`) are billed at a higher tier than car routes (`'DRIVE'`); Google's Routes billing page lists two-wheeler under its top tier. At this volume both should still be inside the free monthly usage. Check the Google pricing page (Google Maps Platform pricing > Routes) before going live, because the tiers and free amounts change.
- When Google finds no two-wheeler route, the function asks once more for a car route. That is a second Google request.
- The quota cap (step 5) is what stops spending. A budget alert only sends an email.

## Steps

1. **Project.** console.cloud.google.com > project picker > **New project**. Name `watersun-crm-routes`. Create, then select it.
2. **Billing.** Menu > Billing > link a billing account to this project (add the card if asked). Testing: your own card. Live: the client's.
3. **Turn on the Routes API only.** Menu > APIs & Services > Library > search **Routes API** > Enable. Do not enable other Maps APIs; the CRM needs none of them.
4. **API key.** APIs & Services > Credentials > **Create credentials > API key**. Then open the key (Edit):
   - Name: `watersun-trip-distance`.
   - Application restrictions: **None**. It is a server key: Supabase calls Google, not the browser, so a website (HTTP referrer) restriction would block it, and Supabase has no fixed IP address.
   - API restrictions: **Restrict key** > tick **Routes API** only. Save.
   - Copy the key into your password manager.
5. **Quota cap.** APIs & Services > Routes API > **Quotas & System Limits** (or Google Maps Platform > **Quotas**). Find the Compute Routes requests limit, tick it, **Edit quota**, set **500 per day**. If only a per-minute limit is listed, set it to **10 per minute**; the CRM's own limit (1000 lookups a day) then stops the rest. Google refuses calls over the cap and the CRM uses the estimate.
6. **Budget alert.** Billing > **Budgets & alerts** > Create budget for this project, amount **Rs 500** a month, alerts at 50%, 90% and 100% to your email (live: the owner's email too).
7. **Key into Supabase.** Easiest: Supabase Dashboard > Edge Functions > **Secrets** > add `GOOGLE_MAPS_API_KEY` (keeps it out of your shell history). Or from the terminal:

   ```bash
   supabase secrets set --project-ref cjskyhxameobcqlfiuav GOOGLE_MAPS_API_KEY=<key>
   ```

   Never set `GOOGLE_ROUTES_BASE` on Supabase (local tests only).
8. **Database.** Supabase SQL editor: run `supabase/migrations/20261013120000_customer_sites.sql`, then its "Check" queries. It needs the four earlier files from `docs/TECHNICIAN_PLAN.md` ("Deploy in this order") to have run first. Then regenerate `supabase/schema.sql`.
9. **Function.**

   ```bash
   supabase functions deploy trip-distance --project-ref cjskyhxameobcqlfiuav
   ```

10. **Switch the app to pro.** In `src/constants.js` set `TRIP_DISTANCE_MODE = 'pro'` (and `TRIP_TRAVEL_MODE` to `'TWO_WHEELER'` or `'DRIVE'`), then `npm run deploy` (see `docs/OPERATIONS.md`).
11. **Test.**
    1. Technician: claim a test complaint, tap **Start trip** (allow location), then **Reached site** at the address.
    2. Office: open the complaint > **Record a visit payment**. The working should read like "Road distance (Google, two-wheeler): 23.4 km x 2 + 5 km grace = 52 km". Save it.
    3. SQL editor, newest first. The last row must be `ok = true` with no `error_code`:

       ```sql
       select travel_mode, ok, error_code, created_at from trip_distance_lookups order by created_at desc limit 5;
       select km_source, route_km, km_estimate, kilometers from service_visits order by created_at desc limit 3;
       ```

    4. What an `error_code` means:
       - `not_configured`: key missing in Supabase (step 7).
       - `google_error`: see Supabase > Edge Functions > trip-distance > Logs (key not restricted to the Routes API, API not enabled, billing off, Google too slow, or an answer that cannot be a road km).
       - `no_route`: Google found no road between the two points, even by car.
       - `google_limit`: the Google quota cap (step 5) was reached. `limit`: the CRM's own daily limit.
       - `server_error` or `pending`: the function failed or stopped half-way; see the Logs.
12. **Hand over to the client.** The client repeats steps 1-6 with its own Google account and card, and sends you the new key through a password manager (not WhatsApp or email). Replace the secret (step 7). Then, in your own project, delete your key (Credentials) and unlink billing (or shut the project down).

## Switch back to simple

- **For good:** set `TRIP_DISTANCE_MODE = 'simple'` in `src/constants.js` and `npm run deploy`. The app then never calls the function. Visits already saved keep their km.
- **At once, without a new app build:** `supabase secrets unset --project-ref cjskyhxameobcqlfiuav GOOGLE_MAPS_API_KEY`. The function then answers "not set up" and the office gets the estimate, even in `'pro'` mode.

## What Google receives

Only two points per lookup: where the technician started and the customer's location. No names, phone numbers or addresses. The CRM's log (`trip_distance_lookups`) keeps who asked, when, the travel mode and the result; it keeps no points and never the key.

Google's terms limit storing Google results and ask for "Google Maps" credit where they are shown without a Google map. The CRM keeps only the one-way km on each visit, as the payment record. Read the Google Maps Platform terms for the Routes API before the client goes live.
