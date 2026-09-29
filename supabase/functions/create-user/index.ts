import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function readKeyFromJsonEnv(envName: string): string | undefined {
  const raw = Deno.env.get(envName);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const defaultKey = parsed.default;
    if (typeof defaultKey === "string" && defaultKey.trim()) return defaultKey.trim();

    const firstStringKey = Object.values(parsed).find(
      (value): value is string => typeof value === "string" && value.trim().length > 0,
    );
    return firstStringKey?.trim();
  } catch {
    return raw.trim() || undefined;
  }
}

function getSupabaseAdminConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() ||
    readKeyFromJsonEnv("SUPABASE_SECRET_KEYS") ||
    Deno.env.get("SUPABASE_SECRET_KEY")?.trim();

  return { supabaseUrl, serviceRoleKey };
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { supabaseUrl, serviceRoleKey } = getSupabaseAdminConfig();

    console.log("[create-user] env check", {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
      hasSecretKeysJson: !!Deno.env.get("SUPABASE_SECRET_KEYS"),
      hasSecretKey: !!Deno.env.get("SUPABASE_SECRET_KEY"),
      hasAnonKey: !!Deno.env.get("SUPABASE_ANON_KEY"),
      hasPublishableKey: !!Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    });

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configurazione server mancante: SUPABASE_URL o chiave admin Supabase non disponibili" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Valida il JWT del chiamante usando l'admin client (non serve l'anon key)
    const {
      data: { user: caller },
      error: authError,
    } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !caller) {
      return jsonResponse({ error: "Non autenticato" }, 401);
    }

    const { data: roles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin");


    if (!roles || roles.length === 0) {
      return jsonResponse({ error: "Accesso non autorizzato" }, 403);
    }

    const body = await req.json();
    const action = body.action || "create";

    // ---- Action: reset-password ----
    if (action === "reset-password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return jsonResponse({ error: "user_id e password obbligatori" }, 400);
      }
      const { error: updErr } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (updErr) {
        return jsonResponse({ error: `Errore reset password: ${updErr.message}` }, 400);
      }
      await adminClient.from("log_attivita").insert({
        user_id: caller.id,
        azione: "reset_password_utente",
        entita_tipo: "profile",
        entita_id: user_id,
        dettagli_json: { reset_by: caller.email },
      });
      return jsonResponse({ success: true });
    }

    const {
      nome, cognome, email, ruolo, ufficio_id, permessi_json, password,
      descrizione, indirizzo, cap, citta, provincia, telefono, fax,
      codice_fiscale, nome_rui, data_iscrizione_rui, numero_rui, sezione_rui,
      codice_contabile, percentuale_base, percentuale_consulenza, percentuale_ra,
      iban, intestatario_cc,
    } = body;

    if (!email || !nome || !cognome || !ruolo) {
      return jsonResponse({ error: "Campi obbligatori mancanti: nome, cognome, email, ruolo" }, 400);
    }

    const userPassword = password || "Temp123!";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
    });

    if (createError) {
      const alreadyRegistered = createError.message?.toLowerCase().includes("already") || createError.message?.toLowerCase().includes("registered");
      return jsonResponse(
        { error: alreadyRegistered ? "Email già registrata: usa un indirizzo diverso o resetta l'utente esistente" : `Errore creazione utente: ${createError.message}` },
        alreadyRegistered ? 409 : 400,
      );
    }

    const newUserId = newUser.user.id;

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: newUserId,
      nome,
      cognome,
      email,
      ruolo,
      ufficio_id: ufficio_id || null,
      permessi_json: permessi_json || null,
      attivo: true,
      descrizione: descrizione || null,
      indirizzo: indirizzo || null,
      cap: cap || null,
      citta: citta || null,
      provincia: provincia || null,
      telefono: telefono || null,
      fax: fax || null,
      codice_fiscale: codice_fiscale || null,
      nome_rui: nome_rui || null,
      data_iscrizione_rui: data_iscrizione_rui || null,
      numero_rui: numero_rui || null,
      sezione_rui: sezione_rui || null,
      codice_contabile: codice_contabile || null,
      percentuale_base: percentuale_base ?? null,
      percentuale_consulenza: percentuale_consulenza ?? null,
      percentuale_ra: percentuale_ra ?? null,
      iban: iban || null,
      intestatario_cc: intestatario_cc || null,
    });

    if (profileError) {
      await adminClient.auth.admin.deleteUser(newUserId);
      return jsonResponse({ error: `Errore creazione profilo: ${profileError.message}` }, 400);
    }

    const { error: roleError } = await adminClient.from("user_roles").insert({
      user_id: newUserId,
      role: ruolo,
    });

    if (roleError) {
      console.error("Error assigning role:", roleError.message);
    }

    const { error: logError } = await adminClient.from("log_attivita").insert({
      user_id: caller.id,
      azione: "creazione_utente",
      entita_tipo: "profile",
      entita_id: newUserId,
      dettagli_json: { nome, cognome, email, ruolo, ufficio_id },
    });

    if (logError) {
      console.error("Error logging activity:", logError.message);
    }

    return jsonResponse({
      success: true,
      user_id: newUserId,
      message: "Utente creato con successo.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[create-user] unhandled error", message);
    return jsonResponse({ error: `Errore interno: ${message}` }, 500);
  }
});
