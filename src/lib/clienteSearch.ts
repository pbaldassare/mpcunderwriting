import { resolveClienteIndirizzo, resolveClienteNome, type ClienteEcAnagrafica } from "@/lib/ecClienteAnagrafica";
import { scoreClienteSearch, type ClienteSearchFields } from "@/lib/scoreClienteSearch";

export const CLIENTE_SEARCH_MIN_CHARS = 2;
export const CLIENTE_SEARCH_LIMIT = 40;
export const CLIENTE_SEARCH_BROWSE_LIMIT = 40;

export const CLIENTE_SEARCH_SELECT =
  "id, nome, cognome, ragione_sociale, tipo_cliente, codice_fiscale, partita_iva, codice_ricerca, codice_cliente, email, pec, telefono, cellulare, indirizzo_residenza, indirizzo_sede, indirizzo_fiscale, indirizzo_alternativo, cap_residenza, cap_sede, cap_fiscale, cap_alternativo, citta_residenza, citta_sede, citta_fiscale, citta_alternativa, provincia_residenza, provincia_sede, provincia_fiscale, provincia_alternativa, gruppo_statistico";

export type ClienteSearchRow = ClienteEcAnagrafica & {
  id: string;
  attivo?: boolean | null;
  codice_fiscale?: string | null;
  partita_iva?: string | null;
  codice_ricerca?: string | null;
  codice_cliente?: string | null;
  telefono?: string | null;
  cellulare?: string | null;
  gruppo_statistico?: string | null;
  nominativi?: Array<{ nome?: string | null; cognome?: string | null }>;
};

export function sanitizeClienteSearchTerm(raw: string): string {
  return raw.replace(/[,()]/g, " ").replace(/%/g, "").replace(/\s+/g, " ").trim();
}

export function clienteSearchTokens(term: string): string[] {
  return sanitizeClienteSearchTerm(term)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

export function clienteSearchLabel(c: ClienteSearchRow | ClienteEcAnagrafica | null | undefined): string {
  const label = resolveClienteNome(c);
  return label === "—" ? "" : label;
}

export function clienteSearchIndirizzoLine(c: ClienteSearchRow | ClienteEcAnagrafica | null | undefined): string {
  const addr = resolveClienteIndirizzo(c);
  return [addr.indirizzo, [addr.cap, addr.citta].filter(Boolean).join(" "), addr.provincia ? `(${addr.provincia})` : ""]
    .filter(Boolean)
    .join(", ");
}

export function clienteSearchDescription(c: ClienteSearchRow | null | undefined): string | undefined {
  if (!c) return undefined;
  const parts = [
    c.codice_fiscale || c.partita_iva || undefined,
    clienteSearchIndirizzoLine(c) || undefined,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
}

/** Blob ricercabile: anagrafica + più nomi + indirizzi. Mai email/pec. */
export function clienteSearchBlob(c: ClienteSearchRow): string {
  const nominativi = (c.nominativi ?? [])
    .map((n) => `${n.cognome ?? ""} ${n.nome ?? ""}`.trim())
    .filter(Boolean)
    .join(" ");
  return [
    c.cognome,
    c.nome,
    c.ragione_sociale,
    c.codice_fiscale,
    c.partita_iva,
    c.codice_ricerca,
    c.codice_cliente,
    c.telefono,
    c.cellulare,
    c.indirizzo_residenza,
    c.indirizzo_sede,
    c.indirizzo_fiscale,
    c.indirizzo_alternativo,
    c.cap_residenza,
    c.cap_sede,
    c.cap_fiscale,
    c.cap_alternativo,
    c.citta_residenza,
    c.citta_sede,
    c.citta_fiscale,
    c.citta_alternativa,
    c.provincia_residenza,
    c.provincia_sede,
    c.provincia_fiscale,
    c.provincia_alternativa,
    nominativi,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Token AND: ogni parola deve comparire in nome, più nomi o indirizzo. */
export function matchesClienteSearch(c: ClienteSearchRow, term: string): boolean {
  const tokens = clienteSearchTokens(term);
  if (tokens.length === 0) return true;
  const hay = clienteSearchBlob(c);
  return tokens.every((tok) => hay.includes(tok));
}

export function parseSearchClientiRankedPayload(data: unknown): ClienteSearchRow[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as ClienteSearchRow[];
  if (typeof data === "object" && data !== null && "data" in data) {
    const inner = (data as { data?: unknown }).data;
    return Array.isArray(inner) ? (inner as ClienteSearchRow[]) : [];
  }
  return [];
}

export function rankClienteSearchRows(rows: ClienteSearchRow[], term: string): ClienteSearchRow[] {
  const t = sanitizeClienteSearchTerm(term);
  if (!t) return rows;
  return [...rows].sort((a, b) => {
    const sa = scoreClienteSearch(a as ClienteSearchFields, t);
    const sb = scoreClienteSearch(b as ClienteSearchFields, t);
    if (sa !== sb) return sa - sb;
    return clienteSearchLabel(a).localeCompare(clienteSearchLabel(b), "it");
  });
}

export function toClienteSearchOption(c: ClienteSearchRow) {
  return {
    value: c.id,
    label: clienteSearchLabel(c) || "(senza nome)",
    description: clienteSearchDescription(c),
    searchText: clienteSearchBlob(c),
  };
}
