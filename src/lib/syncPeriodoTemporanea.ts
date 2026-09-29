/** Campi periodo allineati quando polizza_temporanea è attiva. */
export type SyncPeriodoTemporaneaResult = {
  data_competenza: string;
  garanzia_da: string;
  garanzia_a: string;
};

/** Allinea data competenza e garanzie alle date durata per polizze temporanee. */
export function syncPeriodoTemporanea({
  durataDa,
  durataA,
}: {
  durataDa: string;
  durataA: string;
}): SyncPeriodoTemporaneaResult {
  return {
    data_competenza: durataDa || "",
    garanzia_da: durataDa || "",
    garanzia_a: durataA || "",
  };
}
