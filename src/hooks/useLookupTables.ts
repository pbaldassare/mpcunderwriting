import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface LookupOption {
  value: string;
  label: string;
}

function useLookup(table: string, orderField = "descrizione") {
  return useQuery<LookupOption[]>({
    queryKey: ["lookup", table],
    queryFn: async () => {
      const { data } = await supabase
        .from(table as any)
        .select("codice, descrizione")
        .eq("attivo", true)
        .order(orderField);
      return (data || []).map((r: any) => ({
        value: r.codice,
        label: r.descrizione,
      }));
    },
    staleTime: 300000 * 60 * 30, // 30 min cache
  });
}

function useLookupOrdered(table: string) {
  return useQuery<LookupOption[]>({
    queryKey: ["lookup", table],
    queryFn: async () => {
      const { data } = await supabase
        .from(table as any)
        .select("codice, descrizione, ordine")
        .eq("attivo", true)
        .order("ordine");
      return (data || []).map((r: any) => ({
        value: r.codice,
        label: r.descrizione,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });
}

export function useLookupZone() { return useLookupOrdered("lookup_zone"); }
export function useLookupIndotti() { return useLookup("lookup_indotti"); }
export function useLookupAttivita() { return useLookup("lookup_attivita"); }
export function useLookupSettori() { return useLookup("lookup_settori"); }
export function useLookupContratti() { return useLookup("lookup_contratti"); }
export function useLookupFasceFatturato() { return useLookupOrdered("lookup_fasce_fatturato"); }
export function useLookupFasceDipendenti() { return useLookupOrdered("lookup_fasce_dipendenti"); }
export function useLookupTipologiaVeicolo() { return useLookup("lookup_tipologia_veicolo"); }

export function useTitoliNidificazione() {
  return useQuery({
    queryKey: ["lookup", "lookup_titoli_nidificazione"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lookup_titoli_nidificazione" as never)
        .select("codice, descrizione, preposizione, categoria, attivo")
        .eq("attivo", true)
        .order("categoria")
        .order("descrizione");
      if (error) throw error;
      return (data || []) as {
        codice: string;
        descrizione: string;
        preposizione: string;
        categoria: "incarico" | "familiare" | "societario";
        attivo: boolean;
      }[];
    },
    staleTime: 300000 * 60 * 30,
  });
}

export function useGruppiStatistici() {
  return useQuery<LookupOption[]>({
    queryKey: ["lookup", "gruppi_statistici"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gruppi_statistici" as any)
        .select("codice, descrizione")
        .eq("attivo", true)
        .order("descrizione");
      return (data || []).map((r: any) => ({
        value: r.codice,
        label: r.descrizione,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });
}
