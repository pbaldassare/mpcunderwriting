import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProduttoreOption = { value: string; label: string };

/**
 * Lookup canonico dei Produttori per i filtri.
 * Fonte: `anagrafiche_professionali` (tipo='corrispondente', attivo=true).
 * Il `value` è `anagrafiche_professionali.id` → usare per filtrare
 * `titoli.anagrafica_commerciale_id`.
 */
export const useProduttoriLookup = () => {
  return useQuery({
    queryKey: ["lookup-produttori-anagrafiche"],
    queryFn: async (): Promise<ProduttoreOption[]> => {
      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select("id, nome, cognome, ragione_sociale")
        .eq("tipo", "corrispondente")
        .eq("attivo", true);
      if (error) throw error;
      const opts = (data || []).map((p: any) => {
        const personName = `${p.cognome || ""} ${p.nome || ""}`.trim();
        const label =
          personName ||
          (p.ragione_sociale && p.ragione_sociale.trim()) ||
          "—";
        return { value: p.id as string, label };
      });
      opts.sort((a, b) => a.label.localeCompare(b.label, "it"));
      return opts;
    },
    staleTime: 300000 * 60 * 1000,
  });
};
