import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CAUSALI_COMP_MESSA_CASSA_UI } from "@/lib/compensazioniMessaCassa";

export interface AbbuonoClienteRow {
  id: string;
  titolo_id: string;
  causale_codice: string;
  causale_descrizione: string;
  segno: "+" | "-";
  importo: number;
  note: string | null;
  created_at: string;
  numero_titolo: string | null;
}

/**
 * Abbuoni e arrotondamenti applicati sulle quietanze del cliente
 * (persistiti in titoli_compensazioni alla messa a cassa).
 */
export function useAbbuoniCliente(clienteId: string | undefined) {
  return useQuery({
    queryKey: ["cliente-abbuoni", clienteId],
    enabled: !!clienteId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("titoli_compensazioni") as any)
        .select(
          "id, titolo_id, causale_codice, causale_descrizione, segno, importo, note, created_at, titoli!inner(id, numero_titolo, cliente_anagrafica_id)",
        )
        .eq("titoli.cliente_anagrafica_id", clienteId)
        .in("causale_codice", [...CAUSALI_COMP_MESSA_CASSA_UI])
        .order("created_at", { ascending: false });
      if (error) throw error;

      return ((data || []) as Array<Record<string, unknown>>).map((r) => {
        const titolo = r.titoli as { numero_titolo?: string | null } | null;
        return {
          id: String(r.id),
          titolo_id: String(r.titolo_id),
          causale_codice: String(r.causale_codice || ""),
          causale_descrizione: String(r.causale_descrizione || ""),
          segno: (r.segno === "-" ? "-" : "+") as "+" | "-",
          importo: Number(r.importo) || 0,
          note: (r.note as string | null) ?? null,
          created_at: String(r.created_at || ""),
          numero_titolo: titolo?.numero_titolo ?? null,
        } satisfies AbbuonoClienteRow;
      });
    },
  });
}
