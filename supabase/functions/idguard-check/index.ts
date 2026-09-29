// Avvia una verifica ID Guard per un cliente CBnet.
// Tutti i clienti usano lo stesso IDGUARD_CLIENT_ID. Nessuna chiamata automatica.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  IDGUARD_API_BASE,
  isCooldownActive,
  mapIdGuardResult,
  nextVerificaAtIso,
  type IdGuardCheckTipo,
} from "./idGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeEmail(value: unknown): string | null {
  const v = String(value || "").trim().toLowerCase();
  return v && EMAIL_RE.test(v) ? v : null;
}

function extractDomain(value: unknown): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  let host = raw.includes("@")
    ? raw.slice(raw.lastIndexOf("@") + 1)
    : raw.replace(/^https?:\/\//, "").replace(/^\/\//, "");
  host = host.split("/")[0].split("?")[0].split("#")[0].replace(/:\d+$/, "").replace(/^www\./, "");
  if (!host || !host.includes(".") || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(host)) return null;
  return host;
}

function resolveTarget(cliente: Record<string, unknown>):
  | { ok: true; tipo: IdGuardCheckTipo; target: string }
  | { ok: false; tipo: IdGuardCheckTipo; missing: string } {
  const tipoCliente = String(cliente.tipo_cliente || "").trim().toLowerCase();
  if (tipoCliente === "privato") {
    const email =
      normalizeEmail(cliente.email) ||
      normalizeEmail(cliente.referente_email) ||
      normalizeEmail(cliente.pec);
    if (!email) return { ok: false, tipo: "email", missing: "email" };
    return { ok: true, tipo: "email", target: email };
  }
  const domain =
    extractDomain(cliente.email) || extractDomain(cliente.pec) || extractDomain(cliente.referente_email);
  if (!domain) return { ok: false, tipo: "domain", missing: "domain" };
  return { ok: true, tipo: "domain", target: domain };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Metodo non consentito" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Non autenticato" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Configurazione server mancante" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const envKey = Deno.env.get("IDGUARD_API_KEY");
  const envClient = Deno.env.get("IDGUARD_CLIENT_ID");
  let apiKey = envKey || null;
  let clientId = envClient || null;
  if (!apiKey || !clientId) {
    const { data: cfg } = await admin.rpc("idguard_config");
    const row = cfg && typeof cfg === "object" ? cfg as Record<string, string | null> : {};
    apiKey = apiKey || row.api_key || null;
    clientId = clientId || row.client_id || null;
  }
  if (!apiKey || !clientId) {
    return json({ error: "ID Guard non configurato: mancano IDGUARD_API_KEY o IDGUARD_CLIENT_ID" }, 500);
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  const caller = authData?.user;
  if (authError || !caller) return json({ error: "Non autenticato" }, 401);

  const { data: profile } = await admin
    .from("profiles")
    .select("id, ruolo, attivo")
    .eq("id", caller.id)
    .maybeSingle();

  if (!profile || profile.attivo === false || ["cliente", "prospect"].includes(String(profile.ruolo))) {
    return json({ error: "Permesso negato" }, 403);
  }

  let body: { cliente_id?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Body JSON non valido" }, 400);
  }

  const clienteId = String(body.cliente_id || "").trim();
  if (!clienteId) return json({ error: "cliente_id obbligatorio" }, 400);

  const { data: cliente, error: clienteErr } = await admin
    .from("clienti")
    .select("id, tipo_cliente, email, pec, referente_email")
    .eq("id", clienteId)
    .maybeSingle();
  if (clienteErr || !cliente) return json({ error: "Cliente non trovato" }, 404);

  const target = resolveTarget(cliente);
  if (!target.ok) {
    return json({
      error: target.missing === "email" ? "Manca l'email del cliente" : "Manca il dominio del cliente",
      code: "missing_target",
      missing: target.missing,
    }, 400);
  }

  const { data: existing } = await admin
    .from("idguard_verifiche")
    .select("*")
    .eq("cliente_id", clienteId)
    .eq("tipo", target.tipo)
    .eq("target", target.target)
    .maybeSingle();

  const isAdmin = String(profile.ruolo) === "admin";
  if (existing && !isAdmin && isCooldownActive(existing.prossima_verifica_at)) {
    return json({
      error: "Verifica già richiesta nelle ultime 24 ore",
      code: "cooldown",
      verifica: existing,
      prossima_verifica_at: existing.prossima_verifica_at,
    }, 409);
  }

  const now = new Date();
  const chiamataAt = now.toISOString();
  const prossima = nextVerificaAtIso(now);
  const row = {
    cliente_id: clienteId,
    tipo: target.tipo,
    target: target.target,
    stato: "in_corso",
    chiamata_at: chiamataAt,
    prossima_verifica_at: prossima,
    idguard_client_id: clientId,
    created_by: caller.id,
    error_message: null,
  };

  const { data: saved, error: saveErr } = await admin
    .from("idguard_verifiche")
    .upsert(row, { onConflict: "cliente_id,tipo,target_norm" })
    .select("*")
    .maybeSingle();

  // unique index on expression may not be a valid ON CONFLICT target — fallback update/insert
  let verifica = saved;
  if (saveErr || !verifica) {
    if (existing?.id) {
      const upd = await admin.from("idguard_verifiche").update(row).eq("id", existing.id).select("*").maybeSingle();
      if (upd.error) return json({ error: upd.error.message }, 500);
      verifica = upd.data;
    } else {
      const ins = await admin.from("idguard_verifiche").insert(row).select("*").maybeSingle();
      if (ins.error) return json({ error: ins.error.message }, 500);
      verifica = ins.data;
    }
  }
  if (!verifica) return json({ error: "Impossibile salvare la verifica" }, 500);

  const path = target.tipo === "email" ? "/checks/email" : "/checks/domain";
  const payload = target.tipo === "email"
    ? { client_id: clientId, email: target.target }
    : { client_id: clientId, domain: target.target };

  let apiJson: unknown = null;
  let apiError: string | null = null;
  try {
    const res = await fetch(`${IDGUARD_API_BASE}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    try {
      apiJson = text ? JSON.parse(text) : null;
    } catch {
      apiJson = { raw: text };
    }
    if (!res.ok) {
      const errObj = (apiJson && typeof apiJson === "object")
        ? (apiJson as { error?: { message?: string; code?: string } }).error
        : null;
      apiError = errObj?.message || `ID Guard HTTP ${res.status}`;
    }
  } catch (err) {
    apiError = (err as Error)?.message || "Chiamata ID Guard fallita";
  }

  const esito = apiError ? null : mapIdGuardResult(target.tipo, apiJson);
  const update = {
    stato: apiError ? "errore" : "completata",
    error_message: apiError,
    result_json: apiJson,
    is_pwned: esito?.is_pwned ?? null,
    mail_esposte: esito?.mail_esposte ?? null,
    password_esposte: esito?.password_esposte ?? null,
    breach_count: esito?.breach_count ?? null,
    explanation: esito?.explanation ?? null,
  };

  const { data: finalRow, error: finalErr } = await admin
    .from("idguard_verifiche")
    .update(update)
    .eq("id", verifica.id)
    .select("*")
    .maybeSingle();

  if (finalErr) return json({ error: finalErr.message }, 500);

  if (apiError) {
    return json({ error: apiError, code: "idguard_error", verifica: finalRow }, 502);
  }

  return json({ ok: true, verifica: finalRow });
});
