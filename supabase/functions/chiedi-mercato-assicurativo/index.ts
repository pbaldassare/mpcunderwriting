// Edge function: chiedi-mercato-assicurativo (Assistente Web)
// Chat web — interroga SOLO i siti in cb_bot_siti_autorizzati. Non accede a polizze CBnet.
// IA: Kimi (Moonshot). Know-how curato: se la domanda matcha, nessuna chiamata IA.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireAi, callKimiText } from "../_shared/aiProvider.ts";
import { bumpKnowHowHit, findKnowHowHit, knowHowFonti } from "../_shared/cbBotKnowHowDb.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type StoricoMsg = { role: string; content: string };
type SearchHit = { title: string; url: string; snippet: string };
type SitoAutorizzato = { nome: string; url: string; dominio: string };
type FonteSalvata = { titolo: string; url: string; snippet: string | null; dominio: string };

function isHostAllowed(url: string, domains: string[]): boolean {
  if (!url || domains.length === 0) return false;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return domains.some((d) => {
      const dom = d.toLowerCase().replace(/^www\./, "");
      return host === dom || host.endsWith(`.${dom}`);
    });
  } catch {
    return false;
  }
}

async function loadSitiAutorizzati(): Promise<SitoAutorizzato[]> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("cb_bot_siti_autorizzati")
    .select("nome, url, dominio")
    .eq("attivo", true);
  if (error) {
    console.warn("cb_bot_siti_autorizzati", error.message);
    return [];
  }
  return (data ?? []) as SitoAutorizzato[];
}

async function loadFontiSalvate(): Promise<FonteSalvata[]> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return [];
  const admin = createClient(url, key);
  const { data, error } = await admin
    .from("cb_bot_fonti")
    .select("titolo, url, snippet, dominio")
    .eq("attiva", true)
    .order("updated_at", { ascending: false })
    .limit(80);
  if (error) {
    console.warn("cb_bot_fonti", error.message);
    return [];
  }
  return (data ?? []) as FonteSalvata[];
}

