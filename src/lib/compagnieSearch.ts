/** Ricerca unica Compagnie / Agenzie: un solo termine su nome + codice (+ sede). */

export type AgenziaSearchRow = {
  nome?: string | null;
  nome_sede?: string | null;
  codice?: string | null;
  comune?: string | null;
  tipo?: string | null;
  gruppo_compagnia_id?: string | null;
};

export type CompagniaAssicurativaSearchRow = {
  descrizione?: string | null;
  codice?: string | null;
};

export function normalizeCompagnieSearchTerm(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Escape per `.or()` PostgREST / ilike. */
export function escapeCompagnieIlike(raw: string): string {
  return normalizeCompagnieSearchTerm(raw)
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ");
}

export function matchesAgenziaSearch(row: AgenziaSearchRow, search: string): boolean {
  const q = normalizeCompagnieSearchTerm(search);
  if (!q) return true;
  return [row.nome, row.nome_sede, row.codice, row.comune].some((value) =>
    (value || "").toLowerCase().includes(q),
  );
}

export function matchesCompagniaAssicurativaSearch(
  row: CompagniaAssicurativaSearchRow,
  search: string,
): boolean {
  const q = normalizeCompagnieSearchTerm(search);
  if (!q) return true;
  return (
    (row.descrizione || "").toLowerCase().includes(q) ||
    (row.codice || "").toLowerCase().includes(q)
  );
}

export function filterAgenzieList<T extends AgenziaSearchRow>(
  rows: T[],
  opts: {
    search?: string;
    tipo?: string;
    onlyPluri?: boolean;
    gruppiMap?: Record<string, { is_pluri?: boolean }>;
  },
): T[] {
  return rows.filter((row) => {
    if (!matchesAgenziaSearch(row, opts.search || "")) return false;
    if (opts.tipo && opts.tipo !== "all" && row.tipo !== opts.tipo) return false;
    if (opts.onlyPluri) {
      const gid = row.gruppo_compagnia_id;
      if (!gid || !opts.gruppiMap?.[gid]?.is_pluri) return false;
    }
    return true;
  });
}

export function filterCompagnieAssicurativeList<T extends CompagniaAssicurativaSearchRow>(
  rows: T[],
  search: string,
): T[] {
  return rows.filter((row) => matchesCompagniaAssicurativaSearch(row, search));
}

/** Un solo filtro testuale OR per query Supabase su `compagnie`. */
export function buildAgenzieSearchOr(search: string): string | null {
  const term = escapeCompagnieIlike(search);
  if (!term) return null;
  return `nome.ilike.%${term}%,nome_sede.ilike.%${term}%,codice.ilike.%${term}%,comune.ilike.%${term}%`;
}

/** Un solo filtro testuale OR per query Supabase su `gruppi_compagnia`. */
export function buildCompagnieAssicurativeSearchOr(search: string): string | null {
  const term = escapeCompagnieIlike(search);
  if (!term) return null;
  return `descrizione.ilike.%${term}%,codice.ilike.%${term}%`;
}
