> **Parked 23 Oct 2026:** the client dropped WhatsApp. Completion codes go by SMS (Firebase). Kept for reference only.

# WhatsApp - developer setup

For the developer (sadafmhavish953@gmail.com) after the agency has invited you to **Watersun's** business portfolio with **Full control**. WhatsApp goes straight to Meta's Cloud API (no Twilio, no BSP). Supabase project: `cjskyhxameobcqlfiuav`.

**Never in git, chat or screenshots:** the token, the app secret, the PIN. Keep them in a password manager.

What you will note down on the way:

| Name | Where |
|---|---|
| App ID, App secret | App Dashboard > App settings > Basic |
| Test phone number ID, test WhatsApp Business Account (WABA) ID | App Dashboard > WhatsApp > API Setup |
| Real phone number ID, real WABA ID | Same page, after step 13 |
| System user token | Step 5 |
| Verify token | You make it up (step 7) |
| PIN | You make it up (step 14) |

## A. Test number (no card, Ravi not needed)

1. Accept the invite. In business.facebook.com > Settings > Business info, check that the name and address match the GST certificate, and note whether it says **Verified**.
2. developers.facebook.com > My Apps > **Create app**. Name `Watersun CRM`. Use case **Connect with customers through WhatsApp**. Business portfolio: **Watersun's**, never your own (a WhatsApp account can never move to another portfolio later).
3. App Dashboard > WhatsApp > **API Setup**:
   - Note the test **Phone number ID** and **WhatsApp Business Account ID**.
   - "To" > Manage phone number list > add your own mobile and type the code WhatsApp sends you.
   - Click **Send message**. The `hello_world` message must reach your phone.
