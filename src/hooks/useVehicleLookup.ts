import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VehicleOption {
  value: string;
  label: string;
}

export function useVehicleMakes() {
  return useQuery<VehicleOption[]>({
    queryKey: ["veicoli-marche"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("veicoli_marche")
        .select("nome, popolare")
        .eq("attivo", true)
        .order("popolare", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({ value: m.nome, label: m.nome }));
    },
    staleTime: 300000 * 60 * 30,
  });
}

export function useVehicleModels(marcaNome: string) {
  return useQuery<VehicleOption[]>({
    queryKey: ["veicoli-modelli", marcaNome],
    queryFn: async () => {
      if (!marcaNome) return [];
      const { data: marca } = await supabase
        .from("veicoli_marche")
        .select("id")
        .eq("nome", marcaNome.toUpperCase())
        .maybeSingle();
      if (!marca) return [];
      const { data, error } = await supabase
        .from("veicoli_modelli")
        .select("nome, popolare")
        .eq("marca_id", (marca as any).id)
        .eq("attivo", true)
        .order("popolare", { ascending: false })
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []).map((m: any) => ({ value: m.nome, label: m.nome }));
    },
    enabled: !!marcaNome,
    staleTime: 300000 * 60 * 30,
  });
}

export function useAddMarca() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nome: string) => {
      const upper = nome.toUpperCase().trim();
      const { data, error } = await supabase
        .from("veicoli_marche")
        .insert({ nome: upper })
        .select("nome")
        .single();
      if (error) throw error;
      return (data as any).nome as string;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["veicoli-marche"] }),
  });
}

export function useAddModello() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ marcaNome, nome }: { marcaNome: string; nome: string }) => {
      const upperMarca = marcaNome.toUpperCase().trim();
      const upperModello = nome.toUpperCase().trim();
      // get or create marca
      let { data: marca } = await supabase
        .from("veicoli_marche")
        .select("id")
        .eq("nome", upperMarca)
        .maybeSingle();
      if (!marca) {
        const { data: nuova, error: errMarca } = await supabase
          .from("veicoli_marche")
          .insert({ nome: upperMarca })
          .select("id")
          .single();
        if (errMarca) throw errMarca;
        marca = nuova as any;
      }
      const { data, error } = await supabase
        .from("veicoli_modelli")
        .insert({ marca_id: (marca as any).id, nome: upperModello })
        .select("nome")
        .single();
      if (error) throw error;
      return (data as any).nome as string;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["veicoli-modelli", vars.marcaNome] });
      qc.invalidateQueries({ queryKey: ["veicoli-marche"] });
    },
  });
}
