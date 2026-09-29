/**
 * Fase 3 — Import incrementale rinnovi (madre + quietanza) via edge function.
 *
 * Prerequisito: scripts/output/analyze-rinnovi-report.json
 *
 * Uso:
 *   node scripts/import-rinnovi-batch.mjs --dry-run
 *   node scripts/import-rinnovi-batch.mjs --limit 5
 *   node scripts/import-rinnovi-batch.mjs
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;

const REPORT_JSON = path.resolve(process.cwd(), "scripts/output/analyze-rinnovi-report.json");
const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/output");
const REPORT_OUT = path.join(
  OUTPUT_DIR,
  `import-rinnovi-report-${new Date().toISOString().slice(0, 10)}.json`,
);

const BATCH_SIZE = 15;
const SDO_UFFICIO_ID = "327e92f7-64f0-48b9-9e48-73611d8cb406";
const MIDENA_ANAGRAFICA_ID = "63e6aebb-ee6a-4114-ab4b-a723ce775358";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;

function toPairPayload(row) {
  const p = row.piano;
  if (!p?.madre || !p?.quietanza) return null;

  return {
    riga_excel: row.riga,
    numero_titolo: String(row.polizza || p.madre.numero_titolo).trim(),
    cliente_anagrafica_id: row.clienteId,
    compagnia_id: row.compagniaId,
    compagnia_rapporto_id: row.rapportoId || null,
    ramo_id: row.ramoId,
    ufficio_id: row.clienteUfficioId || SDO_UFFICIO_ID,
    ae_anagrafica_id: MIDENA_ANAGRAFICA_ID,
    specialist: row.specialist || "SEDE SAN DONA' DI PIAVE",
    filiale: row.filiale || "SD",
    descrizione_polizza: row.descrizione || null,
    garanzia_da: p.quietanza.garanzia_da || row.scadPolizza || row.scadenza,
    garanzia_a: p.quietanza.garanzia_a || row.scadenza || row.scadPolizza,
    data_scadenza: row.scadPolizza || row.scadenza,
    durata_da: p.madre.garanzia_da || row.scadenza,
    durata_a: row.scadPolizza || row.scadenza,
    tipo_rinnovo: row.tipoRinnovo || "R",
    provvigioni_quietanza: Number.isFinite(Number(row.attive)) ? Number(row.attive) : null,
    madre: {
      azione: p.madre.azione === "crea_nuovo" ? "crea_nuovo" : "gia_presente",
      premio_lordo: 0,
    },
    quietanza: {
      azione: p.quietanza.azione === "crea_nuovo" ? "crea_nuovo" : "gia_presente",
      premio_lordo: p.quietanza.premio_lordo ?? row.lordo,
      incasso: !!p.quietanza.incasso,
      importo_incassato: p.quietanza.importo_incassato ?? null,
      data_messa_cassa: p.quietanza.data_messa_cassa ?? row.scadenza,
      stato: p.quietanza.stato || (p.quietanza.incasso ? "incassato" : "attivo"),
    },
  };
}

async function invokeImportBatch(records) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/import-rinnovi`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      action: "import_batch",
      records,
      options: { skip_existing: true, dry_run: dryRun },
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Risposta non JSON (${res.status}): ${text.slice(0, 800)}`);
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configura VITE_SUPABASE_URL e chiave Supabase in .env");
  }
  if (!fs.existsSync(REPORT_JSON)) {
    throw new Error(`Report analisi mancante: ${REPORT_JSON}`);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_JSON, "utf8"));
  let ready = (report.rows || []).filter((r) => r.prontoImport && r.piano);
  if (limit && limit > 0) ready = ready.slice(0, limit);

  const pairs = ready.map(toPairPayload).filter(Boolean);
  console.log(`Coppie da importare: ${pairs.length}${dryRun ? " (DRY RUN)" : ""}`);

  const aggregated = {
    startedAt: new Date().toISOString(),
    dryRun,
    limit: limit || null,
    pairsRequested: pairs.length,
    batches: [],
    imported: [],
    skipped: [],
    failed: [],
  };

  for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
    const batch = pairs.slice(i, i + BATCH_SIZE);
    console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} coppie...`);
    const result = await invokeImportBatch(batch);
    aggregated.batches.push({
      index: Math.floor(i / BATCH_SIZE) + 1,
      size: batch.length,
      counts: result.counts,
    });
    aggregated.imported.push(...(result.imported || []));
    aggregated.skipped.push(...(result.skipped || []));
    aggregated.failed.push(...(result.failed || []));
  }

  aggregated.finishedAt = new Date().toISOString();
  aggregated.summary = {
    imported: aggregated.imported.length,
    skipped: aggregated.skipped.length,
    failed: aggregated.failed.length,
  };

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(REPORT_OUT, JSON.stringify(aggregated, null, 2));
  console.log("Report import:", REPORT_OUT);
  console.log(JSON.stringify(aggregated.summary, null, 2));

  if (aggregated.failed.length > 0) {
    console.log("Primi errori:", aggregated.failed.slice(0, 5));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
