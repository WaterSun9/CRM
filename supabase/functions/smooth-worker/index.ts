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

  // DELETE - deactivate user
  // DELETE - deactivate user
if (req.method === "DELETE") {
  try {
    const { user_id } = await req.json()

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
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
}

  // POST - create user
  if (req.method === "POST") {
    try {
      const body = await req.json()
      console.log("Body:", JSON.stringify(body))

      const { name, email, password, role, user_type } = body

      const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
        email, password, email_confirm: true
      })

      if (authError) return new Response(
        JSON.stringify({ error: authError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

      const { error: profileError } = await adminClient.from("profiles").insert({
        id: authUser.user.id, name, email, role, user_type
      })

      if (profileError) return new Response(
        JSON.stringify({ error: profileError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    } catch (err) {
      console.log("Error:", err.message)
      return new Response(
        JSON.stringify({ error: err.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }
  }

  return new Response(
    JSON.stringify({ error: "Method not allowed" }),
    { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  )
})