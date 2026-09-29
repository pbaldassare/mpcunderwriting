// Mapping da testo libero AI → catalogo rca_garanzie reale (DB).
// NON inventare codici: tutto deve corrispondere a `codice` esistente.

export type CatalogoVoce = { codice: string; descrizione: string; aliquota_tasse?: number | null };

// Codice speciale usato nel componente VociRcaCard per la riga RCA principale.
export const RCA_PRINCIPALE_CODE = "RCA";

const SINONIMI: Record<string, string[]> = {
  RCA: ["rca auto", "rc auto", "responsabilita civile", "responsabilità civile", " rca", "rca "],
  "01": ["cristall"],
  "02": ["terremot"],
  "03": ["alluvion", "inondaz"],
  "04": ["socio", "politic", "atti vandali", "vandalismo", "vandalic"],
  "05": ["incendio"],
  "06": ["atmosferic", "eventi naturali"],
  "07": ["grandine"],
  "08": ["accessor"], // usato come fallback per "garanzie accessorie RCA"
  "09": ["ard accessor", "ard garanzie"],
  "10": ["unibox", "recupero scatola"],
  "11": ["furto"],
  "12": ["assistenza", "soccorso", "pas "],
  "13": ["tutela", "giudiziar", "legale"],
  "14": ["infortun"],
  "15": ["casko", "kasko", "collision", "guasti tecnici"],
  "90": ["diritti"],
  "91": ["black box", "blackbox", "scatola nera", "canone "],
};

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export type MatchResult = {
  status: "matched" | "unmatched";
  codice?: string;
  suggerimenti: { codice: string; descrizione: string }[];
};

export function matchGaranzia(
  descrizione: string,
  codiceEsplicito: string | undefined,
  catalogo: CatalogoVoce[],
): MatchResult {
  const desc = norm(descrizione);

  // 1) codice esplicito (es. "01", "15", "RCA")
  if (codiceEsplicito) {
    const codeUp = String(codiceEsplicito).trim().toUpperCase();
    if (codeUp === "RCA") return { status: "matched", codice: "RCA", suggerimenti: [] };
    const padded = codeUp.padStart(2, "0");
    const hit = catalogo.find((c) => c.codice.toUpperCase() === padded);
    if (hit) return { status: "matched", codice: hit.codice, suggerimenti: [] };
  }

  // 2) sinonimi keyword (RCA principale)
  if (SINONIMI.RCA.some((k) => desc.includes(k))) {
    return { status: "matched", codice: "RCA", suggerimenti: [] };
  }

  // 3) sinonimi keyword (catalogo)
  for (const c of catalogo) {
    const kws = SINONIMI[c.codice] || [];
    if (kws.some((k) => desc.includes(k))) {
      return { status: "matched", codice: c.codice, suggerimenti: [] };
    }
  }

  // 4) match descrizione catalogo (token includes)
  const tokens = desc.split(" ").filter((t) => t.length > 3);
  const scored = catalogo
    .map((c) => {
      const cd = norm(c.descrizione);
      let score = 0;
      for (const t of tokens) if (cd.includes(t)) score++;
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => ({ codice: x.c.codice, descrizione: x.c.descrizione }));

  return { status: "unmatched", suggerimenti: scored };
}
