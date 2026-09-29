import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = path.resolve("scripts/output");
const DATE_TAG = "2026-07-14";
const REPORT_JSON = path.join(OUT, "import-compagnie-report.json");
const REPORT_PDF = path.join(OUT, `Report-Import-Compagnie-${DATE_TAG}.pdf`);
const XLSX_NON_IMPORTATE = path.join(OUT, `Compagnie-Non-Importate-${DATE_TAG}.xlsx`);
const XLSX_NON_CONGIUNTE = path.join(OUT, `Compagnie-Non-Congiunte-${DATE_TAG}.xlsx`);

function wrapText(text, font, size, maxWidth) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) current = test;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function buildPdf(report) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageW = 595;
  const pageH = 842;
  const margin = 40;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const addPageIfNeeded = (needed = 11) => {
    if (y - needed < margin) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };
  const drawText = (text, opts = {}) => {
    const size = opts.size ?? 9;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    for (const chunk of wrapText(text, f, size, pageW - margin * 2)) {
      addPageIfNeeded(size + 2);
      page.drawText(chunk, { x: margin, y, size, font: f, color });
      y -= size + 2;
    }
  };
  const drawLine = () => {
    addPageIfNeeded(8);
    page.drawLine({
      start: { x: margin, y: y + 4 },
      end: { x: pageW - margin, y: y + 4 },
      thickness: 0.5,
      color: rgb(0.75, 0.75, 0.75),
    });
    y -= 6;
  };

  drawText("CONSULNET / CBnet — Report importazione agenzie / plurimandatarie", { size: 14, bold: true });
  drawText(`Data/ora: ${report.generated_at}`, { size: 9 });
  drawLine();
  drawText("RIEPILOGO", { size: 12, bold: true });
  for (const [k, v] of Object.entries(report.summary)) drawText(`${k}: ${v}`, { size: 9 });
  drawLine();

  const sections = [
    { title: "NON IMPORTATE — Validazione", rows: report.non_importate_validazione || [], columns: ["riga_excel", "codice", "nome", "motivo"] },
    { title: "NON IMPORTATE — Database", rows: report.non_importate_db || [], columns: ["codice", "nome", "motivo"] },
    { title: "NON CONGIUNTE", rows: report.non_congiunte || [], columns: ["codice", "nome", "gruppo_excel", "motivo"] },
    { title: "IBAN NON COLLEGATI", rows: report.iban_skipped || [], columns: ["codice", "iban", "motivo"] },
    { title: "IMPORTATE (campione 150)", rows: (report.importate || []).slice(0, 150), columns: ["codice", "id", "nome", "gruppo_label"] },
  ];

  for (const s of sections) {
    drawText(s.title, { size: 11, bold: true, color: rgb(0.15, 0.35, 0.65) });
    drawText(`Totale: ${s.rows.length}`, { size: 8 });
    drawLine();
    if (!s.rows.length) drawText("Nessuna riga.", { size: 9 });
    else for (const row of s.rows) drawText(s.columns.map((c) => `${c}=${row[c] ?? "—"}`).join(" | "), { size: 7.5 });
    drawLine();
  }
  return doc.save();
}

function writeExcels(report) {
  const nonImp = [
    ...(report.non_importate_validazione || []).map((r) => ({ Fase: "Validazione", Codice: r.codice, Nome: r.nome, Motivo: r.motivo })),
    ...(report.non_importate_db || []).map((r) => ({ Fase: "Database", Codice: r.codice, Nome: r.nome, Motivo: r.motivo })),
  ];
  const wb1 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb1, XLSX.utils.json_to_sheet(nonImp), "Non importate");
  XLSX.utils.book_append_sheet(wb1, XLSX.utils.json_to_sheet(Object.entries(report.summary).map(([Metrica, Valore]) => ({ Metrica, Valore }))), "Riepilogo");
  XLSX.writeFile(wb1, XLSX_NON_IMPORTATE);

  const nonCong = (report.non_congiunte || []).map((r) => ({
    Codice: r.codice, Nome: r.nome, GruppoExcel: r.gruppo_excel, Motivo: r.motivo,
  }));
  const wb2 = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(nonCong), "Non congiunte");
  if (report.iban_skipped?.length) {
    XLSX.utils.book_append_sheet(wb2, XLSX.utils.json_to_sheet(report.iban_skipped.map((r) => ({ Codice: r.codice, IBAN: r.iban, Motivo: r.motivo }))), "IBAN non collegati");
  }
  XLSX.writeFile(wb2, XLSX_NON_CONGIUNTE);
}

const report = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));
const pdf = await buildPdf(report);
fs.writeFileSync(REPORT_PDF, pdf);
writeExcels(report);

const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
for (const f of [REPORT_PDF, XLSX_NON_IMPORTATE, XLSX_NON_CONGIUNTE]) {
  fs.copyFileSync(f, path.join(downloads, path.basename(f)));
}
console.log("PDF:", REPORT_PDF);
console.log("Excel non importate:", XLSX_NON_IMPORTATE);
console.log("Excel non congiunte:", XLSX_NON_CONGIUNTE);
