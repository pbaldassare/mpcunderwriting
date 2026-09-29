/**
 * Genera SQL di import polizze/sospesi EXE Roma.
 * Uso: bun scripts/build-roma-exe-polizze-sql.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import {
  resolveRomaExePolizza,
  resolveRomaExeSospeso,
  type RomaExeElencoRiga,
  type RomaExePolizzaRisolta,
  type RomaExeSospesoRiga,
} from "../src/lib/romaExePolizze.ts";
import type { CatalogoRamoCBnet } from "../src/lib/romaExeRami.ts";
import type { RomaExeCompagniaMapRow } from "../src/lib/romaExeCompagnie.ts";

const RM2 = "c83a748c-653f-4cbd-b075-b399eccdd1b1";
const SPECIALIST = "ROMA EXE";
const OUT = "/tmp/roma-exe-polizze-sql";
const CHUNK = 12;

const rami = JSON.parse(readFileSync("/tmp/roma-exe-rami-catalog.json", "utf8")) as CatalogoRamoCBnet[];
const compagnieMap = JSON.parse(
  readFileSync("/tmp/roma-exe-compagnie-map.json", "utf8"),
) as RomaExeCompagniaMapRow[];
const clientiMap = JSON.parse(readFileSync("/tmp/roma-exe-clienti-map.json", "utf8")) as Array<{
  exe_codice: string;
  cliente_id: string | null;
  ragione_sociale?: string | null;
}>;
const existing = JSON.parse(readFileSync("/tmp/roma-exe-titoli-taken.json", "utf8")) as string[];

const elencoWb = XLSX.readFile("/tmp/roma-exe-portafoglio/elenco_polizze_05.03.2026.xlsx");
const elencoRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(elencoWb.Sheets[elencoWb.SheetNames[0]], {
  defval: null,
  raw: true,
});
const sospWb = XLSX.readFile("/tmp/roma-exe-portafoglio/Sospesi_al_05.03.2026.xlsx");
const sospRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sospWb.Sheets[sospWb.SheetNames[0]], {
  defval: null,
  raw: true,
});

const taken = new Set(existing);
const madri: RomaExePolizzaRisolta[] = elencoRows.map((r, i) => {
  const row: RomaExeElencoRiga = {
    numero: r["Num. polizza"] as string,
    clienteCodice: r["Codice cliente"] as number,
    clienteNome: r["Ragione sociale"] as string,
    effetto: r["Data effetto"],
    scadenza: r["Data scadenza"],
    primoQuietanzamento: r["Data primo quietanzamento"],
    premioLordo: r["Totale importo anno"] as number,
    imponibileFuture: r["Importo imponibile future"] as number,
    tasseFuture: r["Importo tasse future"] as number,
    provvigioniAttive: r["Totale provvigioni delle rate attive"] as number,
    frazionamento: r["Descrizione Tipo Frazionamento"] as string,
    gruppoNome: r["Descrizione Gruppo Cliente"] as string,
    ramoCodice: r["Codice Ramo"] as number,
    ramoDescrizione: r["Descrizione Ramo"] as string,
    compagniaNome: r["Ragione Sociale"] as string,
    quota: r["Quota"] as number,
    produttoreCodice: (r["Codice Produttore"] ?? r["Codice Produttore_1"]) as number | null,
  };
  return resolveRomaExePolizza(row, i + 1, { rami, compagnieMap, clientiMap, taken });
});

const nextRiga = new Map<string, number>();
const sospesi = sospRows.map((r, i) => {
  const row: RomaExeSospesoRiga = {
    numero: r["N.Polizza"] as string,
    appendice: r["Appendice"] as string,
    compagniaNome: r["Delegataria"] as string,
    rischio: r["Rischio"] as string,
    effetto: r["Data Effetto"],
    scadenza: r["Data Scadenza"],
    importo: r["Importo"] as number,
    importoResiduo: r["Importo Residuo"] as number,
    provvigioniAttive: r["Provvigioni Attive"] as number,
    clienteNome: r["Cliente"] as string,
    gruppoNome: r["Gruppo"] as string,
  };
  return resolveRomaExeSospeso(row, i + 1, { madri, rami, compagnieMap, clientiMap, nextRiga });
});

function tally(rows: RomaExePolizzaRisolta[]) {
  return rows.reduce(
    (acc, r) => {
      acc[r.esito] = (acc[r.esito] || 0) + 1;
      if (r.esito === "saltata") {
        const key = r.motivo.split(";")[0].trim();
        acc[`skip:${key}`] = (acc[`skip:${key}`] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );
}

const stats = { elenco: elencoRows.length, sospesi: sospRows.length, madri: tally(madri), quietanze: tally(sospesi) };
writeFileSync("/tmp/roma-exe-polizze-stats.json", JSON.stringify(stats, null, 2));
writeFileSync(
  "/tmp/roma-exe-polizze-skipped.json",
  JSON.stringify(
    [...madri, ...sospesi]
      .filter((r) => r.esito === "saltata")
      .map((r) => ({ chiave: r.exeChiave, tipo: r.tipo, numero: r.exeNumero, motivo: r.motivo })),
    null,
    2,
  ),
);

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlIdent(id: string): string {
  return `'${id}'::uuid`;
}

function sqlDate(v: string | null | undefined): string {
  return v ? `'${v}'::date` : "NULL";
}

function sqlNum(v: number | null | undefined): string {
  return v == null ? "NULL" : String(v);
}

function sqlBool(v: boolean): string {
  return v ? "true" : "false";
}

function titoloValues(r: RomaExePolizzaRisolta & { newId: string }): string {
  return `(${sqlIdent(r.newId)}, ${sqlStr(r.numeroTitolo)}, ${r.riga}, ${sqlStr(r.stato)},
    NULL, ${r.clienteId ? sqlIdent(r.clienteId) : "NULL"},
    ${r.compagniaId ? sqlIdent(r.compagniaId) : "NULL"}, ${r.ramoId ? sqlIdent(r.ramoId) : "NULL"},
    '${RM2}'::uuid, ${sqlDate(r.garanziaDa)}, ${sqlDate(r.garanziaA)},
    ${sqlDate(r.garanziaDa)}, ${sqlDate(r.garanziaA)}, ${sqlDate(r.garanziaA)}, ${sqlDate(r.dataCompetenza)},
    ${sqlNum(r.premioNetto)}, ${sqlNum(r.tasse)}, ${sqlNum(r.premioLordo)},
    ${sqlNum(r.provvigioni)}, ${sqlNum(r.provvigioni)},
    ${sqlStr(r.frazionamento)}, ${sqlStr(r.frazionamento)},
    ${sqlNum(r.percentualeRiparto)}, ${sqlBool(r.coassicurazione)}, ${sqlBool(r.emittenda)},
    ${sqlStr(r.sostituiscePolizza)}, ${r.sostituisceRiga ?? "NULL"},
    ${sqlStr(r.appendice)}, ${sqlStr(r.motivoSospensione)}, ${sqlDate(r.dataSospensione)},
    ${sqlStr(r.note)}, ${sqlStr(r.descrizione)}, ${sqlStr(r.prodottoNome)},
    'EUR', false, 1, ${sqlStr(SPECIALIST)})`;
}

const toCreate = [...madri, ...sospesi]
  .filter((r) => r.esito === "da_creare")
  .map((r) => ({ ...r, newId: randomUUID() }));
const skipped = [...madri, ...sospesi].filter((r) => r.esito === "saltata");

mkdirSync(OUT, { recursive: true });
const headerCols = `INSERT INTO public.titoli (
  id, numero_titolo, riga, stato,
  cliente_id, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  premio_netto, tasse, premio_lordo, provvigioni_firma, provvigioni_quietanza,
  frazionamento, periodicita,
  percentuale_riparto, coassicurazione, emittenda,
  sostituisce_polizza, sostituisce_riga,
  appendice, motivo_sospensione, data_sospensione,
  note, descrizione_polizza, prodotto_nome,
  valuta, tacito_rinnovo, anni_durata, specialist
) VALUES`;

let n = 0;
for (let i = 0; i < toCreate.length; i += CHUNK) {
  const slice = toCreate.slice(i, i + CHUNK);
  const mapRows = slice
    .map((r) => `  (${sqlStr(r.exeChiave)}, ${sqlStr(r.exeNumero)}, ${sqlStr(r.tipo)}, ${sqlIdent(r.newId)}, 'creata', ${sqlStr(r.motivo)})`)
    .join(",\n");
  const sql = `ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;
${headerCols}
${slice.map(titoloValues).join(",\n")};
INSERT INTO public.roma_exe_polizze_map (exe_chiave, exe_numero, exe_tipo, titolo_id, esito, motivo) VALUES
${mapRows};
ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;
`;
  writeFileSync(`${OUT}/ins-${String(n).padStart(4, "0")}.sql`, sql);
  n += 1;
}

if (skipped.length) {
  const skipSql = `INSERT INTO public.roma_exe_polizze_map (exe_chiave, exe_numero, exe_tipo, titolo_id, esito, motivo) VALUES
${skipped
  .map((r) => `  (${sqlStr(r.exeChiave)}, ${sqlStr(r.exeNumero)}, ${sqlStr(r.tipo)}, NULL, 'saltata', ${sqlStr(r.motivo)})`)
  .join(",\n")};
`;
  writeFileSync(`${OUT}/skip.sql`, skipSql);
}

writeFileSync(
  `${OUT}/manifest.json`,
  JSON.stringify({ chunks: n, toCreate: toCreate.length, skipped: skipped.length, stats }, null, 2),
);
console.log(JSON.stringify({ chunks: n, toCreate: toCreate.length, skipped: skipped.length, stats }, null, 2));
