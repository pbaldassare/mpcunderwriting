import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResendDomain {
  id: string;
  name: string;
  status: string;
  created_at: string;
  region: string;
  records?: Array<{
    record: string;
    name: string;
    type: string;
    ttl: string | number;
    status: string;
    value: string;
    priority?: number;
  }>;
}

async function handleDomainsCheck(RESEND_API_KEY: string) {
  const listRes = await fetch("https://api.resend.com/domains", {
    method: "GET",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  const listData = await listRes.json();
  if (!listRes.ok) {
    return {
      ok: false,
      payload: {
        error: "Impossibile leggere domini da Resend",
        status: listRes.status,
        details: listData,
      },
    };
  }
  const domains: ResendDomain[] = listData?.data || [];
  const detailed = await Promise.all(
    domains.map(async (d) => {
      try {
        const r = await fetch(`https://api.resend.com/domains/${d.id}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        const dd = await r.json();
        return r.ok ? dd : { ...d, _detail_error: dd };
      } catch (e: any) {
        return { ...d, _detail_error: e?.message };
      }
    }),
  );
  return { ok: true, payload: { success: true, count: detailed.length, domains: detailed } };
}

async function lookupEmail(RESEND_API_KEY: string, email: string) {
  const normalized = email.trim().toLowerCase();
  // 1) Cerca negli ultimi 100 messaggi inviati
  // Resend non ha filtro server-side per "to": prendiamo lista e filtriamo lato server
  const emailsRes = await fetch("https://api.resend.com/emails?limit=100", {
    method: "GET",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  const emailsData = await emailsRes.json();
  let recent: any[] = [];
  if (emailsRes.ok && Array.isArray(emailsData?.data)) {
    recent = emailsData.data.filter((m: any) => {
      const tos: string[] = Array.isArray(m.to) ? m.to : (m.to ? [m.to] : []);
      return tos.some((t) => String(t).toLowerCase() === normalized);
    });
  }

  // Per ognuno (max 5) recuperiamo lo stato dettagliato (delivered/bounced/complained)
  const detailed = await Promise.all(
    recent.slice(0, 5).map(async (m) => {
      try {
        const r = await fetch(`https://api.resend.com/emails/${m.id}`, {
          method: "GET",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
        });
        const dd = await r.json();
        return r.ok ? dd : { ...m, _detail_error: dd };
      } catch (e: any) {
        return { ...m, _detail_error: e?.message };
      }
    }),
  );

  // Determina stato sintetico
  const statuses = detailed.map((m) => m?.last_event || m?.status).filter(Boolean);
  const hasBounce = statuses.some((s) => String(s).toLowerCase().includes("bounce"));
  const hasComplaint = statuses.some((s) => String(s).toLowerCase().includes("complain"));
  const allDelivered = statuses.length > 0 && statuses.every((s) => String(s).toLowerCase() === "delivered");

  let synthetic: "delivered" | "bounced" | "complained" | "pending" | "no_history" = "no_history";
  if (hasComplaint) synthetic = "complained";
  else if (hasBounce) synthetic = "bounced";
  else if (allDelivered) synthetic = "delivered";
  else if (statuses.length > 0) synthetic = "pending";

  return {
    ok: true,
    payload: {
      success: true,
      email: normalized,
      total_found: recent.length,
      synthetic_status: synthetic,
      messages: detailed.map((m) => ({
        id: m.id,
        to: m.to,
        from: m.from,
        subject: m.subject,
        created_at: m.created_at,
        last_event: m.last_event || m.status,
        bounce: m.bounce || null,
        complained: m.complained || null,
      })),
    },
  };
}

async function removeFromSuppression(RESEND_API_KEY: string, email: string) {
  // Resend espone /audiences/.../contacts ma per la suppression list SES sotto serve
  // chiamare l'endpoint /emails/{id}/cancel non è applicabile.
  // L'endpoint reale per rimuovere bounce è limitato; tentiamo via API contacts come best-effort.
  // In assenza di endpoint pubblico, restituiamo istruzione manuale.
  return {
    ok: true,
    payload: {
      success: false,
      manual_action_required: true,
      message:
        "Resend non espone API pubblica per rimuovere indirizzi dalla suppression list SES. " +
        "Apri https://resend.com/suppressions, cerca l'indirizzo e rimuovilo manualmente.",
      suppressions_url: "https://resend.com/suppressions",
      email,
    },
  };
}

async function resolveResendApiKey(): Promise<string | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await admin.rpc("resend_config");
      const vaultKey = data && typeof data === "object" ? (data as { api_key?: string | null }).api_key : null;
      if (typeof vaultKey === "string" && vaultKey.trim()) return vaultKey.trim();
    } catch (e) {
      console.warn("[check-resend-domain] vault RESEND_API_KEY non disponibile:", e);
    }
  }
  return Deno.env.get("RESEND_API_KEY") || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = await resolveResendApiKey();
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY non configurata" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let mode = "domains";
    let email: string | undefined;

    if (req.method === "POST") {
      try {
        const body = await req.json();
        mode = body?.mode || (body?.email ? "lookup_email" : "domains");
        email = body?.email;
      } catch {
        // body vuoto = default domains
      }
    } else {
      const url = new URL(req.url);
      mode = url.searchParams.get("mode") || "domains";
      email = url.searchParams.get("email") || undefined;
    }

    let result;
    if (mode === "lookup_email") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Parametro 'email' richiesto per mode=lookup_email" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      result = await lookupEmail(RESEND_API_KEY, email);
    } else if (mode === "remove_suppression") {
      if (!email) {
        return new Response(
          JSON.stringify({ error: "Parametro 'email' richiesto" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      result = await removeFromSuppression(RESEND_API_KEY, email);
    } else {
      result = await handleDomainsCheck(RESEND_API_KEY);
    }

    return new Response(JSON.stringify(result.payload), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("check-resend-domain error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
