/**
 * Calcola provvigioni per quietanze rinnovi già incassate (post-import).
 * Uso: node scripts/backfill-rinnovi-provvigioni.mjs [--limit N]
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const OUTPUT_DIR = path.resolve(process.cwd(), "scripts/output");
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;

function findImportJson() {
  const files = fs
    .readdirSync(OUTPUT_DIR)
    .filter((f) => f.startsWith("import-rinnovi-report-") && f.endsWith(".json") && !f.includes("-final"));
  files.sort();
  if (!files.length) throw new Error("Nessun report import rinnovi");
  return path.join(OUTPUT_DIR, files[files.length - 1]);
}

async function calcolaProvvigioni(titoloId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/calcola-provvigioni`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({ titolo_id: titoloId }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  const imp = JSON.parse(fs.readFileSync(findImportJson(), "utf8"));
  let quietanze = (imp.imported || []).filter((x) => x.ruolo === "quietanza" && x.incasso && x.id);
  if (limit && limit > 0) quietanze = quietanze.slice(0, limit);

  console.log(`Quietanze incassate da processare: ${quietanze.length}`);
  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const q of quietanze) {
    const result = await calcolaProvvigioni(q.id);
    if (result.data?.skipped) {
      skip++;
    } else if (result.ok && result.data?.success !== false) {
      ok++;
    } else {
      fail++;
      if (fail <= 5) console.warn(q.numero_titolo, result.data?.error || result.data?.reason);
    }
  }

  console.log(JSON.stringify({ ok, skip, fail, total: quietanze.length }, null, 2));
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
