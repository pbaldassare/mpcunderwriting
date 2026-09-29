/**
 * Rileva se un titolo madre è una polizza auto (RCA / veicoli).
 * Segnali: gruppo ramo / descrizione con RCA|AUTO, oppure record veicoli_polizza.
 */

export type TitoloAutoLike = {
  targa_telaio?: string | null;
  ramo?: {
    descrizione?: string | null;
    gruppo_ramo?: { descrizione?: string | null } | null;
  } | null;
};

function matchRcaText(s: string): boolean {
  const u = s.toUpperCase();
  if (u.includes("R.C.A") || u.includes("RCA")) return true;
  if (/\bAUTO\b/.test(u) || u.includes("AUTOVEIC") || u.includes("VEICOL")) return true;
  return false;
}

export function isPolizzaAuto(
  titolo: TitoloAutoLike | null | undefined,
  hasVeicoloRecord = false,
): boolean {
  if (!titolo) return hasVeicoloRecord;
  const gruppo = String(titolo.ramo?.gruppo_ramo?.descrizione || "");
  const desc = String(titolo.ramo?.descrizione || "");
  if (matchRcaText(gruppo) || matchRcaText(desc)) return true;
  return hasVeicoloRecord;
}
