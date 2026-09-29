import { supabase } from "@/integrations/supabase/client";

export type AnnullaPolizzaResult = {
  ok: boolean;
  error?: string;
  quietanzeEliminate?: number;
  provvigioniEliminate?: number;
  pagamentiRigheEliminate?: number;
  rimessaDettagliEliminati?: number;
  rimesseTestateEliminate?: number;
  movimentiEliminati?: number;
  movimentiPolizzaEliminati?: number;
  movimentiPolizzeEliminati?: number;
  splitsEliminati?: number;
  includevaProvvigioniPagate?: boolean;
};

/**
 * Annulla una polizza/quietanza in modo transazionale via RPC `annulla_polizza_cascade`.
 * Elimina in cascade: pagamenti_provvigioni_righe, provvigioni_generate, rimessa_dettaglio,
 * testate rimessa_premi rimaste vuote, movimenti_contabili, movimenti_polizza, movimenti_polizze,
 * titoli_split_commerciali e quietanze discendenti.
 * Lascia il titolo target in stato `annullato` come ancoraggio per il log.
 */
export async function annullaPolizza(titoloId: string): Promise<AnnullaPolizzaResult> {
  const { data, error } = await (supabase as any).rpc("annulla_polizza_cascade", {
    p_titolo_id: titoloId,
  });
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as any;
  if (r.ok === false) return { ok: false, error: r.error || "Errore annullamento" };
  return {
    ok: true,
    quietanzeEliminate: r.quietanze_eliminate ?? 0,
    provvigioniEliminate: r.provvigioni_eliminate ?? 0,
    pagamentiRigheEliminate: r.pagamenti_righe_eliminate ?? 0,
    rimessaDettagliEliminati: r.rimessa_dettagli_eliminati ?? 0,
    rimesseTestateEliminate: r.rimesse_testate_eliminate ?? 0,
    movimentiEliminati: r.movimenti_eliminati ?? 0,
    movimentiPolizzaEliminati: r.movimenti_polizza_eliminati ?? 0,
    movimentiPolizzeEliminati: r.movimenti_polizze_eliminati ?? 0,
    splitsEliminati: r.splits_eliminati ?? 0,
    includevaProvvigioniPagate: !!r.includeva_provvigioni_pagate,
  };
}
