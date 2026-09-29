import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const email = "pscarpelli@consulbrokers.it";
    const password = "Leone123!";
    const nome = "Pasquale";
    const cognome = "Scarpelli";

    // Check if profile already exists
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ ok: false, message: "Utente già esistente", user_id: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1) Create auth user
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authErr) {
      return new Response(JSON.stringify({ ok: false, step: "auth", error: authErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = created.user!.id;

    // 2) Profile
    const { error: profErr } = await admin.from("profiles").insert({
      id: userId,
      nome,
      cognome,
      email,
      ruolo: "admin",
      attivo: true,
    });
    if (profErr) {
      await admin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ ok: false, step: "profile", error: profErr.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) user_roles
    const { error: roleErr } = await admin
      .from("user_roles")
      .insert({ user_id: userId, role: "admin" });

    // 4) Log
    await admin.from("log_attivita").insert({
      user_id: userId,
      azione: "creazione_utente",
      entita_tipo: "profile",
      entita_id: userId,
      dettagli_json: { nome, cognome, email, ruolo: "admin", origine: "bootstrap-admin" },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        user_id: userId,
        role_inserted: !roleErr,
        role_error: roleErr?.message ?? null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