4. App settings > Basic: note the **App ID**. Click Show next to **App secret** and note it. Fill in **Privacy policy URL** (ask the owner for Watersun's website privacy page). Save.
5. business.facebook.com > Settings > Users > **System users** > Add. Name `watersun-crm`, role **Admin**.
   - **Assign assets**: Apps > Watersun CRM > Full control. WhatsApp accounts > each one listed (the test one too) > Full control.
   - **Generate token**: app Watersun CRM, expiry **Never**, permissions `whatsapp_business_messaging` and `whatsapp_business_management`. Copy it once into your password manager.
   - If the test WhatsApp account is not listed, use the temporary token from API Setup until step 16 (it lasts 24 hours).
6. Supabase SQL editor, one file per run, each followed by its "Check:" queries. Skip any file that already ran.
   1. `20261012190000_service_jobs_v2.sql`
   2. `20261013090000_whatsapp_log.sql`
   3. `20261013100000_vendor_phone.sql`
   4. `20261013110000_service_trips.sql`
   5. `20261013120000_customer_sites.sql`

   Then regenerate `supabase/schema.sql`.
7. Supabase secrets.
   - Make a verify token with `openssl rand -hex 16`.
   - Paste `WA_TOKEN` and `WA_APP_SECRET` in Dashboard > Edge Functions > **Secrets**, so they never sit in your shell history.
   - Set the rest from the terminal:

   ```bash
   supabase secrets set --project-ref cjskyhxameobcqlfiuav \
     WA_PHONE_NUMBER_ID=<test phone number ID> \
     WA_VERIFY_TOKEN=<verify token> \
     WA_DONE_TEMPLATE=service_completed_confirm \
     WA_TEST_TO=<your own 10-digit mobile> \
     WA_ENABLED=false
   # Same command for the two secrets, if you are not using the Dashboard:
   #   WA_TOKEN=<system user token> WA_APP_SECRET=<app secret>
   # Optional: one reply a day to anyone who writes to the number (text from the owner):
   #   WA_AUTO_REPLY_TEXT="<text>"
   ```

   Leave `WA_TEMPLATE_LANG`, `WA_GRAPH_VERSION`, `WA_OTP_TEMPLATE` and `WA_QUOTATION_TEMPLATE` unset (they default to `en_US`, `v23.0`, `watersun_service_code` and `watersun_quotation`). Never set `WA_GRAPH_BASE` (local tests only).
8. Deploy the functions, then the app (`npm run deploy`, see docs/OPERATIONS.md):

   ```bash
   supabase functions deploy service-otp --project-ref cjskyhxameobcqlfiuav
   supabase functions deploy whatsapp-send-quotation --project-ref cjskyhxameobcqlfiuav
   supabase functions deploy send-lead-to-vendor --project-ref cjskyhxameobcqlfiuav
   supabase functions deploy whatsapp-webhook --no-verify-jwt --project-ref cjskyhxameobcqlfiuav
   supabase functions deploy trip-distance --project-ref cjskyhxameobcqlfiuav
   ```

9. In your terminal (this window only; `read -s` keeps the token off the screen and out of history):

   ```bash
   export WA_WABA_ID=<test WABA ID>
   export WA_APP_ID=<App ID>
   printf 'Token: '; read -rs WA_TOKEN; export WA_TOKEN; echo
   ```

10. Webhook.
    - App Dashboard > WhatsApp > **Configuration** > Webhook > Edit.
    - Callback URL: `https://cjskyhxameobcqlfiuav.supabase.co/functions/v1/whatsapp-webhook`
    - Verify token: the one from step 7. Click **Verify and save**.
    - Webhook fields > Manage > subscribe **messages**.
    - Connect the app to this WhatsApp account. The answer must be `{"success":true}`:

    ```bash
    curl -s -X POST "https://graph.facebook.com/v23.0/$WA_WABA_ID/subscribed_apps" -H "Authorization: Bearer $WA_TOKEN"
    ```

11. Templates:

    ```bash
    node scripts/whatsapp_templates.mjs --dry-run   # checks templates.json, sends nothing
    node scripts/whatsapp_templates.mjs             # creates the missing ones
    ```

    - Run the second line again every few minutes until all 4 say **APPROVED**.
    - The script uploads a sample PDF for the quotation template (that is why it needs `WA_APP_ID`). If that fails, it prints the steps to make the template by hand in WhatsApp Manager.
    - If Meta puts `watersun_quotation` under **MARKETING**, tell the owner: it costs more per message.
    - If Meta refuses a template on the test account, test that message after step 18 instead.
12. Test after office hours. While `WA_TEST_TO` is set, **every** WhatsApp from the CRM goes to your phone.
    1. `supabase secrets set --project-ref cjskyhxameobcqlfiuav WA_ENABLED=true`
    2. Complaint: technician taps "Work done - send code". The code arrives on your phone; type it in and the job closes. The "work completed" message arrives. Tap **Not solved**.
    3. Vendor: as admin, give a test vendor a mobile number (Operations > Vendors Allotment, pencil button), then send a customer to that vendor. The email and the WhatsApp both arrive.
    4. Quotation: tap **WhatsApp** on a quotation. The PDF arrives.
    5. In the SQL editor, statuses must move to `delivered` / `read`, and your "Not solved" tap must be there:

       ```sql
       select kind, template, status, error_code, error_text, test_mode, created_at from whatsapp_messages order by created_at desc limit 10;
       select message_type, button_text, body, received_at from whatsapp_inbound order by received_at desc limit 5;
       ```

    6. When done: `supabase secrets set --project-ref cjskyhxameobcqlfiuav WA_ENABLED=false`

## B. Real number (with Ravi)

13. 92744 04398 must not be on WhatsApp or the WhatsApp Business app.
    - API Setup > **Add phone number**. Display name `Watersun Solar` (Meta checks it matches the business). Enter the number.
    - **Ravi reads out the code** from the SMS or voice call.
    - Note the real **Phone number ID** and **WhatsApp Business Account ID**.
14. Register the number. Make up a 6-digit PIN and keep it in the password manager. Meta allows at most 10 register calls in 72 hours.

    ```bash
    curl -s -X POST "https://graph.facebook.com/v23.0/<real phone number ID>/register" \
      -H "Authorization: Bearer $WA_TOKEN" -H "Content-Type: application/json" \
      -d '{"messaging_product":"whatsapp","pin":"<6-digit PIN>"}'
    ```

15. **Ravi adds a card:** business.facebook.com > Billing & payments > WhatsApp Business accounts > the real account > Add payment method. The currency must be **INR**: from 1 Jan 2027 Meta stops delivering for Indian accounts billed in any other currency.
16. System user (step 5) > Assign assets > the real WhatsApp account > Full control. If you used the temporary token so far, make the permanent token now and update `WA_TOKEN` (terminal and Supabase).
17. `export WA_WABA_ID=<real WABA ID>`, then for the real account:
    - Run the `subscribed_apps` curl from step 10.
    - Run `node scripts/whatsapp_templates.mjs` until all 4 are **APPROVED**.
18. App Dashboard: switch the app to **Live** (it needs the privacy policy URL from step 4).
19. Switch to the real number and test quickly (these messages are billed):

    ```bash
    supabase secrets set --project-ref cjskyhxameobcqlfiuav WA_PHONE_NUMBER_ID=<real phone number ID> WA_ENABLED=true
    ```

    Repeat step 12, parts 2-5. Everything still goes to your phone, now from 92744 04398.
20. Go live:

    ```bash
    supabase secrets unset --project-ref cjskyhxameobcqlfiuav WA_TEST_TO
    unset WA_TOKEN WA_WABA_ID WA_APP_ID
    ```

    `WA_ENABLED` stays `true`. Close one real complaint with the customer's code and check that `whatsapp_messages.test_mode` is `false` for it.

**To switch WhatsApp off at any time:** `supabase secrets set --project-ref cjskyhxameobcqlfiuav WA_ENABLED=false`. Technicians are then told to ask the office to close the job. Quotations and vendor emails work as before.
