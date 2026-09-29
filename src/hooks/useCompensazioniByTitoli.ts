import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompensazioneSummary {
  count: number;
  totale: number; // somma algebrica con segno (positivo = riduce dovuto)
}

/**
 * Carica le compensazioni applicate ai titoli visibili.
 * Restituisce una Map<titolo_id, { count, totale }>.
 * Usato dai badge nelle liste portafoglio (Carico / Attive / Storico).
 */
export function useCompensazioniByTitoli(titoloIds: string[]) {
  const ids = (titoloIds || []).filter(Boolean);
  const key = ids.slice().sort().join(",");
  return useQuery({
    queryKey: ["compensazioni-by-titoli", key],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select("titolo_id, segno, importo")
        .in("titolo_id", ids);
      if (error) throw error;
      const map = new Map<string, CompensazioneSummary>();
      for (const r of (data || []) as Array<{ titolo_id: string; segno: "+" | "-"; importo: number }>) {
        const cur = map.get(r.titolo_id) || { count: 0, totale: 0 };
        const imp = Number(r.importo) || 0;
        cur.count += 1;
        cur.totale += (r.segno === "+" ? imp : -imp);
        map.set(r.titolo_id, cur);
      }
      return map;
    },
  });
}
