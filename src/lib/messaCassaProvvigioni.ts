import { getProvvigioneEC, type TitoloProvvigioneEC } from "@/lib/getProvvigioneEC";
import { calcProvvigioneProduttoreEuro } from "@/lib/provvigioneProduttore";
import { calcProvvigioneProduttorePrincipale } from "@/lib/trattenutaProvvigioniIncasso";

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Display «Conferma Messa a Cassa» — solo lettura, nessuna scrittura di cassa.
 *
 * Provvigioni attive = tot provvigioni titolo (`getProvvigioneEC`):
 *   quietanza (`sostituisce_polizza`) → `provvigioni_quietanza`
 *   altrimenti → `provvigioni_quietanza` se > 0, senno `provvigioni_firma`
 *   (su `titoli` non esiste `provvigione_lordo`; il tot è firma/quietanza.)
 *
 * Provvigioni passive = quota produttori:
 *   se `titoli_split_commerciali` ha righe → attive × Σ(percentuale split) / 100
 *   se nessun split e c'è un commerciale (`anagrafica_commerciale_id` o `produttore_id`)
 *     → attive × (`percentuale_commerciale` oppure 100) / 100
 *   se nessun split e nessun commerciale → 0
 *
 * Più quietanze: somma attive e somma passive.
 */
export type TitoloProvvigioniMessaCassa = TitoloProvvigioneEC & {
  id: string;
  anagrafica_commerciale_id?: string | null;
  produttore_id?: string | null;
  percentuale_commerciale?: number | null;
};

export type SplitPercentualiByTitolo = Map<string, number[]>;

export function calcProvvigioniAttive(titolo: TitoloProvvigioneEC): number {
  return getProvvigioneEC(titolo);
}

export function calcProvvigioniPassive(
  titolo: TitoloProvvigioniMessaCassa,
  splitsByTitolo?: SplitPercentualiByTitolo | null,
): number {
  const attive = calcProvvigioniAttive(titolo);
  const splits = splitsByTitolo?.get(titolo.id);
  if (splits && splits.length > 0) {
    return calcProvvigioneProduttoreEuro(attive, { splitPercentuali: splits });
  }
  const hasCommerciale = !!(titolo.anagrafica_commerciale_id || titolo.produttore_id);
  if (!hasCommerciale) return 0;
  return calcProvvigioneProduttorePrincipale(attive, titolo.percentuale_commerciale);
}

export function sumMessaCassaProvvigioni(
  titoli: TitoloProvvigioniMessaCassa[],
  splitsByTitolo?: SplitPercentualiByTitolo | null,
): { attive: number; passive: number } {
  let attive = 0;
  let passive = 0;
  for (const t of titoli) {
    attive += calcProvvigioniAttive(t);
    passive += calcProvvigioniPassive(t, splitsByTitolo);
  }
  return { attive: round2(attive), passive: round2(passive) };
}
