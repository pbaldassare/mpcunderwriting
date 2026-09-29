import type { GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { calcTasseRiga } from "@/lib/calcProvvigioniGaranzia";
import { supabase } from "@/integrations/supabase/client";

export type DbPremioLike = {
  tipo_premio: "firma" | "quietanza";
  garanzia: string | null;
  codice_garanzia: string | null;
  firma: number | null;
  rata: number | null;
  accessori: number | null;
  aliquota_tasse_pct: number | null;
  ssn: number | null;
  quietanza_personalizzata?: boolean | null;
  provvigione_netto_pct?: number | null;
  provvigione_accessori_pct?: number | null;
  provvigione_netto_pct_override?: boolean | null;
  provvigione_accessori_pct_override?: boolean | null;
  tasse_rettifica?: number | null;
};

export type TitoloPremiAggregati = {
  ramo_id?: string | null;
  premio_netto?: number | null;
  premio_netto_quietanza?: number | null;
  tasse?: number | null;
  tasse_quietanza?: number | null;
  ssn_firma?: number | null;
  ssn_quietanza?: number | null;
  addizionali?: number | null;
  addizionali_quietanza?: number | null;
};

type CatalogoSottoramo = {
  id: string;
  codice: string;
  descrizione: string;
  aliquota_tasse_ramo?: number | null;
  ssn_attivo?: boolean | null;
  aliquota_ssn?: number | null;
  escludi_provvigioni?: boolean | null;
  diritti_agenzia?: boolean | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export const PREMI_GARANZIA_SELECT_BASE =
  "id, titolo_id, tipo_premio, garanzia, codice_garanzia, firma, rata, accessori, aliquota_tasse_pct, ssn, ordine, quietanza_personalizzata, provvigione_netto_pct, provvigione_accessori_pct, provvigione_netto_pct_override, provvigione_accessori_pct_override";

function isMissingTasseRettificaColumnError(error: { message?: string } | null): boolean {
  const msg = (error?.message ?? "").toLowerCase();
  return msg.includes("tasse_rettifica");
}

/** Carica premi_garanzia_polizza; se la colonna tasse_rettifica non esiste ancora, ripete senza. */
export async function fetchPremiGaranziaByTitolo(
  titoloId: string,
): Promise<{ rows: DbPremioLike[]; hasTasseRettifica: boolean }> {
  const selectWith = `${PREMI_GARANZIA_SELECT_BASE}, tasse_rettifica`;
  const withCol = await supabase
    .from("premi_garanzia_polizza")
    .select(selectWith)
    .eq("titolo_id", titoloId)
    .order("ordine");
  if (!withCol.error) {
    return { rows: (withCol.data as DbPremioLike[]) || [], hasTasseRettifica: true };
  }
  if (isMissingTasseRettificaColumnError(withCol.error)) {
    const withoutCol = await supabase
      .from("premi_garanzia_polizza")
      .select(PREMI_GARANZIA_SELECT_BASE)
      .eq("titolo_id", titoloId)
      .order("ordine");
    if (withoutCol.error) throw withoutCol.error;
    return { rows: (withoutCol.data as DbPremioLike[]) || [], hasTasseRettifica: false };
  }
  throw withCol.error;
}

/** Riutilizza righe DB di un altro titolo, eventualmente cambiando tipo_premio (es. firma madre → quietanza rata). */
export function remapDbPremiTipo(
  rows: DbPremioLike[],
  sourceTipo: "firma" | "quietanza",
  targetTipo: "firma" | "quietanza",
): DbPremioLike[] {
  return rows
    .filter((p) => p.tipo_premio === sourceTipo)
    .map((p) => ({
      ...p,
      tipo_premio: targetTipo,
      firma: targetTipo === "firma" ? Number(p.firma ?? p.rata ?? 0) : 0,
      rata: targetTipo === "quietanza" ? Number(p.rata ?? p.firma ?? 0) : 0,
    }));
}

export function titoliHaAggregatiPremi(
  titolo: TitoloPremiAggregati,
  tipo: "firma" | "quietanza",
): boolean {
  const netto =
    tipo === "quietanza"
      ? Number(titolo.premio_netto_quietanza ?? titolo.premio_netto ?? 0)
      : Number(titolo.premio_netto ?? 0);
  const tasse =
    tipo === "quietanza"
      ? Number(titolo.tasse_quietanza ?? titolo.tasse ?? 0)
      : Number(titolo.tasse ?? 0);
  const accessori =
    tipo === "quietanza"
      ? Number(titolo.addizionali_quietanza ?? titolo.addizionali ?? 0)
      : Number(titolo.addizionali ?? 0);
  const ssn =
    tipo === "quietanza"
      ? Number(titolo.ssn_quietanza ?? titolo.ssn_firma ?? 0)
      : Number(titolo.ssn_firma ?? 0);
  return netto > 0 || tasse > 0 || accessori > 0 || ssn > 0;
}

/** Costruisce una riga garanzia sintetica dagli aggregati su `titoli` quando mancano righe in premi_garanzia_polizza. */
export function buildGaranziaRowFromTitoliAggregati(
  tipo: "firma" | "quietanza",
  titolo: TitoloPremiAggregati,
  catalogo: CatalogoSottoramo[],
): GaranziaRow | null {
  if (!titoliHaAggregatiPremi(titolo, tipo)) return null;

  const netto =
    tipo === "quietanza"
      ? Number(titolo.premio_netto_quietanza ?? titolo.premio_netto ?? 0)
      : Number(titolo.premio_netto ?? 0);
  const accessori =
    tipo === "quietanza"
      ? Number(titolo.addizionali_quietanza ?? titolo.addizionali ?? 0)
      : Number(titolo.addizionali ?? 0);
  const tasseStored =
    tipo === "quietanza"
      ? Number(titolo.tasse_quietanza ?? titolo.tasse ?? 0)
      : Number(titolo.tasse ?? 0);
  const ssn =
    tipo === "quietanza"
      ? Number(titolo.ssn_quietanza ?? titolo.ssn_firma ?? 0)
      : Number(titolo.ssn_firma ?? 0);

  const cat =
    catalogo.find((c) => c.id === titolo.ramo_id) ||
    catalogo[0] ||
    null;

  const dirittiAgenzia = !!cat?.diritti_agenzia;
  const escludiProvvigioni = !!cat?.escludi_provvigioni;
  const aliquotaTasse = dirittiAgenzia || escludiProvvigioni
    ? 0
    : Number(cat?.aliquota_tasse_ramo ?? 0);
  const ssnAttivo = !dirittiAgenzia && !escludiProvvigioni && !!cat?.ssn_attivo;
  const aliquotaSsn = ssnAttivo ? Number(cat?.aliquota_ssn ?? 10.5) || 10.5 : 0;

  if (dirittiAgenzia) {
    return {
      codice: cat?.codice || null,
      descrizione: cat?.descrizione || "Premio",
      netto: "",
      accessori: "",
      tasse: tasseStored ? tasseStored.toFixed(2) : "",
      aliquotaTasse: 0,
      sottoramoId: cat?.id || null,
      ssn: "",
      aliquotaSsn: 0,
      ssnAttivo: false,
      ssnManualOverride: false,
      escludiProvvigioni: false,
      dirittiAgenzia: true,
      quietanzaPersonalizzata: tipo === "quietanza" ? true : undefined,
    };
  }

  const tasseCalc =
    tasseStored > 0
      ? tasseStored
      : aliquotaTasse > 0 && (netto > 0 || accessori > 0)
        ? calcTasseRiga(netto, accessori, aliquotaTasse)
        : 0;
  const ssnAuto = ssnAttivo ? round2((netto * aliquotaSsn) / 100) : 0;

  return {
    codice: cat?.codice || null,
    descrizione: cat?.descrizione || "Premio",
    netto: netto ? netto.toFixed(2) : "",
    accessori: accessori ? accessori.toFixed(2) : "",
    tasse: escludiProvvigioni ? "0" : tasseCalc ? tasseCalc.toFixed(2) : "",
    aliquotaTasse,
    sottoramoId: cat?.id || null,
    ssn: ssn ? ssn.toFixed(2) : "",
    aliquotaSsn,
    ssnAttivo,
    ssnManualOverride: ssnAttivo && Math.abs(ssn - ssnAuto) > 0.01,
    escludiProvvigioni,
    dirittiAgenzia: false,
    quietanzaPersonalizzata: tipo === "quietanza" ? true : undefined,
  };
}

/** Lordo operativo di una quietanza/rata (per header e incasso). */
export function calcLordoQuietanzaTitolo(t: {
  premio_lordo?: number | null;
  premio_netto?: number | null;
  premio_netto_quietanza?: number | null;
  tasse?: number | null;
  tasse_quietanza?: number | null;
  addizionali?: number | null;
  addizionali_quietanza?: number | null;
  ssn_firma?: number | null;
  ssn_quietanza?: number | null;
}): number {
  const lordoStored = Number(t.premio_lordo ?? 0);
  if (lordoStored > 0) return lordoStored;
  const netto = Number(t.premio_netto_quietanza ?? t.premio_netto ?? 0);
  const tasse = Number(t.tasse_quietanza ?? t.tasse ?? 0);
  const accessori = Number(t.addizionali_quietanza ?? t.addizionali ?? 0);
  const ssn = Number(t.ssn_quietanza ?? t.ssn_firma ?? 0);
  return round2(netto + tasse + accessori + ssn);
}
