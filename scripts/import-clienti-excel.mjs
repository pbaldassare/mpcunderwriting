/**
 * Import massivo clienti da Excel CBnet legacy + report PDF dettagliato.
 *
 * Uso:
 *   node scripts/import-clienti-excel.mjs "C:\path\Clienti_xxx.xlsx"
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

const EXCEL_PATH =
  process.argv[2] ||
  "C:\\Users\\Utente\\Downloads\\Clienti_20260714085817.xlsx";

const BATCH_SIZE = 40;
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts", "output");
const REPORT_JSON = path.join(OUTPUT_DIR, "import-clienti-report.json");
const REPORT_PDF = path.join(
  OUTPUT_DIR,
  `Report-Import-Clienti-${new Date().toISOString().slice(0, 10)}.pdf`,
);

function excelSerialToIso(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(raw)) {
    const [d, m, y] = raw.split("/");
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + n * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

function normalizeRow(row) {
  const get = (...keys) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };

  return {
    codice: get("Codice"),
    nome: get("Nome"),
    indirizzo: get("Indirizzo"),
    cap: get("Cap"),
    comune: get("Comune"),
    prov: get("Prov"),
    email: get("Email"),
    tel: get("Tel"),
    tipo: get("F/G", "F/G"),
    cf: get("CF", "Cf"),
    piva: get("PIva", "Piva", "P.IVA"),
    gru_fin: get("GruFin"),
    gru_stat: get("GruStat"),
    stato: get("Stato") || "Attivo",
    atten_di: get("AttenDi"),
    zona: get("Zona"),
    attivita: get("Attivita"),
    specialist: get("Specialist"),
    brand: get("Brand"),
    unit: get("Unit"),
    prod1: get("Prod1"),
    prod2: get("Prod2"),
    prod3: get("Prod3"),
    acquisito: excelSerialToIso(row["Acquisito"]),
    scad_mandato: excelSerialToIso(row["ScadMandato"] ?? row["Scad Mandato"]),
    specialist_sx: get("SpecialistSx", "Specialist Sx"),
    indotto: get("Indotto"),
    fatturato: get("Fatturato"),
    dipendenti: get("Dipendenti"),
  };
}

function validateRow(row, index, cfSeen, pivaSeen, codiceSeen) {
  const issues = [];

  if (!row.codice) issues.push("Codice mancante");
  if (!row.nome) issues.push("Nome/Ragione sociale mancante");
  if (!row.email) issues.push("Email mancante (obbligatoria in CBnet)");
  if (!row.gru_fin) issues.push("Gruppo finanziario (GruFin) mancante");

  const isGiuridico = row.tipo === "G";
  if (!row.indirizzo || !row.cap || !row.comune || !row.prov) {
    issues.push("Indirizzo incompleto (Indirizzo/Cap/Comune/Prov)");
  }

  if (isGiuridico) {
    if (!row.cf && !row.piva) issues.push("Azienda/Ente senza CF né P.IVA");
    if (row.piva && pivaSeen.has(row.piva)) issues.push(`P.IVA duplicata nel file: ${row.piva}`);
    if (row.piva) pivaSeen.add(row.piva);
  } else {
    if (!row.cf) issues.push("Privato senza codice fiscale");
    if (row.cf && cfSeen.has(row.cf)) issues.push(`CF duplicato nel file: ${row.cf}`);
    if (row.cf) cfSeen.add(row.cf);
  }

  if (row.codice && codiceSeen.has(row.codice)) {
    issues.push(`Codice duplicato nel file: ${row.codice}`);
  }
  if (row.codice) codiceSeen.add(row.codice);

  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    issues.push(`Email non valida: ${row.email}`);
  }

  if (row.nome.toLowerCase().includes("_nuovo_cliente")) {
    issues.push("Placeholder _nuovo_cliente — anagrafica incompleta");
  }

  return {
    riga_excel: index + 2,
    ...row,
    motivo: issues.join("; "),
    valido: issues.length === 0,
  };
}

async function invokeImportBatch(clienti, codiciCommerciali) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-clienti`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      action: "import_batch",
      clienti,
      codici_commerciali: codiciCommerciali,
      options: {
        ufficio_codice: "SDO",
        specialist_email: "mmidena@consulbrokers.it",
        skip_existing: true,
      },
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

function toCodiceCommerciale(row) {
  return {
    codice: row.codice,
    specialist: row.specialist || "SEDE SAN DONA' DI PIAVE",
    brand: row.brand || "Consulbrokers",
    unit: row.unit || "SEDE SAN DONA' DI PIAVE",
    prod1: row.prod1 || null,
    acquisito: row.acquisito || null,
    scad_mandato: row.scad_mandato || null,
  };
}

function toClientePayload(row) {
  return {
    codice: row.codice,
    nome: row.nome,
    indirizzo: row.indirizzo,
    cap: row.cap,
    comune: row.comune,
    prov: row.prov,
    email: row.email,
    tel: row.tel,
    tipo: row.tipo,
    cf: row.cf,
    piva: row.piva,
    gru_fin: row.gru_fin,
    gru_stat: row.gru_stat,
    stato: row.stato,
    atten_di: row.atten_di,
    zona: row.zona,
    attivita: row.attivita,
    specialist_sx: row.specialist_sx,
    indotto: row.indotto,
    fatturato: row.fatturato,
    dipendenti: row.dipendenti,
  };
}

async function buildPdf(report) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageW = 595;
  const pageH = 842;
  const margin = 40;
  const lineH = 11;
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

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
    const maxW = pageW - margin * 2;
    const chunks = wrapText(String(text), f, size, maxW);
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

  drawText("CONSULNET / CBnet — Report importazione anagrafiche clienti", {
    size: 14,
    bold: true,
  });
  drawText(`File sorgente: ${report.source_file}`, { size: 9 });
  drawText(`Data/ora: ${report.generated_at}`, { size: 9 });
  drawText(`Sede assegnata: ${report.config.sede}`, { size: 9 });
  drawText(`Specialist assegnato: ${report.config.specialist}`, { size: 9 });
  drawLine();

  drawText("RIEPILOGO", { size: 12, bold: true });
  for (const [k, v] of Object.entries(report.summary)) {
    drawText(`${k}: ${v}`, { size: 9 });
  }
  drawLine();

  const sections = [
    {
      title: "ANAGRAFICHE NON IMPORTATE — Validazione pre-import (errori nel file Excel)",
      rows: report.non_importate_validazione,
      columns: ["riga_excel", "codice", "nome", "tipo", "cf", "piva", "email", "motivo"],
    },
    {
      title: "ANAGRAFICHE NON IMPORTATE — Errori database / vincoli",
      rows: report.non_importate_db,
      columns: ["codice", "nome", "tipo", "cf", "piva", "email", "gru_fin", "motivo"],
    },
    {
      title: "ANAGRAFICHE SALTATE — Già presenti in CBnet (codice esistente)",
      rows: report.saltate_esistenti,
      columns: ["codice", "nome", "cliente_id", "motivo"],
    },
    {
      title: "ANAGRAFICHE IMPORTATE CON SUCCESSO (campione prime 200)",
      rows: report.importate.slice(0, 200),
      columns: ["codice", "id", "nome", "tipo_cliente"],
    },
  ];

  for (const section of sections) {
    drawText(section.title, { size: 11, bold: true, color: rgb(0.15, 0.35, 0.65) });
    drawText(`Totale righe in sezione: ${section.rows.length}`, { size: 8 });
    drawLine();

    if (section.rows.length === 0) {
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

  if (report.importate.length > 200) {
    drawText(
      `… altre ${report.importate.length - 200} anagrafiche importate non elencate per limiti di spazio PDF. Consultare il file JSON completo.`,
      { size: 8, color: rgb(0.4, 0.4, 0.4) },
    );
  }

  drawText("Fine report.", { size: 8, color: rgb(0.4, 0.4, 0.4) });
  return doc.save();
}

function wrapText(text, font, size, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configura VITE_SUPABASE_URL e chiave Supabase in .env");
  }
  if (!fs.existsSync(EXCEL_PATH)) {
    throw new Error(`File Excel non trovato: ${EXCEL_PATH}`);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  console.log(`Letti ${rawRows.length} record da ${path.basename(EXCEL_PATH)}`);

  const cfSeen = new Set();
  const pivaSeen = new Set();
  const codiceSeen = new Set();

  const validated = rawRows.map((row, i) =>
    validateRow(normalizeRow(row), i, cfSeen, pivaSeen, codiceSeen),
  );

  const validRows = validated.filter((r) => r.valido);
  const invalidRows = validated.filter((r) => !r.valido);

  console.log(`Validi: ${validRows.length}, scartati in validazione: ${invalidRows.length}`);

  const imported = [];
  const failedDb = [];
  const skippedExisting = [];
  let ccInserted = 0;
  let ccFailed = 0;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const chunk = validRows.slice(i, i + BATCH_SIZE);
    const clienti = chunk.map(toClientePayload);
    const codici = chunk.map(toCodiceCommerciale);

    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(validRows.length / BATCH_SIZE)} (${chunk.length} righe)...`);

    try {
      const result = await invokeImportBatch(clienti, codici);
      imported.push(...(result.imported || []));
      failedDb.push(...(result.failed || []));
      skippedExisting.push(...(result.skipped || []));
      ccInserted += result.cc_inserted || 0;
      ccFailed += result.cc_failed || 0;
    } catch (err) {
      console.error(`Errore batch ${i}:`, err.message);
      for (const row of chunk) {
        failedDb.push({
          codice: row.codice,
          nome: row.nome,
          tipo: row.tipo,
          cf: row.cf,
          piva: row.piva,
          email: row.email,
          gru_fin: row.gru_fin,
          motivo: `Errore batch: ${err.message}`,
        });
      }
    }
  }

  const report = {
    source_file: EXCEL_PATH,
    generated_at: new Date().toLocaleString("it-IT", { timeZone: "Europe/Rome" }),
    config: {
      sede: "SEDE SAN DONA' DI PIAVE (SDO)",
      specialist: "Maria Midena (mmidena@consulbrokers.it)",
    },
    summary: {
      "Righe totali Excel": rawRows.length,
      "Scartate in validazione pre-import": invalidRows.length,
      "Inviate a import": validRows.length,
      "Importate con successo": imported.length,
      "Saltate (codice già presente)": skippedExisting.length,
      "Fallite su database": failedDb.length,
      "Codici commerciali inseriti (fase import)": ccInserted,
      "Codici commerciali falliti (fase import)": ccFailed,
      "Nota codici commerciali":
        "I record Backoffice/Specialist sono stati completati con backfill SQL post-import (date Excel seriali corrette).",
    },
    non_importate_validazione: invalidRows,
    non_importate_db: failedDb,
    saltate_esistenti: skippedExisting,
    importate: imported,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), "utf8");
  console.log(`Report JSON: ${REPORT_JSON}`);

  const pdfBytes = await buildPdf(report);
  fs.writeFileSync(REPORT_PDF, pdfBytes);
  console.log(`Report PDF: ${REPORT_PDF}`);

  console.log("\n=== RIEPILOGO ===");
  for (const [k, v] of Object.entries(report.summary)) {
    console.log(`${k}: ${v}`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
