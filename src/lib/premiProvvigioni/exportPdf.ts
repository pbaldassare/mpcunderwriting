import { format } from "date-fns";
import { buildEstrazionePdf, downloadEstrazionePdf } from "@/lib/estrazioni/exportPdf";
import type { PremiProvvigioniRow } from "./columns";
import {
  buildPremiProvvigioniCommentary,
  pivotPremiPerCompagnia,
  pivotPremiPerProduttore,
  totaliPremiProvvigioni,
} from "./pivot";

export async function buildPremiProvvigioniPdf(
  rows: PremiProvvigioniRow[],
  periodoLabel: string,
  criterioLabel?: string,
  periodoBase?: string,
): Promise<Uint8Array> {
  const tot = totaliPremiProvvigioni(rows);
  const fmt = (n: number) => n.toLocaleString("it-IT", { style: "currency", currency: "EUR" });

  return buildEstrazionePdf({
    title: "Report Premi e Provvigioni",
    subtitle: `Periodo: ${periodoLabel}`,
    kpis: [
      { label: "Titoli", value: String(tot.nRighe) },
      { label: "Premio", value: fmt(tot.totPremio) },
      { label: "Incassato", value: fmt(tot.totIncassato) },
      { label: "Provv. passive", value: fmt(tot.totProvvPassive) },
    ],
    commentary: buildPremiProvvigioniCommentary(rows, periodoBase ?? periodoLabel, criterioLabel),
    pivotTables: [
      { title: "Pivot per Compagnia", rows: pivotPremiPerCompagnia(rows) },
      { title: "Pivot per Produttore", rows: pivotPremiPerProduttore(rows) },
    ],
  });
}

export function downloadPremiProvvigioniPdf(bytes: Uint8Array) {
  downloadEstrazionePdf(bytes, `report_premi_provvigioni_${format(new Date(), "yyyyMMdd")}.pdf`);
}
