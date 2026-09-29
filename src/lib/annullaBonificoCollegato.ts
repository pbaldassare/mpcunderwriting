import { supabase } from "@/integrations/supabase/client";

export type AnnullaBonificoResult = {
  ok: boolean;
  error?: string;
  titoloId?: string;
  statoNuovo?: string;
  clienteRimosso?: boolean;
  titoliAnnullati?: number;
  titoliSaltati?: number;
  movimentiClientiEliminati?: number;
  anticipiUtilizziEliminati?: number;
  ammancoEliminati?: number;
};

/** Annulla incasso titoli collegati e ripristina il bonifico in «Da collegare». */
export async function annullaBonificoCollegato(movimentoId: string): Promise<AnnullaBonificoResult> {
  const { data, error } = await (supabase as any).rpc("annulla_bonifico_collegato", {
    p_movimento_id: movimentoId,
  });
  if (error) return { ok: false, error: error.message };
  const r = (data ?? {}) as Record<string, unknown>;
  if (r.ok === false) {
    return {
      ok: false,
      error: (r.error as string) || "Errore annullamento bonifico",
      titoloId: r.titolo_id as string | undefined,
    };
  }
  return {
    ok: true,
    statoNuovo: r.stato_nuovo as string | undefined,
    clienteRimosso: (r.cliente_rimosso as boolean) ?? false,
    titoliAnnullati: (r.titoli_annullati as number) ?? 0,
    titoliSaltati: (r.titoli_saltati as number) ?? 0,
    movimentiClientiEliminati: (r.movimenti_clienti_eliminati as number) ?? 0,
    anticipiUtilizziEliminati: (r.anticipi_utilizzi_eliminati as number) ?? 0,
    ammancoEliminati: (r.ammanco_eliminati as number) ?? 0,
  };
}
