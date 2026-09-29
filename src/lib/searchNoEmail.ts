/**
 * Matching di ricerca: mai email/pec/mail.
 * Le colonne restano in anagrafica e in tabella; solo il filtro testuale le ignora.
 */

export function sanitizeSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").replace(/%/g, "").replace(/\s+/g, " ").trim();
}

export function matchesSearchFields(
  term: string,
  fields: Array<string | null | undefined>,
): boolean {
  const q = term.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f || "").toLowerCase().includes(q));
}

/** OR PostgREST ilike su colonne non-email. */
export function buildIlikeOr(columns: string[], term: string): string | null {
  const t = sanitizeSearchTerm(term);
  if (!t || columns.length === 0) return null;
  return columns.map((c) => `${c}.ilike.%${t}%`).join(",");
}

export const PROSPECT_SEARCH_COLUMNS = [
  "nome",
  "cognome",
  "ragione_sociale",
  "codice_fiscale",
  "partita_iva",
] as const;

export const PROFILES_SEARCH_COLUMNS = ["nome", "cognome"] as const;

export const IDGUARD_CLIENTI_SEARCH_COLUMNS = [
  "nome",
  "cognome",
  "ragione_sociale",
  "codice_fiscale",
  "partita_iva",
] as const;

export const RICHIESTE_QUIETANZA_SEARCH_COLUMNS = ["oggetto", "compagnia_nome"] as const;

export type AnagraficaListSearchRow = {
  codice?: string | null;
  cognome?: string | null;
  nome?: string | null;
  nome_breve?: string | null;
  ragione_sociale?: string | null;
  citta?: string | null;
  referente_nome?: string | null;
  sigla?: string | null;
};

export function matchesAnagraficaListSearch(item: AnagraficaListSearchRow, search: string): boolean {
  return matchesSearchFields(search, [
    item.codice,
    item.cognome,
    item.nome,
    item.nome_breve,
    item.ragione_sociale,
    item.citta,
    item.referente_nome,
    item.sigla,
  ]);
}

export function matchesProfileNameSearch(
  row: { nome?: string | null; cognome?: string | null; ruolo?: string | null },
  search: string,
): boolean {
  return matchesSearchFields(search, [row.nome, row.cognome, row.ruolo]);
}

export function isEmailLikeSearchTerm(term: string): boolean {
  const t = term.trim();
  return t.includes("@") && !t.includes(" ");
}
