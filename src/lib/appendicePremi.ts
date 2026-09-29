import type { SupabaseClient } from "@supabase/supabase-js";
import type { GaranziaEditorRow } from "@/components/polizze/PolizzaEditorInline";
import { calcLordoGaranzia } from "@/lib/operazionePolizzaPremi";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type AggregatedPremi = {
  premio_netto: number;
  tasse: number;
  addizionali: number;
  ssn_firma: number;
  premio_lordo: number;
};

/** Aggrega importi da righe garanzia (stessa logica editor polizza). */
export function aggregateGaranziePremi(garanzie: GaranziaEditorRow[]): AggregatedPremi {
  let premio_netto = 0;
  let tasse = 0;
  let addizionali = 0;
  let ssn_firma = 0;
  let premio_lordo = 0;
  for (const g of garanzie) {
    premio_netto += Number(g.firma || 0);
    addizionali += Number(g.rata || 0);
    tasse += Number(g.imposta_provinciale || 0);
    ssn_firma += Number(g.ssn || 0);
    premio_lordo += Number(g.lordo_calcolato || calcLordoGaranzia(g));
  }
  return {
    premio_netto: round2(premio_netto),
    tasse: round2(tasse),
    addizionali: round2(addizionali),
    ssn_firma: round2(ssn_firma),
    premio_lordo: round2(premio_lordo),
  };
}

/** Calcola provvigioni da netto e percentuale polizza madre. */
export function calcProvvigioniAppendice(premioNetto: number, percProvv: number | null | undefined): number {
  if (percProvv == null || !Number.isFinite(percProvv)) return 0;
  return round2((premioNetto * percProvv) / 100);
}

/** Copia composizione premi sul titolo derivato appendice. */
export async function syncPremiGaranziaToTitolo(
  supabase: SupabaseClient,
  titoloId: string,
  garanzie: GaranziaEditorRow[],
): Promise<void> {
  await supabase.from("premi_garanzia_polizza").delete().eq("titolo_id", titoloId);
  if (garanzie.length === 0) return;
  const rows = garanzie.map((g, idx) => ({
    titolo_id: titoloId,
    garanzia: g.garanzia || "Garanzia",
    codice_garanzia: g.codice_garanzia,
    firma: g.firma,
    rata: g.rata,
    imposta_provinciale: g.imposta_provinciale,
    ssn: g.ssn,
    lordo_calcolato: g.lordo_calcolato || calcLordoGaranzia(g),
    is_rca_principale: g.is_rca_principale,
    ordine: g.ordine ?? idx + 1,
    tipo_premio: "firma",
  }));
  const { error } = await supabase.from("premi_garanzia_polizza").insert(rows as never);
  if (error) throw error;
}

/** Aggiorna intestazione titolo derivato con periodo e importi dettagliati. */
export async function patchTitoloDerivatoAppendice(
  supabase: SupabaseClient,
  titoloId: string,
  opts: {
    dataEffetto: string;
    dataScadenza: string;
    oggetto?: string | null;
    aggregated: AggregatedPremi;
    provvigioni: number;
    percProvv: number | null;
  },
): Promise<void> {
  const { dataEffetto, dataScadenza, oggetto, aggregated, provvigioni, percProvv } = opts;
  const { error } = await supabase
    .from("titoli")
    .update({
      garanzia_da: dataEffetto,
      garanzia_a: dataScadenza,
      durata_da: dataEffetto,
      durata_a: dataScadenza,
      data_scadenza: dataScadenza,
      data_competenza: dataEffetto,
      premio_netto: aggregated.premio_netto,
      tasse: aggregated.tasse,
      addizionali: aggregated.addizionali,
      ssn_firma: aggregated.ssn_firma,
      premio_lordo: aggregated.premio_lordo,
      premio_netto_quietanza: aggregated.premio_netto,
      tasse_quietanza: aggregated.tasse,
      addizionali_quietanza: aggregated.addizionali,
      ssn_quietanza: aggregated.ssn_firma,
      provvigioni_firma: provvigioni,
      provvigioni_quietanza: provvigioni,
      ...(oggetto ? { descrizione_polizza: oggetto } : {}),
    } as never)
    .eq("id", titoloId);
  if (error) throw error;
}

