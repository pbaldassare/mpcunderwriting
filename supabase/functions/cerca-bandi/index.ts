// Cerca bandi: TED, Mondo Appalti, Infordat.
// I nomi dei motori IA non vanno esposti al client.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TED_SEARCH = "https://api.ted.europa.eu/v3/notices/search";
const CPV_BROKER = "66518100";
const CPV_SERVIZI = "66510000";
const BROKER_RE = /brokeraggio|broker assicur|intermediazione assicur/i;
const SERVIZI_RE = /servizi assicurativ|servizi di assicurazione|polizze assicur|coperture assicur|assicurativ/i;

type KeywordRicerca = "brokeraggio" | "servizi" | "entrambe";

function parseKeywordRicerca(raw: unknown): KeywordRicerca {
  const v = String(raw || "").toLowerCase();
  if (v === "servizi" || v === "servizi_assicurativi") return "servizi";
  if (v === "entrambe" || v === "tutte" || v === "both") return "entrambe";
  return "brokeraggio";
}

function wantBrokeraggio(k: KeywordRicerca): boolean {
  return k === "brokeraggio" || k === "entrambe";
}

function wantServizi(k: KeywordRicerca): boolean {
  return k === "servizi" || k === "entrambe";
}

function frasiKeyword(k: KeywordRicerca): string[] {
  if (k === "servizi") return ["servizi assicurativi"];
  if (k === "entrambe") return ["brokeraggio assicurativo", "servizi assicurativi"];
  return ["brokeraggio assicurativo"];
}

function categoriaDaKeyword(title: string, cpvs: string[]): string {
  if (isBrokeraggio(title, cpvs)) return "Brokeraggio assicurativo";
  return "Servizi assicurativi";
}

const NUTS_REGION: [string, string][] = [
  ["ITC1", "Piemonte"],
  ["ITC2", "Valle d'Aosta"],
  ["ITC3", "Liguria"],
  ["ITC4", "Lombardia"],
  ["ITH1", "Trentino-Alto Adige"],
  ["ITH2", "Trentino-Alto Adige"],
  ["ITH3", "Veneto"],
  ["ITH4", "Friuli Venezia Giulia"],
  ["ITH5", "Emilia-Romagna"],
  ["ITI1", "Toscana"],
  ["ITI2", "Umbria"],
  ["ITI3", "Marche"],
  ["ITI4", "Lazio"],
  ["ITF1", "Abruzzo"],
  ["ITF2", "Molise"],
  ["ITF3", "Campania"],
  ["ITF4", "Puglia"],
  ["ITF5", "Basilicata"],
  ["ITF6", "Calabria"],
  ["ITG1", "Sicilia"],
  ["ITG2", "Sardegna"],
];

type Filtri = {
  regioni: string[];
  importoMin?: string;
  importoMax?: string;
  dataDa?: string;
  dataA?: string;
  statoBando?: string;
  keyword: KeywordRicerca;
};

type FonteBando = "ted" | "mondoappalti" | "infordat";

type Bando = {
  id: string;
  titolo: string;
  ente: string;
  ente_tipo: string | null;
  importo: number | null;
  scadenza: string | null;
  stato: string;
  dataPublicazione: string;
  link: string | null;
  categoria: string | null;
  scheda_id: string | null;
  cig: string | null;
  localita: string | null;
  regione: string | null;
  pdf_url: string | null;
  fonte: FonteBando;
  tipo_avviso: "gara" | "esito" | "altro";
  notice_type: string | null;
  form_type: string | null;
  aggiudicato: boolean;
  aggiudicatario: string | null;
  data_decisione: string | null;
  data_contratto: string | null;
  servizio_da: string | null;
  servizio_a: string | null;
  tipo_procedura: string | null;
};

