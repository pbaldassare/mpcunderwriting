// Helper di presentazione condivisi per le tabelle del portafoglio (Attive/Carico/Storico).
// Regola di dominio (UI-only): SOLO quietanze e regolazioni possono mostrare lo stato "incassato".
// Una polizza madre (titolo non sostitutivo, non di regolazione) non deve mai apparire come "incassata":
// quel concetto appartiene alle sue rate, non al contenitore.

export type PolizzaRow = {
  stato?: string | null;
  sostituisce_polizza?: string | null;
  is_regolazione?: boolean | null;
  is_proroga?: boolean | null;
  data_messa_cassa?: string | null;
};

/** True se il titolo è stato messo a cassa (data valorizzata). */
export function isMessaACassa(p: Pick<PolizzaRow, "data_messa_cassa">): boolean {
  return !!p?.data_messa_cassa;
}

/** Sfondo canarino: solo titoli messi a cassa. */
export function messaCassaRowBgClass(p: PolizzaRow): string {
  if (!isMessaACassa(p)) return "";
  return "bg-quietanza-soft/40 hover:bg-quietanza-soft/80 hover:ring-1 hover:ring-inset hover:ring-quietanza/40";
}

/**
 * Stato da visualizzare in tabella. Per le polizze madre mascheriamo "incassato" → "attivo".
 * Per quietanze, regolazioni e proroghe restituisce lo stato originale.
 */
export function displayStatoPolizza(p: PolizzaRow): string {
  const stato = p?.stato || "";
  const isMadre = !p?.sostituisce_polizza && !p?.is_regolazione && !p?.is_proroga;
  if (isMadre && stato === "incassato") return "attivo";
  return stato;
}

/** True se la riga è una quietanza (rata sostitutiva). */
export function isQuietanzaRow(p: PolizzaRow): boolean {
  return !!p?.sostituisce_polizza && !p?.is_regolazione && !p?.is_proroga;
}

/** True se la riga è una polizza madre (non quietanza, non regolazione/proroga). */
export function isPolizzaMadreRow(p: PolizzaRow): boolean {
  return !p?.sostituisce_polizza && !p?.is_regolazione && !p?.is_proroga;
}

/**
 * Classe del bordo sinistro colorato per raggruppare visivamente le righe in scroll.
 * Teal per polizze, ambra per quietanze, arancio per regolazioni, blu per proroghe.
 */
export function rowBorderClass(p: PolizzaRow): string {
  if (p?.is_proroga) return "border-l-4 border-l-blue-500";
  if (p?.is_regolazione) return "border-l-4 border-l-orange-500";
  if (p?.sostituisce_polizza) {
    return isMessaACassa(p) ? "border-l-4 border-l-quietanza" : "";
  }
  return "border-l-4 border-l-polizza";
}
