// Arricchisce un bando da TED (API ufficiale) o da scheda/titolo Mondo Appalti.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TED_SEARCH = "https://api.ted.europa.eu/v3/notices/search";
const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "buyer-name",
  "total-value",
  "publication-date",
  "deadline-date-lot",
  "deadline",
  "deadline-receipt-tender-date-lot",
  "contract-duration-start-date-lot",
  "contract-duration-end-date-lot",
  "winner-selection-status",
  "winner-name",
  "winner-decision-date",
  "contract-conclusion-date",
  "procedure-type",
  "notice-type",
  "form-type",
  "links",
];

function pickLang(value: unknown, langs = ["ita", "eng"]): string | null {
  if (value == null) return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const first = value.find((v) => typeof v === "string" && v.trim());
    return first ? String(first).trim() : null;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const lang of langs) {
      const hit = pickLang(obj[lang], langs);
      if (hit) return hit;
    }
    for (const v of Object.values(obj)) {
      const hit = pickLang(v, langs);
      if (hit) return hit;
    }
  }
  return null;
}

function firstString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const v of value) {
      const s = firstString(v);
      if (s) return s;
    }
  }
  return null;
}

function toIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const it = String(raw).match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  return null;
}

function parsePeriodoDaTitolo(titolo: string): { servizio_da: string | null; servizio_a: string | null } {
  const m = titolo.match(
    /dal\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})\s+al\s+(\d{1,2})[./-](\d{1,2})[./-](\d{4})/i,
  );
  if (!m) return { servizio_da: null, servizio_a: null };
  const pad = (v: string) => v.padStart(2, "0");
  return {
    servizio_da: `${m[3]}-${pad(m[2])}-${pad(m[1])}`,
    servizio_a: `${m[6]}-${pad(m[5])}-${pad(m[4])}`,
  };
}

function parseNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function mapTed(n: Record<string, unknown>) {
  const pub = String(n["publication-number"] || "").trim();
  if (!pub) return null;
  const titolo = pickLang(n["notice-title"]) || "";
  const formType = firstString(n["form-type"]);
  const winnerStatus = firstString(n["winner-selection-status"]);
  const aggiudicatario = pickLang(n["winner-name"]);
  const isEsito = formType === "result" || winnerStatus === "selec-w" || !!aggiudicatario;
  const periodo = parsePeriodoDaTitolo(titolo);
  const links = (n.links || {}) as Record<string, Record<string, string>>;
  return {
    scheda_id: pub,
    titolo: titolo.replace(/^Italia\s+[–-]\s+[^–-]+[–-]\s+/i, "").trim(),
    ente: pickLang(n["buyer-name"]),
    importo: parseNumber(n["total-value"]),
    scadenza: toIsoDate(
      firstString(n["deadline-date-lot"]) ||
        firstString(n["deadline-receipt-tender-date-lot"]) ||
        firstString(n["deadline"]),
    ),
    link: links.html?.ITA || links.html?.ENG || `https://ted.europa.eu/it/notice/-/detail/${pub}`,
    pdf_url: links.pdf?.ITA || links.pdf?.ENG || null,
    fonte: "ted",
    tipo_avviso: isEsito ? "esito" : "gara",
    notice_type: firstString(n["notice-type"]),
    form_type: formType,
    aggiudicato: isEsito,
    aggiudicatario,
    data_decisione: toIsoDate(firstString(n["winner-decision-date"])),
    data_contratto: toIsoDate(firstString(n["contract-conclusion-date"])),
    servizio_da: toIsoDate(firstString(n["contract-duration-start-date-lot"])) || periodo.servizio_da,
    servizio_a: toIsoDate(firstString(n["contract-duration-end-date-lot"])) || periodo.servizio_a,
    tipo_procedura: firstString(n["procedure-type"]),
    data_pubblicazione: toIsoDate(firstString(n["publication-date"])),
  };
}

async function enrichTed(schedaId: string) {
  const resp = await fetch(TED_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query: `publication-number=${schedaId}`,
      fields: TED_FIELDS,
      limit: 5,
      scope: "ALL",
      paginationMode: "PAGE_NUMBER",
      page: 1,
    }),
  });
  if (!resp.ok) throw new Error(`TED ${resp.status}`);
  const json = await resp.json();
  const notices = Array.isArray(json?.notices) ? json.notices : [];
  for (const n of notices) {
    const mapped = mapTed(n);
    if (mapped) return mapped;
  }
  return null;
}

async function enrichMondo(input: { titolo?: string; cig?: string; link?: string }) {
  const titolo = input.titolo || "";
  const periodo = parsePeriodoDaTitolo(titolo);
  const extra: Record<string, unknown> = {
    fonte: "mondoappalti",
    tipo_avviso: "gara",
    aggiudicato: false,
    cig: input.cig || null,
    servizio_da: periodo.servizio_da,
    servizio_a: periodo.servizio_a,
  };
  if (!input.link) return extra;
  try {
    const path = new URL(input.link).pathname;
    if (!/scheda/i.test(path)) return extra;
    const resp = await fetch(input.link, {
      headers: { Accept: "text/html", "User-Agent": "CBnet/1.0" },
    });
    if (!resp.ok) return extra;
    const text = (await resp.text())
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 8000);
    const cigMatch = text.match(/\bCIG[:\s]+([A-Z0-9]{10})\b/i);
    const scadMatch = text.match(/scadenza[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
    const vincMatch = text.match(/impresa vincitrice[:\s]+([^.]{4,80})/i) ||
      text.match(/aggiudicatari[oa][:\s]+([^.]{4,80})/i);
    if (cigMatch) extra.cig = cigMatch[1].toUpperCase();
    if (scadMatch) extra.scadenza = toIsoDate(scadMatch[1]);
    if (vincMatch) {
      extra.aggiudicatario = String(vincMatch[1]).trim();
      extra.aggiudicato = true;
      extra.tipo_avviso = "esito";
    }
    const fromHtml = parsePeriodoDaTitolo(text);
    extra.servizio_da = extra.servizio_da || fromHtml.servizio_da;
    extra.servizio_a = extra.servizio_a || fromHtml.servizio_a;
  } catch (e) {
    console.warn("arricchisci mondo", e);
  }
  return extra;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const schedaId = String(body.scheda_id || "").trim();
    const fonte = String(body.fonte || "").toLowerCase();
    let bando: Record<string, unknown> | null = null;
    if (fonte === "ted" || /^\d{4,}-\d{4}$/.test(schedaId)) {
      bando = await enrichTed(schedaId);
    }
    if (!bando || fonte === "mondoappalti") {
      const mondo = await enrichMondo({
        titolo: body.titolo,
        cig: body.cig,
        link: body.link,
      });
      bando = bando ? { ...mondo, ...bando } : mondo;
    }
    return new Response(JSON.stringify({ bando, done: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Errore arricchimento";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
