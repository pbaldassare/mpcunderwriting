import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { TITOLI_DA_INCASSARE_COLUMNS, type TitoloDaIncassareRow } from "./columns";
import {
  buildPivotCommentary,
  pivotPerCliente,
  pivotPerCompagnia,
  pivotPerProduttore,
  pivotPerRamo,
  pivotPerSede,
  totaliPivot,
  type PivotRow,
} from "./pivot";

function rowsToSheet(rows: TitoloDaIncassareRow[]) {
  return rows.map((r) => {
    const o: Record<string, string | number | null> = {};
    for (const col of TITOLI_DA_INCASSARE_COLUMNS) {
      o[col.header] = r[col.key];
    }
    return o;
  });
}

function pivotToSheet(pivot: PivotRow[], dimensione: string) {
  return pivot.map((p) => ({
    [dimensione]: p.chiave,
    "N. Titoli": p.nTitoli,
    "Totale Premio (€)": Number(p.totPremio.toFixed(2)),
    "Provv. Attive (€)": Number(p.totProvvAttive.toFixed(2)),
    "Provv. Passive (€)": Number(p.totProvvPassive.toFixed(2)),
  }));
}

export interface ExportTitoliDaIncassareOpts {
  meseLabel: string;
  filtri?: Record<string, string>;
}

export function exportTitoliDaIncassareXlsx(
  rows: TitoloDaIncassareRow[],
  opts: ExportTitoliDaIncassareOpts,
) {
  const wb = XLSX.utils.book_new();
  const tot = totaliPivot(rows);

  const meta: (string | number)[][] = [
    ["Titoli da incassare — Consulnet"],
    ["Competenza", opts.meseLabel],
    ["Generato il", format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })],
    [],
    ["N. titoli", tot.nTitoli],
    ["Totale premio (€)", Number(tot.totPremio.toFixed(2))],
    ["Provv. attive (€)", Number(tot.totProvvAttive.toFixed(2))],
    ["Provv. passive (€)", Number(tot.totProvvPassive.toFixed(2))],
    ["In copertura garantita", tot.nGarantiti],
    [],
    ["Commento analisi"],
    [buildPivotCommentary(rows, opts.meseLabel)],
  ];
  if (opts.filtri && Object.keys(opts.filtri).length) {
    meta.push([], ["Filtri applicati"]);
    for (const [k, v] of Object.entries(opts.filtri)) {
      if (v) meta.push([k, v]);
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Riepilogo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsToSheet(rows)), "Dettaglio");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotToSheet(pivotPerCompagnia(rows), "Compagnia")), "Pivot Compagnia");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotToSheet(pivotPerCliente(rows), "Cliente")), "Pivot Cliente");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotToSheet(pivotPerSede(rows), "Sede")), "Pivot Sede");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pivotToSheet(pivotPerRamo(rows), "Ramo")), "Pivot Ramo");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(pivotToSheet(pivotPerProduttore(rows), "Produttore")),
    "Pivot Produttore",
  );

  const slug = opts.meseLabel.replace(/\s+/g, "_").replace(/\//g, "-");
  XLSX.writeFile(wb, `titoli_da_incassare_${slug}_${format(new Date(), "yyyyMMdd")}.xlsx`);
}
