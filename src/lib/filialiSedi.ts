/**
 * Allineamento filiali gestionale (TTXFL00F) → uffici CBnet.
 * Match per codice (con alias Roma/Napoli). Niente doppioni.
 */

export type FilialeRiga = {
  codice: string;
  nome: string;
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
};

export type UfficioEsistente = {
  id: string;
  codice_ufficio: string | null;
  nome_ufficio: string;
  indirizzo?: string | null;
  cap?: string | null;
  citta?: string | null;
  provincia?: string | null;
};

/** Codici gestionali che non sono sedi operative da creare. */
export const FILIALI_SKIP = new Set([
  "1", // duplicato di NA (stesso indirizzo Mergellina)
  "A1",
  "AS",
  "CV",
  "DM", // ambiente demo
  "MN", // Città Metropolitana di Napoli
  "PC", // Produttori Catania
  "Z1", // Ufficio Cauzioni
]);

/** Codice file → codice già in CBnet. */
export const FILIALI_ALIAS_CODICE: Record<string, string> = {
  RM: "009",
  RO: "RM2",
};

export function normCodiceFiliale(raw: string | number | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase();
}

export function emptyToNull(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s ? s : null;
}

export function resolveCodiceCBnet(codiceFile: string): string {
  const c = normCodiceFiliale(codiceFile);
  return FILIALI_ALIAS_CODICE[c] ?? c;
}

export function parseFilialiRows(rows: Array<Record<string, unknown>>): FilialeRiga[] {
  return rows
    .map((r) => ({
      codice: normCodiceFiliale(
        (r["Codice Filiale"] ?? r.codice ?? r.Codice ?? "") as string | number,
      ),
      nome: String(r["Descrizione Filiale"] ?? r.nome ?? r.Descrizione ?? "").trim(),
      indirizzo: emptyToNull(String(r.Indirizzo ?? r.indirizzo ?? "")),
      cap: emptyToNull(String(r.Cap ?? r.cap ?? "")),
      citta: emptyToNull(String(r.Località ?? r.Localita ?? r.citta ?? r.Sede ?? "")),
      provincia: emptyToNull(String(r.Prov ?? r.provincia ?? "")),
    }))
    .filter((r) => r.codice && r.nome);
}

export type PianoFiliale =
  | { esito: "salta"; riga: FilialeRiga; motivo: string }
  | { esito: "aggiorna"; riga: FilialeRiga; esistente: UfficioEsistente; codiceCBnet: string }
  | { esito: "crea"; riga: FilialeRiga; codiceCBnet: string };

export function planFilialiSedi(
  righe: FilialeRiga[],
  esistenti: UfficioEsistente[],
): PianoFiliale[] {
  const byCodice = new Map(
    esistenti
      .filter((u) => u.codice_ufficio)
      .map((u) => [normCodiceFiliale(u.codice_ufficio), u]),
  );
  const seen = new Set<string>();
  const out: PianoFiliale[] = [];

  for (const riga of righe) {
    const codice = normCodiceFiliale(riga.codice);
    if (FILIALI_SKIP.has(codice)) {
      out.push({ esito: "salta", riga, motivo: "non è una sede operativa da allineare" });
      continue;
    }
    const codiceCBnet = resolveCodiceCBnet(codice);
    if (seen.has(codiceCBnet)) {
      out.push({ esito: "salta", riga, motivo: `doppio del codice ${codiceCBnet}` });
      continue;
    }
    seen.add(codiceCBnet);
    const esistente = byCodice.get(codiceCBnet);
    if (esistente) {
      out.push({ esito: "aggiorna", riga, esistente, codiceCBnet });
    } else {
      out.push({ esito: "crea", riga, codiceCBnet });
    }
  }
  return out;
}

/** Sovrascrive solo i campi valorizzati nel file; non azzera email/telefono. */
export function patchUfficioDaFiliale(
  esistente: UfficioEsistente,
  riga: FilialeRiga,
): {
  indirizzo: string | null;
  cap: string | null;
  citta: string | null;
  provincia: string | null;
} {
  return {
    indirizzo: riga.indirizzo ?? esistente.indirizzo ?? null,
    cap: riga.cap ?? esistente.cap ?? null,
    citta: riga.citta ?? esistente.citta ?? null,
    provincia: riga.provincia ?? esistente.provincia ?? null,
  };
}
