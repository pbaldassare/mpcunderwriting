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
    const { cliente_id } = await req.json();
    if (!cliente_id) {
      return new Response(
        JSON.stringify({ error: "cliente_id richiesto" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Fetch the client record
    const { data: cliente, error: fetchErr } = await supabaseAdmin
      .from("clienti")
      .select("id, email, nome, cognome, ragione_sociale, tipo_cliente, user_id")
      .eq("id", cliente_id)
      .single();

    if (fetchErr || !cliente) {
      return new Response(
        JSON.stringify({ error: "Cliente non trovato" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already provisioned
    if (cliente.user_id) {
      return new Response(
        JSON.stringify({ message: "Utente già esistente", user_id: cliente.user_id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!cliente.email) {
      return new Response(
        JSON.stringify({ error: "Email mancante per il cliente" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const email = cliente.email.toLowerCase().trim();

    // Create auth user
    const { data: authData, error: authError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: "Consul123!",
        email_confirm: true,
        user_metadata: {
          nome: cliente.nome || cliente.ragione_sociale || "",
          cognome: cliente.cognome || "",
        },
      });

    let userId: string;

    if (authError) {
      if (authError.message?.includes("already been registered")) {
        // Find existing user by email
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

    // Upsert profile
    await supabaseAdmin.from("profiles").upsert({
      id: userId,
      nome: cliente.nome || cliente.ragione_sociale || "",
      cognome: cliente.cognome || "",
      email,
      ruolo: "cliente",
      attivo: true,
    }, { onConflict: "id" });

    // Upsert user_roles
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userId,
      role: "cliente",
    }, { onConflict: "user_id,role" });

    // Link to clienti
    await supabaseAdmin
      .from("clienti")
      .update({ user_id: userId })
      .eq("id", cliente_id);

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
