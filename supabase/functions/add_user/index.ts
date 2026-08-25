import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const ALLOWED_ORIGINS = ["https://watersun9.github.io", "http://localhost:5173", "http://localhost:3000"]

function getCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin") || ""
    const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
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

        const { data: callerProfile } = await adminClient
            .from("profiles")
            .select("user_type, role, channel_partner")
            .eq("id", caller.id)
            .maybeSingle()

        const callerRole = (callerProfile?.role || "").toLowerCase();
        const callerType = (callerProfile?.user_type || "").toLowerCase();
        const isCP = callerType === "channel_partner_office" || callerType === "office2" || callerRole.includes("partner");
        const isAdmin = callerType === "admin" || callerRole === "admin" || callerRole.includes("admin") || !callerProfile;

        if (!isAdmin && !isCP) {
            return new Response(
                JSON.stringify({ error: "Forbidden: Access denied" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )
        }

        // Security check: Channel Partner Office can only manage users belonging to their own channel partner
        if (isCP && ["deactivate", "reactivate", "delete", "update_email"].includes(action)) {
            const targetId = body.user_id;
            if (targetId) {
                const { data: targetProf } = await adminClient
                    .from("profiles")
                    .select("channel_partner")
                    .eq("id", targetId)
                    .single();
                if (targetProf?.channel_partner !== callerProfile.channel_partner) {
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

            if (authError) return new Response(
                JSON.stringify({ error: authError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

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
            const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
                email, password, email_confirm: true
            })

            if (authError) return new Response(
                JSON.stringify({ error: authError.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            )

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

            // Step 4: send them a "set your password" email
            // Fire-and-forget — don't await. The account works with the
            // temp password either way, and this shaves seconds off the response.
            adminClient.auth.resetPasswordForEmail(email, {
                redirectTo: "https://watersun9.github.io/CRM/"
            }).catch(err => console.log("Reset email failed:", err.message))

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