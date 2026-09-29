import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ProvvigioneProduttoreLookup } from "@/lib/provvigioneProduttore";

export function useProvvigioniProduttoreLookup(titoloIds: string[]) {
  const ids = [...new Set(titoloIds.filter(Boolean))].sort();
  return useQuery({
    queryKey: ["provvigioni-produttore-lookup", ids.join(",")],
    enabled: ids.length > 0,
    staleTime: 15_000,
    queryFn: async (): Promise<ProvvigioneProduttoreLookup> => {
      const [{ data: splits }, { data: titoli }] = await Promise.all([
        supabase.from("titoli_split_commerciali").select("titolo_id, percentuale").in("titolo_id", ids),
        supabase.from("titoli").select("id, percentuale_commerciale").in("id", ids),
      ]);
      const splitsByTitolo = new Map<string, number[]>();
      for (const s of splits || []) {
        const arr = splitsByTitolo.get(s.titolo_id) || [];
        arr.push(Number(s.percentuale) || 0);
        splitsByTitolo.set(s.titolo_id, arr);
      }
      const percByTitolo = new Map<string, number | null>(
        (titoli || []).map((t) => [t.id, t.percentuale_commerciale ?? null]),
      );
      return { splitsByTitolo, percByTitolo };
    },
  });
}
