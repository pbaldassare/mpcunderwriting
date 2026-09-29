import fs from "fs";
import path from "path";

const part = process.argv[2];
const raw = process.argv[3];
if (!part || !raw) {
  console.error("Uso: node scripts/write-lookup-part.mjs <part> '<json>'");
  process.exit(1);
}

const dir = path.resolve("scripts/output/mcp-raw");
fs.mkdirSync(dir, { recursive: true });
const data = JSON.parse(raw);
fs.writeFileSync(path.join(dir, `${part}.json`), JSON.stringify(data, null, 2));
console.log("Wrote", part, data.length);
