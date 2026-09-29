/** Campi titolo necessari per il calcolo provvigione E/C Agenzie/Compagnia. */
export type TitoloProvvigioneEC = {
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
  sostituisce_polizza?: string | null;
};

/**
 * Provvigione per titoli incassati in E/C Agenzie/Compagnia.
 * Evita il doppio conteggio firma + quietanza (es. quietanza incassata con entrambi a 150 → 150, non 300).
 * Quietanza/rata: solo provvigioni_quietanza; polizza madre legacy: provvigioni_firma.
 */
export function getProvvigioneEC(titolo: TitoloProvvigioneEC): number {
  const firma = Number(titolo.provvigioni_firma) || 0;
  const quietanza = Number(titolo.provvigioni_quietanza) || 0;
  if (titolo.sostituisce_polizza) return quietanza;
  return quietanza > 0 ? quietanza : firma;
}
