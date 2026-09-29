import * as XLSX from "xlsx";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { CARICO_EXPORT_COLUMNS, type CaricoExportMeta, type CaricoExportRow } from "./columns";

function rowsToSheet(rows: CaricoExportRow[]) {
  return rows.map((r) => {
    const o: Record<string, string | number | null> = {};
    for (const col of CARICO_EXPORT_COLUMNS) {
      o[col.header] = r[col.key];
    }
    return o;
  });
}

export function exportCaricoXlsx(rows: CaricoExportRow[], meta: CaricoExportMeta) {
  const wb = XLSX.utils.book_new();

  const metaRows: (string | number)[][] = [
    ["Carico portafoglio — Consulnet"],
    ["Vista", meta.vista === "incassati" ? "Incassati" : "Pendenti"],
    ["Ambito export", meta.scope === "selezione" ? "Selezione" : "Righe in pagina"],
    ["Generato il", format(new Date(), "dd/MM/yyyy HH:mm", { locale: it })],
    [],
    ["N. righe", meta.nRighe],
    ["Totale premio (€)", Number(meta.totalePremio.toFixed(2))],
    ["Totale provvigioni (€)", Number(meta.totaleProvvigioni.toFixed(2))],
  ];

  if (meta.totaleFiltrate != null && meta.scope === "pagina" && meta.totaleFiltrate > meta.nRighe) {
    metaRows.push(["Totale filtrate (DB)", meta.totaleFiltrate]);
  }

  if (Object.keys(meta.filtri).length) {
    metaRows.push([], ["Filtri applicati"]);
    for (const [k, v] of Object.entries(meta.filtri)) {
      if (v) metaRows.push([k, v]);
    }
  }

  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(metaRows), "Riepilogo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rowsToSheet(rows)), "Dettaglio");

  const slug = meta.vista === "incassati" ? "incassati" : "pendenti";
  XLSX.writeFile(wb, `carico_portafoglio_${slug}_${format(new Date(), "yyyyMMdd_HHmm")}.xlsx`);
}
