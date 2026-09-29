import * as XLSX from "xlsx";

export function exportJsonToXlsx(
  rows: Record<string, string | number | null | undefined>[],
  sheetName: string,
  fileName: string,
) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, fileName.endsWith(".xlsx") ? fileName : `${fileName}.xlsx`);
}
