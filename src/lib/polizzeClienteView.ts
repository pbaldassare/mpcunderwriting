// Helpers PURI usati dalla vista "Polizze · Quietanze" del ClienteDetail.
// Estratti per testabilità: stessa semantica del componente PolizzeClienteTable.
import { groupTitoliByPolizza, type TitoloLike, type CatenaPolizza } from "./quietanze";

export type FiltroTipo = "polizze" | "quietanze";

/** Vista polizze: niente espansione rate annidate (si usano i tab Polizze / Quietanze). */
export function shouldShowRate(_filtroTipo: FiltroTipo, _hasRate: boolean): boolean {
  return false;
}

/**
 * Vista flat delle quietanze (mode="quietanze"): per ogni catena emette N righe
 * (una per rata) con il `madreNum` e `madreId` della polizza madre.
 *
 * NB: la polizza madre è il contratto, NON una rata. Le quietanze sono numerate
 * 1..N su N = c.rate.length (numero di figli, esclusa la madre).
 */
export function computeFlatQuietanze<T extends TitoloLike>(
  catene: CatenaPolizza<T>[],
): { rata: T; madreNum: string | null; madreId: string | null; idx: number; totale: number }[] {
  const out: { rata: T; madreNum: string | null; madreId: string | null; idx: number; totale: number }[] = [];
  for (const c of catene) {
    const head = c.madre || c.all[0];
    const madreNum = head?.numero_titolo ?? null;
    const madreId = head?.id ?? null;
    const totale = c.rate.length;
    c.rate.forEach((r, i) => out.push({ rata: r, madreNum, madreId, idx: i + 1, totale }));
  }
  return out;
}


/**
 * Conteggi mostrati nella toolbar (polizze / quietanze) — sono calcolati sui titoli
 * filtrati indipendentemente dalla modalità di rendering. Sono quindi stabili
 * tra "polizze" e "quietanze".
 */
export function computeCounts<T extends TitoloLike>(titoli: T[]): {
  polizze: number;
  quietanze: number;
} {
  let polizze = 0;
  let quietanze = 0;
  for (const t of titoli) {
    if (t.sostituisce_polizza) quietanze++;
    else polizze++;
  }
  return { polizze, quietanze };
}

/**
 * Numero di righe che la tabella renderizza per una data modalità, dato
 * l'insieme delle catene.
 */
export function computeRenderedRowCount<T extends TitoloLike>(
  catene: CatenaPolizza<T>[],
  filtroTipo: FiltroTipo,
  _expanded: Record<string, boolean> = {},
): number {
  if (filtroTipo === "quietanze") {
    return computeFlatQuietanze(catene).length;
  }
  return catene.length;
}

// Re-export per comodità nei test
export { groupTitoliByPolizza };
