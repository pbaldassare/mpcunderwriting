import { supabase } from "@/integrations/supabase/client";

export type AnnullaResult = {
  ok: boolean;
  error?: string;
  provvigioniEliminate?: number;
  pagamentiRigheEliminate?: number;
  rimessaDettagliEliminati?: number;
  rimesseTestateEliminate?: number;
  movimentiEliminati?: number;
  anticipiEliminati?: number;
  compensazioniEliminate?: number;
  rataSuccessivaEliminata?: boolean;
  quietanzeAggiornate?: number;
  bonificiRiaperti?: number;
};

/**
 * Annulla incasso / messa a cassa di una quietanza via RPC transazionale
 * `annulla_quietanza_incasso`. Non tocca la polizza madre.
 */
export async function annullaMessaACassa(titoloId: string): Promise<AnnullaResult> {
  const { data, error } = await (supabase as any).rpc("annulla_quietanza_incasso", {
    p_titolo_id: titoloId,
  });
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === false) return { ok: false, error: (r.error as string) || "Errore annullamento incasso" };
  return {
    ok: true,
    provvigioniEliminate: (r.provvigioni_eliminate as number) ?? 0,
    pagamentiRigheEliminate: (r.pagamenti_righe_eliminate as number) ?? 0,
    rimessaDettagliEliminati: (r.rimessa_dettagli_eliminati as number) ?? 0,
    rimesseTestateEliminate: (r.rimesse_testate_eliminate as number) ?? 0,
    movimentiEliminati: (r.movimenti_eliminati as number) ?? 0,
    anticipiEliminati: (r.anticipi_eliminati as number) ?? 0,
    compensazioniEliminate: (r.compensazioni_eliminate as number) ?? 0,
    rataSuccessivaEliminata: !!r.rata_successiva_eliminata,
    quietanzeAggiornate: (r.quietanze_aggiornate as number) ?? 0,
    bonificiRiaperti: (r.bonifici_riaperti as number) ?? 0,
  };
}
