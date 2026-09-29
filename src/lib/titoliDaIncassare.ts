import { supabase } from "@/integrations/supabase/client";
import { PENDENTI_OR_GARANTITO_APERTO_FILTER } from "@/lib/garantitoTitolo";

/** Stessa logica di Incassi (view v_portafoglio_quietanze). */
export const applyExcludeMadreConRate = (q: any) =>
  q.or(
    "is_regolazione.eq.true,is_proroga.eq.true,is_appendice_modifica.eq.true,numero_rata.gt.1,numero_rate_totali.lte.1,numero_rate_totali.is.null",
  );

/** Su tabella titoli: appendici RG/PR/AM, quietanze (figlie) e madri mono-rata; dedupe esclude madre se presente figlia. */
export const applyExcludeMadreConRateTitoli = (q: any) =>
  q.or(
    "is_regolazione.eq.true,is_proroga.eq.true,is_appendice_modifica.eq.true,sostituisce_polizza.not.is.null,and(sostituisce_polizza.is.null,is_regolazione.is.null,is_regolazione.eq.false,is_proroga.is.null,is_proroga.eq.false,is_appendice_modifica.is.null,is_appendice_modifica.eq.false)",
  );

export type TitoloDaIncassareRow = {
  id: string;
  numero_titolo: string | null;
  premio_lordo: number | null;
  stato: string | null;
  data_messa_cassa: string | null;
  data_scadenza: string | null;
  sostituisce_polizza: string | null;
  ramo?: { descrizione?: string | null } | null;
  compagnia?: { nome?: string | null } | null;
};

/** Se madre e quietanza condividono numero_titolo, tiene solo la quietanza/rata. */
export function dedupeTitoliMadreQuietanza<T extends { id: string; numero_titolo?: string | null; sostituisce_polizza?: string | null }>(
  rows: T[],
): T[] {
  const byNumero = new Map<string, T[]>();
  for (const r of rows) {
    const key = (r.numero_titolo || r.id).trim();
    const list = byNumero.get(key) ?? [];
    list.push(r);
    byNumero.set(key, list);
  }
  const out: T[] = [];
  for (const group of byNumero.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const figlie = group.filter((t) => t.sostituisce_polizza);
    out.push(...(figlie.length > 0 ? figlie : group));
  }
  return out;
}

/** Titoli eleggibili per collegamento bonifico / messa a cassa (allineato a Incassi). */
export async function fetchTitoliClienteDaIncassare(
  clienteAnagraficaId: string,
  limit = 50,
): Promise<TitoloDaIncassareRow[]> {
  let q = supabase
    .from("titoli")
    .select(
      "id, numero_titolo, premio_lordo, stato, data_messa_cassa, data_scadenza, sostituisce_polizza, conferimento_gestito, fondi_ricevuti, tipo_pagamento, data_copertura, ramo:rami(descrizione), compagnia:compagnie(nome)" as any,
    )
    .eq("cliente_anagrafica_id", clienteAnagraficaId)
    .neq("stato", "annullato")
    .or(PENDENTI_OR_GARANTITO_APERTO_FILTER);
  q = applyExcludeMadreConRateTitoli(q);
  const { data, error } = await q
    .order("data_scadenza", { ascending: true, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return dedupeTitoliMadreQuietanza(((data as unknown) as TitoloDaIncassareRow[]) ?? []);
}
