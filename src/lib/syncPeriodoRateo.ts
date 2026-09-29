/** Campi periodo allineati quando polizza_rateo è attiva. */

import { computeRateoDurataA } from "./quietanzePlan";

export type SyncPeriodoRateoResult = {
  data_competenza: string;
  garanzia_da: string;
  durata_a?: string;
  /** true se durata_a va applicata (non toccata manualmente o valore attuale blocca Q2+). */
  applyDurataA: boolean;
};

/**
 * Allinea periodo per polizze rateo:
 * - garanzia_da = durata_da (inizio contratto)
 * - garanzia_a resta editabile dall'utente (fine fase rateo)
 * - durata_a = fine contratto reale, allineata a computeRateoPlan / trigger DB
 */
export function syncPeriodoRateo({
  garanziaDa,
  durataDa,
  garanziaA,
  frazionamento,
  durataATouched,
  currentDurataA,
  anniDurata,
}: {
  garanziaDa: string;
  durataDa: string;
  garanziaA?: string;
  frazionamento?: string;
  durataATouched: boolean;
  currentDurataA?: string;
  anniDurata: number;
}): SyncPeriodoRateoResult {
  const garanzia_da = durataDa || garanziaDa || "";
  const result: SyncPeriodoRateoResult = {
    garanzia_da,
    data_competenza: garanziaDa || garanzia_da,
    applyDurataA: false,
  };

  if (!durataDa || anniDurata < 1) return result;

  const durata_a = computeRateoDurataA({
    durataDa,
    garanziaA,
    frazionamento,
    anniDurata,
  });
  if (!durata_a) return result;

  const blocksFollowOn = Boolean(
    garanziaA && currentDurataA && currentDurataA <= garanziaA,
  );
  const applyDurataA = !durataATouched || blocksFollowOn;
  if (applyDurataA) {
    result.durata_a = durata_a;
    result.applyDurataA = true;
  }
  return result;
}
