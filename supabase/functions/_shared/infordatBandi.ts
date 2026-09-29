import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";
const BASE = "https://infordat.it";
const BROKER_RE = /brokeraggio|broker assicur|intermediazione assicur|polizza|assicurativ/i;

export type InfordatBando = {
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
  fonte: "infordat";
};

class CookieJar {
  private cookies = new Map<string, string>();

  header(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  absorb(resp: Response) {
    const raw = typeof resp.headers.getSetCookie === "function"
      ? resp.headers.getSetCookie()
      : [resp.headers.get("set-cookie") || ""];
    for (const line of raw) {
      if (!line) continue;
      const kv = line.split(";")[0];
      const i = kv.indexOf("=");
      if (i <= 0) continue;
      this.cookies.set(kv.slice(0, i).trim(), kv.slice(i + 1).trim());
    }
  }
}

function jsonString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  return String(value).trim();
}

export async function loadInfordatCredentials(): Promise<{ user: string; pass: string }> {
  const envUser = (Deno.env.get("INFORDAT_USERNAME") || Deno.env.get("INFORDAT_USER") || "").trim();
  const envPass = (Deno.env.get("INFORDAT_PASSWORD") || Deno.env.get("INFORDAT_PW") || "").trim();
  if (envUser && envPass) return { user: envUser, pass: envPass };

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Credenziali Infordat non configurate.");
  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from("impostazioni_sistema")
    .select("chiave, valore_json")
    .in("chiave", ["infordat_username", "infordat_password"]);
  if (error) throw new Error("Impossibile leggere le credenziali Infordat.");
  const map = new Map((data || []).map((r: { chiave: string; valore_json: unknown }) => [r.chiave, jsonString(r.valore_json)]));
  const user = map.get("infordat_username") || "";
  const pass = map.get("infordat_password") || "";
  if (!user || !pass) throw new Error("Credenziali Infordat mancanti. Impostale in Impostazioni.");
  return { user, pass };
}

function infordatSchedaId(raw: string): string {
  const value = String(raw || "").trim();
  const digits = value.match(/(\d{4,})/);
  const id = digits ? digits[1] : value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "scheda";
  return id.startsWith("infordat-") ? id : `infordat-${id}`;
}

function normalizeHref(href: string): string {
  const raw = (href || "").trim();
  if (!raw || raw.startsWith("#") || raw.toLowerCase().startsWith("javascript:")) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${BASE}${raw}`;
  return `${BASE}/${raw}`;
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
  const m = text.match(/(?:€\s*)?(\d{1,3}(?:\.\d{3})*(?:,\d{2})|\d+(?:,\d{2}))/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseScadenza(text: string): string | null {
  const m = text.match(/\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/);
  if (!m) return null;
  const [d, mo, y] = m[1].replace(/-/g, "/").split("/");
  const year = y.length === 2 ? `20${y}` : y;
  return `${d.padStart(2, "0")}/${mo.padStart(2, "0")}/${year}`;
}

function parseCig(text: string): string | null {
  const m = text.toUpperCase().match(/\b([A-Z0-9]{10})\b/);
  return m ? m[1] : null;
}

function regioneFromText(text: string, regioni: string[]): string | null {
  const hay = text.toLowerCase();
  for (const r of regioni) {
    if (hay.includes(r.toLowerCase())) return r;
  }
  return null;
}

export function parseInfordatHtml(html: string, regioni: string[] = []): InfordatBando[] {
  const out: InfordatBando[] = [];
  const seen = new Set<string>();
  const push = (b: InfordatBando) => {
    if (!b.titolo || b.titolo.length < 8) return;
    if (/^(login|accedi|infordat|benvenuto)/i.test(b.titolo)) return;
    const key = b.scheda_id || b.id;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(b);
  };

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
    const id = infordatSchedaId(idAttr || href);
    push({
      id,
      titolo: text.slice(0, 300),
      ente: "Scheda Infordat",
      ente_tipo: null,
      importo: parseImporto(text),
      scadenza: parseScadenza(text),
      stato: "aperto",
      dataPublicazione: "",
      link: normalizeHref(href || "/account/listaemail"),
      categoria: "Brokeraggio assicurativo",
      scheda_id: id,
      cig: parseCig(text),
      localita: null,
      regione: regioneFromText(text, regioni),
      pdf_url: null,
      fonte: "infordat",
    });
  }

  const eventRe = /<(a|div)([^>]*class=["'][^"']*event[^"']*["'][^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = eventRe.exec(html))) {
    const attrs = m[2] || "";
    const inner = m[3] || "";
    const href = attrs.match(/href=["']([^"']+)["']/i)?.[1] || "";
    const text = stripTags(`${inner}`);
    if (text.length < 12 && !href) continue;
    const idRaw = href.match(/(\d{4,})/)?.[1] || text.match(/(\d{4,})/)?.[1] || href || text.slice(0, 24);
    const id = infordatSchedaId(idRaw);
    push({
      id,
      titolo: text.slice(0, 300) || "Scheda Infordat",
      ente: "Scheda Infordat",
      ente_tipo: null,
      importo: parseImporto(text),
      scadenza: parseScadenza(text),
      stato: "aperto",
      dataPublicazione: "",
      link: normalizeHref(href || "/account/listaemail"),
      categoria: "Brokeraggio assicurativo",
      scheda_id: id,
      cig: parseCig(text),
      localita: null,
      regione: regioneFromText(text, regioni),
      pdf_url: null,
      fonte: "infordat",
    });
  }
  return out;
}

async function request(jar: CookieJar, url: string, init?: RequestInit): Promise<string> {
  const resp = await fetch(url, {
    ...init,
    headers: {
      "User-Agent": UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Cookie: jar.header(),
      ...(init?.headers || {}),
    },
    redirect: "follow",
  });
  jar.absorb(resp);
  return await resp.text();
}

async function loginInfordat(user: string, pass: string, jar: CookieJar): Promise<string> {
  const loginHtml = await request(jar, `${BASE}/Account/Login`);
  const token = loginHtml.match(/name="__RequestVerificationToken"[^>]*value="([^"]+)"/)?.[1];
  if (!token) throw new Error("Login Infordat non disponibile.");
  const body = new URLSearchParams({
    __RequestVerificationToken: token,
    User_Name: user,
    Password: pass,
    RememberMe: "false",
  });
  const after = await request(jar, `${BASE}/account/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Origin: BASE,
      Referer: `${BASE}/Account/Login`,
    },
    body,
  });
  if (/name="User_Name"/i.test(after) && /type="password"/i.test(after)) {
    throw new Error("Accesso Infordat non riuscito. Controlla utente e password in Impostazioni.");
  }
  return after;
}

