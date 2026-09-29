export const DEFAULT_PERCENTUALE_RA = 4.6;

export type PercentualeRAInput = {
  rapporto_percentuale_ra?: number | null;
  compagnia_percentuale_ra?: number | null;
};

/** Risolve % RA: rapporto → compagnia → 4.60 */
export function resolvePercentualeRA(input: PercentualeRAInput): number {
  const rapporto = Number(input.rapporto_percentuale_ra);
  if (Number.isFinite(rapporto) && rapporto > 0) return rapporto;

  const compagnia = Number(input.compagnia_percentuale_ra);
  if (Number.isFinite(compagnia) && compagnia > 0) return compagnia;

  return DEFAULT_PERCENTUALE_RA;
}

/** Ritenuta d'acconto su singola provvigione, arrotondata a 2 decimali */
export function calcolaRitenutaAcconto(provvigione: number, percentualeRA: number): number {
  return Math.round((provvigione * percentualeRA) / 100 * 100) / 100;
}
