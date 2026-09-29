import { isCbBotUrlAllowed } from "@/lib/cbBotSiti";

export type CbBotFonte = {
  id: string;
  titolo: string;
  url: string;
  snippet: string | null;
  dominio: string;
  origine: "ricerca" | "manuale";
  conversazione_id: string | null;
  messaggio_id: string | null;
  note: string | null;
  tags: string[];
  attiva: boolean;
  created_at: string;
  updated_at: string;
};

export type WebFonteHit = {
  title?: string;
  url: string;
  snippet?: string;
};

/** Canonicalizza un URL fonte (https, host senza www, senza slash finale). */
export function normalizeFonteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || host === "localhost") return null;
    const path = u.pathname.replace(/\/+$/, "");
    return `https://${host}${path}${u.search}`;
  } catch {
    return null;
  }
}

export function dominioFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function extractWebFonti(fonti: unknown): WebFonteHit[] {
  if (!Array.isArray(fonti)) return [];
  const seen = new Set<string>();
  const out: WebFonteHit[] = [];
  for (const raw of fonti) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as { title?: unknown; url?: unknown; snippet?: unknown };
    const url = typeof rec.url === "string" ? normalizeFonteUrl(rec.url) : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push({
      title: typeof rec.title === "string" && rec.title.trim() ? rec.title.trim() : undefined,
      url,
      snippet: typeof rec.snippet === "string" ? rec.snippet.slice(0, 400) : undefined,
    });
  }
  return out;
}

function tokenize(q: string): string[] {
  return q
    .toLowerCase()
    .split(/[^a-z0-9àèéìòù]+/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

export function scoreFonteVsQuery(
  fonte: { titolo: string; snippet?: string | null; url: string },
  query: string,
): number {
  const tokens = tokenize(query);
  if (tokens.length === 0) return 0;
  const hay = `${fonte.titolo} ${fonte.snippet ?? ""} ${fonte.url}`.toLowerCase();
  return tokens.reduce((n, t) => n + (hay.includes(t) ? 1 : 0), 0);
}

/** Sceglie le fonti da iniettare nel prompt: tutte se poche, altrimenti overlap con la domanda. */
export function pickFontiForQuery<T extends { titolo: string; snippet?: string | null; url: string }>(
  fonti: T[],
  query: string,
  limit = 8,
): T[] {
  const attive = fonti.filter(Boolean);
  if (attive.length === 0) return [];
  if (attive.length <= 5) return attive.slice(0, limit);
  const ranked = attive
    .map((f) => ({ f, s: scoreFonteVsQuery(f, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.f);
  return ranked;
}

export function assertFonteSuSitiAutorizzati(
  url: string,
  domains: string[],
): { ok: true; url: string; dominio: string } | { ok: false; error: string } {
  const canonical = normalizeFonteUrl(url);
  if (!canonical) return { ok: false, error: "URL non valido." };
  if (!isCbBotUrlAllowed(canonical, domains)) {
    return { ok: false, error: "La fonte deve stare su un sito autorizzato." };
  }
  const dominio = dominioFromUrl(canonical);
  if (!dominio) return { ok: false, error: "Dominio non valido." };
  return { ok: true, url: canonical, dominio };
}
