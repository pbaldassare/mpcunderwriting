/**
 * Esegue le query da rinnovi-sql.json via Supabase REST (rpc) o salva da file MCP.
 * Fallback: legge scripts/output/mcp-raw/*.json generati manualmente.
 *
 * Uso diretto con MCP (agent):
 *   1. Eseguire query MCP e salvare JSON array in scripts/output/mcp-raw/<nome>.json
 *   2. node scripts/fetch-rinnovi-lookup.mjs
 */
import fs from "fs";
import path from "path";

const OUTPUT = path.resolve("scripts/output");
const RAW_DIR = path.join(OUTPUT, "mcp-raw");
const SQL = JSON.parse(fs.readFileSync(path.join(OUTPUT, "rinnovi-sql.json"), "utf8"));
const parts = ["clienti", "compagnie", "rami", "titoli", "meta"];

fs.mkdirSync(RAW_DIR, { recursive: true });

for (const p of parts) {
  const rawFile = path.join(RAW_DIR, `${p}.json`);
  if (!fs.existsSync(rawFile)) {
    console.error(`Manca ${rawFile} — eseguire query MCP per "${p}" e salvare l'array JSON`);
    process.exit(1);
  }
  const data = JSON.parse(fs.readFileSync(rawFile, "utf8"));
  fs.writeFileSync(path.join(OUTPUT, `lookup-${p}.json`), JSON.stringify(data, null, 2));
  console.log(p, data.length);
}

import { spawnSync } from "child_process";
const merge = spawnSync("node", ["scripts/merge-rinnovi-lookup.mjs"], {
  stdio: "inherit",
  cwd: process.cwd(),
});
process.exit(merge.status ?? 1);
