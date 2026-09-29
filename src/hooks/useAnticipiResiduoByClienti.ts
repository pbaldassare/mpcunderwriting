import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AnticipoResiduoSummary {
  totale: number;
  conteggio: number;
  primoAnticipoId: string | null;
}

/**
 * Recupera, per un insieme di clienti, la somma dei residui anticipi (importo_residuo > 0)
 * e il numero di anticipi disponibili. Usato nelle pagine di portafoglio per mostrare
 * il badge "Anticipo" sulla riga del titolo.
 */
export function useAnticipiResiduoByClienti(clienteIds: string[]) {
  const ids = Array.from(new Set(clienteIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["anticipi-residuo-by-clienti", ids],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("cliente_anticipi") as any)
        .select("id, cliente_id, importo_residuo, data_anticipo")
        .in("cliente_id", ids)
        .eq("segno", "+")
        .gt("importo_residuo", 0)
        .is("rimborsato_il", null)
        .order("data_anticipo", { ascending: true });
      if (error) throw error;
      const map = new Map<string, AnticipoResiduoSummary>();
      for (const row of (data || []) as Array<{ id: string; cliente_id: string; importo_residuo: number }>) {
        const cur = map.get(row.cliente_id) || { totale: 0, conteggio: 0, primoAnticipoId: null };
        cur.totale += Number(row.importo_residuo) || 0;
        cur.conteggio += 1;
        if (!cur.primoAnticipoId) cur.primoAnticipoId = row.id;
        map.set(row.cliente_id, cur);
      }
      return map;
    },
  });
}
