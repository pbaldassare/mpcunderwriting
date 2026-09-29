/**
 * Import incrementale agenzie/plurimandatarie da Excel CBnet legacy.
 * Merge Compagnie.xlsx + Compagnie_INTERMEDIA.xlsx, report PDF + Excel.
 *
 * Uso:
 *   node scripts/import-compagnie-excel.mjs
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const EXCEL_MAIN =
  process.argv[2] ||
  "C:\\Users\\Utente\\Downloads\\Compagnie_20260714085952.xlsx";
const EXCEL_INTERMEDIA =
  process.argv[3] ||
  "C:\\Users\\Utente\\Downloads\\Compagnie_INTERMEDIA.xlsx";

const BATCH_SIZE = 25;
const DATE_TAG = new Date().toISOString().slice(0, 10);
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts", "output");
const REPORT_JSON = path.join(OUTPUT_DIR, "import-compagnie-report.json");
const REPORT_PDF = path.join(OUTPUT_DIR, `Report-Import-Compagnie-${DATE_TAG}.pdf`);
const XLSX_NON_IMPORTATE = path.join(OUTPUT_DIR, `Compagnie-Non-Importate-${DATE_TAG}.xlsx`);
const XLSX_NON_CONGIUNTE = path.join(OUTPUT_DIR, `Compagnie-Non-Congiunte-${DATE_TAG}.xlsx`);

const EXCEL_TO_DB = {
  "Generali Italia S.p.a.": "GENERALI ITALIA",
  "Generali Italia Spa": "GENERALI ITALIA",
  "Generali Div. Cattolica": "Generali Div. Cattolica",
  "Allianz Assicurazioni": "ALLIANZ",
  "Allianz Viva Spa": "Allianz Viva Spa",
  "Unipol Assicurazioni S.p.a.": "Unipol Assicurazioni S.p.a.",
  "Itas Mutua": "Itas Mutua",
  "Reale Mutua Assicurazioni": "REALE MUTUA",
  "Societa' Reale Mutua Assicurazioni": "Societa' Reale Mutua di Assicurazioni",
  "Italiana Assicurazioni": "Italiana Assicurazioni",
  Plurimandatario: "Da definire",
  "Vittoria Ass.ni": "Vittoria Ass.ni",
  "Sara Ass.ni": "Sara Ass.ni",
  "Axa Assicurazioni": "AXA",
  "Axa Assistance": "Axa Assistance",
  "Zurich Insurance Company Ltd": "Zurich Insurance Company Ltd",
  "Hdi Assicurazioni Spa": "Hdi Assicurazioni Spa",
  "Hdi Global Se": "Hdi Global Se",
  "Helvetia Assicurazioni": "HELVETIA",
  "Coface Assicurazioni": "COFACE",
  "Sace Bt Spa": "Sace Bt Spa",
  "Lloyd Italico": "Lloyd Italico",
  "Liguria Assicurazioni": "Liguria Assicurazioni",
  "Lloyd Adriatico": "Lloyd Adriatico",
  "D.a.s": "DAS",
  "D.a.s.": "DAS",
  "Filo Diretto": "Filo Diretto",
  "Cattolica Assicurazioni": "CATTOLICA",
  "Societa' Cattolica Di Assicurazione": "Societa' Cattolica Di Assicurazione",
  "Arag Assicurazioni": "ARAG",
  "Giuliana Ass.ni": "Giuliana Ass.ni",
  "Chubb Insurance": "CHUBB",
  Viscontea: "Viscontea",
  "Europ Assistance Italia Spa": "EUROP ASSISTANCE ITALIA",
  "British Marine": "British Marine",
  Roland: "ROLAND",
  "Milano Divisione Nuova Maa Assicurazioni": "Milano Divisione Nuova Maa Assicurazioni",
  "Amissima Assicurazioni": "AMISSIMA",
  "Nuova Tirrena Ass.ni": "Nuova Tirrena Ass.ni",
  "Faro Ass.ni": "Faro Ass.ni",
  Genertel: "Genertel",
  "Convenzione Fimmg": "Convenzione Fimmg",
  "Balcia Insurance Se": "Balcia Insurance Se",
  "Amtrust Assicurazioni Spa": "Amtrust Assicurazioni Spa",
  Aig: "AIG",
  "Poste Vita Spa": "Poste Vita Spa",
  "Great Lakes Insurance Re": "Great Lakes Insurance Re",
  Assimoco: "ASSIMOCO",
  "Assicuratrice Milanese": "ASSICURATRICE MILANESE",
  "Liberty Mutual Insurance Europe S.e.": "Liberty Mutual Insurance Europe S.e.",
  "Argoglobal Assicurazioni Spa": "Argoglobal Assicurazioni Spa",
  "Bene Assicurazioni": "BENE",
  "Revo Insurance S.p.a.": "REVO",
  "Uca Assicurazioni S.p.a.": "Uca Assicurazioni S.p.a.",
  "Groupama Assicurazioni Spa": "Groupama Assicurazioni Spa",
  "Tutela Legale Spa": "Tutela Legale Spa",
  "Qbe Europe Sa/nv": "Qbe Europe Sa/nv",
  "S2c Spa": "S2C",
  "Lloyd's": "Lloyd's",
};

function normKey(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function parsePercent(raw) {
  const s = String(raw ?? "").trim().replace(",", ".");
  if (!s) return 4.6;
  const n = Number(s);
  return Number.isFinite(n) ? n : 4.6;
}

function normalizeIban(raw) {
  if (!raw) return { valid: null, raw: "" };
  const iban = String(raw).trim().toUpperCase().replace(/\s+/g, "");
  if (iban.startsWith("IT") && iban.length === 27) return { valid: iban, raw: iban };
  return { valid: null, raw: iban };
}

function normalizeRow(row, source, rigaExcel) {
  const get = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  const ibanInfo = normalizeIban(get("IBAN"));
  const stato = get("Stato");
  const nome = get("Nome");
  const nomeSegue = get("Nome_segue", "Nome segue");

  return {
    riga_excel: rigaExcel,
    source_file: source,
    codice: get("Codice"),
    nome,
    nome_segue: nomeSegue,
    indirizzo: get("Indirizzo"),
    cap: get("Cap"),
    comune: get("Comune"),
    prov: get("Prov"),
    tel: get("Tel"),
    fax: get("Fax"),
    cf: get("CF"),
    piva: get("PIva", "Piva"),
    stato,
    attiva: stato.toLowerCase() !== "non operativo",
    gruppo_compagnia_excel: get("GruppoCompagnia"),
    tipo_mandatario: get("TipoMandatario"),
    gruppo_statistico: get("GruppoStatistico"),
    mail: get("Mail"),
    pec: get("Pec"),
    mail_ec: get("MailEC"),
    mail_avvisi: get("MailAvvisi"),
    percentuale_ra: parsePercent(row["%RA"]),
    iban: ibanInfo.valid,
    iban_raw: ibanInfo.raw,
    intestato_a: get("IntestatoA"),
  };
}

function mergeExcelFiles(mainPath, intermediaPath) {
  const merged = new Map();

  const readFile = (filePath, label) => {
    const wb = XLSX.readFile(filePath);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    rows.forEach((row, i) => {
      const norm = normalizeRow(row, path.basename(filePath), i + 2);
      if (!norm.codice) return;
      merged.set(norm.codice, norm);
    });
    console.log(`${label}: ${rows.length} righe`);
  };

  readFile(mainPath, "File principale");
  readFile(intermediaPath, "File intermedia (sovrascrive codici comuni)");

  return [...merged.values()];
}

async function fetchGruppiMap() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/gruppi_compagnia?select=id,codice,descrizione&attivo=eq.true`,
    {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    },
  );
  if (!res.ok) throw new Error(`Fetch gruppi fallito: ${res.status}`);
  const rows = await res.json();
  const byDescrizione = {};
  const byNorm = {};
  for (const g of rows) {
    byDescrizione[g.descrizione] = g.id;
    byNorm[normKey(g.descrizione)] = { id: g.id, descrizione: g.descrizione };
  }
  return { rows, byDescrizione, byNorm };
}

function resolveGruppo(excelName, gruppi) {
  const raw = String(excelName || "").trim();
  if (!raw || normKey(raw) === "plurimandatario") {
    const id = gruppi.byDescrizione["Da definire"];
    return {
      id,
      label: "Da definire",
      excel: raw || "(vuoto)",
      motivo: null,
    };
  }

  if (EXCEL_TO_DB[raw]) {
    const target = EXCEL_TO_DB[raw];
    const id = gruppi.byDescrizione[target];
    if (id) {
      return { id, label: target, excel: raw, motivo: null };
    }
  }

  if (gruppi.byDescrizione[raw]) {
    return { id: gruppi.byDescrizione[raw], label: raw, excel: raw, motivo: null };
  }

  const nk = normKey(raw);
  if (gruppi.byNorm[nk]) {
    const hit = gruppi.byNorm[nk];
    return { id: hit.id, label: hit.descrizione, excel: raw, motivo: null };
  }

  for (const g of gruppi.rows) {
    const gn = normKey(g.descrizione);
    if (gn.includes(nk) || nk.includes(gn)) {
      return { id: g.id, label: g.descrizione, excel: raw, motivo: null };
    }
  }

  return {
    id: null,
    label: null,
    excel: raw,
    motivo: `Gruppo Excel non mappato: "${raw}"`,
  };
}

function validateRow(row, codiceSeen) {
  const issues = [];
  if (!row.codice) issues.push("Codice mancante");
  if (!row.nome && !row.nome_segue) issues.push("Nome e Nome_segue mancanti");
  if (row.codice && codiceSeen.has(row.codice)) {
    issues.push(`Codice duplicato nel merge: ${row.codice}`);
  }
  if (row.codice) codiceSeen.add(row.codice);

  return {
    ...row,
    motivo: issues.join("; "),
    valido: issues.length === 0,
  };
}

function toPayload(row) {
  return {
    codice: row.codice,
    nome: row.nome,
    nome_segue: row.nome_segue,
    indirizzo: row.indirizzo,
    cap: row.cap,
    comune: row.comune,
    prov: row.prov,
    tel: row.tel,
    fax: row.fax,
    cf: row.cf,
    piva: row.piva,
    stato: row.stato,
    attiva: row.attiva,
    gruppo_statistico: row.gruppo_statistico,
    mail: row.mail,
    pec: row.pec,
    mail_ec: row.mail_ec,
    mail_avvisi: row.mail_avvisi,
    percentuale_ra: row.percentuale_ra,
    iban: row.iban,
    iban_raw: row.iban_raw,
    intestato_a: row.intestato_a,
    gruppo_compagnia_excel: row.gruppo_compagnia_excel,
  };
}

async function invokeImportBatch(records) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-compagnie`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      action: "import_batch",
      records,
      options: { skip_existing: true },
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Risposta non JSON (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

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
  const lineH = 11;

  const addPageIfNeeded = (needed = lineH) => {
    if (y - needed < margin) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
  };

  const drawText = (text, opts = {}) => {
    const size = opts.size ?? 9;
    const f = opts.bold ? fontBold : font;
    const color = opts.color ?? rgb(0.1, 0.1, 0.1);
    const chunks = wrapText(text, f, size, pageW - margin * 2);
    for (const chunk of chunks) {
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

  drawText("CONSULNET / CBnet — Report importazione agenzie / plurimandatarie", {
    size: 14,
    bold: true,
  });
  drawText(`File principale: ${report.source_files.main}`, { size: 9 });
  drawText(`File intermedia: ${report.source_files.intermedia}`, { size: 9 });
  drawText(`Data/ora: ${report.generated_at}`, { size: 9 });
  drawText("Modalità: import incrementale (tipo=plurimandataria, rapporti su gruppi assicurativi)", {
    size: 9,
  });
  drawLine();

  drawText("RIEPILOGO", { size: 12, bold: true });
  for (const [k, v] of Object.entries(report.summary)) {
    drawText(`${k}: ${v}`, { size: 9 });
  }
  drawLine();

  const sections = [
    {
      title: "NON IMPORTATE — Validazione pre-import",
      rows: report.non_importate_validazione,
      columns: ["riga_excel", "codice", "nome", "nome_segue", "gruppo_compagnia_excel", "motivo"],
    },
    {
      title: "NON IMPORTATE — Errori database",
      rows: report.non_importate_db,
      columns: ["codice", "nome", "nome_segue", "gruppo_compagnia_excel", "motivo"],
    },
    {
      title: "SALTATE — Codice già presente in CBnet",
      rows: report.saltate_esistenti,
      columns: ["codice", "nome", "compagnia_id", "motivo"],
    },
    {
      title: "NON CONGIUNTE — Senza collegamento a compagnia assicuratrice",
      rows: report.non_congiunte,
      columns: ["codice", "nome", "gruppo_excel", "motivo", "fase"],
    },
    {
      title: "RAPPORTI NON CREATI",
      rows: report.rapporti_failed,
      columns: ["codice", "nome", "gruppo", "motivo"],
    },
    {
      title: "IBAN NON COLLEGATI",
      rows: report.iban_skipped,
      columns: ["codice", "iban", "motivo"],
    },
    {
      title: "IMPORTATE CON SUCCESSO (campione prime 150)",
      rows: report.importate.slice(0, 150),
      columns: ["codice", "id", "nome", "gruppo_label"],
    },
  ];

  for (const section of sections) {
    drawText(section.title, { size: 11, bold: true, color: rgb(0.15, 0.35, 0.65) });
    drawText(`Totale: ${section.rows.length}`, { size: 8 });
    drawLine();
    if (!section.rows.length) {
      drawText("Nessuna riga.", { size: 9 });
      drawLine();
      continue;
    }
    for (const row of section.rows) {
      const parts = section.columns.map((c) => `${c}=${row[c] ?? "—"}`);
      drawText(parts.join(" | "), { size: 7.5 });
    }
    drawLine();
  }

  drawText("Fine report.", { size: 8, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

function writeExcelNonImportate(report, outPath) {
  const rows = [
    ...(report.non_importate_validazione || []).map((r) => ({
      Fase: "Validazione pre-import",
      "Riga Excel": r.riga_excel ?? "",
      File: r.source_file ?? "",
      Codice: r.codice ?? "",
      Nome: r.nome ?? "",
      Nome_segue: r.nome_segue ?? "",
      GruppoCompagnia: r.gruppo_compagnia_excel ?? "",
      Stato: r.stato ?? "",
      IBAN: r.iban_raw ?? "",
      Motivo: r.motivo ?? "",
    })),
    ...(report.non_importate_db || []).map((r) => ({
      Fase: "Errore database",
      "Riga Excel": "",
      File: "",
      Codice: r.codice ?? "",
      Nome: r.nome ?? "",
      Nome_segue: r.nome_segue ?? "",
      GruppoCompagnia: r.gruppo_compagnia_excel ?? "",
      Stato: "",
      IBAN: "",
      Motivo: r.motivo ?? "",
    })),
    ...(report.saltate_esistenti || []).map((r) => ({
      Fase: "Già presente in CBnet",
      "Riga Excel": "",
      File: "",
      Codice: r.codice ?? "",
      Nome: r.nome ?? "",
      Nome_segue: "",
      GruppoCompagnia: "",
      Stato: "",
      IBAN: "",
      Motivo: r.motivo ?? "",
    })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Non importate");
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      Object.entries(report.summary || {}).map(([Metrica, Valore]) => ({ Metrica, Valore })),
    ),
    "Riepilogo",
  );
  XLSX.writeFile(wb, outPath);
}

function writeExcelNonCongiunte(report, outPath) {
  const rows = (report.non_congiunte || []).map((r) => ({
    Codice: r.codice ?? "",
    Nome: r.nome ?? "",
    Nome_segue: r.nome_segue ?? "",
    GruppoExcel: r.gruppo_excel ?? "",
    GruppoCBnet: r.gruppo_cbnet ?? "",
    Fase: r.fase ?? "",
    CompagniaId: r.compagnia_id ?? "",
    Motivo: r.motivo ?? "",
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), "Non congiunte");
  if (report.rapporti_failed?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.rapporti_failed.map((r) => ({
          Codice: r.codice,
          Nome: r.nome,
          Gruppo: r.gruppo,
          Motivo: r.motivo,
        })),
      ),
      "Rapporti falliti",
    );
  }
  if (report.iban_skipped?.length) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(
        report.iban_skipped.map((r) => ({
          Codice: r.codice,
          IBAN: r.iban,
          Motivo: r.motivo,
        })),
      ),
      "IBAN non collegati",
    );
  }
  XLSX.writeFile(wb, outPath);
}

function copyToDownloads(...files) {
  const downloads = path.join(process.env.USERPROFILE || "", "Downloads");
  if (!fs.existsSync(downloads)) return;
  for (const f of files) {
    if (fs.existsSync(f)) {
      fs.copyFileSync(f, path.join(downloads, path.basename(f)));
    }
  }
  console.log("Copiato in Downloads utente");
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configura VITE_SUPABASE_URL e chiave Supabase in .env");
  }
  for (const p of [EXCEL_MAIN, EXCEL_INTERMEDIA]) {
    if (!fs.existsSync(p)) throw new Error(`File Excel non trovato: ${p}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const mergedRows = mergeExcelFiles(EXCEL_MAIN, EXCEL_INTERMEDIA);
  console.log(`Codici unici dopo merge: ${mergedRows.length}`);

  const gruppi = await fetchGruppiMap();
  console.log(`Gruppi compagnia visibili via REST: ${gruppi.rows.length} (risoluzione effettiva lato edge function)`);

  const codiceSeen = new Set();
  const validated = mergedRows.map((row) => validateRow(row, codiceSeen));

  const validRows = validated.filter((r) => r.valido);
  const invalidRows = validated.filter((r) => !r.valido);

  const imported = [];
  const failedDb = [];
  const skippedExisting = [];
  const rapportiCreated = [];
  const rapportiFailed = [];
  const nonCongiunte = [];
  const ibanLinked = [];
  const ibanSkipped = [];

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const chunk = validRows.slice(i, i + BATCH_SIZE);
    const records = chunk.map((r) => toPayload(r));
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(validRows.length / BATCH_SIZE);
    console.log(`Batch ${batchNum}/${totalBatches} (${chunk.length} righe)...`);

    try {
      const result = await invokeImportBatch(records);
      imported.push(...(result.imported || []));
      failedDb.push(...(result.failed || []));
      skippedExisting.push(...(result.skipped || []));
      rapportiCreated.push(...(result.rapporti_created || []));
      rapportiFailed.push(...(result.rapporti_failed || []));
      nonCongiunte.push(...(result.non_congiunte || []));
      ibanLinked.push(...(result.iban_linked || []));
      ibanSkipped.push(...(result.iban_skipped || []));
    } catch (err) {
      console.error(`Errore batch ${batchNum}:`, err.message);
      for (const row of chunk) {
        failedDb.push({
          codice: row.codice,
          nome: row.nome,
          nome_segue: row.nome_segue,
          gruppo_compagnia_excel: row.gruppo_compagnia_excel,
          motivo: `Errore batch: ${err.message}`,
        });
      }
    }
  }

  const report = {
    source_files: { main: EXCEL_MAIN, intermedia: EXCEL_INTERMEDIA },
    generated_at: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
    summary: {
      "Righe uniche dopo merge Excel": mergedRows.length,
      "Scartate in validazione pre-import": invalidRows.length,
      "Inviate a import": validRows.length,
      "Importate con successo (nuove agenzie)": imported.length,
      "Saltate (codice già presente)": skippedExisting.length,
      "Fallite su database": failedDb.length,
      "Rapporti compagnia assicuratrice creati": rapportiCreated.length,
      "Rapporti falliti": rapportiFailed.length,
      "Non congiunte (gruppo non risolto o rapporto fallito)": nonCongiunte.length,
      "IBAN collegati": ibanLinked.length,
      "IBAN non collegati (formato legacy/invalido)": ibanSkipped.length,
    },
    non_importate_validazione: invalidRows,
    non_importate_db: failedDb,
    saltate_esistenti: skippedExisting,
    importate: imported,
    rapporti_created: rapportiCreated,
    rapporti_failed: rapportiFailed,
    non_congiunte: nonCongiunte,
    iban_linked: ibanLinked,
    iban_skipped: ibanSkipped,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  console.log(`Report JSON: ${REPORT_JSON}`);

  const pdfBytes = await buildPdf(report);
  fs.writeFileSync(REPORT_PDF, pdfBytes);
  console.log(`Report PDF: ${REPORT_PDF}`);

  writeExcelNonImportate(report, XLSX_NON_IMPORTATE);
  console.log(`Excel non importate: ${XLSX_NON_IMPORTATE}`);

  writeExcelNonCongiunte(report, XLSX_NON_CONGIUNTE);
  console.log(`Excel non congiunte: ${XLSX_NON_CONGIUNTE}`);

  copyToDownloads(REPORT_PDF, XLSX_NON_IMPORTATE, XLSX_NON_CONGIUNTE);

  console.log("\n=== RIEPILOGO ===");
  for (const [k, v] of Object.entries(report.summary)) {
    console.log(`${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
