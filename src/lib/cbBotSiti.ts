export type CbBotSito = {
  id: string;
  nome: string;
  url: string;
  dominio: string;
  note: string | null;
  attivo: boolean;
  created_at: string;
  updated_at: string;
};

export type ParseSitoResult =
  | { ok: true; url: string; dominio: string }
  | { ok: false; error: string };

/** Normalizza URL/dominio inserito dall'admin (ivass.it, https://www.ivass.it/...). */
export function parseCbBotSitoInput(raw: string): ParseSitoResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, error: "Inserisci un URL o un dominio." };
  if (/\s/.test(trimmed)) return { ok: false, error: "L'indirizzo non può contenere spazi." };

  const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProto);
  } catch {
    return { ok: false, error: "URL non valido." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "Usa un indirizzo http o https." };
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  if (!host.includes(".") || host.endsWith(".")) {
    return { ok: false, error: "Dominio non valido." };
  }
  if (host === "localhost" || /^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { ok: false, error: "Usa un dominio pubblico, non localhost o un IP." };
  }

  const path = parsed.pathname === "/" ? "" : parsed.pathname.replace(/\/$/, "");
  return { ok: true, url: `https://${parsed.hostname}${path}`, dominio: host };
}

/** True se l'URL del risultato di ricerca cade su un dominio (o sottodominio) autorizzato. */
export function isCbBotUrlAllowed(url: string, domains: string[]): boolean {
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
