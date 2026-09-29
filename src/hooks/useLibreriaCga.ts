import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CgaRow {
  id: string;
  nome_prodotto: string;
  compagnia: string | null;
  ramo: string | null;
  edizione: string | null;
  sommario_ai: string | null;
  created_at: string;
  versioni_count: number;
}

export function useLibreriaCga() {
  return useQuery({
    queryKey: ["libreria-cga-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prodotti_cga")
        .select("id, nome_prodotto, compagnia, ramo, edizione, sommario_ai, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Group by (compagnia, nome_prodotto, ramo) keeping latest
      const groups = new Map<string, CgaRow>();
      for (const r of data || []) {
        const key = `${r.compagnia ?? ""}|${r.nome_prodotto ?? ""}|${r.ramo ?? ""}`.toLowerCase();
        const existing = groups.get(key);
        if (!existing) {
          groups.set(key, { ...r, versioni_count: 1 });
        } else {
          existing.versioni_count += 1;
        }
      }
      return Array.from(groups.values());
    },
  });
}

export interface CgaGaranzia {
  id: string;
  garanzia: string;
  massimale_standard: number | null;
  franchigia_standard: number | null;
  scoperto_percentuale: number | null;
  note: string | null;
}

export interface CgaCondizione {
  id: string;
  tipo: string;
  titolo: string | null;
  testo: string;
  rilevante_sinistri: boolean | null;
}

export interface CgaDettaglio {
  cga: {
    id: string;
    nome_prodotto: string;
    compagnia: string | null;
    ramo: string | null;
    edizione: string | null;
    sommario_ai: string | null;
    testo_completo: string | null;
    created_at: string;
  };
  garanzie: CgaGaranzia[];
  condizioni: CgaCondizione[];
  versioni: { id: string; created_at: string; edizione: string | null }[];
}

export function useCgaDettaglio(cgaId: string | null) {
  return useQuery({
    queryKey: ["libreria-cga-detail", cgaId],
    enabled: !!cgaId,
    queryFn: async (): Promise<CgaDettaglio | null> => {
      if (!cgaId) return null;
      const { data: cga, error: e1 } = await supabase
        .from("prodotti_cga")
        .select("id, nome_prodotto, compagnia, ramo, edizione, sommario_ai, testo_completo, created_at")
        .eq("id", cgaId)
        .maybeSingle();
      if (e1) throw e1;
      if (!cga) return null;

      const [{ data: garanzie }, { data: condizioni }, { data: vers }] = await Promise.all([
        supabase
          .from("prodotti_garanzie")
          .select("id, garanzia, massimale_standard, franchigia_standard, scoperto_percentuale, note")
          .eq("prodotto_id", cgaId)
          .order("garanzia"),
        supabase
          .from("prodotti_condizioni")
          .select("id, tipo, titolo, testo, rilevante_sinistri")
          .eq("prodotto_id", cgaId)
          .order("tipo"),
        supabase
          .from("prodotti_cga")
          .select("id, created_at, edizione")
          .eq("compagnia", cga.compagnia ?? "")
          .eq("nome_prodotto", cga.nome_prodotto)
          .order("created_at", { ascending: false }),
      ]);

      return {
        cga,
        garanzie: (garanzie as CgaGaranzia[]) || [],
        condizioni: (condizioni as CgaCondizione[]) || [],
        versioni: (vers as any[]) || [],
      };
    },
  });
}
