import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { prospect_id } = await req.json();
    if (!prospect_id) {
      return new Response(
        JSON.stringify({ error: "prospect_id richiesto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: prospect, error: fetchErr } = await supabaseAdmin
      .from("prospect")
      .select("id, email, nome, cognome, user_id")
      .eq("id", prospect_id)
      .single();

    if (fetchErr || !prospect) {
      return new Response(
        JSON.stringify({ error: "Prospect non trovato" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (prospect.user_id) {
      return new Response(
        JSON.stringify({ message: "Utente già esistente", user_id: prospect.user_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!prospect.email) {
      return new Response(
        JSON.stringify({ error: "Email mancante per il prospect" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = prospect.email.toLowerCase().trim();

    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: "Leone123!",
        email_confirm: true,
        user_metadata: {
          nome: prospect.nome || "",
          cognome: prospect.cognome || "",
        },
      });

    let userId: string;

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const existing = listData?.users?.find((u) => u.email === email);
        if (!existing) {
          return new Response(
            JSON.stringify({ error: "Email già registrata ma utente non trovato" }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = existing.id;
      } else {
        throw authError;
      }
    } else {
      userId = authData.user.id;
    }

    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      nome: prospect.nome || "",
      cognome: prospect.cognome || "",
      email,
      ruolo: "prospect",
      attivo: true,
    }, { onConflict: "id" });

    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: "user",
    }, { onConflict: "user_id,role" });

    await supabaseAdmin
      .from("prospect")
      .update({ user_id: userId })
      .eq("id", prospect_id);

    return new Response(
      JSON.stringify({ success: true, user_id: userId, email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
