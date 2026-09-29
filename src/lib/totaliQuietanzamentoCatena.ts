import { getProvvigioneEC, type TitoloProvvigioneEC } from "@/lib/getProvvigioneEC";

/**
 * Totali premio/provvigioni del quietanzamento di una catena polizza.
 *
 * Regola: somma solo le quietanze (`rate` = titoli con `sostituisce_polizza`, non appendici).
 * La madre non si somma: in CBnet ripete spesso il premio della prima rata (annuale 1y → 1 madre + 1 quietanza)
 * e sommarla raddoppierebbe. Appendici escluse (titoli da incassare a parte).
 * Se non ci sono rate (legacy/incompleto), fallback sugli importi della madre.
 */
export type TitoloQuietanzamentoLike = TitoloProvvigioneEC & {
  premio_lordo?: number | null;
};

export function totaliQuietanzamentoCatena(
  madre: TitoloQuietanzamentoLike | null | undefined,
  rate: TitoloQuietanzamentoLike[],
  _appendici?: TitoloQuietanzamentoLike[],
): { premio: number; provvigioni: number; count: number } {
  void _appendici; // esplicitamente fuori dal totale quietanzamento
  if (rate.length > 0) {
    let premio = 0;
    let provvigioni = 0;
    for (const t of rate) {
      premio += Number(t.premio_lordo) || 0;
      provvigioni += getProvvigioneEC(t);
    }
    return { premio, provvigioni, count: rate.length };
  }
  if (madre) {
    const premio = Number(madre.premio_lordo) || 0;
    const provvigioni = getProvvigioneEC(madre);
    const count = premio !== 0 || provvigioni !== 0 ? 1 : 0;
    return { premio, provvigioni, count };
  }
  return { premio: 0, provvigioni: 0, count: 0 };
}
