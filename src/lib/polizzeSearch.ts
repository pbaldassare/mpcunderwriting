// Helpers per la ricerca polizze nel wizard apertura sinistro.
// Estratti per consentire test di regressione sul comportamento
// "Solo madri" vs "Tutte le polizze" e sull'assenza di deduplica.

import { supabase } from "@/integrations/supabase/client";

export type TitoloRow = {
  id: string;
  numero_titolo: string | null;
  sostituisce_polizza?: string | null;
  [k: string]: any;
};

export type CgaRow = {
  id: string;
  numero_polizza: string | null;
  cliente_id?: string | null;
  prodotti_cga?: { nome_prodotto?: string; compagnia?: string; ramo?: string } | null;
  [k: string]: any;
};

/**
 * Applica il filtro "solo madri" (sostituisce_polizza IS NULL) sulla query
 * di supabase quando richiesto. Restituisce la query (potenzialmente modificata).
 *
 * Pensata per essere testabile con un fake query builder.
 */
export function applySoloMadriFilter<T extends { is: (col: string, val: any) => T }>(
  query: T,
  onlyMothers: boolean,
): T {
  return onlyMothers ? query.is('sostituisce_polizza', null) : query;
}

/**
 * Unisce i risultati titoli + CGA. Effettua la deduplica per `numero_titolo`:
 * a parità di numero viene mantenuta la madre (sostituisce_polizza IS NULL)
 * se presente, altrimenti la riga più recente per `created_at`.
 * Filtra le righe senza numero_titolo.
 */
export function mergePolizze(titoli: TitoloRow[], cga: CgaRow[]) {
  const fromTitoli = (titoli ?? []).map((t) => ({ ...t, _isCga: false as const }));
  const fromCga = (cga ?? []).map((c) => ({
    id: `cga:${c.id}`,
    numero_titolo: c.numero_polizza,
    stato: 'attivo' as const,
    cliente_anagrafica_id: c.cliente_id ?? null,
    ufficio_id: null,
    sostituisce_polizza: null,
    created_at: (c as any).created_at ?? null,
    prodotto_nome: c.prodotti_cga?.nome_prodotto ?? null,
    garanzia_da: (c as any).data_decorrenza ?? null,
    garanzia_a: (c as any).data_scadenza ?? null,
    data_scadenza: (c as any).data_scadenza ?? null,
    data_decorrenza: (c as any).data_decorrenza ?? null,
    prodotti: {
      nome_prodotto: c.prodotti_cga?.nome_prodotto,
      compagnie: { id: null, nome: c.prodotti_cga?.compagnia },
    },
    ramo: c.prodotti_cga?.ramo
      ? { descrizione: c.prodotti_cga.ramo, gruppo_ramo: null }
      : null,
    clienti: null,
    _isCga: true as const,
  }));
  const all = [...fromTitoli, ...fromCga].filter((p: any) => p.numero_titolo);

  const byNumero = new Map<string, any>();
  for (const row of all) {
    const key = String(row.numero_titolo);
    const prev = byNumero.get(key);
    if (!prev) { byNumero.set(key, row); continue; }
    const prevIsMother = prev.sostituisce_polizza == null;
    const rowIsMother = row.sostituisce_polizza == null;
    if (rowIsMother && !prevIsMother) { byNumero.set(key, row); continue; }
    if (prevIsMother && !rowIsMother) continue;
    // stesso "tipo": tieni la più recente
    const prevTs = (prev as any).created_at ? Date.parse((prev as any).created_at) : 0;
    const rowTs = (row as any).created_at ? Date.parse((row as any).created_at) : 0;
    if (rowTs > prevTs) byNumero.set(key, row);
  }
  return Array.from(byNumero.values());
}

const TITOLI_POLIZZE_SELECT = `id, numero_titolo, premio_lordo, stato, created_at, cliente_anagrafica_id, ufficio_id, compagnia_id, sostituisce_polizza, prodotto_nome, data_competenza, data_scadenza, garanzia_da, garanzia_a,
  compagnia_diretta:compagnie!titoli_compagnia_id_fkey(id, nome),
  prodotti(nome_prodotto, compagnie(id, nome)),
  ramo:rami!titoli_ramo_id_fkey(id, codice, descrizione, gruppo_ramo:gruppi_ramo!rami_gruppo_ramo_id_fkey(id, codice, descrizione)),
  premi_garanzia_polizza:premi_garanzia_polizza!premi_garanzia_polizza_titolo_id_fkey(garanzia),
  clienti!titoli_cliente_anagrafica_id_fkey(cognome, nome, ragione_sociale, tipo_cliente)`;

/** Carica polizze (titoli + CGA) per un cliente — riusabile in wizard e dettaglio sinistro. */
export async function fetchPolizzeForCliente(clienteId: string, opts?: { soloMadri?: boolean }) {
  const onlyMothers = opts?.soloMadri ?? true;
  const baseTitQuery = supabase.from("titoli")
    .select(TITOLI_POLIZZE_SELECT)
    .eq("cliente_anagrafica_id", clienteId)
    .order("created_at", { ascending: false })
    .limit(200);
  const titQuery = applySoloMadriFilter(baseTitQuery as any, onlyMothers);

  const [titRes, cgaRes] = await Promise.all([
    titQuery,
    supabase.from("polizza_cga")
      .select(`id, numero_polizza, data_decorrenza, data_scadenza, premio_lordo_totale, cliente_id, prodotti_cga(nome_prodotto, compagnia, ramo)`)
      .eq("stato", "approvato")
      .eq("cliente_id", clienteId)
      .limit(200),
  ]);

  if (titRes.error) throw titRes.error;
  if (cgaRes.error) throw cgaRes.error;

  return mergePolizze((titRes.data ?? []) as TitoloRow[], (cgaRes.data ?? []) as CgaRow[]);
}
