import { format } from "date-fns";
import { PREMI_PROVVIGIONI_COLUMNS, type PremiProvvigioniRow } from "./columns";
import {
  buildPremiProvvigioniCommentary,
  pivotPremiPerCliente,
  pivotPremiPerCompagnia,
  pivotPremiPerProduttore,
  pivotPremiPerRamo,
  pivotPremiPerSede,
  totaliPremiProvvigioni,
} from "./pivot";
import { exportEstrazioneWorkbook } from "@/lib/estrazioni/exportXlsx";

function rowsToSheet(rows: PremiProvvigioniRow[]) {
  return rows.map((r) => {
    const o: Record<string, string | number | null> = {};
    for (const col of PREMI_PROVVIGIONI_COLUMNS) {
      o[col.header] = r[col.key];
    }
    return o;
  });
}

export interface ExportPremiProvvigioniOpts {
  periodoLabel: string;
  periodoBase?: string;
  filtri?: Record<string, string>;
  criterioLabel?: string;
}

export function exportPremiProvvigioniXlsx(rows: PremiProvvigioniRow[], opts: ExportPremiProvvigioniOpts) {
  const tot = totaliPremiProvvigioni(rows);

  exportEstrazioneWorkbook({
    title: "Premi e Provvigioni — Consulnet",
    subtitle: `Periodo: ${opts.periodoLabel}`,
    metaRows: [
      [],
      ["N. titoli", tot.nRighe],
      ["Totale premio (€)", Number(tot.totPremio.toFixed(2))],
      ["Totale incassato (€)", Number(tot.totIncassato.toFixed(2))],
      ["Provv. attive (€)", Number(tot.totProvvAttive.toFixed(2))],
      ["Provv. passive (€)", Number(tot.totProvvPassive.toFixed(2))],
      ["Provv. incassate", tot.nIncassate],
      ...(opts.criterioLabel ? [["Criterio data", opts.criterioLabel] as [string, string | number]] : []),
    ],
    filtri: opts.filtri,
    commentary: buildPremiProvvigioniCommentary(rows, opts.periodoBase ?? opts.periodoLabel, opts.criterioLabel),
    dettaglio: { name: "Dettaglio", rows: rowsToSheet(rows) },
    pivots: [
      { dimensione: "Compagnia", rows: pivotPremiPerCompagnia(rows) },
      { dimensione: "Cliente", rows: pivotPremiPerCliente(rows) },
      { dimensione: "Sede", rows: pivotPremiPerSede(rows) },
      { dimensione: "Ramo", rows: pivotPremiPerRamo(rows) },
      { dimensione: "Produttore", rows: pivotPremiPerProduttore(rows) },
    ],
    fileName: `premi_provvigioni_${format(new Date(), "yyyyMMdd")}.xlsx`,
  });
}
