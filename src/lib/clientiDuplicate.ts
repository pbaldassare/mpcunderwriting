import type { SupabaseClient } from "@supabase/supabase-js";

export type ClienteDuplicatoMatchType = "partita_iva" | "codice_fiscale" | "nome";

export interface ClienteDuplicatoMatch {
  cliente_id: string;
  codice_cliente: string | null;
  denominazione: string;
  match_type: ClienteDuplicatoMatchType;
}

export function normalizePartitaIva(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return input.replace(/\s+/g, "").trim();
}

export function normalizeCodiceFiscale(input: string | null | undefined): string | null {
  if (!input?.trim()) return null;
  return input.replace(/\s+/g, "").toUpperCase().trim();
}

/** Allineato a find_clienti_duplicati (nome_norm). */
export function normalizeNomeCliente(fields: {
  nome?: string | null;
  cognome?: string | null;
  ragione_sociale?: string | null;
}): string {
  const raw = `${fields.cognome || ""} ${fields.nome || ""} ${fields.ragione_sociale || ""}`;
  return raw.trim().toUpperCase().replace(/\s+/g, " ");
}

export function formatClienteDuplicatoError(matches: ClienteDuplicatoMatch[]): string {
  const labels: Record<ClienteDuplicatoMatchType, string> = {
    partita_iva: "P.IVA",
    codice_fiscale: "Codice Fiscale",
    nome: "denominazione",
  };
  const parts = matches.map(
    (m) =>
      `${labels[m.match_type]} già presente: ${m.denominazione.trim() || "—"} (cod. ${m.codice_cliente || "—"})`,
  );
  return parts.join(" • ");
}

export async function verificaClienteDuplicato(
  supabase: SupabaseClient,
  params: {
    partitaIva?: string | null;
    codiceFiscale?: string | null;
    codiceFiscaleAzienda?: string | null;
    nome?: string | null;
    cognome?: string | null;
    ragioneSociale?: string | null;
    tipoCliente?: "privato" | "azienda" | "ente" | string | null;
    excludeId?: string | null;
  },
): Promise<ClienteDuplicatoMatch[]> {
  const { data, error } = await supabase.rpc("verifica_cliente_duplicato", {
    _partita_iva: normalizePartitaIva(params.partitaIva) ?? undefined,
    _codice_fiscale: normalizeCodiceFiscale(params.codiceFiscale) ?? undefined,
    _codice_fiscale_azienda: normalizeCodiceFiscale(params.codiceFiscaleAzienda) ?? undefined,
    _nome: params.nome?.trim() || undefined,
    _cognome: params.cognome?.trim() || undefined,
    _ragione_sociale: params.ragioneSociale?.trim() || undefined,
    _tipo_cliente: params.tipoCliente || undefined,
    _exclude_id: params.excludeId || undefined,
  });
  if (error) throw error;
  return (data || []) as ClienteDuplicatoMatch[];
}

export async function verificaNumeroPolizzaDuplicato(
  supabase: SupabaseClient,
  params: {
    numeroTitolo: string;
    compagniaId: string | null;
    excludeTitoloId?: string | null;
  },
): Promise<{ duplicato: boolean; titolo_id?: string; numero_titolo?: string }> {
  const numero = params.numeroTitolo.trim();
  if (!numero) return { duplicato: false };

  const { data, error } = await supabase.rpc("verifica_numero_polizza_duplicato", {
    _numero_titolo: numero,
    _compagnia_id: params.compagniaId ?? undefined,
    _exclude_titolo_id: params.excludeTitoloId ?? undefined,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.duplicato) return { duplicato: false };
  return {
    duplicato: true,
    titolo_id: row.titolo_id ?? undefined,
    numero_titolo: row.numero_titolo ?? numero,
  };
}
