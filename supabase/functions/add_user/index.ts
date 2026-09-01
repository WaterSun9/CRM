import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// The custom domain must be listed here, not just in Supabase Auth settings.
// A missing origin fails CORS preflight, and the browser never sends the POST -
// which surfaces in the UI as "Could not reach the account-creation service",
// indistinguishable from the function being undeployed.
const ALLOWED_ORIGINS = [
    "https://watersun.deeprootsystems.in",
    "https://watersun9.github.io",
    "http://localhost:5173",
    "http://localhost:3000",
]

function isAllowedOrigin(origin: string) {
    return ALLOWED_ORIGINS.includes(origin)
        || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

function getCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin") || ""
    const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0]
    return {
        "Access-Control-Allow-Origin": allowed,
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
    }
}

serve(async (req) => {
    const corsHeaders = getCorsHeaders(req)
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders })
    }

    const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    try {
        const body = await req.json()
        const action = body.action || (req.method === "DELETE" ? "deactivate" : "create")

        // ── Verify caller is admin ────────────────────────────────────────
        const authHeader = req.headers.get("Authorization")
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Unauthorized: No token provided" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        const token = authHeader.replace("Bearer ", "")
        const { data: { user: caller }, error: callerAuthErr } = await adminClient.auth.getUser(token)

        if (callerAuthErr || !caller) {
            return new Response(
                JSON.stringify({ error: "Unauthorized: Invalid or expired token" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // Capture the error: discarding it made a failed lookup look identical to
        // "no profile row", so any read failure surfaced as a bare 403.
        const { data: callerProfile, error: callerProfileErr } = await adminClient
            .from("profiles")
            .select("user_type, role, channel_partner")
            .eq("id", caller.id)
            .maybeSingle()

        if (callerProfileErr) {
            console.error("Caller profile lookup failed:", callerProfileErr)
            return new Response(
                JSON.stringify({
                    error: "Could not read your profile: " + callerProfileErr.message
                        + " — this is a server-side lookup failure, not a permission problem."
                }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        const callerRole = (callerProfile?.role || "").toLowerCase();
        const callerType = (callerProfile?.user_type || "").toLowerCase();
        // User Management is deliberately limited to the main Admin and main
        // Channel Partner Office accounts. Managers and ordinary partners must
        // not gain account-creation rights through broad role-name matching.
        const isCP = callerType === "channel_partner_office" || callerRole === "channel partner office";
        const isAdmin = callerType === "admin" || callerRole === "admin";

        if (!isAdmin && !isCP) {
            // Say what was actually seen, so a missing profile is distinguishable
            // from a wrong role without digging through logs.
            const detail = !callerProfile
                ? `no profile row exists for your account (auth id ${caller.id}, ${caller.email})`
                : `your account is user_type='${callerProfile.user_type}', role='${callerProfile.role}' — only Admin or the main Channel Partner Office account can manage users`;
            console.error("Access denied:", detail)
            return new Response(
                JSON.stringify({ error: "Forbidden: Access denied — " + detail }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // Security check: Channel Partner Office can only manage users belonging to
        // their own channel partner. Admins skip this entirely (isCP is false for
        // them), so nothing here affects Admin-initiated actions.
        //
        // update_password is included: the UI only ever lists a CPO's own branch,
        // but the function accepted any user_id, so a crafted call could set an
        // Admin's password. It is now held to the same rule as delete/update_email.
        if (isCP && ["deactivate", "reactivate", "delete", "update_email", "update_password"].includes(action)) {
            const targetId = body.user_id;
            if (targetId) {
                const { data: targetProf, error: targetErr } = await adminClient
                    .from("profiles")
                    .select("channel_partner")
                    .eq("id", targetId)
                    .single();

                // Branch names are compared the way the rest of the app compares
                // them — trimmed and case-insensitive. A strict !== would lock a
                // CPO out of their own users over "Radhe Solar" vs "RADHE SOLAR".
                const norm = (value: string | null | undefined) => String(value ?? "").trim().toUpperCase();
                const sameBranch = !targetErr && targetProf
                    && norm(targetProf.channel_partner) === norm(callerProfile?.channel_partner);

                // A CPO may always act on their own account (e.g. change their password).
                const isSelf = targetId === caller.id;

                if (!sameBranch && !isSelf) {
                    return new Response(
                        JSON.stringify({ error: "Forbidden: You do not own this sub-partner account" }),
                        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    )
                }
            }
        }

        // ── DEACTIVATE USER ───────────────────────────────────────────────
        if (action === "deactivate") {
            const { user_id } = body

            if (!user_id) return new Response(
                JSON.stringify({ error: "user_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            const { error: profileError } = await adminClient
                .from("profiles")
                .update({ status: "inactive" })
                .eq("id", user_id)

            if (profileError) return new Response(
                JSON.stringify({ error: profileError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── REACTIVATE USER ──────────────────────────────────────────────
        if (action === "reactivate") {
            const { user_id } = body

            if (!user_id) return new Response(
                JSON.stringify({ error: "user_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            const { error: profileError } = await adminClient
                .from("profiles")
                .update({ status: "active" })
                .eq("id", user_id)

            if (profileError) return new Response(
                JSON.stringify({ error: profileError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── DELETE USER (permanent) ──────────────────────────────────────
        if (action === "delete") {
            const { user_id } = body

            if (!user_id) return new Response(
                JSON.stringify({ error: "user_id is required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            // Delete from auth (profiles row cascades via FK)
            const { error: authError } = await adminClient.auth.admin.deleteUser(user_id)

            if (authError) {
                const errMsg = (authError.message || "").toLowerCase()
                // If user is already not found in auth.users, that is non-fatal: proceed to clean up profile
                const isNotFound = errMsg.includes("not found") || errMsg.includes("no user") || (authError as any).status === 404
                if (!isNotFound) {
                    console.error("Auth delete error:", authError)
                    return new Response(
                        JSON.stringify({ error: authError.message }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    )
                }
            }

            // Always ensure the profile row in profiles table is deleted
            const { error: profileDeleteError } = await adminClient
                .from("profiles")
                .delete()
                .eq("id", user_id)

            if (profileDeleteError) {
                console.error("Profile delete error after auth deletion:", profileDeleteError)
                return new Response(
                    JSON.stringify({ error: "Auth user deleted, but profiles row cleanup failed: " + profileDeleteError.message }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
            }

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── UPDATE USER EMAIL ─────────────────────────────────────────────
        if (action === "update_email") {
            const { user_id, new_email } = body

            if (!user_id || !new_email) return new Response(
                JSON.stringify({ error: "user_id and new_email are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            // Step 1: Update Auth user email using service role adminClient
            const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, {
                email: new_email,
                email_confirm: true
            })

            if (authError) return new Response(
                JSON.stringify({ error: authError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            // Step 2: Update Profile email
            const { error: profileError } = await adminClient
                .from("profiles")
                .update({ email: new_email })
                .eq("id", user_id)

            if (profileError) return new Response(
                JSON.stringify({ error: profileError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── UPDATE USER PASSWORD ──────────────────────────────────────────
        if (action === "update_password") {
            const { user_id, new_password } = body

            if (!user_id || !new_password) return new Response(
                JSON.stringify({ error: "user_id and new_password are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            if (new_password.length < 6) return new Response(
                JSON.stringify({ error: "Password must be at least 6 characters" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, {
                password: new_password
            })

            if (authError) return new Response(
                JSON.stringify({ error: authError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── CREATE USER ───────────────────────────────────────────────────
        if (action === "create") {
            console.log("Body:", JSON.stringify(body))

            let { name, email, password, role, user_type, channel_partner } = body

            if (isCP) {
                // Limit creations for CP Office: allow Manager (office2) or Field CP (agent2)
                if (user_type === "office2") {
                    user_type = "office2";
                    role = "Channel Partner Manager";
                } else {
                    user_type = "agent2";
                    role = "Channel Partner";
                }
                channel_partner = (callerProfile?.channel_partner || callerProfile?.name || body.channel_partner || "").trim();
            }

            // Step 1: create the auth user with the dummy/temp password
            let authUser = null
            let { data: newAuthUser, error: authError } = await adminClient.auth.admin.createUser({
                email, password, email_confirm: true
            })

            if (authError) {
                // If user already exists in auth, check if it's an orphaned auth account (no profile row)
                const errMsg = (authError.message || "").toLowerCase()
                if (errMsg.includes("already exists") || errMsg.includes("already registered") || errMsg.includes("unique constraint")) {
                    const { data: listData } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 })
                    const existingAuthUser = listData?.users?.find(u => u.email?.toLowerCase() === email?.toLowerCase())
                    
                    if (existingAuthUser) {
                        const { data: existingProfile } = await adminClient
                            .from("profiles")
                            .select("id")
                            .eq("id", existingAuthUser.id)
                            .maybeSingle()

                        if (existingProfile) {
                            return new Response(
                                JSON.stringify({ error: "A user with this email address already exists in the system." }),
                                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                            )
                        } else {
                            // Clean up orphaned auth user leftover from previous deletion
                            await adminClient.auth.admin.deleteUser(existingAuthUser.id)
                            const retry = await adminClient.auth.admin.createUser({
                                email, password, email_confirm: true
                            })
                            if (retry.error) {
                                return new Response(
                                    JSON.stringify({ error: retry.error.message }),
                                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                                )
                            }
                            authUser = retry.data
                        }
                    } else {
                        return new Response(
                            JSON.stringify({ error: authError.message }),
                            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        )
                    }
                } else {
                    return new Response(
                        JSON.stringify({ error: authError.message }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    )
                }
            } else {
                authUser = newAuthUser
            }

            // Step 2: create their profile row
            const { error: profileError } = await adminClient.from("profiles").insert({
                id: authUser.user.id,
                created_by: caller.id,
                name,
                email,
                role,
                user_type,
                channel_partner
            })

            if (profileError) {
                // roll back the auth user so we don't leave an orphaned account behind
                await adminClient.auth.admin.deleteUser(authUser.user.id)
                return new Response(
                    JSON.stringify({ error: profileError.message }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
            }

            // A CPO branch is also a shared partner choice throughout the CRM.
            // Add the typed branch name to metadata once, so it immediately
            // appears in Channel Partner/CPO dropdowns as well as the CPO list.
            if (user_type === "channel_partner_office" && channel_partner) {
                const branchName = String(channel_partner).trim()
                const { data: existingBranch, error: branchLookupError } = await adminClient
                    .from("metadata")
                    .select("id")
                    .eq("category", "channel_partner")
                    .ilike("label", branchName)
                    .maybeSingle()

                if (branchLookupError) {
                    await adminClient.from("profiles").delete().eq("id", authUser.user.id)
                    await adminClient.auth.admin.deleteUser(authUser.user.id)
                    return new Response(
                        JSON.stringify({ error: "Could not check the CPO directory: " + branchLookupError.message }),
                        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    )
                }

                if (!existingBranch) {
                    const { error: branchInsertError } = await adminClient
                        .from("metadata")
                        .insert({ category: "channel_partner", label: branchName })

                    if (branchInsertError) {
                        await adminClient.from("profiles").delete().eq("id", authUser.user.id)
                        await adminClient.auth.admin.deleteUser(authUser.user.id)
                        return new Response(
                            JSON.stringify({ error: "Could not add the CPO name to the shared directory: " + branchInsertError.message }),
                            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                        )
                    }
                }
            }

            // Step 3: If user is a vendor, ensure they are present in the vendors directory table
            if (user_type === "vendor" || role === "Vendors") {
                try {
                    const { data: existingV } = await adminClient
                        .from("vendors")
                        .select("id")
                        .or(`email.ilike.${email},name.ilike.${name}`)
                        .maybeSingle();

                    if (!existingV) {
                        await adminClient.from("vendors").insert({ name, email });
                    }
                } catch (vErr) {
                    console.log("Vendor table auto-sync notice:", vErr);
                }
            }

            // Step 4: send them a "set your password" email using Brevo (bypasses Supabase Rate Limit)
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
                    const htmlContent = `
                        <div style="font-family:Arial,sans-serif;max-width:600px;background:#ffffff;padding:20px;">
                            <h2 style="color:#333;">Welcome to Watersun CRM</h2>
                            <p style="color:#555;font-size:15px;">An account has been created for you by your administrator.</p>
                            <p style="color:#555;font-size:15px;">Please click the button below to securely set your password and access your dashboard.</p>
                            <a href="${recoveryLink}" style="display:inline-block;padding:12px 24px;background-color:#d97706;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;margin-top:15px;margin-bottom:15px;">Set My Password</a>
                            <p style="margin-top:20px;font-size:12px;color:#888;">If the button doesn't work, copy and paste this link into your browser: <br/> ${recoveryLink}</p>
                        </div>
                    `;
                    
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
            }).catch(err => console.log("Generate link promise failed:", err.message));

            return new Response(
                JSON.stringify({ success: true }),
                { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // ── UNKNOWN ACTION ────────────────────────────────────────────────
        return new Response(
            JSON.stringify({ error: `Unknown action: ${action}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (err) {
        console.log("Error:", err.message)
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})