export type AppendiceTipo = "modifica" | "proroga" | "regolazione";

export async function creaTitoloDaAppendice(
  supabase: SupabaseClient,
  tipo: AppendiceTipo,
  appendiceId: string,
): Promise<string> {
  const rpc =
    tipo === "modifica"
      ? "crea_titolo_da_modifica"
      : tipo === "proroga"
        ? "crea_titolo_da_proroga"
        : "crea_titolo_da_regolazione";
  const { data, error } = await supabase.rpc(rpc, { p_appendice_id: appendiceId });
  if (error) throw error;
  return data as string;
}

/** Serializza le righe garanzia in payload per la RPC transazionale. */
export function buildGaranziePayload(garanzie: GaranziaEditorRow[]) {
  return garanzie.map((g, idx) => ({
    garanzia: g.garanzia || "Garanzia",
    codice_garanzia: g.codice_garanzia ?? null,
    firma: Number(g.firma || 0),
    rata: Number(g.rata || 0),
    imposta_provinciale: Number(g.imposta_provinciale || 0),
    ssn: Number(g.ssn || 0),
    accessori: Number((g as { accessori?: number }).accessori || 0),
    aliquota_tasse_pct: (g as { aliquota_tasse_pct?: number }).aliquota_tasse_pct ?? null,
    lordo_calcolato: Number(g.lordo_calcolato || calcLordoGaranzia(g)),
    is_rca_principale: !!g.is_rca_principale,
    ordine: g.ordine ?? idx + 1,
  }));
}

export type CreaAppendiceIncassoResult = {
  appendice_id: string;
  titolo_id: string;
  numero_titolo: string;
};

export type CreaAppendiceIncassoArgs = {
  tipo: AppendiceTipo;
  madreId: string;
  numeroAppendice: string;
  dataEffetto: string;
  dataScadenza: string | null;
  oggetto: string | null;
  note: string | null;
  quietanzaId: string | null;
  aggregated: AggregatedPremi;
  provvigioni: number;
  percProvv: number | null;
  garanzie: GaranziaEditorRow[];
  filePath: string | null;
  nomeFile: string | null;
  allegati: unknown[];
  createdBy: string | null;
};

/**
 * Crea l'appendice in un'unica transazione lato DB:
 * header appendice + titolo-incasso + composizione premi + quietanza collegata.
 */
export async function creaAppendiceIncasso(
  supabase: SupabaseClient,
  args: CreaAppendiceIncassoArgs,
): Promise<CreaAppendiceIncassoResult> {
  const { data, error } = await supabase.rpc("crea_appendice_incasso", {
    p_titolo_id: args.madreId,
    p_tipo: args.tipo,
    p_numero_appendice: args.numeroAppendice,
    p_data_effetto: args.dataEffetto,
    p_data_scadenza: args.dataScadenza,
    p_oggetto: args.oggetto,
    p_note: args.note,
    p_quietanza_id: args.quietanzaId,
    p_premio_netto: args.aggregated.premio_netto,
    p_tasse: args.aggregated.tasse,
    p_addizionali: args.aggregated.addizionali,
    p_ssn: args.aggregated.ssn_firma,
    p_premio_lordo: args.aggregated.premio_lordo,
    p_provvigioni: args.provvigioni,
    p_percentuale_provvigione: args.percProvv,
    p_garanzie: buildGaranziePayload(args.garanzie),
    p_file_path: args.filePath,
    p_nome_file: args.nomeFile,
    p_allegati: args.allegati,
    p_created_by: args.createdBy,
  } as never);
  if (error) throw error;
  return data as CreaAppendiceIncassoResult;
}
