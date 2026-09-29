/**
 * Esporta Excel anagrafiche non importate dal report JSON.
 * Copia anche PDF + Excel in public/reports/import-clienti/ per download da CBnet.
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";

const REPORT_JSON = path.resolve(process.cwd(), "scripts/output/import-clienti-report.json");
const OUTPUT_XLSX = path.resolve(process.cwd(), "scripts/output/Anagrafiche-Non-Importate-2026-07-14.xlsx");
const PUBLIC_DIR = path.resolve(process.cwd(), "public/reports/import-clienti");
const PDF_SRC = path.resolve(process.cwd(), "scripts/output/Report-Import-Clienti-2026-07-14.pdf");

function mapRow(row, fase) {
  return {
    Fase: fase,
    "Riga Excel": row.riga_excel ?? "",
    Codice: row.codice ?? "",
    Nome: row.nome ?? "",
    "F/G": row.tipo ?? "",
    CF: row.cf ?? "",
    "P.IVA": row.piva ?? "",
    Email: row.email ?? "",
    Tel: row.tel ?? "",
    Indirizzo: row.indirizzo ?? "",
    Cap: row.cap ?? "",
    Comune: row.comune ?? "",
    Prov: row.prov ?? "",
    GruFin: row.gru_fin ?? "",
    GruStat: row.gru_stat ?? "",
    Stato: row.stato ?? "",
    Motivo: row.motivo ?? "",
  };
}

function main() {
  if (!fs.existsSync(REPORT_JSON)) {
    throw new Error(`Report non trovato: ${REPORT_JSON}`);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));
  const rows = [
    ...(report.non_importate_validazione || []).map((r) => mapRow(r, "Validazione pre-import")),
    ...(report.non_importate_db || []).map((r) => mapRow(r, "Errore database")),
    ...(report.saltate_esistenti || []).map((r) => mapRow(r, "Già presente in CBnet")),
  ];

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 22 }, { wch: 10 }, { wch: 10 }, { wch: 36 }, { wch: 5 },
    { wch: 18 }, { wch: 14 }, { wch: 32 }, { wch: 14 }, { wch: 28 },
    { wch: 8 }, { wch: 22 }, { wch: 6 }, { wch: 22 }, { wch: 18 },
    { wch: 12 }, { wch: 60 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Non importate");

  const riepilogo = XLSX.utils.json_to_sheet(
    Object.entries(report.summary || {}).map(([Metrica, Valore]) => ({ Metrica, Valore })),
  );
  XLSX.utils.book_append_sheet(wb, riepilogo, "Riepilogo");

  XLSX.writeFile(wb, OUTPUT_XLSX);
  console.log("Excel:", OUTPUT_XLSX);
  console.log("Righe non importate:", rows.length);

  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(OUTPUT_XLSX, path.join(PUBLIC_DIR, "Anagrafiche-Non-Importate.xlsx"));

  if (fs.existsSync(PDF_SRC)) {
    fs.copyFileSync(PDF_SRC, path.join(PUBLIC_DIR, "Report-Import-Clienti.pdf"));
    console.log("PDF copiato in public/reports/import-clienti/");
  }

  fs.copyFileSync(OUTPUT_XLSX, path.join(PUBLIC_DIR, "Anagrafiche-Non-Importate.xlsx"));
  console.log("Download app: /reports/import-clienti/Report-Import-Clienti.pdf");
  console.log("Download app: /reports/import-clienti/Anagrafiche-Non-Importate.xlsx");

  const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
  if (fs.existsSync(downloads)) {
    fs.copyFileSync(OUTPUT_XLSX, path.join(downloads, "Anagrafiche-Non-Importate-2026-07-14.xlsx"));
    if (fs.existsSync(PDF_SRC)) {
      fs.copyFileSync(PDF_SRC, path.join(downloads, "Report-Import-Clienti-2026-07-14.pdf"));
    }
    console.log("Copiato anche in Downloads utente");
  }
}

main();
