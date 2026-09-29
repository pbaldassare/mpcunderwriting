export type FiltroRicerche = "tutte" | "salvate";

export function isRicercaSalvata(c: { salvata?: boolean | null }): boolean {
  return c.salvata === true;
}

export function filterRicerche<T extends { salvata?: boolean | null }>(
  list: T[],
  filtro: FiltroRicerche,
): T[] {
  if (filtro === "salvate") return list.filter(isRicercaSalvata);
  return list;
}

/** Quante ricerche spariscono con «Azzera cronologia» (le salvate restano). */
export function countCronologiaDaAzzerare<T extends { salvata?: boolean | null }>(
  list: T[],
): number {
  return list.filter((c) => !isRicercaSalvata(c)).length;
}
