import { format } from "date-fns";

/** Criteri E/C Cliente: quietanze da incassare già decorsi (non madre, non messa a cassa). */
export function ecClienteTitoloEligible(
  t: {
    sostituisce_polizza?: string | null;
    data_messa_cassa?: string | null;
    garanzia_da?: string | null;
    stato?: string | null;
  },
  today = format(new Date(), "yyyy-MM-dd"),
): boolean {
  if (!t.sostituisce_polizza) return false;
  if (t.data_messa_cassa) return false;
  if (!t.garanzia_da || t.garanzia_da > today) return false;
  const stato = t.stato || "";
  return stato === "attivo" || stato === "sospeso";
}

export function ecClienteDefaultSelected(
  t: Parameters<typeof ecClienteTitoloEligible>[0],
  today?: string,
): boolean {
  return ecClienteTitoloEligible(t, today);
}
