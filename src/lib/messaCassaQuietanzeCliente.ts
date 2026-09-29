export type QuietanzaClienteRaw = {
  id: string;
  numero_titolo?: string | null;
  sostituisce_polizza?: string | null;
  premio_lordo?: number | null;
};

/**
 * Elenco "quietanze da incassare" in Messa a cassa.
 * Il lordo della vista può essere quello legacy di `quietanze` (es. 1222,50):
 * si usa `titoli.premio_lordo` e si esclude la stessa polizza già in distinta.
 */
export function filterQuietanzeClienteDaIncassare<T extends QuietanzaClienteRaw>(
  raw: T[],
  alreadyIds: Set<string>,
  alreadyNumeri: Set<string>,
  lordoByTitoloId: Record<string, number>,
): T[] {
  const numeriPadre = new Set(
    raw.filter((r) => r.sostituisce_polizza).map((r) => String(r.sostituisce_polizza)),
  );
  return raw
    .filter((r) => !alreadyIds.has(r.id))
    .filter((r) => !r.numero_titolo || !alreadyNumeri.has(r.numero_titolo))
    .filter((r) => !(r.sostituisce_polizza == null && r.numero_titolo && numeriPadre.has(r.numero_titolo)))
    .map((r) => {
      const lordo = lordoByTitoloId[r.id];
      return lordo == null ? r : { ...r, premio_lordo: lordo };
    });
}
