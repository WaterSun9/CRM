import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, DELETE, OPTIONS",
}

serve(async (req) => {
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

        // ── CREATE USER ───────────────────────────────────────────────────
        if (action === "create") {
            console.log("Body:", JSON.stringify(body))

            const { name, email, password, role, user_type } = body

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
                id: authUser.user.id, name, email, role, user_type
            })

            if (profileError) {
                // roll back the auth user so we don't leave an orphaned account behind
                await adminClient.auth.admin.deleteUser(authUser.user.id)
                return new Response(
                    JSON.stringify({ error: profileError.message }),
                    { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                )
            }

            // Step 3: send them a "set your password" email
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