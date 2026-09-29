import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PolizzaCgaRow = {
  id: string;
  stato: string;
  created_at: string;
  titolo_id: string | null;
  prodotto: {
    id: string;
    nome_prodotto: string;
    compagnia: string | null;
    ramo: string | null;
    edizione: string | null;
  } | null;
};

export function usePolizzeCgaByCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["polizze-cga", clienteId],
    enabled: !!clienteId,
    queryFn: async (): Promise<PolizzaCgaRow[]> => {
      const { data, error } = await supabase
        .from("polizza_cga")
        .select("id, stato, created_at, titolo_id, prodotto:prodotto_id(id, nome_prodotto, compagnia, ramo, edizione)")
        .eq("cliente_id", clienteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any) ?? [];
    },
  });
}