const TED_FIELDS = [
  "publication-number",
  "notice-title",
  "buyer-name",
  "total-value",
  "publication-date",
  "classification-cpv",
  "place-of-performance",
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

function fontiRichieste(raw: unknown): FonteBando[] {
  const v = String(raw || "tutte").toLowerCase();
  if (v === "ted") return ["ted"];
  if (v === "mondoappalti") return ["mondoappalti"];
  if (v === "infordat") return ["infordat"];
  return ["ted", "mondoappalti", "infordat"];
}

function publicErrorMessage(raw: string): string {
  return /kimi|gemini|moonshot|moonshine|lovable|openai|tavily|serper/i.test(raw)
    ? "Ricerca non disponibile. Riprova tra poco."
    : raw;
}

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

function toIsoDate(raw: string | null): string {
  if (!raw) return "";
  const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : raw.slice(0, 10);
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

function emptyDettaglio(): Pick<
  Bando,
  | "tipo_avviso"
  | "notice_type"
  | "form_type"
  | "aggiudicato"
  | "aggiudicatario"
  | "data_decisione"
  | "data_contratto"
  | "servizio_da"
  | "servizio_a"
  | "tipo_procedura"
> {
  return {
    tipo_avviso: "gara",
    notice_type: null,
    form_type: null,
    aggiudicato: false,
    aggiudicatario: null,
    data_decisione: null,
    data_contratto: null,
    servizio_da: null,
    servizio_a: null,
    tipo_procedura: null,
  };
}

function toItDate(iso: string | null): string | null {
  if (!iso) return null;
  const m = iso.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function parseNumber(val: unknown): number | null {
  if (val == null) return null;
  if (typeof val === "number") return Number.isFinite(val) ? val : null;
  const n = parseFloat(String(val).replace(/[^\d.,-]/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function uniqueCpvs(cpv: unknown): string[] {
  const raw = Array.isArray(cpv) ? cpv : [];
  return [...new Set(raw.map((c) => String(c)))];
}

function regioneFromNuts(nuts: unknown): { regione: string | null; localita: string | null } {
  const codes = (Array.isArray(nuts) ? nuts : []).map(String).filter((c) => c && c !== "ITA" && c !== "00");
  for (const code of codes) {
    const hit = NUTS_REGION
      .filter(([prefix]) => code.startsWith(prefix))
      .sort((a, b) => b[0].length - a[0].length)[0];
    if (hit) return { regione: hit[1], localita: code };
  }
  return { regione: null, localita: codes[0] || null };
}

function cleanTitle(title: string): string {
  return title
    .replace(/^Italia\s+[–-]\s+[^–-]+[–-]\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isBrokeraggio(title: string, cpvs: string[]): boolean {
  if (BROKER_RE.test(title)) return true;
  return cpvs.includes(CPV_BROKER) && cpvs.length <= 6;
}

function isServiziAssicurativi(title: string, cpvs: string[]): boolean {
  if (SERVIZI_RE.test(title) || BROKER_RE.test(title)) return true;
  return cpvs.some((c) => c.startsWith("6651"));
}

function matchesKeyword(title: string, cpvs: string[], keyword: KeywordRicerca): boolean {
  const broker = isBrokeraggio(title, cpvs);
  const servizi = isServiziAssicurativi(title, cpvs);
  if (keyword === "brokeraggio") return broker;
  if (keyword === "servizi") return servizi;
  return broker || servizi;
}

function tedDate(iso?: string): string {
  if (!iso) return "20250101";
  return iso.replace(/-/g, "").slice(0, 8);
}

async function tedSearch(query: string): Promise<Record<string, unknown>[]> {
  const resp = await fetch(TED_SEARCH, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      query,
      fields: TED_FIELDS,
      limit: 50,
      scope: "ALL",
      paginationMode: "PAGE_NUMBER",
      page: 1,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`TED ${resp.status}: ${t.slice(0, 180)}`);
  }
  const json = await resp.json();
  return Array.isArray(json?.notices) ? json.notices : [];
}

function mapNotice(n: Record<string, unknown>, opts?: { force?: boolean; keyword?: KeywordRicerca }): Bando | null {
  const pub = String(n["publication-number"] || "").trim();
  if (!pub) return null;
  const titleRaw = pickLang(n["notice-title"]) || "Titolo non disponibile";
  const titolo = cleanTitle(titleRaw);
  const cpvs = uniqueCpvs(n["classification-cpv"]);
  const keyword = opts?.keyword ?? "brokeraggio";
  if (!opts?.force && !matchesKeyword(`${titolo} ${titleRaw}`, cpvs, keyword)) return null;

  const ente = pickLang(n["buyer-name"]) || "Ente non specificato";
  const pubIso = toIsoDate(firstString(n["publication-date"]));
  const deadlineIso = toIsoDate(
    firstString(n["deadline-date-lot"]) ||
      firstString(n["deadline-receipt-tender-date-lot"]) ||
      firstString(n["deadline"]),
  );
  const { regione, localita } = regioneFromNuts(n["place-of-performance"]);
  const links = (n.links || {}) as Record<string, Record<string, string>>;
  const html = links.html?.ITA || links.html?.ENG || `https://ted.europa.eu/it/notice/-/detail/${pub}`;
  const pdf = links.pdf?.ITA || links.pdf?.ENG || null;
  const oggi = new Date().toISOString().slice(0, 10);
  const formType = firstString(n["form-type"]);
  const noticeType = firstString(n["notice-type"]);
  const winnerStatus = firstString(n["winner-selection-status"]);
  const aggiudicatario = pickLang(n["winner-name"]);
  const isEsito = formType === "result" || winnerStatus === "selec-w" || !!aggiudicatario;
  const periodoTitolo = parsePeriodoDaTitolo(titolo);
  const servizioDa = toIsoDate(firstString(n["contract-duration-start-date-lot"])) || periodoTitolo.servizio_da;
  const servizioA = toIsoDate(firstString(n["contract-duration-end-date-lot"])) || periodoTitolo.servizio_a;
  const stato = isEsito || (deadlineIso && deadlineIso < oggi) ? "scaduto" : "aperto";

  return {
    id: pub,
    titolo,
    ente,
    ente_tipo: null,
    importo: parseNumber(n["total-value"]),
    scadenza: toItDate(deadlineIso),
    stato,
    dataPublicazione: pubIso,
    link: html,
    categoria: categoriaDaKeyword(`${titolo} ${titleRaw}`, cpvs),
    scheda_id: pub,
    cig: null,
    localita,
    regione,
    pdf_url: pdf,
    fonte: "ted",
    tipo_avviso: isEsito ? "esito" : "gara",
    notice_type: noticeType,
    form_type: formType,
    aggiudicato: isEsito,
    aggiudicatario,
    data_decisione: toIsoDate(firstString(n["winner-decision-date"])) || null,
    data_contratto: toIsoDate(firstString(n["contract-conclusion-date"])) || null,
    servizio_da: servizioDa || null,
    servizio_a: servizioA || null,
    tipo_procedura: firstString(n["procedure-type"]),
  };
}

type WebHit = { title: string; url: string; snippet: string };

function isMondoUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "mondoappalti.it" || host.endsWith(".mondoappalti.it");
  } catch {
    return false;
  }
}

function schedaIdFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const digits = u.pathname.match(/(\d{5,})/);
    if (digits) return digits[1];
    return `${u.hostname}${u.pathname}`.replace(/\/+$/, "").slice(0, 180);
  } catch {
    return url.slice(0, 180);
  }
}

function isMondoSchedaUrl(url: string): boolean {
  if (!isMondoUrl(url)) return false;
  try {
    const path = new URL(url).pathname;
    if (/\/(login|account|register|privacy|cookie|servizi|cart|checkout|landing)(\/|$)/i.test(path)) return false;
    if (/\/(Main|Landing|Servizi|GareAppalti)(\/|$)/i.test(path) && !/scheda/i.test(path)) return false;
    return /\/(bancadati\/)?scheda\//i.test(path) || /\/Scheda\/\d{5,}/.test(path);
  } catch {
    return false;
  }
}

function filterMondoHits(hits: WebHit[]): WebHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    if (!h.url || !isMondoSchedaUrl(h.url)) return false;
    const key = schedaIdFromUrl(h.url);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function regioneFromText(text: string, regioni: string[]): string | null {
  const hay = text.toLowerCase();
  for (const r of regioni) {
    if (hay.includes(r.toLowerCase())) return r;
  }
  return null;
}

function hitToBando(hit: WebHit, i: number, regioni: string[]): Bando {
  const id = schedaIdFromUrl(hit.url) || `mondo-${i}`;
  const titolo = (hit.title || "Titolo non disponibile").slice(0, 300);
  return {
    id,
    titolo,
    ente: "Scheda Mondo Appalti",
    ente_tipo: null,
    importo: null,
    scadenza: null,
    stato: "aperto",
    dataPublicazione: "",
    link: hit.url,
    categoria: categoriaDaKeyword(`${titolo} ${hit.snippet || ""}`, []),
    scheda_id: id,
    cig: null,
    localita: null,
    regione: regioneFromText(`${hit.title} ${hit.snippet}`, regioni),
    pdf_url: null,
    fonte: "mondoappalti",
    ...emptyDettaglio(),
    ...parsePeriodoDaTitolo((hit.title || "") + " " + (hit.snippet || "")),
  };
}

async function searchTavilyMondo(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("TAVILY_API_KEY");
  if (!key) return [];
  const resp = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: "advanced",
      max_results: 20,
      include_answer: false,
      include_domains: ["mondoappalti.it"],
    }),
  });
  if (!resp.ok) {
    console.warn("tavily mondo", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.results ?? []).map((r: { title?: string; url?: string; content?: string }) => ({
    title: r.title ?? "",
    url: r.url ?? "",
    snippet: r.content ?? "",
  }));
}

