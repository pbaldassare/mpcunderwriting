/** True se il titolo è una polizza duplicabile (non quietanza, non regolazione). */
export function isDuplicaSorgentePolizza(src: {
  sostituisce_polizza?: unknown;
  is_regolazione?: unknown;
}): boolean {
  return !src.sostituisce_polizza && !src.is_regolazione;
}

/** Colonne `titoli` da non clonare in Duplica (identificativi, date da reinserire, stati). */
export const TITOLI_DUPLICA_DROP_KEYS = new Set<string>([
  "id",
  "created_at",
  "updated_at",
  "numero_titolo",
  "garanzia_da",
  "garanzia_a",
  "data_decorrenza",
  "data_scadenza",
  "data_competenza",
  "data_messa_cassa",
  "data_pagamento",
  "data_incasso",
  "importo_incassato",
  "data_decorrenza_rinnovo",
  "stato",
  "sostituisce_polizza",
  "sostituita_da",
  "annullata_il",
  "stornata_il",
  "sospesa_il",
  "fondi_ricevuti",
  "conferimento_gestito",
  "cig",
  "codice_cig",
  "polizza_id",
]);

/**
 * Payload insert per Duplica polizza.
 * Su `titoli` la decorrenza è `garanzia_da` — `data_decorrenza` non esiste (è su polizza_cga).
 */
export function buildDuplicaTitoloPayload(
  src: Record<string, unknown>,
  args: { numero: string; decorrenza: string; scadenza: string },
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(src)) {
    if (!TITOLI_DUPLICA_DROP_KEYS.has(k)) payload[k] = v;
  }
  delete payload.data_decorrenza;
  payload.numero_titolo = args.numero.trim();
  payload.garanzia_da = args.decorrenza;
  payload.garanzia_a = args.scadenza;
  payload.data_scadenza = args.scadenza;
  payload.data_competenza = args.decorrenza;
  payload.stato = "attivo";
  return payload;
}
