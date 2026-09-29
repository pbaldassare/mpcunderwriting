/**
 * Report finale import rinnovi: PDF + Excel (cosa manca) + copia in public/Downloads.
 *
 * Uso: node scripts/generate-rinnovi-import-report.mjs
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const DATE_TAG = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/output");
const ANALYZE_JSON = path.join(OUTPUT_DIR, "analyze-rinnovi-report.json");
const IMPORT_JSON = path.join(OUTPUT_DIR, `import-rinnovi-report-${DATE_TAG}.json`);
const REPORT_JSON = path.join(OUTPUT_DIR, "import-rinnovi-report-final.json");
const REPORT_PDF = path.join(OUTPUT_DIR, `Report-Import-Rinnovi-${DATE_TAG}.pdf`);
const REPORT_XLSX = path.join(OUTPUT_DIR, `Rinnovi-Non-Importati-${DATE_TAG}.xlsx`);
const PUBLIC_DIR = path.resolve(process.cwd(), "public/reports/import-rinnovi");

function findImportJson() {
  if (fs.existsSync(IMPORT_JSON)) return IMPORT_JSON;
  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith("import-rinnovi-report-") && f.endsWith(".json") && !f.includes("-final"));
  if (!files.length) throw new Error("Report import mancante — eseguire import-rinnovi-batch.mjs");
  files.sort();
  return path.join(OUTPUT_DIR, files[files.length - 1]);
}

function categorizeMissing(row) {
  const p = (row.problemi || []).join(" ");
  if (p.includes("Appendice")) return "Appendice (manuale)";
  if (p.includes("Codice cliente mancante")) return "Codice cliente mancante";
  if (p.includes("Cliente non trovato")) return "Cliente non trovato in CBnet";
  if (p.includes("Agenzia non collegata") || p.includes("Match agenzia incerto")) return "Agenzia non collegata / match incerto";
  if (p.includes("Ramo non trovato")) return "Ramo non trovato";
  if (p.includes("Codice fiscale placeholder")) return "CF placeholder/errato";
  if (p.includes("Account Executive")) return "Account Executive diverso";
  if (p.includes("Filiale non SD")) return "Filiale non SDO";
  if (p.includes("duplicata nel file")) return "Polizza duplicata nel file";
  return "Altro";
}

function buildReport() {
  const analyze = JSON.parse(fs.readFileSync(ANALYZE_JSON, "utf8"));
  const imp = JSON.parse(fs.readFileSync(findImportJson(), "utf8"));

  const allRows = analyze.rows || [];
  const importedPairs = new Set(
    (imp.imported || [])
      .filter((x) => x.ruolo === "quietanza" || (x.dry_run && x.quietanza))
      .map((x) => x.numero_titolo || x.polizza)
      .filter(Boolean),
  );
  for (const x of imp.imported || []) {
    if (x.numero_titolo) importedPairs.add(x.numero_titolo);
  }

  const importate = allRows.filter((r) => r.prontoImport);
  const nonImportate = allRows.filter((r) => !r.prontoImport);
  const appendici = nonImportate.filter((r) => r.importKind === "appendice");
  const altreNonImportate = nonImportate.filter((r) => r.importKind !== "appendice");

  const byCategoria = {};
  for (const r of nonImportate) {
    const cat = categorizeMissing(r);
    byCategoria[cat] = (byCategoria[cat] || 0) + 1;
  }

  const madriImportate = (imp.imported || []).filter((x) => x.ruolo === "madre").length;
  const quietImportate = (imp.imported || []).filter((x) => x.ruolo === "quietanza").length;
  const quietIncassate = importate.filter((r) => r.quietanzaIncasso).length;

  return {
    generated_at: new Date().toISOString(),
    source_files: {
      analisi: ANALYZE_JSON,
      import: findImportJson(),
    },
    summary: {
      "Righe Excel totali": analyze.summary?.righeTotali ?? allRows.length,
      "Polizze uniche file": analyze.summary?.polizzeUniche ?? "—",
      "Coppie pronte (analisi)": analyze.summary?.coppiePronteImport ?? importate.length,
      "Coppie importate con successo": importate.length,
      "Titoli creati (madri)": madriImportate,
      "Titoli creati (quietanze)": quietImportate,
      "Titoli saltati (già presenti)": (imp.skipped || []).length,
      "Errori import DB": (imp.failed || []).length,
      "Righe NON importate": nonImportate.length,
      "— Appendici (manuale)": appendici.length,
      "— Altro bloccato": altreNonImportate.length,
      "Quietanze con incasso (file)": analyze.summary?.quietanzeConIncasso ?? quietIncassate,
      Modello: "madre + quietanza (incasso solo quietanza)",
      Sede: "SDO — San Donà di Piave",
      Specialist: "Maria Midena",
    },
    categorie_mancanti: byCategoria,
    importate: importate.map((r) => ({
      riga_excel: r.riga,
      polizza: r.polizza,
      codice: r.codice,
      nome: r.nome,
      compagnia: r.compagniaNome,
      lordo: r.lordo,
      incasso: r.quietanzaIncasso ? "Sì" : "No",
      madre: r.madreAzione,
      quietanza: r.quietanzaAzione,
    })),
    non_importate: nonImportate.map((r) => ({
      riga_excel: r.riga,
      categoria: categorizeMissing(r),
      st: r.st,
      codice: r.codice,
      cod_fiscale: r.codFiscale,
      nome: r.nome,
      polizza: r.polizza,
      gruppo: r.gruppo,
      ramo: r.ramo,
      compagnia_excel: r.compagniaExcel,
      compagnia_cbnet: r.compagniaNome || "",
      lordo: r.lordo,
      tipo_rinnovo: r.tipoRinnovo,
      problemi: (r.problemi || []).join(" | "),
      avvisi: (r.avvisi || []).join(" | "),
    })),
    import_db: {
      imported: imp.imported || [],
      skipped: imp.skipped || [],
      failed: imp.failed || [],
    },
  };
}

function sanitizePdf(text) {
  return String(text ?? "")
    .replace(/→/g, "->")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function wrapText(text, font, size, maxWidth) {
  text = sanitizePdf(text);
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

  const addPageIfNeeded = (needed = 12) => {
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

  drawText("CONSULNET / CBnet — Report importazione Rinnovi", { size: 14, bold: true });
  drawText(`Generato: ${report.generated_at}`, { size: 9 });
  drawText(`Analisi: ${path.basename(report.source_files.analisi)}`, { size: 8 });
  drawText(`Import: ${path.basename(report.source_files.import)}`, { size: 8 });
  y -= 4;

  drawText("RIEPILOGO", { size: 12, bold: true, color: rgb(0.15, 0.35, 0.65) });
  for (const [k, v] of Object.entries(report.summary)) {
    drawText(`${k}: ${v}`, { size: 9 });
  }
  y -= 4;

  drawText("NON IMPORTATE — Per categoria", { size: 11, bold: true, color: rgb(0.6, 0.2, 0.15) });
  for (const [cat, n] of Object.entries(report.categorie_mancanti).sort((a, b) => b[1] - a[1])) {
    drawText(`• ${cat}: ${n}`, { size: 9 });
  }
  y -= 4;

  const sections = [
    {
      title: "NON IMPORTATE — Dettaglio (prime 120 righe)",
      rows: report.non_importate.slice(0, 120),
      fmt: (r) =>
        `R.${r.riga_excel} [${r.categoria}] ${r.polizza} | ${r.codice} ${r.nome?.slice(0, 40)} | ${r.problemi.slice(0, 120)}`,
    },
    {
      title: "IMPORTATE — Campione (prime 40)",
      rows: report.importate.slice(0, 40),
      fmt: (r) =>
        `R.${r.riga_excel} ${r.polizza} | ${r.nome?.slice(0, 35)} | €${r.lordo} inc.${r.incasso}`,
    },
  ];

  for (const section of sections) {
    y -= 6;
    drawText(section.title, { size: 11, bold: true, color: rgb(0.15, 0.35, 0.65) });
    drawText(`Totale sezione: ${section.rows.length}`, { size: 8 });
    if (!section.rows.length) {
      drawText("(nessuna)", { size: 9 });
      continue;
    }
    for (const r of section.rows) {
      drawText(section.fmt(r), { size: 8 });
    }
  }

  const pdfBytes = await doc.save();
  fs.writeFileSync(REPORT_PDF, pdfBytes);
}

function buildExcel(report) {
  const nonImpSheet = report.non_importate.map((r) => ({
    Categoria: r.categoria,
    "Riga Excel": r.riga_excel,
    St: r.st,
    Codice: r.codice,
    "Cod. Fiscale": r.cod_fiscale,
    Nome: r.nome,
    Polizza: r.polizza,
    Gruppo: r.gruppo,
    Ramo: r.ramo,
    "Compagnia (file)": r.compagnia_excel,
    "Compagnia CBnet": r.compagnia_cbnet,
    Lordo: r.lordo,
    "Tipo Rinnovo": r.tipo_rinnovo,
    Problemi: r.problemi,
    Avvisi: r.avvisi,
  }));

  const importateSheet = report.importate.map((r) => ({
    "Riga Excel": r.riga_excel,
    Polizza: r.polizza,
    Codice: r.codice,
    Nome: r.nome,
    Compagnia: r.compagnia,
    Lordo: r.lordo,
    Incasso: r.incasso,
    Madre: r.madre,
    Quietanza: r.quietanza,
  }));

  const riepilogo = [
    ...Object.entries(report.summary).map(([Metrica, Valore]) => ({ Metrica, Valore: String(Valore) })),
    { Metrica: "—", Valore: "—" },
    ...Object.entries(report.categorie_mancanti)
      .sort((a, b) => b[1] - a[1])
      .map(([Metrica, Valore]) => ({ Metrica: `Mancante: ${Metrica}`, Valore: String(Valore) })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(riepilogo), "Riepilogo");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(nonImpSheet), "Non importate");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importateSheet), "Importate");
  XLSX.writeFile(wb, REPORT_XLSX);
}

function copyOutputs() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  fs.copyFileSync(REPORT_PDF, path.join(PUBLIC_DIR, "Report-Import-Rinnovi.pdf"));
  fs.copyFileSync(REPORT_XLSX, path.join(PUBLIC_DIR, "Rinnovi-Non-Importati.xlsx"));
  fs.copyFileSync(REPORT_JSON, path.join(PUBLIC_DIR, "import-rinnovi-report-final.json"));

  const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
  if (fs.existsSync(downloads)) {
    fs.copyFileSync(REPORT_PDF, path.join(downloads, path.basename(REPORT_PDF)));
    fs.copyFileSync(REPORT_XLSX, path.join(downloads, path.basename(REPORT_XLSX)));
    console.log("Copiato in Downloads utente");
  }
}

async function main() {
  if (!fs.existsSync(ANALYZE_JSON)) {
    throw new Error(`Analisi mancante: ${ANALYZE_JSON}`);
  }

  const report = buildReport();
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  await buildPdf(report);
  buildExcel(report);
  copyOutputs();

  console.log("Report JSON:", REPORT_JSON);
  console.log("Report PDF:", REPORT_PDF);
  console.log("Excel non importate:", REPORT_XLSX);
  console.log("\nDownload da CBnet:");
  console.log("  /reports/import-rinnovi/Report-Import-Rinnovi.pdf");
  console.log("  /reports/import-rinnovi/Rinnovi-Non-Importati.xlsx");
  console.log("\nRiepilogo:", JSON.stringify(report.summary, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