async function searchSerperMondo(query: string): Promise<WebHit[]> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return [];
  const resp = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: `${query} site:mondoappalti.it`,
      gl: "it",
      hl: "it",
      num: 20,
    }),
  });
  if (!resp.ok) {
    console.warn("serper mondo", resp.status, await resp.text());
    return [];
  }
  const json = await resp.json();
  return (json?.organic ?? []).map((r: { title?: string; link?: string; snippet?: string }) => ({
    title: r.title ?? "",
    url: r.link ?? "",
    snippet: r.snippet ?? "",
  }));
}

function parseBandiJson(output: string | null): Record<string, unknown>[] {
  if (!output) return [];
  let cleaned = output.trim();
  const md = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (md) cleaned = md[1].trim();
  try {
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed?.bandi)) return parsed.bandi;
    return [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try {
      return JSON.parse(match[0]);
    } catch {
      return [];
    }
  }
}

async function extractMondoBandi(hits: WebHit[], filtri: Filtri): Promise<Bando[] | null> {
  let ai: { hasAiCredentials: () => boolean; aiChatCompletions: typeof import("../_shared/aiProvider.ts")["aiChatCompletions"] };
  try {
    ai = await import("../_shared/aiProvider.ts");
  } catch {
    return null;
  }
  const { hasAiCredentials, aiChatCompletions } = ai;
  if (!hasAiCredentials()) return null;
  const system =
    "Sei un analista di gare d'appalto italiane per un broker. " +
    "Estrai SOLO bandi reali da Mondo Appalti. Non inventare CIG, importi, enti. " +
    "Rispondi SOLO con un JSON array: scheda_id, oggetto, stazione_appaltante, localita, regione, importo, scadenza (dd/MM/yyyy), cig, link, pdf_url, tipo_avviso (gara|esito), aggiudicatario, servizio_da (yyyy-mm-dd), servizio_a (yyyy-mm-dd), tipo_procedura.";
  const user =
    `Keyword: ${frasiKeyword(filtri.keyword).join(" | ")}` +
    (filtri.regioni.length ? `; regioni: ${filtri.regioni.join(", ")}` : "") +
    `.\n\nRISULTATI:\n${JSON.stringify(hits.slice(0, 20), null, 2)}`;
  const resp = await aiChatCompletions({
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  if (!resp.ok) return null;
  const json = await resp.json();
  const raw = parseBandiJson(json?.choices?.[0]?.message?.content ?? "");
  if (raw.length === 0) return null;
  return raw.map((b, i) => {
    const link = String(b.link || hits[i]?.url || "");
    const id = String(b.scheda_id || schedaIdFromUrl(link) || `mondo-${i}`);
    return {
      id,
      titolo: String(b.oggetto || b.titolo || hits[i]?.title || "Titolo non disponibile").slice(0, 300),
      ente: String(b.stazione_appaltante || b.ente || "Scheda Mondo Appalti"),
      ente_tipo: null,
      importo: parseNumber(b.importo),
      scadenza: typeof b.scadenza === "string" ? b.scadenza : null,
      stato: "aperto",
      dataPublicazione: "",
      link: link || null,
      categoria: categoriaDaKeyword(String(b.oggetto || b.titolo || ""), []),
      scheda_id: id,
      cig: typeof b.cig === "string" ? b.cig : null,
      localita: typeof b.localita === "string" ? b.localita : null,
      regione: typeof b.regione === "string" ? b.regione : regioneFromText(`${b.oggetto ?? ""} ${b.stazione_appaltante ?? ""}`, filtri.regioni.length ? filtri.regioni : []),
      pdf_url: typeof b.pdf_url === "string" ? b.pdf_url : null,
      fonte: "mondoappalti",
      ...emptyDettaglio(),
      tipo_avviso: b.tipo_avviso === "esito" ? "esito" : "gara",
      aggiudicato: b.tipo_avviso === "esito" || !!b.aggiudicatario,
      aggiudicatario: typeof b.aggiudicatario === "string" ? b.aggiudicatario : null,
      servizio_da: toIsoDate(typeof b.servizio_da === "string" ? b.servizio_da : null) ||
        parsePeriodoDaTitolo(String(b.oggetto || "")).servizio_da,
      servizio_a: toIsoDate(typeof b.servizio_a === "string" ? b.servizio_a : null) ||
        parsePeriodoDaTitolo(String(b.oggetto || "")).servizio_a,
      tipo_procedura: typeof b.tipo_procedura === "string" ? b.tipo_procedura : null,
    } satisfies Bando;
  });
}

async function searchMondoAppalti(filtri: Filtri): Promise<Bando[]> {
  if (!Deno.env.get("TAVILY_API_KEY") && !Deno.env.get("SERPER_API_KEY")) {
    console.error("mondoappalti: manca TAVILY_API_KEY / SERPER_API_KEY");
    throw new Error("Ricerca su Mondo Appalti non disponibile. Riprova più tardi.");
  }
  const seen = new Set<string>();
  const hits: WebHit[] = [];
  for (const frase of frasiKeyword(filtri.keyword)) {
    const q = [
      `${frase} bando gara`,
      filtri.regioni.length ? filtri.regioni.join(" ") : "Italia",
    ].join(" ");
    let batch = filterMondoHits(await searchTavilyMondo(q));
    if (batch.length === 0) batch = filterMondoHits(await searchSerperMondo(q));
    for (const h of batch) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      hits.push(h);
    }
  }
  if (hits.length === 0) return [];

  const extracted = await extractMondoBandi(hits, filtri).catch((e) => {
    console.warn("mondo extract", e);
    return null;
  });
  const mapped = extracted && extracted.length > 0
    ? extracted
    : hits.map((h, i) => hitToBando(h, i, filtri.regioni));
  return applyFiltri(mapped, filtri).slice(0, 30);
}

async function searchInfordatFonte(filtri: Filtri): Promise<Bando[]> {
  const { searchInfordat } = await import("../_shared/infordatBandi.ts");
  const mapped = await searchInfordat({
    regioni: filtri.regioni,
    keyword: frasiKeyword(filtri.keyword).join(" "),
    mode: filtri.keyword,
  });
  return applyFiltri(mapped, filtri).slice(0, 30);
}

async function searchTed(filtri: Filtri): Promise<Bando[]> {
  const da = tedDate(filtri.dataDa || "2025-01-01");
  const aClause = filtri.dataA ? ` AND publication-date<=${tedDate(filtri.dataA)}` : "";
  const queries: string[] = [];
  if (wantBrokeraggio(filtri.keyword)) {
    queries.push(
      `(FT~"brokeraggio assicurativo" OR FT~"broker assicurativo" OR FT~"intermediazione assicurativa") AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
    );
    queries.push(
      `classification-cpv=${CPV_BROKER} AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
    );
  }
  if (wantServizi(filtri.keyword)) {
    queries.push(
      `(FT~"servizi assicurativi" OR FT~"servizi di assicurazione") AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
    );
    queries.push(
      `classification-cpv=${CPV_SERVIZI} AND buyer-country=ITA AND publication-date>=${da}${aClause} SORT BY publication-date DESC`,
    );
  }

  console.log("cerca-bandi ted", filtri);

  const batches = await Promise.all(queries.map((q) => tedSearch(q)));
  const seen = new Set<string>();
  const mapped: Bando[] = [];
  for (const batch of batches) {
    for (const notice of batch) {
      const bando = mapNotice(notice, { keyword: filtri.keyword });
      if (!bando || seen.has(bando.id)) continue;
      seen.add(bando.id);
      mapped.push(bando);
    }
  }

  const bandi = applyFiltri(mapped, filtri).slice(0, 30);
  console.log("cerca-bandi ted done", { raw: mapped.length, count: bandi.length });
  return bandi;
}

function applyFiltri(bandi: Bando[], filtri: Filtri): Bando[] {
  const min = filtri.importoMin ? parseFloat(filtri.importoMin) : null;
  const max = filtri.importoMax ? parseFloat(filtri.importoMax) : null;
  const stato = filtri.statoBando && filtri.statoBando !== "tutti" ? filtri.statoBando : "";
  return bandi.filter((b) => {
    if (stato && b.stato !== stato) return false;
    if (min != null && Number.isFinite(min) && (b.importo == null || b.importo < min)) return false;
    if (max != null && Number.isFinite(max) && (b.importo == null || b.importo > max)) return false;
    if (filtri.regioni.length) {
      const hay = `${b.regione || ""} ${b.localita || ""} ${b.titolo || ""} ${b.ente || ""}`.toLowerCase();
      const match = filtri.regioni.some((r) => {
        const nome = r.toLowerCase();
        if (b.regione && b.regione.toLowerCase().replace(/-/g, " ") === nome.replace(/-/g, " ")) return true;
        return hay.includes(nome);
      });
      if (!match) return false;
    }
    if (filtri.dataDa && b.dataPublicazione && b.dataPublicazione < filtri.dataDa) return false;
    if (filtri.dataA && b.dataPublicazione && b.dataPublicazione > filtri.dataA) return false;
    return true;
  });
}

async function enrichFromTed(schedaId: string): Promise<Bando | null> {
  const notices = await tedSearch(`publication-number=${schedaId}`);
  for (const n of notices) {
        const mapped = mapNotice(n, { force: true });
    if (mapped) return mapped;
  }
  return null;
}

async function enrichFromMondo(input: {
  titolo?: string;
  cig?: string;
  link?: string;
}): Promise<Partial<Bando>> {
  const titolo = input.titolo || "";
  const periodo = parsePeriodoDaTitolo(titolo);
  const extra: Partial<Bando> = {
    ...emptyDettaglio(),
    servizio_da: periodo.servizio_da,
    servizio_a: periodo.servizio_a,
    cig: input.cig || null,
    fonte: "mondoappalti",
  };
  if (!input.link || !isMondoSchedaUrl(input.link)) return extra;
  try {
    const resp = await fetch(input.link, {
      headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "CBnet/1.0" },
    });
    if (!resp.ok) return extra;
    const html = (await resp.text()).replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ");
    const text = html.replace(/\s+/g, " ").slice(0, 8000);
    const cigMatch = text.match(/\bCIG[:\s]+([A-Z0-9]{10})\b/i);
    const scadMatch = text.match(/scadenza[:\s]+(\d{1,2}[./-]\d{1,2}[./-]\d{4})/i);
    const vincMatch = text.match(/impresa vincitrice[:\s]+([^.]{4,80})/i) ||
      text.match(/aggiudicatari[oa][:\s]+([^.]{4,80})/i);
    if (cigMatch) extra.cig = cigMatch[1].toUpperCase();
    if (scadMatch) extra.scadenza = scadMatch[1];
    if (vincMatch) {
      extra.aggiudicatario = vincMatch[1].trim();
      extra.aggiudicato = true;
      extra.tipo_avviso = "esito";
    }
    const periodoHtml = parsePeriodoDaTitolo(text);
    extra.servizio_da = extra.servizio_da || periodoHtml.servizio_da;
    extra.servizio_a = extra.servizio_a || periodoHtml.servizio_a;
  } catch (e) {
    console.warn("enrich mondo fetch", e);
  }
  return extra;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "enrich") {
      const schedaId = String(body.scheda_id || "").trim();
      const fonte = String(body.fonte || "").toLowerCase();
      let bando: Partial<Bando> | null = null;
      if (fonte === "ted" || /^\d{4,}-\d{4}$/.test(schedaId)) {
        bando = await enrichFromTed(schedaId);
      }
      if (!bando || fonte === "mondoappalti") {
        const mondo = await enrichFromMondo({
          titolo: body.titolo,
          cig: body.cig,
          link: body.link,
        });
        bando = bando ? { ...mondo, ...bando } : mondo;
      }
      return new Response(JSON.stringify({ bando, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if ((body.action || "start") === "status") {
      return new Response(JSON.stringify({ done: true, sessions: [], bandi: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filtri: Filtri = {
      regioni: Array.isArray(body.regioni) ? body.regioni : [],
      importoMin: body.importoMin,
      importoMax: body.importoMax,
      dataDa: body.dataDa,
      dataA: body.dataA,
      statoBando: body.statoBando,
      keyword: parseKeywordRicerca(body.keyword),
    };
    const fonti = fontiRichieste(body.fonte);
    const jobs = fonti.map(async (fonte) => {
      try {
        const bandi = fonte === "mondoappalti"
          ? await searchMondoAppalti(filtri)
          : fonte === "infordat"
          ? await searchInfordatFonte(filtri)
          : await searchTed(filtri);
        return { fonte, bandi, error: null as string | null };
      } catch (error: unknown) {
        const raw = error instanceof Error ? error.message : "Errore durante la ricerca";
        console.error(`cerca-bandi ${fonte}`, error);
        return { fonte, bandi: [] as Bando[], error: publicErrorMessage(raw) };
      }
    });

    const settled = await Promise.all(jobs);
    const ok = settled.filter((s) => !s.error);
    const failed = settled.filter((s) => s.error);

    if (ok.length === 0) {
      throw new Error(failed[0]?.error || "Errore durante la ricerca");
    }

    const bandi: Bando[] = [];
    const seen = new Set<string>();
    for (const part of ok) {
      for (const bando of part.bandi) {
        const key = `${bando.fonte}:${bando.scheda_id || bando.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        bandi.push(bando);
      }
    }

    const counts = Object.fromEntries(
      fonti.map((f) => [f, bandi.filter((b) => b.fonte === f).length]),
    ) as Record<FonteBando, number>;
    const parts: string[] = [];
    if (fonti.includes("ted")) parts.push(`TED ${counts.ted ?? 0}`);
    if (fonti.includes("mondoappalti")) parts.push(`Mondo Appalti ${counts.mondoappalti ?? 0}`);
    if (fonti.includes("infordat")) parts.push(`Infordat ${counts.infordat ?? 0}`);
    const warning = failed.length
      ? failed.map((f) =>
        f.fonte === "mondoappalti"
          ? "Mondo Appalti non disponibile in questa ricerca."
          : f.fonte === "infordat"
          ? "Infordat non disponibile in questa ricerca."
          : "TED non disponibile in questa ricerca.",
      ).join(" ")
      : undefined;

    const viaLabel = fonti.length > 1 ? fonti.join("+") : fonti[0] === "ted" ? "ted-api" : fonti[0];
    return new Response(
      JSON.stringify({
        status: "completed",
        engine: fonti.length > 1 ? "tutte" : fonti[0],
        via: viaLabel,
        done: true,
        sessionIds: [],
        totalBatches: 0,
        bandi,
        warning,
        message: `Trovati ${bandi.length} bando/i (${parts.join(", ")})`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: unknown) {
    console.error("cerca-bandi", error);
    const raw = error instanceof Error ? error.message : "Errore durante la ricerca";
    return new Response(JSON.stringify({ error: publicErrorMessage(raw) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
