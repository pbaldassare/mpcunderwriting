/**
 * 5 fattori di regolazione sempre disponibili in immissione (indipendenti dal sottoramo).
 * I fattori custom collegati al sottoramo si aggiungono in coda, senza duplicare codice.
 */

export const FATTORI_REGOLAZIONE_STANDARD = [
  { codice: "fatturato", descrizione: "Fatturato" },
  { codice: "num_dipendenti", descrizione: "N° dipendenti" },
  { codice: "retribuzioni", descrizione: "Retribuzioni" },
  { codice: "superficie", descrizione: "Superficie (mq)" },
  { codice: "valore_assicurato", descrizione: "Valore assicurato" },
] as const;

export type FattoreRegolazioneStandardCodice =
  (typeof FATTORI_REGOLAZIONE_STANDARD)[number]["codice"];

export const FATTORI_REGOLAZIONE_STANDARD_CODICI: readonly FattoreRegolazioneStandardCodice[] =
  FATTORI_REGOLAZIONE_STANDARD.map((f) => f.codice);

export function isFattoreRegolazioneStandard(codice: string): boolean {
  return (FATTORI_REGOLAZIONE_STANDARD_CODICI as readonly string[]).includes(codice);
}

export type FattoreRegolazioneMergeable = {
  id: string;
  codice: string;
  descrizione: string;
};

/**
 * Unisce standard + custom sottoramo: standard nell'ordine canonico, poi custom
 * non già presenti (dedupe by codice).
 */
export function mergeFattoriRegolazione(
  standard: FattoreRegolazioneMergeable[],
  customFromSottoramo: FattoreRegolazioneMergeable[],
): FattoreRegolazioneMergeable[] {
  const stdByCodice = new Map(
    (standard ?? []).filter((f) => f?.codice).map((f) => [f.codice, f]),
  );
  const seen = new Set<string>();
  const out: FattoreRegolazioneMergeable[] = [];

  for (const s of FATTORI_REGOLAZIONE_STANDARD) {
    const f = stdByCodice.get(s.codice);
    if (f) {
      out.push(f);
      seen.add(f.codice);
    }
  }

  for (const f of customFromSottoramo ?? []) {
    if (!f?.codice || seen.has(f.codice)) continue;
    out.push(f);
    seen.add(f.codice);
  }

  return out;
}
