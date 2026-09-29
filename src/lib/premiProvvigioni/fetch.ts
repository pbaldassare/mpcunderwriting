import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { mapPremiProvvigioniRow, type PremiProvvigioniRaw } from "./mapRow";
import type { PremiProvvigioniRow } from "./columns";
import { periodoLabel } from "@/lib/estrazioni/utils";
import {
  resolvePremiProvvigioniDateColumn,
  type PremiProvvigioniCriterioData,
} from "./criterioData";

export { periodoLabel };

export interface FetchPremiProvvigioniFilters {
  dateFrom?: Date | null;
  dateTo?: Date | null;
  ufficioId?: string | null;
  produttoreId?: string | null;
  compagniaId?: string | null;
  pagata?: "tutte" | "pagate" | "non_pagate";
  search?: string;
  criterioData?: PremiProvvigioniCriterioData;
}

const VIEW_SELECT =
  "id, numero_titolo, appendice_corrente, descrizione_polizza, data_competenza, durata_da, durata_a, garanzia_da, garanzia_a, premio_lordo, premio_netto, tasse, provvigioni_quietanza, provvigioni_firma, produttore_nome, produttori_display, data_copertura, data_incasso, data_messa_cassa, importo_incassato, tipo_portafoglio, cliente_nome_display, ae_nome, specialist, compagnia_nome, compagnia_id, ramo_nome, ufficio_id, produttore_id, targa_telaio";

/** Titoli incassati nel periodo (per criterio data scelto) con dati provvigioni. */
export async function fetchPremiProvvigioni(
  filters: FetchPremiProvvigioniFilters,
): Promise<PremiProvvigioniRow[]> {
  const criterio = filters.criterioData ?? "cassa";
  const dateColumn = resolvePremiProvvigioniDateColumn(criterio) as
    | "data_messa_cassa"
    | "data_competenza"
    | "durata_da"
    | "garanzia_a";

  let q = supabase
    .from("v_portafoglio_quietanze")
    .select(VIEW_SELECT)
    .not("data_messa_cassa", "is", null);

  if (filters.dateFrom) {
    q = q.gte(dateColumn, format(filters.dateFrom, "yyyy-MM-dd"));
  }
  if (filters.dateTo) {
    q = q.lte(dateColumn, format(filters.dateTo, "yyyy-MM-dd"));
  }
  if (filters.ufficioId) q = q.eq("ufficio_id", filters.ufficioId);
  if (filters.produttoreId) q = q.eq("produttore_id", filters.produttoreId);
  if (filters.compagniaId) q = q.eq("compagnia_id", filters.compagniaId);
  if (filters.search?.trim()) {
    const s = filters.search.trim();
    q = q.or(`numero_titolo.ilike.%${s}%,cliente_nome_display.ilike.%${s}%,compagnia_nome.ilike.%${s}%`);
  }

  const { data, error } = await q.order(dateColumn, { ascending: false }).limit(5000);
  if (error) throw error;

  const ids = (data || []).map((r) => r.id).filter(Boolean) as string[];
  const enrich = await enrichTitoli(ids);
  const provvMap = await loadProvvigioni(ids);

  let rows = (data || []).map((row) => {
    const extra = enrich.get(row.id!) || {};
    const provv = provvMap.get(row.id!) || {};
    return mapPremiProvvigioniRow({ ...row, ...extra, ...provv } as PremiProvvigioniRaw);
  });

  if (filters.pagata === "pagate") {
    rows = rows.filter((r) => r.pagata === "Incassata");
  } else if (filters.pagata === "non_pagate") {
    rows = rows.filter((r) => r.pagata === "Non incassata");
  }

  return rows;
}

async function enrichTitoli(ids: string[]): Promise<Map<string, Partial<PremiProvvigioniRaw>>> {
  const map = new Map<string, Partial<PremiProvvigioniRaw>>();
  if (!ids.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 200) chunks.push(ids.slice(i, i + 200));

  for (const chunk of chunks) {
    const { data: titoli } = await supabase
      .from("titoli")
      .select(`
        id, appendice, comp_contabile, comp_assicurativa, conto_incasso, filiale,
        percentuale_riparto,
        clienti!titoli_cliente_anagrafica_id_fkey(zona, indotto, settore, contratto, fatturato, num_dipendenti),
        compagnie(codice, gruppo_statistico, gruppi_compagnia(descrizione)),
        uffici(nome_ufficio)
      `)
      .in("id", chunk);

    for (const t of titoli || []) {
      const cli = t.clienti as {
        zona?: string;
        indotto?: string;
        settore?: string;
        contratto?: string;
        fatturato?: number;
        num_dipendenti?: number;
      } | null;
      const comp = t.compagnie as {
        codice?: string;
        gruppo_statistico?: string;
        gruppi_compagnia?: { descrizione?: string };
      } | null;
      const uff = t.uffici as { nome_ufficio?: string } | null;

      map.set(t.id, {
        appendice: t.appendice,
        comp_contabile: t.comp_contabile,
        comp_assicurativa: t.comp_assicurativa,
        conto_incasso: t.conto_incasso,
        filiale: t.filiale,
        percentuale_riparto: t.percentuale_riparto,
        compagnia_codice: comp?.codice,
        gruppo_compagnia_nome: comp?.gruppi_compagnia?.descrizione,
        gruppo_stat_compagnia: comp?.gruppo_statistico,
        ufficio_nome: uff?.nome_ufficio,
        zona: cli?.zona,
        indotto: cli?.indotto,
        settore: cli?.settore,
        contratto: cli?.contratto,
        fatturato: cli?.fatturato,
        num_dipendenti: cli?.num_dipendenti,
      });
    }
  }
  return map;
}

type ProvvAgg = {
  provv_passive: number;
  perc_provv: number | null;
  provv_pagata: boolean;
};

async function loadProvvigioni(titoloIds: string[]): Promise<Map<string, ProvvAgg>> {
  const map = new Map<string, ProvvAgg>();
  if (!titoloIds.length) return map;

  const chunks: string[][] = [];
  for (let i = 0; i < titoloIds.length; i += 200) chunks.push(titoloIds.slice(i, i + 200));

  for (const chunk of chunks) {
    const { data } = await supabase
      .from("provvigioni_generate")
      .select("titolo_id, importo_provvigione, percentuale, pagata, solo_statistico")
      .in("titolo_id", chunk)
      .eq("solo_statistico", false);

    for (const p of data || []) {
      const cur = map.get(p.titolo_id) || { provv_passive: 0, perc_provv: null, provv_pagata: true };
      cur.provv_passive += Number(p.importo_provvigione) || 0;
      if (p.percentuale != null) cur.perc_provv = Number(p.percentuale);
      if (!p.pagata) cur.provv_pagata = false;
      map.set(p.titolo_id, cur);
    }
  }
  return map;
}
