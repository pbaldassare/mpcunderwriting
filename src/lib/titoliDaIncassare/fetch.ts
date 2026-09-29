import { format, endOfMonth, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";
import { mapTitoloDaIncassareRow, type TitoloDaIncassareRaw } from "./mapRow";
import type { TitoloDaIncassareRow } from "./columns";

export interface FetchTitoliDaIncassareFilters {
  mese: Date;
  ufficioId?: string | null;
  produttoreId?: string | null;
  compagniaId?: string | null;
  search?: string;
}

const VIEW_SELECT =
  "id, numero_titolo, appendice_corrente, descrizione_polizza, cig_rif, data_competenza, durata_da, durata_a, garanzia_da, garanzia_a, data_scadenza, premio_lordo, provvigioni_quietanza, produttore_nome, produttori_display, data_copertura, data_incasso, data_messa_cassa, conferimento_gestito, fondi_ricevuti, tipo_pagamento, tipo_portafoglio, tacito_rinnovo, rate, numero_rata, numero_rate_totali, cliente_nome_display, ae_nome, specialist, compagnia_nome, compagnia_id, ramo_nome, ufficio_id, produttore_id, targa_telaio, sostituisce_polizza, stato";

/** Titoli attivi non incassati con competenza nel mese selezionato. */
export async function fetchTitoliDaIncassare(
  filters: FetchTitoliDaIncassareFilters,
): Promise<TitoloDaIncassareRow[]> {
  const dal = format(startOfMonth(filters.mese), "yyyy-MM-dd");
  const al = format(endOfMonth(filters.mese), "yyyy-MM-dd");

  let q = supabase
    .from("v_portafoglio_quietanze")
    .select(VIEW_SELECT)
    .eq("stato", "attivo")
    .or(PENDENTI_OR_GARANTITO_APERTO_FILTER)
    .gte("data_competenza", dal)
    .lte("data_competenza", al);

  if (filters.ufficioId) q = q.eq("ufficio_id", filters.ufficioId);
  if (filters.produttoreId) q = q.eq("produttore_id", filters.produttoreId);
  if (filters.compagniaId) q = q.eq("compagnia_id", filters.compagniaId);
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    q = q.or(`numero_titolo.ilike.%${s}%,cliente_nome_display.ilike.%${s}%,compagnia_nome.ilike.%${s}%`);
  }

  const { data, error } = await q.order("data_competenza", { ascending: true }).limit(5000);
  if (error) throw error;

  const rowsRaw = (data || []) as unknown as Record<string, any>[];
  const ids = rowsRaw.map((r) => r.id).filter(Boolean) as string[];
  const enrich = await enrichTitoli(ids);

  return rowsRaw.map((row) => {
    const extra = enrich.get(row.id!) || {};
    return mapTitoloDaIncassareRow({ ...row, ...extra } as TitoloDaIncassareRaw);
  });
}

async function enrichTitoli(ids: string[]): Promise<Map<string, Partial<TitoloDaIncassareRaw>>> {
  const map = new Map<string, Partial<TitoloDaIncassareRaw>>();
  if (!ids.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));

  for (const chunk of chunks) {
    const { data: titoli } = await supabase
      .from("titoli")
      .select(`
        id, valuta, cambio, filiale, limite_mora, disdetta_giorni, appendice,
        clienti!titoli_cliente_anagrafica_id_fkey(indotto, gruppi_finanziari(nome)),
        compagnie(gruppi_compagnia(descrizione)),
        uffici(nome_ufficio)
      `)
      .in("id", chunk);

    for (const t of titoli || []) {
      const cli = t.clienti as any;
      const comp = t.compagnie as any;
      const uff = t.uffici as any;
      map.set(t.id, {
        valuta: t.valuta,
        cambio: t.cambio,
        filiale: t.filiale,
        limite_mora: t.limite_mora,
        disdetta_giorni: t.disdetta_giorni,
        appendice: t.appendice,
        indotto: cli?.indotto,
        gruppo_finanziario_nome: cli?.gruppi_finanziari?.nome,
        gruppo_compagnia_nome: comp?.gruppi_compagnia?.descrizione,
        ufficio_nome: uff?.nome_ufficio,
      });
    }
  }
  return map;
}

export function meseCompetenzaLabel(mese: Date): string {
  return format(mese, "MMMM yyyy", { locale: it });
}
