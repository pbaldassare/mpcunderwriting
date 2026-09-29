import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CLIENTE_SEARCH_BROWSE_LIMIT,
  CLIENTE_SEARCH_LIMIT,
  CLIENTE_SEARCH_MIN_CHARS,
  CLIENTE_SEARCH_SELECT,
  parseSearchClientiRankedPayload,
  sanitizeClienteSearchTerm,
  toClienteSearchOption,
  type ClienteSearchRow,
} from "@/lib/clienteSearch";

export type UseClienteSearchOptions = {
  selectedId?: string;
  onlyAttivi?: boolean;
  limit?: number;
  enabled?: boolean;
};

async function fetchClienteById(id: string): Promise<ClienteSearchRow | null> {
  const { data, error } = await supabase
    .from("clienti")
    .select(CLIENTE_SEARCH_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as ClienteSearchRow | null) ?? null;
}

async function fetchNominativiByClienteIds(
  ids: string[],
): Promise<Record<string, Array<{ nome?: string | null; cognome?: string | null }>>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase
    .from("nominativi_cliente")
    .select("cliente_id, nome, cognome")
    .in("cliente_id", ids);
  if (error) return {};
  const map: Record<string, Array<{ nome?: string | null; cognome?: string | null }>> = {};
  for (const n of data || []) {
    const key = (n as { cliente_id: string }).cliente_id;
    if (!map[key]) map[key] = [];
    map[key].push({ nome: n.nome, cognome: n.cognome });
  }
  return map;
}

async function attachNominativi(rows: ClienteSearchRow[]): Promise<ClienteSearchRow[]> {
  const map = await fetchNominativiByClienteIds(rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, nominativi: map[r.id] ?? r.nominativi ?? [] }));
}

export async function fetchClientiSearch(
  rawTerm: string,
  opts: UseClienteSearchOptions = {},
): Promise<ClienteSearchRow[]> {
  const term = sanitizeClienteSearchTerm(rawTerm);
  const limit = opts.limit ?? CLIENTE_SEARCH_LIMIT;
  let rows: ClienteSearchRow[] = [];

  if (term.length >= CLIENTE_SEARCH_MIN_CHARS) {
    const { data, error } = await supabase.rpc("search_clienti_ranked", {
      p_search: term,
      p_limit: limit,
      p_offset: 0,
    });
    if (error) throw error;
    rows = parseSearchClientiRankedPayload(data);
    if (opts.onlyAttivi) rows = rows.filter((r) => r.attivo !== false);
  } else {
    let q = supabase
      .from("clienti")
      .select(CLIENTE_SEARCH_SELECT)
      .is("merged_into", null)
      .order("cognome", { ascending: true, nullsFirst: false })
      .order("ragione_sociale", { ascending: true, nullsFirst: false })
      .limit(opts.limit ?? CLIENTE_SEARCH_BROWSE_LIMIT);
    if (opts.onlyAttivi) q = q.eq("attivo", true);
    const { data, error } = await q;
    if (error) throw error;
    rows = (data || []) as ClienteSearchRow[];
  }

  if (opts.selectedId && !rows.some((r) => r.id === opts.selectedId)) {
    const selected = await fetchClienteById(opts.selectedId);
    if (selected) rows = [selected, ...rows];
  }

  return attachNominativi(rows);
}

export function useDebouncedClienteSearch(search: string, delay = 350): string {
  const [debounced, setDebounced] = useState(search);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), delay);
    return () => clearTimeout(t);
  }, [search, delay]);
  return debounced;
}

export function useClienteSearch(search: string, opts: UseClienteSearchOptions = {}) {
  const debounced = useDebouncedClienteSearch(search);
  const selectedId = opts.selectedId || "";
  const onlyAttivi = opts.onlyAttivi ?? false;
  const limit = opts.limit ?? CLIENTE_SEARCH_LIMIT;
  const enabled = opts.enabled ?? true;

  const query = useQuery({
    queryKey: ["cliente-search", debounced, selectedId, onlyAttivi, limit],
    enabled,
    queryFn: () => fetchClientiSearch(debounced, { selectedId, onlyAttivi, limit }),
    staleTime: 30_000,
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const options = useMemo(() => rows.map(toClienteSearchOption), [rows]);

  return {
    ...query,
    rows,
    options,
    debouncedSearch: debounced,
  };
}
