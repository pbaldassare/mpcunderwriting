/**
 * Unisce i risultati MCP (file parziali) in rinnovi-db-lookup.json
 *
 * Uso:
 *   node scripts/merge-rinnovi-lookup.mjs
 */
import fs from "fs";
import path from "path";

const dir = path.resolve("scripts/output");
const parts = ["clienti", "compagnie", "rami", "titoli", "meta"];
const out = path.join(dir, "rinnovi-db-lookup.json");

const lookup = { fetchedAt: new Date().toISOString() };
for (const p of parts) {
  const file = path.join(dir, `lookup-${p}.json`);
  if (!fs.existsSync(file)) throw new Error(`Manca ${file}`);
  lookup[p] = JSON.parse(fs.readFileSync(file, "utf8"));
}

fs.writeFileSync(out, JSON.stringify(lookup, null, 2));
console.log("Wrote", out);
for (const p of parts) console.log(p, lookup[p].length);
