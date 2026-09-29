import { isAppendice } from "@/lib/quietanze";

export const QUIETANZA_SCADENZA_SOGLIA_GIORNI = 60;

/** Data limite (YYYY-MM-DD) per mostrare rate quietanza: oggi + soglia giorni. */
export function quietanzaSogliaGaranziaDa(now: Date = new Date()): string {
  const limite = new Date(now);
  limite.setHours(23, 59, 59, 999);
  limite.setDate(limite.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
  return limite.toISOString().slice(0, 10);
}

/** Titolo quietanza/appendice ancora da incassare. */
export function isTitoloNonIncassato(t: {
  stato?: string | null;
  data_messa_cassa?: string | null;
}): boolean {
  return t.stato === "attivo" && !t.data_messa_cassa;
}

type QuietanzaViewTitolo = {
  id?: string;
  stato?: string | null;
  data_messa_cassa?: string | null;
  garanzia_da?: string | null;
  sostituisce_polizza?: string | null;
  is_appendice_modifica?: boolean | null;
  is_proroga?: boolean | null;
  is_regolazione?: boolean | null;
  numero_titolo?: string | null;
};

/**
 * Vista Quietanze cliente: solo rate quietanza da incassare.
 * Decorrenza (garanzia_da) entro soglia o già passata (arretrate).
 * Le appendici NON compaiono nel tab Quietanze (restano sotto la polizza madre).
 */
export function isQuietanzaDaMostrare(t: QuietanzaViewTitolo): boolean {
  if (!isTitoloNonIncassato(t)) return false;
  if (isAppendice(t)) return false;
  if (!t.sostituisce_polizza) return false;
  if (!t.garanzia_da) return true;
  const limite = new Date();
  limite.setHours(23, 59, 59, 999);
  limite.setDate(limite.getDate() + QUIETANZA_SCADENZA_SOGLIA_GIORNI);
  const decorrenza = new Date(t.garanzia_da);
  if (Number.isNaN(decorrenza.getTime())) return true;
  return decorrenza <= limite;
}

/** Conteggio tab Quietanze: solo rate, esclude appendici. */
export function countQuietanzeDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return countQuietanzeRateDaIncassare(polizze);
}

/** Solo rate quietanza (esclude appendici) — per conteggi tab. */
export function countQuietanzeRateDaIncassare(polizze: QuietanzaViewTitolo[]): number {
  return polizze.filter(
    (p) => !!p.sostituisce_polizza && !isAppendice(p) && isQuietanzaDaMostrare(p),
  ).length;
}
