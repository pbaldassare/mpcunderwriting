import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRcaUsi() {
  return useQuery({
    queryKey: ["rca-usi"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rca_usi" as any)
        .select("id, codice, descrizione")
        .eq("attivo", true)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.id as string,
        label: `${r.codice} - ${r.descrizione}`,
        codice: r.codice as string,
        descrizione: r.descrizione as string,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });
}
