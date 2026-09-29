import { format, parseISO } from "date-fns";
import { displayStatoPolizza, isPolizzaMadreRow, isQuietanzaRow } from "@/lib/polizzeDisplay";
import { datePeriodoPolizzaGaranzia } from "@/lib/datePolizzaGaranzia";
import { getProvvigioneEC } from "@/lib/getProvvigioneEC";
import { provvigioneProduttoreForRow } from "@/lib/provvigioneProduttore";
import type { CaricoExportRow } from "./columns";

export type CaricoRawRow = {
  id: string;
  titolo_derivato_numero?: string | null;
  numero_titolo?: string | null;
  cliente_nome_display?: string | null;
  compagnia_nome?: string | null;
  ramo_nome?: string | null;
  garanzia_da?: string | null;
  garanzia_a?: string | null;
  durata_da?: string | null;
  durata_a?: string | null;
  targa_telaio?: string | null;
  rate?: number | null;
  numero_rata?: number | null;
  numero_rate_totali?: number | null;
  premio_lordo?: number | null;
  provvigioni_firma?: number | null;
  provvigioni_quietanza?: number | null;
  ae_nome?: string | null;
  produttore_nome?: string | null;
  produttori_display?: string | null;
  stato?: string | null;
  data_copertura?: string | null;
  data_messa_cassa?: string | null;
  sostituisce_polizza?: string | null;
  is_regolazione?: boolean | null;
  is_proroga?: boolean | null;
  is_appendice_modifica?: boolean | null;
  ufficio_id?: string | null;
};

function fmtDate(v: string | null | undefined): string {
  if (!v) return "";
  try {
    const d = v.length === 10 ? parseISO(v) : new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return format(d, "dd/MM/yyyy");
  } catch {
    return "";
  }
}

function frazLabel(r: number | null | undefined): string {
  if (!r) return "";
  const map: Record<number, string> = { 1: "Ann.", 2: "Sem.", 3: "Trim.", 4: "Quad.", 12: "Mens." };
  return map[r] || String(r);
}

function tipoLabel(p: CaricoRawRow): string {
  if (p.is_proroga) return "Proroga";
  if (p.is_regolazione) return "Regolazione";
  if (p.is_appendice_modifica) return "Modifica";
  const isQ = isQuietanzaRow(p) || (Number(p.numero_rata) || 0) > 1;
  if (isQ) {
    const rata = p.numero_rata ?? 1;
    const tot = p.numero_rate_totali;
    if (tot != null && tot > 0) return `Quietanza ${rata}/${tot}`;
    return "Quietanza";
  }
  return "Polizza";
}

export function mapCaricoExportRow(
  p: CaricoRawRow,
  ufficiById?: Map<string, string>,
  provvProdLookup?: import("@/lib/provvigioneProduttore").ProvvigioneProduttoreLookup | null,
): CaricoExportRow {
  const polizza = p.titolo_derivato_numero || p.numero_titolo || "";
  const sede = (p.ufficio_id && ufficiById?.get(p.ufficio_id)) || "";

  const dates = datePeriodoPolizzaGaranzia(p);
  return {
    polizza,
    tipo: tipoLabel(p),
    cliente: p.cliente_nome_display || "",
    agenzia: p.compagnia_nome || "",
    sede,
    garanzia: p.ramo_nome || "",
    inizioPolizza: isPolizzaMadreRow(p) ? fmtDate(dates.inizioPolizza) : "—",
    finePolizza: isPolizzaMadreRow(p) ? fmtDate(dates.finePolizza) : "—",
    inizioGaranzia: fmtDate(dates.inizioGaranzia),
    fineGaranzia: fmtDate(dates.fineGaranzia),
    targa: p.targa_telaio || "",
    frazionamento: frazLabel(p.rate),
    premio: Number(p.premio_lordo) || 0,
    provvigione: getProvvigioneEC(p),
    provvigioneProduttore: (() => {
      const n = provvigioneProduttoreForRow(p, provvProdLookup);
      return n == null ? "" : n;
    })(),
    ae: p.ae_nome || "",
    produttore: p.produttori_display || p.produttore_nome || "",
    stato: displayStatoPolizza(p),
    copertura: fmtDate(p.data_copertura),
    messaACassa: fmtDate(p.data_messa_cassa),
  };
}

export function mapCaricoExportRows(
  rows: CaricoRawRow[],
  ufficiById?: Map<string, string>,
  provvProdLookup?: import("@/lib/provvigioneProduttore").ProvvigioneProduttoreLookup | null,
): CaricoExportRow[] {
  return rows.map((r) => mapCaricoExportRow(r, ufficiById, provvProdLookup));
}
