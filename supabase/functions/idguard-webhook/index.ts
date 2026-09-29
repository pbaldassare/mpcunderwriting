// Webhook HTTPS chiamato da ID Guard a verifica completata.
// Firma HMAC: t + '.' + rawBody con IDGUARD_WEBHOOK_SECRET (whsec_...).
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  mapIdGuardResult,
  verifyIdGuardWebhook,
  webhookEventTipo,
  webhookTarget,
} from "./idGuard.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo non consentito" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Configurazione webhook mancante" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let secret = Deno.env.get("IDGUARD_WEBHOOK_SECRET") || null;
  if (!secret) {
    const { data: cfg } = await admin.rpc("idguard_config");
    const row = cfg && typeof cfg === "object" ? cfg as Record<string, string | null> : {};
    secret = row.webhook_secret || null;
  }
  if (!secret) {
    return new Response(JSON.stringify({ error: "Configurazione webhook mancante" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();
  const verified = await verifyIdGuardWebhook(
    secret,
    req.headers.get("X-IDGuard-Signature"),
    rawBody,
  );
  if (!verified.ok) {
    return new Response(JSON.stringify({ error: verified.reason }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const eventType = req.headers.get("X-IDGuard-Event") || "";
  if (eventType === "webhook.test") {
    return new Response(JSON.stringify({ ok: true, test: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = rawBody ? JSON.parse(rawBody) as Record<string, unknown> : {};
  } catch {
    return new Response(JSON.stringify({ error: "json_non_valido" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tipo = webhookEventTipo(eventType || String(parsed.type || ""));
  if (!tipo) {
    return new Response(JSON.stringify({ ok: true, ignored: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = (parsed.data && typeof parsed.data === "object")
    ? parsed.data as Record<string, unknown>
    : {};
  const target = webhookTarget(tipo, data);
  const eventoId = String(parsed.id || req.headers.get("X-IDGuard-Delivery") || "").trim() || null;
  const resultPayload = data.result ?? parsed;
  const esito = mapIdGuardResult(tipo, resultPayload);

  const update = {
    stato: "completata",
    error_message: null as string | null,
    evento_id: eventoId,
    result_json: parsed,
    is_pwned: esito.is_pwned,
    mail_esposte: esito.mail_esposte,
    password_esposte: esito.password_esposte,
    breach_count: esito.breach_count,
    explanation: esito.explanation,
  };

  if (eventoId) {
    const byEvent = await admin
      .from("idguard_verifiche")
      .update(update)
      .eq("evento_id", eventoId)
      .select("id");
    if (!byEvent.error && (byEvent.data?.length ?? 0) > 0) {
      return new Response(JSON.stringify({ ok: true, updated: byEvent.data.length, via: "evento_id" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!target) {
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: "target_assente" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  const byTarget = await admin
    .from("idguard_verifiche")
    .update(update)
    .eq("tipo", tipo)
    .eq("target", target)
    .select("id");

  return new Response(
    JSON.stringify({
      ok: true,
      updated: byTarget.data?.length ?? 0,
      via: "target",
      error: byTarget.error?.message ?? null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
