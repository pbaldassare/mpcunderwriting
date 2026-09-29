/**
 * Provisioning account sede (ruolo ufficio, password Leone123!).
 *
 * Uso:
 *   node scripts/provision-sedi-users.mjs --dry-run
 *   node scripts/provision-sedi-users.mjs
 */
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const dryRun = process.argv.includes("--dry-run");
const OUTPUT = path.resolve(
  process.cwd(),
  "scripts/output",
  `provision-sedi-${new Date().toISOString().slice(0, 10)}.json`,
);

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error("Configura VITE_SUPABASE_URL e chiave in .env");
  }

  const res = await fetch(`${SUPABASE_URL}/functions/v1/provision-sedi-users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_KEY}`,
      apikey: SUPABASE_KEY,
    },
    body: JSON.stringify({
      secret: "provision-sedi-2026",
      reset_password: true,
      dry_run: dryRun,
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Risposta non JSON (${res.status}): ${text.slice(0, 500)}`);
  }
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(data, null, 2));
  console.log(dryRun ? "DRY RUN" : "PROVISIONING OK");
  console.log(JSON.stringify(data.counts, null, 2));
  console.log("Report:", OUTPUT);
  if (data.skipped?.length) {
    console.log("Sedi senza email:", data.skipped);
  }
  if (data.results?.some((r) => r.ok === false)) {
    console.log("Errori:", data.results.filter((r) => r.ok === false));
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
