import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PASSWORD = "Leone123!";

/** Privilegi operativi ampi (come admin operativo), senza manutenzione / tabelle base / gestione sedi. */
const PERMESSI: Record<string, boolean> = {
  titoli: true,
  sinistri: true,
  trattative: true,
  calendario: true,
  contabilita: true,
  rimesse: true,
  ec_clienti: true,
  chiusure: true,
  report: true,
  estrazioni: true,
  anagrafiche: true,
  agenzie: true,
  documentale: true,
  template: true,
  provvigioni: true,
  // Esplicitamente esclusi (solo admin):
  tabelle_base: false,
  uffici: false,
  manutenzione: false,
  riceve_provvigioni: false,
  pagamenti_provvigioni: false,
};

type UfficioRow = {
  id: string;
  codice_ufficio: string | null;
  nome_ufficio: string;
  email: string | null;
  attivo: boolean | null;
};

function parseNomeSede(nomeUfficio: string): { nome: string; cognome: string } {
  const raw = (nomeUfficio || "Sede").trim();
  const cleaned = raw
    .replace(/^SEDE\s+/i, "")
    .replace(/^Ufficio\s+(di\s+)?/i, "")
    .trim();
  return { nome: "Sede", cognome: cleaned || raw };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.secret !== "provision-sedi-2026") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resetPassword = body?.reset_password !== false;
    const dryRun = body?.dry_run === true;

    const url = Deno.env.get("SUPABASE_URL")!;
    const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, srk, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Tutte le sedi operative con email (esclude E2E e aggregati senza mail)
    const { data: uffici, error: uErr } = await admin
      .from("uffici")
      .select("id, codice_ufficio, nome_ufficio, email, attivo")
      .eq("attivo", true)
      .not("email", "is", null)
      .not("codice_ufficio", "is", null)
      .order("codice_ufficio");

    if (uErr) throw new Error(`Fetch uffici: ${uErr.message}`);

    const sedi = ((uffici || []) as UfficioRow[]).filter((u) => {
      const email = (u.email || "").trim().toLowerCase();
      const codice = (u.codice_ufficio || "").trim();
      if (!email || !email.includes("@")) return false;
      if (!codice) return false;
      if (u.nome_ufficio?.startsWith("E2E ")) return false;
      return true;
    });

    const { data: existingList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const byEmail = new Map<string, string>();
    for (const u of existingList?.users ?? []) {
      if (u.email) byEmail.set(u.email.toLowerCase(), u.id);
    }

    const results: Record<string, unknown>[] = [];
    const skipped: Record<string, unknown>[] = [];

    for (const s of sedi) {
      const email = (s.email || "").trim();
      const emailLower = email.toLowerCase();
      const { nome, cognome } = parseNomeSede(s.nome_ufficio);

      if (dryRun) {
        results.push({
          email,
          codice: s.codice_ufficio,
          ufficio_id: s.id,
          action: byEmail.has(emailLower) ? "would_update" : "would_create",
          dry_run: true,
        });
        continue;
      }

      let userId = byEmail.get(emailLower);
      let action: "created" | "updated" = "updated";

      if (!userId) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email,
          password: PASSWORD,
          email_confirm: true,
        });
        if (cErr || !created?.user) {
          results.push({
            email,
            codice: s.codice_ufficio,
            ok: false,
            error: cErr?.message || "createUser failed",
          });
          continue;
        }
        userId = created.user.id;
        byEmail.set(emailLower, userId);
        action = "created";
      } else if (resetPassword) {
        await admin.auth.admin.updateUserById(userId, {
          password: PASSWORD,
          email_confirm: true,
        });
      }

      const { error: pErr } = await admin.rpc("admin_set_sede_profile", {
        p_user_id: userId,
        p_nome: nome,
        p_cognome: cognome,
        p_email: email,
        p_ufficio_id: s.id,
        p_permessi: PERMESSI,
      });

      if (pErr) {
        // Fallback upsert se RPC non ancora deployata
        const { error: upErr } = await admin.from("profiles").upsert(
          {
            id: userId,
            nome,
            cognome,
            email,
            ruolo: "ufficio",
            ufficio_id: s.id,
            attivo: true,
            permessi_json: PERMESSI,
          },
          { onConflict: "id" },
        );
        if (upErr) {
          results.push({
            email,
            codice: s.codice_ufficio,
            ok: false,
            error: "profile: " + (pErr.message || upErr.message),
          });
          continue;
        }
      }

      await admin.from("user_roles").delete().eq("user_id", userId);
      const { error: rErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "ufficio" });

      if (rErr) {
        results.push({
          email,
          codice: s.codice_ufficio,
          ok: false,
          error: "user_roles: " + rErr.message,
        });
        continue;
      }

      // Assicura profilo_sedi (trigger di solito lo fa; idempotente)
      await admin.from("profilo_sedi").upsert(
        { profilo_id: userId, ufficio_id: s.id, primaria: true },
        { onConflict: "profilo_id,ufficio_id" },
      );

      results.push({
        email,
        codice: s.codice_ufficio,
        nome_ufficio: s.nome_ufficio,
        ok: true,
        action,
        user_id: userId,
        ufficio_id: s.id,
        password_reset: resetPassword,
      });
    }

    // Sedi attive senza email → report
    const { data: senzaEmail } = await admin
      .from("uffici")
      .select("id, codice_ufficio, nome_ufficio")
      .eq("attivo", true)
      .not("codice_ufficio", "is", null)
      .is("email", null);

    for (const u of senzaEmail || []) {
      if ((u as UfficioRow).nome_ufficio?.startsWith("E2E ")) continue;
      skipped.push({
        codice: (u as UfficioRow).codice_ufficio,
        nome_ufficio: (u as UfficioRow).nome_ufficio,
        motivo: "Email mancante su sede",
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dry_run: dryRun,
        password: dryRun ? undefined : PASSWORD,
        counts: {
          sedi_con_email: sedi.length,
          processate: results.length,
          ok: results.filter((r) => r.ok === true || r.dry_run).length,
          failed: results.filter((r) => r.ok === false).length,
          skipped_no_email: skipped.length,
        },
        results,
        skipped,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
