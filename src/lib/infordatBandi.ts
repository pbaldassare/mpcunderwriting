export type InfordatHit = {
  id: string;
  titolo: string;
  ente: string;
  importo: number | null;
  scadenza: string | null;
  link: string;
  localita: string | null;
  regione: string | null;
  cig: string | null;
};

const CIG_RE = /\b([A-Z0-9]{10})\b/;
const MONEY_RE = /(?:€\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2}))/;
const DATE_RE = /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/;

export function isInfordatUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "infordat.it" || host.endsWith(".infordat.it");
  } catch {
    return false;
  }
}

export function infordatSchedaId(raw: string | null | undefined): string {
  const value = String(raw || "").trim();
  const digits = value.match(/(\d{4,})/);
  const id = digits ? digits[1] : value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "scheda";
  return id.startsWith("infordat-") ? id : `infordat-${id}`;
}

export function normalizeInfordatHref(href: string): string {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `https://infordat.it${raw}`;
  return `https://infordat.it/${raw}`;
}

function decodeHtml(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html: string): string {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " "));
}

function parseImporto(text: string): number | null {
  const m = text.match(MONEY_RE);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseScadenza(text: string): string | null {
  const m = text.match(DATE_RE);
  if (!m) return null;
  const [d, mo, y] = m[1].replace(/-/g, "/").split("/");
  const year = y.length === 2 ? `20${y}` : y;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${year}`;
}

function parseCig(text: string): string | null {
  const m = text.toUpperCase().match(CIG_RE);
  return m ? m[1] : null;
}

function regioneFromText(text: string, regioni: string[]): string | null {
  const hay = text.toLowerCase();
  for (const r of regioni) {
    if (hay.includes(r.toLowerCase())) return r;
  }
  return null;
}

function pushHit(out: InfordatHit[], hit: InfordatHit) {
  if (!hit.titolo || hit.titolo.length < 8) return;
  if (/^(login|accedi|infordat|benvenuto)/i.test(hit.titolo)) return;
  const key = hit.id || hit.link;
  if (out.some((h) => h.id === key || h.link === hit.link)) return;
  out.push(hit);
}

/** Estrae schede gara dall'HTML dell'area riservata Infordat. */
export function parseInfordatHtml(html: string, regioniCatalogo: string[] = []): InfordatHit[] {
  const out: InfordatHit[] = [];
  if (!html) return out;

  const rowRe = /<(tr|div|article|li)([^>]*?)>([\s\S]*?)<\/\1>/gi;
  let m: RegExpExecArray | null;
  while ((m = rowRe.exec(html))) {
    const attrs = m[2] || "";
    const inner = m[3] || "";
    const href =
      attrs.match(/data-href=["']([^"']+)["']/i)?.[1]
      || inner.match(/href=["']([^"']*(?:gara|scheda|bando|dettaglio)[^"']*)["']/i)?.[1]
      || "";
    const idAttr =
      attrs.match(/\bid=["']gare-([^"']+)["']/i)?.[1]
      || attrs.match(/data-(?:id|gara|scheda)=["']([^"']+)["']/i)?.[1]
      || href.match(/(\d{4,})/)?.[1]
      || "";
    if (!href && !idAttr) continue;
    const text = stripTags(inner);
    if (text.length < 12) continue;
    const link = normalizeInfordatHref(href || `/account/listaemail`);
    const titolo = text.slice(0, 300);
    pushHit(out, {
      id: infordatSchedaId(idAttr || href),
      titolo,
      ente: "Scheda Infordat",
      importo: parseImporto(text),
      scadenza: parseScadenza(text),
      link,
      localita: null,
      regione: regioneFromText(text, regioniCatalogo),
      cig: parseCig(text),
    });
  }

  const eventRe = /<(a|div)([^>]*class=["'][^"']*event[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = eventRe.exec(html))) {
    const attrs = m[2] || "";
    const inner = m[3] || "";
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1] || "";
    const text = stripTags(`${attrs} ${inner}`);
    if (!href && text.length < 12) continue;
    const id = href.match(/(\d{4,})/)?.[1] || text.match(/(\d{4,})/)?.[1] || "";
    pushHit(out, {
      id: infordatSchedaId(id || href || text.slice(0, 24)),
      titolo: text.slice(0, 300),
      ente: "Scheda Infordat",
      importo: parseImporto(text),
      scadenza: parseScadenza(text),
      link: normalizeInfordatHref(href || "/account/listaemail"),
      localita: null,
      regione: regioneFromText(text, regioniCatalogo),
      cig: parseCig(text),
    });
  }

  return out;
}

export function isBrokeraggioInfordat(text: string): boolean {
  return /brokeraggio|broker assicur|intermediazione assicur|polizza|assicurativ/i.test(text);
}
