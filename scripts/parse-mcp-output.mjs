import fs from "fs";
import path from "path";

const src = process.argv[2];
const part = process.argv[3];
if (!src || !part) {
  console.error("Uso: node scripts/parse-mcp-output.mjs <file> <part>");
  process.exit(1);
}

const raw = fs.readFileSync(src, "utf8");

function extractArray(text) {
  const markers = ['[{"id"', '[{\\"id\\"', '[{\\\"id\\\"'];
  let start = -1;
  for (const m of markers) {
    start = text.indexOf(m);
    if (start >= 0) break;
  }
  if (start < 0) {
    const blocks = [...text.matchAll(/<untrusted-data-[^>]+>\s*([\s\S]*?)\s*<\/untrusted-data-[^>]+>/g)];
    const block = blocks.map((b) => b[1].trim()).find((t) => t.startsWith("["));
    if (block) return block;
    throw new Error(`Array JSON non trovato in ${src}`);
  }

  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "[") depth++;
    else if (ch === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error(`Array JSON incompleto in ${src}`);
}

let jsonText = extractArray(raw);
if (jsonText.includes('\\"')) {
  jsonText = jsonText.replace(/\\"/g, '"');
}
const data = JSON.parse(jsonText);

const outDir = path.resolve("scripts/output/mcp-raw");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `${part}.json`);
fs.writeFileSync(out, JSON.stringify(data, null, 2));
console.log("Wrote", out, data.length);
