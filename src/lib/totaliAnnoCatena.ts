import { getProvvigioneEC, type TitoloProvvigioneEC } from "@/lib/getProvvigioneEC";

/**
 * Anno solare di appartenenza di una quietanza/appendice per i totali "anno in corso".
 *
 * Priorità:
 * 1. `garanzia_da`
 * 2. `data_competenza` (se garanzia_da assente)
 * 3. `garanzia_a` (ultimo fallback)
 *
 * Ritorna `null` se nessuna data è valida.
 */
export type TitoloAnnoLike = TitoloProvvigioneEC & {
  garanzia_da?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
  premio_lordo?: number | null;
};

function yearFromDateLike(value: string | null | undefined): number | null {
  if (!value) return null;
  // ISO / YYYY-MM-DD (o timestamp): primi 4 caratteri se numerici
  const y = Number(String(value).slice(0, 4));
  if (Number.isFinite(y) && y >= 1000 && y <= 9999) return y;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.getFullYear();
}

export function yearOfTitoloForAnno(t: {
  garanzia_da?: string | null;
  data_competenza?: string | null;
  garanzia_a?: string | null;
}): number | null {
  return (
    yearFromDateLike(t.garanzia_da) ??
    yearFromDateLike(t.data_competenza) ??
    yearFromDateLike(t.garanzia_a)
  );
}

/**
 * @deprecated Usare `totaliQuietanzamentoCatena` per i totali in Polizze cliente.
 * Somma premio_lordo e getProvvigioneEC delle rate+appendici con appartenenza all'`anno`.
 * Non include la polizza madre.
 */
export function totaliAnnoCatena(
  rate: TitoloAnnoLike[],
  appendici: TitoloAnnoLike[],
  anno: number,
): { premio: number; provvigioni: number; count: number } {
  let premio = 0;
  let provvigioni = 0;
  let count = 0;
  for (const t of [...rate, ...appendici]) {
    if (yearOfTitoloForAnno(t) !== anno) continue;
    premio += Number(t.premio_lordo) || 0;
    provvigioni += getProvvigioneEC(t);
    count += 1;
  }
  return { premio, provvigioni, count };
}
