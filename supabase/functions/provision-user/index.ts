import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { secret } = await req.json();
    
    if (secret !== "provision-segreteria-2026") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const targetEmail = "segreteria@consulbrokers.it";
    const targetPassword = "Leone123!";
    const ufficio_id = "f5163c49-1e7e-48b5-9ac6-5494a9d4ce4a";

    // 1. Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u: any) => u.email === targetEmail);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Force password reset and confirm email
      const { error: updateErr } = await adminClient.auth.admin.updateUserById(userId, {
        password: targetPassword,
        email_confirm: true,
      });
      if (updateErr) {
        return new Response(JSON.stringify({ error: "update_auth: " + updateErr.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Create new user
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: targetEmail,
        password: targetPassword,
        email_confirm: true,
      });
      if (createError) {
        return new Response(JSON.stringify({ error: "create_auth: " + createError.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = newUser.user.id;
    }

    // 2. Upsert profile
    const { error: profileError } = await adminClient.from("profiles").upsert({
      id: userId,
      nome: "Segreteria",
      cognome: "Consulbrokers",
      email: targetEmail,
      ruolo: "ufficio",
      ufficio_id,
      attivo: true,
      permessi_json: {
        dashboard: true,
        titoli: true,
        portafoglio: true,
        contabilita: true,
        anagrafiche: true,
      },
    }, { onConflict: "id" });

    if (profileError) {
      return new Response(JSON.stringify({ error: "profile: " + profileError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Upsert role
    const { error: roleError } = await adminClient.from("user_roles").upsert({
      user_id: userId,
      role: "ufficio",
    }, { onConflict: "user_id,role" });

    if (roleError) {
      // Try insert ignoring conflict
      await adminClient.from("user_roles").insert({
        user_id: userId,
        role: "ufficio",
      });
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, action: existingUser ? "updated" : "created" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