function findSearchAction(html: string): { action: string; fields: Record<string, string> } | null {
  const form = html.match(/<form[^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i);
  if (!form) return null;
  const action = form[1];
  if (!/ricerca|filtro|cerca|search|gare|bando/i.test(`${action} ${form[2]}`)) return null;
  const fields: Record<string, string> = {};
  const inputRe = /<input[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = inputRe.exec(form[2]))) {
    const tag = m[0];
    const name = tag.match(/\bname=["']([^"']+)["']/i)?.[1];
    if (!name) continue;
    const type = (tag.match(/\btype=["']([^"']+)["']/i)?.[1] || "text").toLowerCase();
    if (type === "password" || type === "file") continue;
    fields[name] = tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] || "";
  }
  return { action: action.startsWith("http") ? action : `${BASE}${action.startsWith("/") ? "" : "/"}${action}`, fields };
}

export async function searchInfordat(filtri: {
  regioni: string[];
  keyword?: string;
  mode?: "brokeraggio" | "servizi" | "entrambe";
}): Promise<InfordatBando[]> {
  const { user, pass } = await loadInfordatCredentials();
  const jar = new CookieJar();
  const pages: string[] = [];
  pages.push(await loginInfordat(user, pass, jar));
  pages.push(await request(jar, `${BASE}/account`));
  pages.push(await request(jar, `${BASE}/account/listaemail?tutte=true&gare=true`));

  const keyword = (filtri.keyword || "brokeraggio assicurativo").trim();
  for (const html of [...pages]) {
    const search = findSearchAction(html);
    if (!search) continue;
    const body = new URLSearchParams(search.fields);
    for (const [k] of body.entries()) {
      if (/oggetto|testo|keyword|chiave|descrizione|query|q$/i.test(k)) body.set(k, keyword);
    }
    try {
      pages.push(await request(jar, search.action, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Origin: BASE,
          Referer: `${BASE}/account`,
        },
        body,
      }));
    } catch (e) {
      console.warn("infordat search form", e);
    }
  }

  const mapped: InfordatBando[] = [];
  const seen = new Set<string>();
  for (const html of pages) {
    for (const bando of parseInfordatHtml(html, filtri.regioni)) {
      if (seen.has(bando.id)) continue;
      seen.add(bando.id);
      mapped.push(bando);
    }
  }

  const BROKER_ONLY = /brokeraggio|broker assicur|intermediazione assicur/i;
  const filtered = mapped.filter((b) => {
    const hay = `${b.titolo} ${b.ente} ${b.categoria}`;
    if (filtri.mode === "brokeraggio") return BROKER_ONLY.test(hay);
    return BROKER_RE.test(hay);
  });
  return (filtered.length ? filtered : mapped).slice(0, 40);
}
