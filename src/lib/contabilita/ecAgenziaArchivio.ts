import { supabase } from "@/integrations/supabase/client";
import type { ECAgenziaTitolo } from "@/lib/ec-agenzia-pdf";

export type EcAgenziaRigaArchivio = {
  polizza: string;
  cliente: string;
  premio: number;
  provvigioni: number;
  mi: string;
};

export function righeFromEcAgenziaTitoli(titoli: ECAgenziaTitolo[]): EcAgenziaRigaArchivio[] {
  return titoli.map((t) => ({
    polizza: t.polizza || "",
    cliente: t.cliente || "",
    premio: t.premio || 0,
    provvigioni: t.provvigioni || 0,
    mi: t.mi || "",
  }));
}

export function buildTestoRicercaEcAgenzia(riferimento: string, righe: EcAgenziaRigaArchivio[]): string {
  const tokens = [
    riferimento,
    ...righe.flatMap((r) => [r.polizza, r.cliente, r.mi].filter(Boolean)),
  ];
  return tokens.join(" ").toLowerCase();
}

export function parseDataEstrattoContoIt(value: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((value || "").trim());
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function archiviaEcAgenziaPdf(params: {
  compagniaId: string;
  riferimento: string;
  periodoTesto: string;
  dataDocumento: string;
  righe: EcAgenziaRigaArchivio[];
  pdfBlob: Blob;
  nomeFile: string;
  userId: string | null;
}): Promise<{ documentoId: string }> {
  const path = `${params.compagniaId}/ec_agenzia/${Date.now()}_${params.nomeFile}`;
  const { error: upErr } = await supabase.storage
    .from("documenti_generali")
    .upload(path, params.pdfBlob, { contentType: "application/pdf", upsert: false });
  if (upErr) throw upErr;

  const { data: doc, error: dbErr } = await supabase
    .from("documenti")
    .insert({
      nome_file: params.nomeFile,
      path_storage: path,
      bucket_name: "documenti_generali",
      entita_tipo: "agenzia",
      entita_id: params.compagniaId,
      categoria: "EC Agenzia",
      visibile_al_cliente: false,
      caricato_da: params.userId,
    } as any)
    .select("id")
    .single();
  if (dbErr) throw dbErr;

  const testoRicerca = buildTestoRicercaEcAgenzia(params.riferimento, params.righe);
  const { error: archErr } = await supabase.from("ec_agenzia_archivio" as any).insert({
    documento_id: doc.id,
    compagnia_id: params.compagniaId,
    riferimento: params.riferimento,
    periodo_testo: params.periodoTesto || null,
    data_estratto_conto: parseDataEstrattoContoIt(params.dataDocumento),
    righe: params.righe,
    testo_ricerca: testoRicerca,
  } as any);
  if (archErr) throw archErr;

  return { documentoId: doc.id };
}

export type EcAgenziaStoricoRow = {
  documento_id: string;
  nome_file: string;
  path_storage: string;
  bucket_name: string;
  created_at: string;
  compagnia_id: string;
  riferimento: string | null;
  periodo_testo: string | null;
  data_estratto_conto: string | null;
  righe: EcAgenziaRigaArchivio[] | null;
};

export async function cercaEcAgenziaStorico(params: {
  compagniaId?: string | null;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
  riferimento?: string;
  cliente?: string;
  polizza?: string;
  limit: number;
  offset: number;
}): Promise<{ rows: EcAgenziaStoricoRow[]; total: number }> {
  const { data, error } = await supabase.rpc("cerca_ec_agenzia_storico", {
    p_compagnia_id: params.compagniaId || null,
    p_date_from: params.dateFrom || null,
    p_date_to: params.dateTo || null,
    p_q: params.q?.trim() || null,
    p_riferimento: params.riferimento?.trim() || null,
    p_cliente: params.cliente?.trim() || null,
    p_polizza: params.polizza?.trim() || null,
    p_limit: params.limit,
    p_offset: params.offset,
  } as any);

  if (error) throw error;
  const res = data as { ok?: boolean; total?: number; rows?: EcAgenziaStoricoRow[]; error?: string };
  if (!res?.ok) throw new Error(res?.error || "Ricerca storico E/C fallita");

  return {
    rows: (res.rows || []) as EcAgenziaStoricoRow[],
    total: Number(res.total) || 0,
  };
}

export function formatClientiAnteprima(righe: EcAgenziaRigaArchivio[] | null | undefined, max = 2): string {
  if (!righe?.length) return "—";
  const names = [...new Set(righe.map((r) => r.cliente).filter(Boolean))];
  if (!names.length) return "—";
  const shown = names.slice(0, max).join(", ");
  if (names.length > max) return `${shown} +${names.length - max}`;
  return shown;
}
