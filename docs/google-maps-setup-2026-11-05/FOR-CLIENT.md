# Technician km: Google setup and cost

**Nothing to buy and no new Google account.** We use the Google project you already have for the OTP SMS (**watersun-crm**). Google Maps is pay-as-you-go, and Watersun's use stays inside the free allowance.

## How the km works

- The technician taps **Start trip** when leaving and **Reached site** at the house. The phone's GPS saves those two points. GPS is free and nothing goes to Google.
- The CRM then asks Google once: "What is the road distance by bike from point A to point B?" That one question is called a **lookup**.
- The answer is saved, so opening the visit again later never asks Google again. **One trip = one lookup, ever.**
- Phones are not tracked all day. Only those two taps are saved.

## Cost

- Bike road distance (what we use): **7,000 lookups free every month**. After that, $4.50 per 1,000 lookups (about ₹380).
- Car road distance is cheaper (70,000 free, then $1.50 per 1,000) if you ever want to switch.
- Prices are from Google's India price list, checked 5 Nov 2026. They are in US dollars; the rupee amount is approximate.
- **Example:** 3 technicians × 5 houses a day × 26 working days = **390 lookups a month**. That is far below 7,000, so the bill is **₹0**. You would need more than 8,000 visits in one month to pay even ₹380.
- As a safety net, the CRM never asks Google more than 1,000 times a day.
- The completion OTP SMS (Firebase, same Google project) is billed separately per SMS, as set up in October.

## What you need to do (about 15 minutes)

1. Go to **console.cloud.google.com** and sign in with the Google account that owns **watersun-crm**.
2. Pick the project **watersun-crm** at the top.
3. **Billing → Payment method:** check that Watersun's own card is on it.
4. **Billing → Budgets & alerts → Create budget:** ₹500 a month, with email alerts at 50% and 100%. Google emails you before anything is spent.
5. **APIs & Services → Library:** search **Routes API**, open it, click **Enable**.
6. **APIs & Services → Credentials → Create credentials → API key.** Click **Edit API key**, choose **Restrict key**, tick only **Routes API**, then **Save**.
7. Copy the key and send it to the developer privately (not in a group chat).

Until the key is added, the CRM still works: it shows an estimated km from the pincodes instead of Google's road km.
