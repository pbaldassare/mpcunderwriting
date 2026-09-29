/**
 * Backfill codici commerciali (Backoffice + Prod1) per clienti già importati.
 */
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
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

function excelSerialToIso(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 20000 || n > 60000) return null;
  const utc = Date.UTC(1899, 11, 30) + n * 86400000;
  return new Date(utc).toISOString().slice(0, 10);
}

async function invokeCcBatch(codiciCommerciali) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-clienti`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      action: "import_batch",
      clienti: [],
      codici_commerciali: codiciCommerciali,
      options: {
        ufficio_codice: "SDO",
        specialist_email: "mmidena@consulbrokers.it",
        skip_existing: true,
      },
    }),
  });
  return res.json();
}

async function main() {
  const wb = XLSX.readFile(EXCEL_PATH);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });

  const codici = rows
    .map((r) => ({
      codice: String(r.Codice || "").trim(),
      brand: String(r.Brand || "Consulbrokers").trim() || "Consulbrokers",
      unit: String(r.Unit || "SEDE SAN DONA' DI PIAVE").trim() || "SEDE SAN DONA' DI PIAVE",
      prod1: String(r.Prod1 || "").trim() || null,
      acquisito: excelSerialToIso(r.Acquisito),
      scad_mandato: excelSerialToIso(r["ScadMandato"] ?? r["Scad Mandato"]),
    }))
    .filter((r) => r.codice);

  let ccInserted = 0;
  let ccFailed = 0;

  for (let i = 0; i < codici.length; i += 80) {
    const chunk = codici.slice(i, i + 80);
    const result = await invokeCcBatch(chunk);
    ccInserted += result.cc_inserted || 0;
    ccFailed += result.cc_failed || 0;
    console.log(`Chunk ${Math.floor(i / 80) + 1}: cc+${result.cc_inserted || 0} fail=${result.cc_failed || 0}`);
  }

  console.log(`Totale CC inseriti: ${ccInserted}, falliti: ${ccFailed}`);
}

main().catch(console.error);