function tokenizeQuery(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function pickFontiForQuery(fonti: FonteSalvata[], query: string, limit = 8): FonteSalvata[] {
  if (fonti.length === 0) return [];
  if (fonti.length <= 5) return fonti.slice(0, limit);
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return fonti.slice(0, limit);
  return fonti
    .map((f) => {
      const hay = `${f.titolo} ${f.snippet ?? ""} ${f.url}`.toLowerCase();
      const s = tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
      return { f, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
}

const ALLOWED_EMAIL_DOMAINS = [
  "consulbrokers.it",
  "cbdigital.tech",
  "etisicura.it",
  "mpcunderwriting.it",
  "interfidi.net",
  "gbintermediazioni.it",
  "exebroker.it",
  "igbsrl.it",
  "probroker.it",
  "dibroker.it",
];

function getEmailDomain(email: string): string | null {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at <= 0 || at === e.length - 1) return null;
  return e.slice(at + 1);
}

function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = getEmailDomain(email);
  return !!domain && ALLOWED_EMAIL_DOMAINS.includes(domain);
}

const PORTAL_ROLES = new Set(["cliente", "prospect"]);

/** Utente CBnet loggato (JWT valido, profilo attivo, non portale cliente/prospect). */
async function isAuthenticatedStaff(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return false;
  const token = authHeader.slice(authHeader.indexOf(" ") + 1).trim();
  if (!token) return false;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return false;
  try {
    const admin = createClient(url, key);
    const { data: userData, error } = await admin.auth.getUser(token);
    if (error || !userData?.user) return false;
    const { data: profile } = await admin
      .from("profiles")
      .select("ruolo, attivo")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile || profile.attivo === false) return false;
    const ruolo = String(profile.ruolo ?? "");
    return !PORTAL_ROLES.has(ruolo);
  } catch {
    return false;
  }
}

async function searchTavily(apiKey: string, query: string, domains: string[]): Promise<SearchHit[]> {
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 8,
      include_answer: false,
      include_domains: domains.slice(0, 80),
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Tavily ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function searchSerper(apiKey: string, query: string, domains: string[]): Promise<SearchHit[]> {
  const siteFilter = domains.map((d) => `site:${d}`).join(" OR ");
  const q = siteFilter ? `${query} (${siteFilter})` : query;
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(12_000),
    body: JSON.stringify({ q, gl: "it", hl: "it", num: 8 }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Serper ${resp.status}: ${t.slice(0, 200)}`);
  }
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

async function webSearch(query: string, domains: string[]): Promise<SearchHit[]> {
  const tavilyKey = Deno.env.get("TAVILY_API_KEY");
  const serperKey = Deno.env.get("SERPER_API_KEY");

  let hits: SearchHit[] = [];
  if (tavilyKey) {
    try {
      hits = await searchTavily(tavilyKey, query, domains);
    } catch (e) {
      console.warn("Tavily fallito, provo Serper", e);
    }
  }

  if (hits.length === 0 && serperKey) {
    hits = await searchSerper(serperKey, query, domains);
  }

  if (!tavilyKey && !serperKey) {
    throw new Error(
      "Ricerca web non configurata. Impostare TAVILY_API_KEY o SERPER_API_KEY nei secrets Supabase.",
    );
  }

  return hits.filter((h) => isHostAllowed(h.url, domains));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const domanda = String(body?.domanda ?? "").trim();
    const storico: StoricoMsg[] = Array.isArray(body?.storico) ? body.storico.slice(-10) : [];
    const email = body?.email ? String(body.email).trim() : null;

    if (!domanda) {
      return new Response(JSON.stringify({ error: "domanda richiesta" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Staff CBnet autenticato (es. admin@consul.it) passa col JWT.
    // Area consultazione esterna resta sulla allowlist dei domini partner.
    const staffOk = await isAuthenticatedStaff(req);
    if (!staffOk && !isEmailAllowed(email)) {
      return new Response(
        JSON.stringify({
          error: "Accesso non autorizzato. Usa un'email aziendale del partner abilitato.",
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const knowHow = await findKnowHowHit("web", domanda);
    if (knowHow) {
      await bumpKnowHowHit(knowHow.id);
      return new Response(
        JSON.stringify({
          ok: true,
          risposta: knowHow.risposta,
          fonti: knowHowFonti(knowHow),
          fonti_salvate: [],
          query: null,
          via: "know-how",
          know_how_id: knowHow.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const siti = await loadSitiAutorizzati();
    const domains = [...new Set(siti.map((s) => s.dominio).filter(Boolean))];
    const fontiInterneAll = await loadFontiSalvate();
    const fontiInterne = pickFontiForQuery(fontiInterneAll, domanda);

    if (domains.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          risposta:
            "Non ci sono siti autorizzati attivi. Un amministratore deve aggiungerli in **CB Bot → Siti autorizzati**. " +
            "Per clausole e garanzie di prodotto usa la tab **Libreria CGA**.",
          fonti: [],
          query: null,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    requireAi();

    const searchQuery = domanda;
    let hits: SearchHit[] = [];
    try {
      hits = await webSearch(searchQuery, domains);
    } catch (e) {
      console.warn("webSearch skip", e);
    }
    const fonti = hits.map((h) => ({
      title: h.title,
      url: h.url,
      snippet: h.snippet.slice(0, 320),
    }));

    const elencoSiti = siti.map((s) => `${s.nome} (${s.dominio})`).join(", ");
    const fontiSalvateOut = fontiInterne.map((f) => ({
      title: f.titolo,
      url: f.url,
      snippet: (f.snippet ?? "").slice(0, 320),
      salvata: true,
    }));

    const systemPrompt =
      "Sei **Assistente Web**, un assistente per professionisti del brokeraggio assicurativo italiano. " +
      "Puoi usare SOLO i risultati web provenienti dai siti autorizzati e le fonti interne salvate dallo staff. " +
      "REGOLE FERREE:\n" +
      "• NON hai accesso a polizze, clienti, portafoglio, titoli, quietanze o dati interni CBnet/Consulbrokers.\n" +
      "• Se l'utente chiede 'le mie polizze', dati cliente o estrazioni dal gestionale → spiega che Assistente Web non può accedervi; indirizza al gestionale CBnet.\n" +
      "• Se chiede clausole/garanzie di un prodotto assicurativo specifico → suggerisci la tab **Libreria CGA** nel Documentale.\n" +
      "• Preferisci le FONTI INTERNE CB BOT quando sono pertinenti; poi i risultati web.\n" +
      "• Usa ESCLUSIVAMENTE i JSON forniti. Non inventare fonti.\n" +
      "• Se i risultati sono vuoti o insufficienti, dillo chiaramente: non hai trovato nulla sui siti autorizzati.\n" +
      "• Cita le fonti con link markdown [titolo](url).\n" +
      "• Rispondi in italiano. Struttura con elenchi quando aiuta la lettura.\n" +
      "• Breve disclaimer finale: orientamento professionale, non consulenza legale/fiscale vincolante.\n" +
      `Siti autorizzati: ${elencoSiti}.`;

    const userContent =
      "FONTI INTERNE CB BOT (pagine salvate dallo staff):\n" +
      JSON.stringify(fontiSalvateOut, null, 2) +
      "\n\nRISULTATI RICERCA WEB SUI SITI AUTORIZZATI (JSON):\n" +
      JSON.stringify({ query: searchQuery, siti_autorizzati: elencoSiti, risultati: fonti }, null, 2) +
      "\n\nDOMANDA UTENTE: " +
      domanda;

    const messages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
      ...storico.filter((m) => m.role === "user" || m.role === "assistant").map((m) => ({
        role: m.role,
        content: m.content,
      })),
      { role: "user", content: userContent },
    ];

    let risposta: string;
    try {
      risposta = await callKimiText(messages);
    } catch (e) {
      if (e instanceof Error && e.message.includes("429")) {
        return new Response(JSON.stringify({ error: "Rate limit AI superato." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    if (!risposta.trim()) {
      throw new Error("Risposta IA vuota. Riprova.");
    }

    return new Response(
      JSON.stringify({
        ok: true,
        risposta,
        fonti,
        fonti_salvate: fontiSalvateOut,
        query: searchQuery,
        via: "kimi",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("chiedi-mercato-assicurativo error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
