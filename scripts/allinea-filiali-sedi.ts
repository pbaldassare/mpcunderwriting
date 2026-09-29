/**
 * Allinea uffici CBnet al tracciato filiali TTXFL00F.
 *   bun scripts/allinea-filiali-sedi.ts --dry-run
 *   bun scripts/allinea-filiali-sedi.ts
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import path from "node:path";
import XLSX from "xlsx";
import {
  parseFilialiRows,
  patchUfficioDaFiliale,
  planFilialiSedi,
  type UfficioEsistente,
} from "../src/lib/filialiSedi.ts";

config({ path: path.resolve(process.cwd(), ".env") });

const DRY = process.argv.includes("--dry-run");
const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/TTXFL00F_20260925142555_10c3.xlsx";

async function main() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Servono SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY");

  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const wb = XLSX.readFile(EXCEL);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const righe = parseFilialiRows(raw);

  const { data: esistenti, error } = await admin
    .from("uffici")
    .select("id, codice_ufficio, nome_ufficio, indirizzo, cap, citta, provincia");
  if (error) throw new Error(error.message);

  const piano = planFilialiSedi(righe, (esistenti || []) as UfficioEsistente[]);
  for (const p of piano) {
    if (p.esito === "salta") {
      console.log(`skip ${p.riga.codice} ${p.riga.nome} — ${p.motivo}`);
      continue;
    }
    if (p.esito === "crea") {
      console.log(`${DRY ? "would_create" : "create"} ${p.codiceCBnet} ${p.riga.nome}`);
      if (DRY) continue;
      const { error: insErr } = await admin.from("uffici").insert({
        codice_ufficio: p.codiceCBnet,
        nome_ufficio: p.riga.nome,
        indirizzo: p.riga.indirizzo,
        cap: p.riga.cap,
        citta: p.riga.citta,
        provincia: p.riga.provincia,
        attivo: true,
      });
      if (insErr) throw new Error(`${p.codiceCBnet}: ${insErr.message}`);
      continue;
    }
    const patch = patchUfficioDaFiliale(p.esistente, p.riga);
    console.log(`${DRY ? "would_update" : "update"} ${p.codiceCBnet} ${p.esistente.nome_ufficio} → ${patch.indirizzo || "—"}`);
    if (DRY) continue;
    const { error: upErr } = await admin
      .from("uffici")
      .update({
        indirizzo: patch.indirizzo,
        cap: patch.cap,
        citta: patch.citta,
        provincia: patch.provincia,
      })
      .eq("id", p.esistente.id);
    if (upErr) throw new Error(`${p.codiceCBnet}: ${upErr.message}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
