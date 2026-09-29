import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface GruppoRamoOption {
  value: string;
  label: string;
  codice: string;
  descrizione: string;
}

export interface RamoOption {
  value: string;
  label: string;
  codice: string;
  descrizione: string;
  gruppo_ramo_id: string | null;
  escludi_provvigioni: boolean;
}

export function useGruppiRamo() {
  return useQuery({
    queryKey: ["lookup-gruppi-ramo"],
    queryFn: async (): Promise<GruppoRamoOption[]> => {
      const { data } = await supabase
        .from("gruppi_ramo")
        .select("id, codice, descrizione")
        .order("codice");
      return (data || []).map((g: any) => ({
        value: g.id,
        label: `${g.codice} - ${g.descrizione}`,
        codice: g.codice,
        descrizione: g.descrizione,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });
}

export function useRamiAll() {
  return useQuery({
    queryKey: ["lookup-rami-all"],
    queryFn: async (): Promise<RamoOption[]> => {
      const { data } = await supabase
        .from("rami")
        .select("id, codice, descrizione, gruppo_ramo_id, attivo, escludi_provvigioni")
        .eq("attivo", true)
        .order("codice");
      return (data || []).map((r: any) => ({
        value: r.id,
        label: `${r.codice} - ${r.descrizione}`,
        codice: r.codice,
        descrizione: r.descrizione,
        gruppo_ramo_id: r.gruppo_ramo_id || null,
        escludi_provvigioni: !!r.escludi_provvigioni,
      }));
    },
    staleTime: 300000 * 60 * 30,
  });
}

/** Returns rami filtered by the given gruppo (or all when null/undefined). */
export function useRami(gruppoRamoId?: string | null) {
  const { data: all = [], isLoading } = useRamiAll();
  const filtered = useMemo(
    () => (gruppoRamoId ? all.filter((r) => r.gruppo_ramo_id === gruppoRamoId) : all),
    [all, gruppoRamoId],
  );
  return { data: filtered, isLoading, all };
}
