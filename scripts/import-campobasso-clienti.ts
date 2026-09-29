/**
 * Import anagrafiche sede Campobasso dal tracciato gestionale.
 * Uso:
 *   bun scripts/import-campobasso-clienti.ts --dry-run
 *   bun scripts/import-campobasso-clienti.ts
 */
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import {
  CAMPOBASSO_SEDE_EMAIL,
  CAMPOBASSO_UFFICIO_ID,
  pickKeepers,
  resolveCampobassoCliente,
  specialistIsBackoffice,
  unitIsPersona,
  type CampobassoRiga,
  type CampobassoRisolto,
  type CatalogoClienteCBnet,
} from "../src/lib/campobassoClienti.ts";

config({ path: path.resolve(process.cwd(), ".env") });

const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/Clienti_sede_Campobasso_34d5.xlsx";
const DRY = process.argv.includes("--dry-run");
const EMIT_SQL = process.argv.includes("--emit-sql");
const BATCH = 40;

const GF_IDS: Record<CampobassoRisolto["gruppoFinanziarioKey"], string> = {
  linea_persona: "05478f51-65b4-41d2-b743-d7a5faa181e0",
  aziende_private: "3b49294f-373e-456e-9bec-0bb7942aa7bb",
  enti_territoriali: "62ae8e50-e440-4810-b4df-6cb64a8f2155",
  enti_no_lucro: "b6cd962d-67b9-4dd8-a329-8f4757cbd51d",
};

const PROFILI = {
  sede: "77cb4823-b980-4f95-a689-c2d374c25475",
  tallini: "d86c3bfc-8925-4665-b538-9ef257306699",
  ferro: "c77281a6-5948-4094-ab79-0548cf1da6f5",
};

function mustEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Manca ${name} in .env`);
  return v;
}

function normKey(s: string | null | undefined): string {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toInsert(r: CampobassoRisolto) {
  const isPrivato = r.tipoCliente === "privato";
  return {
    codice_ricerca: r.codice,
    tipo_cliente: r.tipoCliente,
    tipo_persona: isPrivato ? "F" : "G",
    ufficio_id: CAMPOBASSO_UFFICIO_ID,
    attivo: true,
    stato_cliente: "Attivo",
    ragione_sociale: r.ragioneSociale,
    nome: r.nome,
    cognome: r.cognome,
    codice_fiscale: r.codiceFiscale,
    partita_iva: r.partitaIva,
    codice_fiscale_azienda: r.codiceFiscaleAzienda,
    forma_giuridica: r.formaGiuridica,
    email: r.email,
    pec: r.pec,
    telefono: r.telefono,
    attenzione_di: r.attenzioneDi,
    gruppo_finanziario_id: GF_IDS[r.gruppoFinanziarioKey],
    gruppo_statistico: r.gruppoStatistico,
    indotto: r.indotto,
    zona: r.zona,
    attivita: r.attivita,
    spec_sx_danni: r.specSx,
    ha_incarico: !!r.dataAcquisito,
    incarico_da: r.dataAcquisito,
    indirizzo_residenza: isPrivato ? r.indirizzo : null,
    cap_residenza: isPrivato ? r.cap : null,
    citta_residenza: isPrivato ? r.citta : null,
    provincia_residenza: isPrivato ? r.provincia : null,
    indirizzo_sede: isPrivato ? null : r.indirizzo,
    cap_sede: isPrivato ? null : r.cap,
    citta_sede: isPrivato ? null : r.citta,
    provincia_sede: isPrivato ? null : r.provincia,
  };
}

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function loadLocalCatalog(): CatalogoClienteCBnet[] {
  const raw = JSON.parse(readFileSync("/tmp/cb_clienti_db.json", "utf8"));
  return raw as CatalogoClienteCBnet[];
}

function loadLocalAnag(): Map<string, string> {
  const raw = JSON.parse(readFileSync("/tmp/cb_anag_db.json", "utf8")) as Array<{
    id: string;
    tipo: string;
    nome: string | null;
  }>;
  const map = new Map<string, string>();
  for (const a of raw) {
    const k = normKey(a.nome);
    if (!k) continue;
    if (!map.has(k) || a.tipo === "corrispondente") map.set(k, a.id);
  }
  return map;
}

async function loadRemoteCatalog(sb: ReturnType<typeof createClient>) {
  const { data: clienti, error: cliErr } = await sb
    .from("clienti")
    .select(
      "id, ufficio_id, codice_fiscale, partita_iva, codice_fiscale_azienda, codice_ricerca, codice_cliente, nome, cognome, ragione_sociale",
    );
  if (cliErr) throw cliErr;
  const catalogo: CatalogoClienteCBnet[] = (clienti || []).map((c: any) => ({
    ...c,
    nome_norm: `${c.cognome || ""} ${c.nome || ""} ${c.ragione_sociale || ""}`,
  }));

  const { data: anag, error: anagErr } = await sb
    .from("anagrafiche_professionali")
    .select("id, tipo, nome, cognome, ragione_sociale, attivo")
    .eq("attivo", true);
  if (anagErr) throw anagErr;
  const anagByName = new Map<string, string>();
  for (const a of anag || []) {
    const keys = [
      normKey(a.ragione_sociale || ""),
      normKey(`${a.cognome || ""} ${a.nome || ""}`),
      normKey(`${a.nome || ""} ${a.cognome || ""}`),
    ].filter(Boolean);
    const prefer = a.tipo === "corrispondente";
    for (const k of keys) {
      if (!anagByName.has(k) || prefer) anagByName.set(k, a.id);
    }
  }
  return { catalogo, anagByName };
}

function buildCommerciali(
  toCreate: Array<CampobassoRisolto & { newId: string }>,
  anagByName: Map<string, string>,
) {
  const ccRows: Array<Record<string, unknown>> = [];
  const resolveAnag = (name: string | null) => {
    if (!name || !unitIsPersona(name)) return null;
    return anagByName.get(normKey(name)) || null;
  };
  for (const r of toCreate) {
    const bo = specialistIsBackoffice(r.specialist);
    ccRows.push({
      cliente_id: r.newId,
      ruolo: "Backoffice",
      profilo_id: bo === "ferro" ? PROFILI.ferro : bo === "tallini" ? PROFILI.tallini : PROFILI.sede,
      anagrafica_id: null,
      societa_brand: r.brand,
      filiale: "Ufficio di Campobasso",
      contatto: bo === "ferro" ? "Loredana Ferro" : bo === "tallini" ? "Iole Tallini" : "Sede Campobasso",
      data_acquisito: r.dataAcquisito,
    });
    const seen = new Set<string>();
    const addCorr = (name: string | null, ruolo: string) => {
      const aid = resolveAnag(name);
      if (!aid || seen.has(aid)) return;
      seen.add(aid);
      ccRows.push({
        cliente_id: r.newId,
        ruolo,
        profilo_id: null,
        anagrafica_id: aid,
        societa_brand: r.brand,
        filiale: "Ufficio di Campobasso",
        contatto: name,
        data_acquisito: r.dataAcquisito,
      });
    };
    addCorr(r.unit, "corrispondente_1");
    if (r.specialist && !specialistIsBackoffice(r.specialist)) addCorr(r.specialist, "corrispondente_1");
    if (r.prod1) addCorr(r.prod1, r.unit && unitIsPersona(r.unit) ? "corrispondente_2" : "corrispondente_1");
  }
  return ccRows;
}

function emitSql(
  toCreate: Array<CampobassoRisolto & { newId: string }>,
  toLink: CampobassoRisolto[],
  ccRows: Array<Record<string, unknown>>,
) {
  const dir = "/tmp/campobasso-sql";
  mkdirSync(dir, { recursive: true });
  const linkSql = toLink
    .filter((r) => r.clienteId && r.motivo === "gia_in_sede_campobasso")
    .map(
      (r) =>
        `UPDATE public.clienti SET codice_ricerca = ${sqlStr(r.codice)} WHERE id = '${r.clienteId}'::uuid AND (codice_ricerca IS NULL OR codice_ricerca = '');`,
    )
    .join("\n");
  writeFileSync(`${dir}/00-link.sql`, linkSql + "\n");

  const chunks: string[] = [];
  for (let i = 0; i < toCreate.length; i += 80) {
    const batch = toCreate.slice(i, i + 80);
    const values = batch
      .map((r) => {
        const row = toInsert(r);
        return `(${[
          `'${r.newId}'::uuid`,
          sqlStr(row.codice_ricerca),
          sqlStr(row.tipo_cliente),
          sqlStr(row.tipo_persona),
          `'${CAMPOBASSO_UFFICIO_ID}'::uuid`,
          "true",
          sqlStr(row.stato_cliente),
          sqlStr(row.ragione_sociale),
          sqlStr(row.nome),
          sqlStr(row.cognome),
          sqlStr(row.codice_fiscale),
          sqlStr(row.partita_iva),
          sqlStr(row.codice_fiscale_azienda),
          sqlStr(row.forma_giuridica),
          sqlStr(row.email),
          sqlStr(row.pec),
          sqlStr(row.telefono),
          sqlStr(row.attenzione_di),
          row.gruppo_finanziario_id ? `'${row.gruppo_finanziario_id}'::uuid` : "NULL",
          sqlStr(row.gruppo_statistico),
          sqlStr(row.indotto),
          sqlStr(row.zona),
          sqlStr(row.attivita),
          sqlStr(row.spec_sx_danni),
          row.ha_incarico ? "true" : "false",
          sqlStr(row.incarico_da),
          sqlStr(row.indirizzo_residenza),
          sqlStr(row.cap_residenza),
          sqlStr(row.citta_residenza),
          sqlStr(row.provincia_residenza),
          sqlStr(row.indirizzo_sede),
          sqlStr(row.cap_sede),
          sqlStr(row.citta_sede),
          sqlStr(row.provincia_sede),
        ].join(", ")})`;
      })
      .join(",\n");
    chunks.push(`INSERT INTO public.clienti (
  id, codice_ricerca, tipo_cliente, tipo_persona, ufficio_id, attivo, stato_cliente,
  ragione_sociale, nome, cognome, codice_fiscale, partita_iva, codice_fiscale_azienda,
  forma_giuridica, email, pec, telefono, attenzione_di, gruppo_finanziario_id,
  gruppo_statistico, indotto, zona, attivita, spec_sx_danni, ha_incarico, incarico_da,
  indirizzo_residenza, cap_residenza, citta_residenza, provincia_residenza,
  indirizzo_sede, cap_sede, citta_sede, provincia_sede
) VALUES\n${values};`);
  }
  chunks.forEach((sql, idx) => writeFileSync(`${dir}/1-${String(idx + 1).padStart(3, "0")}-clienti.sql`, sql));

  const ccChunks: string[] = [];
  for (let i = 0; i < ccRows.length; i += 120) {
    const batch = ccRows.slice(i, i + 120);
    const values = batch
      .map((r) => {
        return `(${[
          `'${r.cliente_id}'::uuid`,
          sqlStr(String(r.ruolo)),
          r.profilo_id ? `'${r.profilo_id}'::uuid` : "NULL",
          r.anagrafica_id ? `'${r.anagrafica_id}'::uuid` : "NULL",
          sqlStr(r.societa_brand as string),
          sqlStr(r.filiale as string),
          sqlStr(r.contatto as string),
          sqlStr(r.data_acquisito as string | null),
        ].join(", ")})`;
      })
      .join(",\n");
    ccChunks.push(`INSERT INTO public.codici_commerciali_cliente (
  cliente_id, ruolo, profilo_id, anagrafica_id, societa_brand, filiale, contatto, data_acquisito
) VALUES\n${values};`);
  }
  ccChunks.forEach((sql, idx) => writeFileSync(`${dir}/2-${String(idx + 1).padStart(3, "0")}-cc.sql`, sql));
  return { dir, clientiChunks: chunks.length, ccChunks: ccChunks.length, linkRows: linkSql.split("\n").filter(Boolean).length };
}

async function main() {
  if (!existsSync(EXCEL)) throw new Error(`Excel non trovato: ${EXCEL}`);

  const rows = XLSX.utils.sheet_to_json<CampobassoRiga>(
    XLSX.readFile(EXCEL, { cellDates: true }).Sheets.Sheet1,
    { defval: null, raw: false },
  );

  let catalogo: CatalogoClienteCBnet[];
  let anagByName: Map<string, string>;
  if (EMIT_SQL || existsSync("/tmp/cb_clienti_db.json")) {
    catalogo = loadLocalCatalog();
    anagByName = loadLocalAnag();
  } else {
    const url = mustEnv("VITE_SUPABASE_URL");
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || mustEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const remote = await loadRemoteCatalog(sb);
    catalogo = remote.catalogo;
    anagByName = remote.anagByName;
  }

  const resolved = rows.map((r) => resolveCampobassoCliente(r, catalogo));
  const { keepers, dups } = pickKeepers(resolved);
  const toCreate = keepers.filter((r) => r.esito === "da_creare");
  const toLink = keepers.filter((r) => r.esito === "collegare");

  const report = {
    dry: DRY,
    file: EXCEL,
    totFile: rows.length,
    saltati: dups.length,
    collegare: toLink.length,
    daCreare: toCreate.length,
    tipi: toCreate.reduce(
      (acc, r) => {
        acc[r.tipoCliente] = (acc[r.tipoCliente] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    collegamenti: toLink.map((r) => ({
      codice: r.codice,
      nome: r.ragioneSociale || `${r.cognome} ${r.nome}`,
      motivo: r.motivo,
      clienteId: r.clienteId,
    })),
    saltatiMotivi: dups.reduce(
      (acc, r) => {
        acc[r.motivo] = (acc[r.motivo] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  };
  console.log(JSON.stringify({ ...report, collegamenti: report.collegamenti.slice(0, 8) }, null, 2));
  writeFileSync("/tmp/campobasso-import-plan.json", JSON.stringify(report, null, 2));

  if (DRY || EMIT_SQL) {
    const withIds = toCreate.map((r) => ({ ...r, newId: randomUUID() }));
    const ccRows = buildCommerciali(withIds, anagByName);
    const emitted = emitSql(withIds, toLink, ccRows);
    writeFileSync("/tmp/campobasso-create-ids.json", JSON.stringify(withIds.map((r) => ({ codice: r.codice, id: r.newId }))));
    console.log(JSON.stringify({ emit: emitted, dry: DRY }, null, 2));
    if (DRY && !EMIT_SQL) console.log("Dry-run: nessun write.");
    return;
  }

  const url = mustEnv("VITE_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || mustEnv("VITE_SUPABASE_PUBLISHABLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  let linked = 0;
  for (const r of toLink) {
    if (!r.clienteId) continue;
    const existing = catalogo.find((c) => c.id === r.clienteId);
    if (!existing) continue;
    if (existing.ufficio_id !== CAMPOBASSO_UFFICIO_ID) continue;
    if (existing.codice_ricerca) continue;
    const { error } = await sb.from("clienti").update({ codice_ricerca: r.codice }).eq("id", r.clienteId);
    if (error) console.error("link", r.codice, error.message);
    else linked++;
  }

  let inserted = 0;
  let failed = 0;
  const failRows: Array<{ codice: string; err: string }> = [];
  const idByCodice = new Map<string, string>();

  for (let i = 0; i < toCreate.length; i += BATCH) {
    const batch = toCreate.slice(i, i + BATCH);
    const { data, error } = await sb.from("clienti").insert(batch.map(toInsert)).select("id, codice_ricerca");
    if (error) {
      for (const r of batch) {
        const { data: one, error: oneErr } = await sb.from("clienti").insert(toInsert(r)).select("id, codice_ricerca").single();
        if (oneErr || !one) {
          failed++;
          failRows.push({ codice: r.codice, err: oneErr?.message || "insert" });
        } else {
          inserted++;
          idByCodice.set(r.codice, one.id);
        }
      }
    } else {
      inserted += (data || []).length;
      for (const row of data || []) {
        if (row.codice_ricerca) idByCodice.set(row.codice_ricerca, row.id);
      }
    }
    console.log(`insert ${Math.min(i + BATCH, toCreate.length)}/${toCreate.length} ok=${inserted} ko=${failed}`);
  }

  function resolveAnag(name: string | null): string | null {
    if (!name || !unitIsPersona(name)) return null;
    return anagByName.get(normKey(name)) || null;
  }

  const ccRows: Array<Record<string, unknown>> = [];
  for (const r of toCreate) {
    const clienteId = idByCodice.get(r.codice);
    if (!clienteId) continue;
    const bo = specialistIsBackoffice(r.specialist);
    ccRows.push({
      cliente_id: clienteId,
      ruolo: "Backoffice",
      profilo_id: bo === "ferro" ? PROFILI.ferro : bo === "tallini" ? PROFILI.tallini : PROFILI.sede,
      anagrafica_id: null,
      societa_brand: r.brand,
      filiale: "Ufficio di Campobasso",
      contatto: bo === "ferro" ? "Loredana Ferro" : bo === "tallini" ? "Iole Tallini" : "Sede Campobasso",
      data_acquisito: r.dataAcquisito,
    });
    const seen = new Set<string>();
    const addCorr = (name: string | null, ruolo: string) => {
      const aid = resolveAnag(name);
      if (!aid || seen.has(aid)) return;
      seen.add(aid);
      ccRows.push({
        cliente_id: clienteId,
        ruolo,
        profilo_id: null,
        anagrafica_id: aid,
        societa_brand: r.brand,
        filiale: "Ufficio di Campobasso",
        contatto: name,
        data_acquisito: r.dataAcquisito,
      });
    };
    addCorr(r.unit, "corrispondente_1");
    if (r.specialist && !specialistIsBackoffice(r.specialist)) addCorr(r.specialist, "corrispondente_1");
    if (r.prod1) addCorr(r.prod1, r.unit && unitIsPersona(r.unit) ? "corrispondente_2" : "corrispondente_1");
  }

  let ccOk = 0;
  let ccKo = 0;
  for (let i = 0; i < ccRows.length; i += BATCH) {
    const batch = ccRows.slice(i, i + BATCH);
    const { error } = await sb.from("codici_commerciali_cliente").insert(batch);
    if (error) {
      for (const row of batch) {
        const { error: oneErr } = await sb.from("codici_commerciali_cliente").insert(row);
        if (oneErr) ccKo++;
        else ccOk++;
      }
    } else {
      ccOk += batch.length;
    }
  }

  const summary = { dry: false, linked, inserted, failed, failRows, ccOk, ccKo };
  writeFileSync("/tmp/campobasso-import-result.json", JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, failRows: failRows.slice(0, 20) }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
