# Technician km: Google setup and cost

**Nothing to buy.** Google Maps is pay-as-you-go. You only add a card, and normal use stays inside the free monthly allowance.

## How the km works

- The technician taps **Start trip** when leaving and **Reached site** at the house. The phone's own GPS saves both points. GPS is free, and nothing is sent to Google.
- The CRM asks Google Maps for the real **road distance** between those two points, for a two-wheeler. That road km is what costs money, and only per lookup.
- If GPS or Google fails, the CRM falls back to an estimate from the pincode, so a job never gets stuck.
- The phone is not tracked all day. Only those two taps are saved.

## Cost (Google's India price list, checked 5 Nov 2026)

- Two-wheeler road distance: **7,000 lookups free every month**. After that, $4.50 per 1,000 lookups (about ₹380).
- Car road distance is cheaper: 70,000 free a month, then $1.50 per 1,000. We can switch if needed.
- **One lookup per trip, ever.** A lookup is one question to Google: the road km from Start trip to Reached site. The CRM remembers the answer, so opening the visit again costs nothing.
- Expected use: about one lookup per technician visit, so a few hundred a month. That is **₹0 for normal use**.
- The CRM itself stops at 1,000 lookups a day, so a bill can't run away.
- Completion OTP SMS (Firebase, same Google account) is billed separately per SMS, as set up in October.

## What you need to do (about 15 minutes)

1. Open **console.cloud.google.com** and sign in with the Watersun Google account.
2. Choose the project **watersun-crm**. It is the one already used for the OTP SMS.
3. **Billing:** make sure Watersun's own card is on the billing account (Billing → Payment method).
4. **Budget alert:** Billing → Budgets & alerts → Create budget, ₹500 a month, with email alerts at 50% and 100%.
5. **APIs & Services → Library**, search **Routes API**, then **Enable**.
6. **APIs & Services → Credentials → Create credentials → API key**. Then Edit API key → API restrictions → Restrict key → tick **Routes API** only → Save.
7. Send the key to the developer privately. Do not post it in a group chat. The developer adds it to the server and switches road km on.
