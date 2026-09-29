import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sanitize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

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

    // Get all corrispondenti from anagrafiche_professionali
    const { data: records, error: fetchErr } = await supabaseAdmin
      .from("anagrafiche_professionali")
      .select("*")
      .eq("tipo", "corrispondente");

    if (fetchErr) throw fetchErr;
    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nessun corrispondente trovato", creati: 0, errori: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out empty/header rows
    const valid = records.filter((r) => {
      const desc = (r.ragione_sociale || r.cognome || "").trim();
      if (!desc) return false;
      if (desc.toUpperCase().startsWith("SEDE ")) return false;
      return true;
    });

    const emailUsed = new Set<string>();
    let creati = 0;
    let errori = 0;
    let skippati = 0;
    const errors: { id: string; desc: string; error: string }[] = [];

    for (const rec of valid) {
      const desc = rec.ragione_sociale || rec.cognome || "";
      
      // Build email
      let email = rec.email?.toLowerCase().trim();
      if (!email) {
        // Generate fake email
        const cogn = sanitize(rec.cognome) || sanitize(rec.ragione_sociale) || sanitize(rec.codice_fornitore) || "corr";
        const nome = sanitize(rec.nome) || "";
        const base = nome ? `${cogn}.${nome}` : cogn;
        email = `${base}@corr.consulbrokers.local`;
      }

      // Ensure unique
      let authEmail = email;
      if (emailUsed.has(authEmail)) {
        let suffix = 2;
        const [local, domain] = email.split("@");
        while (emailUsed.has(`${local}+${suffix}@${domain}`)) suffix++;
        authEmail = `${local}+${suffix}@${domain}`;
      }
      emailUsed.add(authEmail);

      try {
        // Check if profile already exists for this corrispondente (by codice_fornitore or email)
        const { data: existingProfile } = await supabaseAdmin
          .from("profiles")
          .select("id")
          .eq("email", authEmail)
          .maybeSingle();

        if (existingProfile) {
          skippati++;
          continue;
        }

        // Create auth user
        const { data: authData, error: authError } =
          await supabaseAdmin.auth.admin.createUser({
            email: authEmail,
            password: "Leone123!",
            email_confirm: true,
            user_metadata: {
              nome: rec.nome || "",
              cognome: rec.cognome || rec.ragione_sociale || "",
            },
          });

        if (authError) {
          if (authError.message?.includes("already been registered")) {
            skippati++;
            continue;
          }
          throw authError;
        }

        const userId = authData.user.id;

        // Create profile with all available data
        await supabaseAdmin.from("profiles").upsert({
          id: userId,
          nome: rec.nome || "",
          cognome: rec.cognome || rec.ragione_sociale || "",
          email: authEmail,
          ruolo: "corrispondente",
          attivo: true,
          indirizzo: rec.indirizzo || null,
          cap: rec.cap || null,
          citta: rec.citta || null,
          provincia: rec.provincia || null,
          telefono: rec.telefono || null,
          fax: rec.fax || null,
          numero_rui: rec.numero_rui || null,
          percentuale_base: rec.percentuale_base || null,
          percentuale_ra: rec.percentuale_ra || null,
          iban: rec.iban || null,
          intestatario_cc: rec.intestatario_cc || null,
          codice_contabile: rec.codice_fornitore || null,
          ufficio_id: rec.ufficio_id || null,
        }, { onConflict: "id" });

        // Create user_roles
        await supabaseAdmin.from("user_roles").upsert({
          user_id: userId,
          role: "corrispondente",
        }, { onConflict: "user_id,role" });

        creati++;
      } catch (err: any) {
        errori++;
        errors.push({
          id: rec.id,
          desc,
          error: err.message || String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        totale_anagrafiche: records.length,
        totale_validi: valid.length,
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
