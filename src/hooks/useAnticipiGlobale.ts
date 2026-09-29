import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchClientiSearch } from "@/hooks/useClienteSearch";

export interface AnticipoGlobaleRow {
  id: string;
  cliente_id: string;
  data_anticipo: string;
  conto_bancario_id: string | null;
  importo: number;
  importo_residuo: number;
  note: string | null;
  created_at: string;
  titolo_origine_id?: string | null;
  rimborsato_il?: string | null;
  rimborsato_note?: string | null;
  causale_id?: string;
  segno?: "+" | "-";
  cliente: {
    id: string;
    nome: string | null;
    cognome: string | null;
    ragione_sociale: string | null;
    tipo_cliente: string | null;
    ufficio_id: string | null;
  } | null;
  conto: { id: string; etichetta: string; iban: string } | null;
  causale?: { id: string; codice: string; descrizione: string } | null;
}

export type StatoFiltro = "tutti" | "disponibili" | "parziali" | "esauriti";

export interface AnticipiGlobaleFilters {
  clienteId?: string | null;
  ufficioId?: string | null;
  contoId?: string | null;
  stato?: StatoFiltro;
  dataDa?: string | null; // yyyy-mm-dd
  dataAl?: string | null;
  search?: string;
}

export function useAnticipiGlobale(filters: AnticipiGlobaleFilters) {
  return useQuery({
    queryKey: ["anticipi-globale", filters],
    queryFn: async () => {
      let q = (supabase.from("cliente_anticipi") as any)
        .select(
          `id, cliente_id, data_anticipo, conto_bancario_id, importo, importo_residuo, note, created_at,
           titolo_origine_id, rimborsato_il, rimborsato_note, causale_id, segno,
           cliente:clienti(id, nome, cognome, ragione_sociale, tipo_cliente, ufficio_id),
           conto:conti_bancari(id, etichetta, iban),
           causale:causali_contabili(id, codice, descrizione)`
        )
        .order("data_anticipo", { ascending: false });

      if (filters.clienteId) q = q.eq("cliente_id", filters.clienteId);
      if (filters.contoId) q = q.eq("conto_bancario_id", filters.contoId);
      if (filters.dataDa) q = q.gte("data_anticipo", filters.dataDa);
      if (filters.dataAl) q = q.lte("data_anticipo", filters.dataAl);
      if (filters.stato === "disponibili") q = q.eq("segno", "+").gt("importo_residuo", 0).is("rimborsato_il", null);
      if (filters.stato === "esauriti") q = q.eq("segno", "+").lte("importo_residuo", 0);

      const { data, error } = await q;
      if (error) throw error;
      let rows = (data || []) as AnticipoGlobaleRow[];

      // Filtri lato client (richiedono campi su tabelle correlate o calcoli)
      if (filters.ufficioId) {
        rows = rows.filter((r) => r.cliente?.ufficio_id === filters.ufficioId);
      }
      if (filters.stato === "parziali") {
        rows = rows.filter(
          (r) => !r.rimborsato_il && r.importo_residuo > 0 && r.importo_residuo < r.importo,
        );
      }
      if (filters.search && filters.search.trim()) {
        const s = filters.search.toLowerCase();
        rows = rows.filter((r) => {
          const c = r.cliente;
          const nome = c
            ? (c.ragione_sociale || `${c.cognome || ""} ${c.nome || ""}`.trim()).toLowerCase()
            : "";
          return nome.includes(s) || (r.note || "").toLowerCase().includes(s);
        });
      }
      return rows;
    },
  });
}

export function useClientiSearch(query: string) {
  return useQuery({
    queryKey: ["clienti-search-anticipi", query],
    queryFn: () => fetchClientiSearch(query, { onlyAttivi: true, limit: 30 }),
  });
}
