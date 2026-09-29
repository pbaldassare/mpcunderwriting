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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get all clients without user_id
    const { data: clienti, error: fetchErr } = await supabaseAdmin
      .from("clienti")
      .select("id, email, nome, cognome, ragione_sociale, tipo_cliente")
      .is("user_id", null)
      .not("email", "is", null)
      .limit(500);

    if (fetchErr) throw fetchErr;
    if (!clienti || clienti.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nessun cliente da processare", creati: 0, errori: 0, skippati: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Count email occurrences to handle duplicates
    const emailCounts: Record<string, number> = {};
    for (const c of clienti) {
      const email = c.email?.toLowerCase().trim();
      if (email) {
        emailCounts[email] = (emailCounts[email] || 0) + 1;
      }
    }

    const emailUsed: Record<string, number> = {};
    let creati = 0;
    let errori = 0;
    let skippati = 0;
    const errors: { id: string; email: string; error: string }[] = [];

    for (const cliente of clienti) {
      const rawEmail = cliente.email?.toLowerCase().trim();
      if (!rawEmail) {
        skippati++;
        continue;
      }

      // Build unique auth email (add +N suffix for duplicates)
      let authEmail = rawEmail;
      if (emailCounts[rawEmail] > 1) {
        const idx = (emailUsed[rawEmail] || 0) + 1;
        emailUsed[rawEmail] = idx;
        if (idx > 1) {
          const [local, domain] = rawEmail.split("@");
          authEmail = `${local}+${idx}@${domain}`;
        } else {
          emailUsed[rawEmail] = 1;
        }
      }

      try {
        // Create auth user
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: "Leone123!",
            email_confirm: true,
            user_metadata: {
              nome: cliente.nome || cliente.ragione_sociale || "",
              cognome: cliente.cognome || "",
            },
          });

        if (authError) {
          // If user already exists, try to find and link
          if (authError.message?.includes("already been registered")) {
            const { data: existingUsers } =
              await supabaseAdmin.auth.admin.listUsers();
            const existing = existingUsers?.users?.find(
              (u) => u.email === authEmail
            );
            if (existing) {
              // Link existing user
              await supabaseAdmin
                .from("clienti")
                .update({ user_id: existing.id })
                .eq("id", cliente.id);
              
              // Ensure profile exists
              await supabaseAdmin.from("profiles").upsert({
                id: existing.id,
                nome: cliente.nome || cliente.ragione_sociale || "",
                cognome: cliente.cognome || "",
                email: authEmail,
                ruolo: "cliente",
                attivo: true,
              }, { onConflict: "id" });

              // Ensure user_roles exists
              await supabaseAdmin.from("user_roles").upsert({
                user_id: existing.id,
                role: "cliente",
              }, { onConflict: "user_id,role" });

              creati++;
              continue;
            }
          }
          throw authError;
        }

        const userId = authData.user.id;

        // Create profile
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          nome: cliente.nome || cliente.ragione_sociale || "",
          cognome: cliente.cognome || "",
          email: authEmail,
          ruolo: "cliente",
          attivo: true,
        }, { onConflict: "id" });

        // Create user_roles
        await supabaseAdmin.from("user_roles").upsert({
          user_id: userId,
          role: "cliente",
        }, { onConflict: "user_id,role" });

        // Link to clienti
        await supabaseAdmin
          .from("clienti")
          .update({ user_id: userId })
          .eq("id", cliente.id);

        creati++;
      } catch (err: any) {
        errori++;
        errors.push({
          id: cliente.id,
          email: rawEmail,
          error: err.message || String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        totale_processati: clienti.length,
        creati,
        errori,
        skippati,
        dettagli_errori: errors.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
