const fs = require('fs');
const file = 'supabase/functions/add_user/index.ts';
let content = fs.readFileSync(file, 'utf8');

const targetStr = `            // Step 4: send them a "set your password" email
            // Fire-and-forget — don't await. The account works with the
            // temp password either way, and this shaves seconds off the response.
            adminClient.auth.resetPasswordForEmail(email, {
                redirectTo: "https://watersun9.github.io/CRM/"
            }).catch(err => console.log("Reset email failed:", err.message))`;

const replacementStr = `            // Step 4: send them a "set your password" email using Brevo (bypasses Supabase Rate Limit)
            // Fire-and-forget — don't await.
            adminClient.auth.admin.generateLink({
                type: 'recovery',
                email: email,
                options: { redirectTo: "https://watersun9.github.io/CRM/" }
            }).then(async ({ data: linkData, error: linkError }) => {
                if (linkError) {
                    console.log("Failed to generate link:", linkError.message);
                    return;
                }
                const recoveryLink = linkData?.properties?.action_link;
                if (recoveryLink) {
                    const htmlContent = \`
                        <div style="font-family:Arial,sans-serif;max-width:600px;background:#ffffff;padding:20px;">
                            <h2 style="color:#333;">Welcome to Watersun CRM</h2>
                            <p style="color:#555;font-size:15px;">An account has been created for you by your administrator.</p>
                            <p style="color:#555;font-size:15px;">Please click the button below to securely set your password and access your dashboard.</p>
                            <a href="\${recoveryLink}" style="display:inline-block;padding:12px 24px;background-color:#d97706;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:15px;margin-bottom:15px;">Set My Password</a>
                            <p style="margin-top:20px;font-size:12px;color:#888;">If the button doesn't work, copy and paste this link into your browser: <br/> \${recoveryLink}</p>
                        </div>
                    \`;
                    
                    fetch('https://api.brevo.com/v3/smtp/email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'api-key': Deno.env.get('BREVO_API_KEY')!
                        },
                        body: JSON.stringify({
                            sender: { name: 'Watersun CRM', email: Deno.env.get('SENDER_EMAIL') || 'deeproot120@gmail.com' },
                            to: [{ email: email, name: name }],
                            subject: 'Welcome to Watersun CRM - Set Your Password',
                            htmlContent
                        })
                    }).then(res => {
                        if (!res.ok) console.log("Brevo API non-ok status:", res.status);
                    }).catch(err => console.log("Brevo email fetch failed:", err.message));
                }
            }).catch(err => console.log("Generate link promise failed:", err.message));`;

if (content.includes(targetStr)) {
    content = content.replace(targetStr, replacementStr);
    fs.writeFileSync(file, content, 'utf8');
    console.log("Updated add_user to use Brevo");
} else {
    console.log("Target block not found in add_user/index.ts!");
}
