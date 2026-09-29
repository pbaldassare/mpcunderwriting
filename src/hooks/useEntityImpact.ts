import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ImpactCheck {
  /** Tabella DB su cui contare */
  table: string;
  /** Colonna FK che punta all'entità */
  column: string;
  /** Etichetta UI (es: "Polizze", "Clienti") */
  label: string;
  /** Se true, blocca l'eliminazione quando count > 0. Default true. */
  blocking?: boolean;
}

export interface ImpactResult {
  label: string;
  count: number;
  blocking: boolean;
}

/**
 * Conta in parallelo tutti i record che referenziano l'entità target via FK.
 * Usato dal dialog di conferma eliminazione per mostrare l'impatto.
 */
export const useEntityImpact = (
  entityId: string | null | undefined,
  checks: ImpactCheck[],
  enabled = true,
) => {
  return useQuery<{ items: ImpactResult[]; totalBlocking: number; total: number }>({
    queryKey: ["entity-impact", entityId, checks.map((c) => `${c.table}.${c.column}`).join("|")],
    enabled: !!entityId && enabled,
    queryFn: async () => {
      const results = await Promise.all(
        checks.map(async (chk) => {
          const { count, error } = await supabase
            .from(chk.table as never)
            .select("id", { count: "exact", head: true })
            .eq(chk.column as never, entityId as never);
          if (error) {
            // Se la colonna non esiste o accesso negato → 0 (non bloccare l'utente per check fallito)
            return { label: chk.label, count: 0, blocking: chk.blocking ?? true };
          }
          return { label: chk.label, count: count ?? 0, blocking: chk.blocking ?? true };
        }),
      );
      const totalBlocking = results
        .filter((r) => r.blocking)
        .reduce((sum, r) => sum + r.count, 0);
      const total = results.reduce((sum, r) => sum + r.count, 0);
      return { items: results, totalBlocking, total };
    },
    staleTime: 300000,
  });
};
