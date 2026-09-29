import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { pivotToSheetRows, type EstrazionePivotRow } from "./pivot";

export interface EstrazioneSheet {
  name: string;
  rows: Record<string, string | number | null>[];
}

export interface ExportEstrazioneWorkbookOpts {
  title: string;
  subtitle?: string;
  metaRows?: (string | number)[][];
  filtri?: Record<string, string>;
  commentary?: string;
  dettaglio: EstrazioneSheet;
  pivots?: { dimensione: string; rows: EstrazionePivotRow[] }[];
  fileName: string;
}

export function exportEstrazioneWorkbook(opts: ExportEstrazioneWorkbookOpts) {
  const wb = XLSX.utils.book_new();

  const meta: (string | number)[][] = [
    [opts.title],
    ...(opts.subtitle ? [[opts.subtitle]] : []),
    ["Generato il", format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })],
    ...(opts.metaRows || []),
  ];
  if (opts.commentary) {
    meta.push([], ["Commento analisi"], [opts.commentary]);
  }
  if (opts.filtri && Object.keys(opts.filtri).length) {
    meta.push([], ["Filtri applicati"]);
    for (const [k, v] of Object.entries(opts.filtri)) {
      if (v) meta.push([k, v]);
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(meta), "Riepilogo");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(opts.dettaglio.rows),
    opts.dettaglio.name.slice(0, 31),
  );

  for (const p of opts.pivots || []) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(pivotToSheetRows(p.rows, p.dimensione)),
      `Pivot ${p.dimensione}`.slice(0, 31),
    );
  }

  const fileName = opts.fileName.endsWith(".xlsx") ? opts.fileName : `${opts.fileName}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
