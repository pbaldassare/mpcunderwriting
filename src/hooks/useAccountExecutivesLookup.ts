import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AccountExecutiveOption = {
  value: string;
  label: string;
  description?: string;
  searchText?: string;
};

export type AccountExecutivesLookupResult = {
  options: AccountExecutiveOption[];
  /** @deprecated AE non sono più filtrati per Sede: il flag resta sempre `false`. */
  isFallback: boolean;
};

/**
 * Lookup canonico degli Account Executive per le tendine di Immissione/Polizze.
 * Fonte: `anagrafiche_professionali` (tipo='account_executive', attivo=true).
 * Restituisce SEMPRE tutti gli AE attivi: gli AE sono indipendenti dalla Sede.
 * Il parametro `_ufficioId` è ignorato (mantenuto per compatibilità di firma).
 * Include `ragione_sociale`/`sigla`/`codice` nel searchText per consentire ricerca
 * per Sede (es. "Campobasso") anche quando il nome AE non la contiene.
 */
export const useAccountExecutivesLookup = (_ufficioId?: string | null) => {
  return useQuery({
    queryKey: ["lookup-ae-anagrafiche", "all"],
    queryFn: async (): Promise<AccountExecutivesLookupResult> => {
      const SELECT = "id, nome, cognome, ragione_sociale, sigla, codice";

      const { data, error } = await supabase
        .from("anagrafiche_professionali")
        .select(SELECT)
        .eq("tipo", "account_executive")
        .eq("attivo", true);
      if (error) throw error;

      const opts: AccountExecutiveOption[] = (data || []).map((p: any) => {
        const personName = `${p.cognome || ""} ${p.nome || ""}`.trim();
        const rs = (p.ragione_sociale || "").trim();
        const label = personName || rs || p.sigla || p.codice || "—";
        const description = personName && rs ? rs : undefined;
        const searchText = [rs, p.sigla, p.codice].filter(Boolean).join(" ");
        return { value: p.id as string, label, description, searchText };
      });
      opts.sort((a, b) => a.label.localeCompare(b.label, "it"));

      return { options: opts, isFallback: false };
    },
    staleTime: 300000 * 60 * 1000,
  });
};
