// Genera o aggiorna la ricetta di monitoraggio di un bando (link extra + pattern).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  extractDocumentLinks,
  flattenTedApiLinks,
  inferTipoDocumento,
  isHttpUrl,
  isTedSchedaId,
  normalizeMonitorScript,
  tedOfficialPdfUrls,
  uniqueHttpUrls,
  type DiscoveredDocLink,
  type MonitorScriptJson,
} from "../_shared/bandiMonitor.ts";

const TED_SEARCH = "https://api.ted.europa.eu/v3/notices/search";

async function fetchTedApiLinks(schedaId: string): Promise<DiscoveredDocLink[]> {
  if (!isTedSchedaId(schedaId)) return [];
  const resp = await fetch(TED_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `publication-number=${schedaId}`,
      fields: ["publication-number", "notice-title", "links"],
      limit: 5,
      scope: "ALL",
      paginationMode: "PAGE_NUMBER",
      page: 1,
    }),
  });
  if (!resp.ok) return [];
  const json = await resp.json();
  const notices = Array.isArray(json?.notices) ? json.notices : [];
  const out: DiscoveredDocLink[] = [];
  for (const n of notices) {
    out.push(...flattenTedApiLinks(n?.links));
  }
  return out;
}

function moonshotKey(): string | undefined {
  return Deno.env.get("MOONSHOT_API_KEY") || Deno.env.get("MOONSHINE_API_KEY") || undefined;
}

function hasAiCredentials(): boolean {
  return Boolean(moonshotKey() || Deno.env.get("LOVABLE_API_KEY"));
}

async function aiChatCompletions(
  body: Record<string, unknown>,
  init?: { signal?: AbortSignal },
): Promise<Response> {
  const moon = moonshotKey();
  const lovable = Deno.env.get("LOVABLE_API_KEY");
  const base = moon
    ? (Deno.env.get("MOONSHOT_BASE_URL") || "https://api.moonshot.ai/v1").replace(/\/$/, "")
    : "https://ai.gateway.lovable.dev/v1";
  const apiKey = moon || lovable || "";
  const model = moon
    ? (Deno.env.get("MOONSHOT_MODEL") || "kimi-k2.6")
    : "google/gemini-2.5-flash";
  const payload: Record<string, unknown> = { ...body, model };
  if (moon) {
    if (payload.temperature === undefined) payload.temperature = 0.6;
    payload.thinking = { type: "disabled" };
  }
  return fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: init?.signal,
  });
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function publicErrorMessage(raw: string): string {
  return /kimi|gemini|moonshot|moonshine|lovable|openai/i.test(raw)
    ? "Generazione script non disponibile. Riprova tra poco."
    : raw;
}

async function fetchHtml(url: string): Promise<string> {
  const resp = await fetch(url, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "CBnet/1.0 (+bandi-monitor)",
    },
  });
  if (!resp.ok) throw new Error(`Portale ${resp.status}`);
  const ctype = resp.headers.get("content-type") || "";
  if (ctype.includes("application/pdf")) return "";
  const text = await resp.text();
  return text.slice(0, 250_000);
}

