import { supabase } from "@/integrations/supabase/client";
import { logAttivita } from "@/lib/logAttivita";

/** Stati eliminabili senza annullare prima un incasso/ricongiungimento. */
export const STATI_MOVIMENTO_CANCELLABILI = ["importato", "matchato", "assegnato"] as const;

export type MovimentoBancarioSnapshot = {
  id: string;
  data_movimento?: string | null;
  importo?: number | null;
  ordinante?: string | null;
  descrizione?: string | null;
  stato?: string | null;
  cliente_id?: string | null;
  ufficio_id?: string | null;
  conto_bancario_id?: string | null;
  carico_id?: string | null;
};

export function isMovimentoCancellabile(stato: string | null | undefined): boolean {
  return STATI_MOVIMENTO_CANCELLABILI.includes(stato as (typeof STATI_MOVIMENTO_CANCELLABILI)[number]);
}

/**
 * Elimina movimenti bancari aperti (importato/matchato/assegnato).
 * Logga ogni cancellazione (batch + dettaglio) in log_attivita.
 */
export async function eliminaMovimentiBancari(
  movimenti: MovimentoBancarioSnapshot[],
  opts?: { motivo?: string },
): Promise<{ ok: number; skipped: number }> {
  const cancellabili = movimenti.filter((m) => isMovimentoCancellabile(m.stato));
  const skipped = movimenti.length - cancellabili.length;
  if (cancellabili.length === 0) {
    return { ok: 0, skipped };
  }

  const ids = cancellabili.map((m) => m.id);

  // Scollega eventuali anticipi che puntano a questi movimenti (FK senza CASCADE)
  await supabase
    .from("cliente_anticipi" as any)
    .update({ movimento_bancario_id: null } as any)
    .in("movimento_bancario_id", ids);

  const { error } = await supabase.from("movimenti_bancari" as any).delete().in("id", ids);
  if (error) throw error;

  await logAttivita({
    azione: "elimina_movimenti_bancari",
    entita_tipo: "movimento_bancario",
    // entita_id è uuid in DB: usa il primo id; il batch è nei dettagli
    entita_id: ids[0],
    severity: "warning",
    dettagli_json: {
      motivo: opts?.motivo || "cancellazione_manuale",
      count: ids.length,
      skipped_non_cancellabili: skipped,
      ids,
      snapshot: cancellabili.map((m) => ({
        id: m.id,
        data_movimento: m.data_movimento,
        importo: m.importo,
        ordinante: m.ordinante,
        descrizione: m.descrizione,
        stato: m.stato,
        cliente_id: m.cliente_id,
        ufficio_id: m.ufficio_id,
        conto_bancario_id: m.conto_bancario_id,
        carico_id: m.carico_id,
      })),
    },
  });

  return { ok: ids.length, skipped };
}
