export type TitoloConRamo = {
  id: string;
  ramo_id?: string | null;
  ramo?: { gruppo_ramo_id?: string | null } | null;
};

/** Gruppo ramo (UI «Ramo») di una polizza. */
export function gruppoRamoIdOfTitolo(
  titolo: TitoloConRamo,
  ramiById?: Map<string, string | null>,
): string | null {
  const fromJoin = titolo.ramo?.gruppo_ramo_id ?? null;
  if (fromJoin) return fromJoin;
  if (titolo.ramo_id && ramiById) return ramiById.get(titolo.ramo_id) ?? null;
  return null;
}

/** Se `gruppoIds` è vuoto non filtra (mostra tutte). */
export function filterTitoliByGruppiRamo<T extends TitoloConRamo>(
  titoli: T[],
  gruppoIds: string[],
  ramiById?: Map<string, string | null>,
): T[] {
  if (gruppoIds.length === 0) return titoli;
  const wanted = new Set(gruppoIds);
  return titoli.filter((t) => {
    const g = gruppoRamoIdOfTitolo(t, ramiById);
    return !!g && wanted.has(g);
  });
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

/** Unisce estrazioni: i valori già presenti non vengono sovrascritti da vuoti. */
export function mergeValoriCampi(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...base };
  for (const [k, v] of Object.entries(extra)) {
    if (v === null || v === undefined || v === "") continue;
    const prev = out[k];
    if (prev === null || prev === undefined || prev === "") out[k] = v;
  }
  return out;
}

/** Clausola `.or()` catalogo: campi generici + quelli dei rami scelti. */
export function catalogoOrFilter(gruppoRamoIds: string[]): string {
  if (gruppoRamoIds.length === 0) return "gruppo_ramo_id.is.null";
  return `gruppo_ramo_id.is.null,gruppo_ramo_id.in.(${gruppoRamoIds.join(",")})`;
}