function parseAiJson(raw: string): Partial<MonitorScriptJson> | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function classifyWithAi(opts: {
  titolo: string;
  startUrl: string;
  links: Array<{ url: string; nome: string }>;
}): Promise<Partial<MonitorScriptJson> | null> {
  if (!hasAiCredentials() || opts.links.length === 0) return null;
  const elenco = opts.links
    .slice(0, 25)
    .map((l, i) => `${i + 1}. ${l.nome} — ${l.url}`)
    .join("\n");
  const resp = await aiChatCompletions({
    messages: [
      {
        role: "system",
        content:
          "Sei un assistente per broker assicurativi italiani. Estrai solo JSON valido, senza markdown.",
      },
      {
        role: "user",
        content:
          `Classifica i documenti di questa scheda di gara. Non inventare URL.\n` +
          `Titolo: ${opts.titolo || "n/d"}\n` +
          `Pagina: ${opts.startUrl}\n` +
          `Link trovati:\n${elenco}\n\n` +
          `Rispondi con JSON: {"documenti":[{"url":"...","tipo":"bando|disciplinare|capitolato|chiarimento|esito|altro","nome":"..."}],` +
          `"link_patterns":["regex utili per ritrovare i PDF"],"note":"breve"}.`,
      },
    ],
  }, { signal: AbortSignal.timeout(20_000) });
  if (!resp.ok) return null;
  const json = await resp.json();
  const text = json?.choices?.[0]?.message?.content ?? "";
  return parseAiJson(String(text));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = String(claimsData.claims.sub || "") || null;

    const body = await req.json().catch(() => ({}));
    const bandoId = String(body.bando_id || "").trim();
    const action = String(body.action || "generate").toLowerCase();
    if (!bandoId) {
      return new Response(JSON.stringify({ error: "bando_id obbligatorio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: bando, error: bandoError } = await supabase
      .from("bandi_pubblici")
      .select("id, titolo, oggetto, link, pdf_url, fonte, scheda_id, tipo_avviso")
      .eq("id", bandoId)
      .single();
    if (bandoError || !bando) {
      return new Response(JSON.stringify({ error: "Bando non trovato" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("bandi_monitor_script")
      .select("id, versione, script_json, motore, source_url")
      .eq("bando_id", bandoId)
      .maybeSingle();

    const prev = normalizeMonitorScript(existing?.script_json);
    const startUrl = isHttpUrl(bando.link) ? bando.link : prev.start_url;
    const motore = String(bando.fonte || prev.motore || "");
    let htmlError: string | null = null;
    let discovered: DiscoveredDocLink[] = [
      ...tedOfficialPdfUrls(bando.scheda_id),
    ];
    if (isHttpUrl(bando.pdf_url)) {
      discovered.push({
        url: bando.pdf_url,
        nome: bando.tipo_avviso === "esito" ? `Esito ${bando.scheda_id || ""}`.trim() : `Avviso ${bando.scheda_id || ""}`.trim(),
      });
    }

    try {
      const tedLinks = await fetchTedApiLinks(String(bando.scheda_id || ""));
      discovered = [...discovered, ...tedLinks];
    } catch (e) {
      console.warn("TED links", e);
    }

    if (startUrl) {
      try {
        const html = await fetchHtml(startUrl);
        if (html) discovered = [...discovered, ...extractDocumentLinks(html, startUrl)];
      } catch (e) {
        htmlError = e instanceof Error ? e.message : "Pagina non raggiungibile";
      }
    }

    let aiPart: Partial<MonitorScriptJson> | null = null;
    if (action === "generate") {
      try {
        aiPart = await classifyWithAi({
          titolo: bando.titolo || bando.oggetto || "",
          startUrl: startUrl || "",
          links: discovered,
        });
      } catch (e) {
        console.warn("genera-monitor-bando AI", e);
      }
    }

    const aiDocs = Array.isArray(aiPart?.documenti) ? aiPart!.documenti : [];
    const mergedDocsMap = new Map<string, { url: string; tipo: string; nome: string }>();
    for (const d of [...prev.documenti, ...discovered.map((l) => ({
      url: l.url,
      tipo: inferTipoDocumento(l.nome, l.url),
      nome: l.nome,
    })), ...aiDocs]) {
      if (!isHttpUrl(d.url)) continue;
      const key = d.url.split("#")[0];
      const prevDoc = mergedDocsMap.get(key);
      mergedDocsMap.set(key, {
        url: key,
        tipo: d.tipo || prevDoc?.tipo || inferTipoDocumento(d.nome, key),
        nome: d.nome || prevDoc?.nome || key.split("/").pop() || "documento",
      });
    }

    const extra = uniqueHttpUrls([
      bando.pdf_url,
      ...prev.extra_urls,
      ...discovered.map((d) => d.url),
      ...aiDocs.map((d) => d.url),
    ], 30);

    const aiPatterns = (aiPart?.link_patterns || []).filter((p) => typeof p === "string" && p.trim());
    const script: MonitorScriptJson = {
      versione: 1,
      start_url: startUrl || "",
      motore,
      extra_urls: extra,
      link_patterns: aiPatterns.length ? aiPatterns : prev.link_patterns,
      note: (aiPart?.note || prev.note || htmlError || "").slice(0, 400),
      documenti: [...mergedDocsMap.values()],
    };

    const now = new Date().toISOString();
    const row = {
      bando_id: bandoId,
      versione: existing ? Number(existing.versione || 1) + (action === "generate" ? 1 : 0) : 1,
      motore,
      source_url: startUrl || null,
      script_json: script,
      attivo: true,
      generated_at: action === "generate" || !existing ? now : undefined,
      generated_by: userId,
      last_used_at: now,
      last_ok_at: htmlError ? null : now,
      errore: htmlError,
    };

    if (existing?.id) {
      const update: Record<string, unknown> = { ...row };
      if (action !== "generate" && existing) delete update.generated_at;
      const { error: upErr } = await supabase
        .from("bandi_monitor_script")
        .update(update)
        .eq("id", existing.id);
      if (upErr) throw upErr;
    } else {
      const { error: insErr } = await supabase.from("bandi_monitor_script").insert({
        ...row,
        generated_at: now,
      });
      if (insErr) throw insErr;
    }

    return new Response(JSON.stringify({
      success: true,
      action,
      urls: extra,
      scoperti: discovered.length,
      script,
      errore: htmlError,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = publicErrorMessage(error instanceof Error ? error.message : "Errore interno");
    console.error("genera-monitor-bando", error);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
