import { safeId } from "@/lib/safeId";

const STORAGE_KEY = "cbnet_cb_bot_fonti_siti_v1";

export type CbBotFonteSito = {
  id: string;
  url: string;
  titolo?: string;
  gruppo?: string;
  createdAt: string;
};

/** Fonti ufficiali da precaricare (IVASS prima). */
export const CB_BOT_FONTI_UFFICIALI: { url: string; titolo: string; gruppo: string }[] = [
  { gruppo: "IVASS", titolo: "Home IVASS", url: "https://www.ivass.it/" },
  { gruppo: "IVASS", titolo: "Normativa IVASS", url: "https://www.ivass.it/normativa/" },
  {
    gruppo: "IVASS",
    titolo: "Focus distribuzione assicurativa",
    url: "https://www.ivass.it/normativa/focus/distribuzione-assicurativa/index.html",
  },
  {
    gruppo: "IVASS",
    titolo: "Consumatori — Proteggi te stesso",
    url: "https://www.ivass.it/consumatori/proteggi/index.html",
  },
  { gruppo: "IVASS", titolo: "Registro Unico Intermediari", url: "https://www.ivass.it/consumatori/rui/index.html" },
  {
    gruppo: "IVASS",
    titolo: "RUI pubblico — consultazione",
    url: "https://ruipubblico.ivass.it/rui-pubblica/ng/",
  },
  {
    gruppo: "IVASS",
    titolo: "Siti imprese e intermediari",
    url: "https://www.ivass.it/consumatori/siti-imprese-intermediari/index.html",
  },
  { gruppo: "IVASS", titolo: "Cyber / truffe", url: "https://www.ivass.it/cyber/index.html" },
  { gruppo: "IVASS", titolo: "Preventivass", url: "https://www.preventivass.it/" },
  {
    gruppo: "IVASS",
    titolo: "Open data IVASS (dati.gov.it)",
    url: "https://www.dati.gov.it/view-dataset?organization=ivass-istituto-per-la-vigilanza-sulle-assicurazioni",
  },
  { gruppo: "Ufficiale", titolo: "Normattiva", url: "https://www.normattiva.it/" },
  { gruppo: "Ufficiale", titolo: "Gazzetta Ufficiale", url: "https://www.gazzettaufficiale.it/" },
  {
    gruppo: "Ufficiale",
    titolo: "EUR-Lex — Direttiva IDD 2016/97",
    url: "https://eur-lex.europa.eu/legal-content/IT/TXT/?uri=CELEX:32016L0097",
  },
  { gruppo: "Ufficiale", titolo: "EIOPA", url: "https://www.eiopa.europa.eu/" },
  { gruppo: "Ufficiale", titolo: "Banca d’Italia", url: "https://www.bancaditalia.it/" },
  { gruppo: "Ufficiale", titolo: "UIF — antiriciclaggio", url: "https://uif.bancaditalia.it/" },
  { gruppo: "Ufficiale", titolo: "Garante Privacy", url: "https://www.garanteprivacy.it/" },
  { gruppo: "Ufficiale", titolo: "COVIP", url: "https://www.covip.it/" },
  { gruppo: "Ufficiale", titolo: "CONSAP", url: "https://www.consap.it/" },
  {
    gruppo: "Ufficiale",
    titolo: "Portale dell’automobilista",
    url: "https://www.ilportaledellautomobilista.it/",
  },
  { gruppo: "Settore", titolo: "ANIA", url: "https://www.ania.it/" },
  { gruppo: "Settore", titolo: "AIBA", url: "https://www.aiba.it/" },
];

function normalizeUrl(raw: string): string {
  return raw.trim();
}

export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(normalizeUrl(raw));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function hasUrl(rows: CbBotFonteSito[], url: string): boolean {
  return rows.some((r) => r.url.toLowerCase() === url.toLowerCase());
}

export function mergeFontiUfficiali(existing: CbBotFonteSito[]): CbBotFonteSito[] {
  const now = new Date().toISOString();
  const next = [...existing];
  for (const f of CB_BOT_FONTI_UFFICIALI) {
    if (hasUrl(next, f.url)) continue;
    next.push({
      id: safeId(),
      url: f.url,
      titolo: f.titolo,
      gruppo: f.gruppo,
      createdAt: now,
    });
  }
  return next;
}

export function readCbBotFontiSiti(): CbBotFonteSito[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const seeded = mergeFontiUfficiali([]);
      writeCbBotFontiSiti(seeded);
      return seeded;
    }
    const parsed = JSON.parse(raw) as CbBotFonteSito[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeCbBotFontiSiti(rows: CbBotFonteSito[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // private mode / quota: non far crashare la pagina
  }
}

export function countCbBotFontiSiti(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as CbBotFonteSito[];
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

export function seedFontiUfficialiSeVuoto(): CbBotFonteSito[] {
  try {
    const current = (() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw) as CbBotFonteSito[];
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    })();
    if (current.length > 0) return current;
    const seeded = mergeFontiUfficiali([]);
    writeCbBotFontiSiti(seeded);
    return seeded;
  } catch {
    return [];
  }
}

export function applyFontiUfficiali(): { rows: CbBotFonteSito[]; added: number } {
  const before = readCbBotFontiSiti();
  const next = mergeFontiUfficiali(before);
  const added = next.length - before.length;
  writeCbBotFontiSiti(next);
  return { rows: next, added };
}

export function addCbBotFonteSito(url: string): { ok: true; rows: CbBotFonteSito[] } | { ok: false; error: string } {
  const trimmed = normalizeUrl(url);
  if (!isValidHttpUrl(trimmed)) {
    return { ok: false, error: "Inserisci un URL http o https valido." };
  }
  const rows = readCbBotFontiSiti();
  if (hasUrl(rows, trimmed)) return { ok: false, error: "Questo sito è già in elenco." };
  const next = [
    ...rows,
    { id: safeId(), url: trimmed, createdAt: new Date().toISOString() },
  ];
  writeCbBotFontiSiti(next);
  return { ok: true, rows: next };
}

export function removeCbBotFonteSito(id: string): CbBotFonteSito[] {
  const next = readCbBotFontiSiti().filter((r) => r.id !== id);
  writeCbBotFontiSiti(next);
  return next;
}
