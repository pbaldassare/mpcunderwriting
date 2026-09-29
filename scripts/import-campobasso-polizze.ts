/**
 * Import parziale polizze sede Campobasso.
 * Uso:
 *   bun scripts/import-campobasso-polizze.ts --emit-sql
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import {
  CAMPOBASSO_UFFICIO_ID,
  planCampobassoPolizze,
  type CampobassoCatalogs,
  type CampobassoPolizzaRiga,
  type CampobassoTitoloPianificato,
} from "../src/lib/campobassoPolizze.ts";

const EXCEL =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "/root/.local/share/cursor-agent-cbnet/projects/home-ubuntu-cursor-projects-cbnet/uploads/polizze_sede_Campobasso_9669.xlsx";
const OUT = "/tmp/campobasso-polizze-sql";
const CHUNK = 20;

function sqlStr(v: string | null | undefined): string {
  if (v == null || v === "") return "NULL";
  return `'${v.replace(/'/g, "''")}'`;
}

function sqlIdent(id: string | null | undefined): string {
  return id ? `'${id}'::uuid` : "NULL";
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

function titoloValues(r: CampobassoTitoloPianificato & { newId: string; madreId?: string | null }): string {
  return `(${[
    sqlIdent(r.newId),
    sqlStr(r.numeroTitolo),
    r.riga,
    sqlStr(r.stato),
    "NULL",
    sqlIdent(r.clienteId),
    sqlIdent(r.compagniaId),
    sqlIdent(r.ramoId),
    sqlIdent(CAMPOBASSO_UFFICIO_ID),
    sqlDate(r.garanziaDa),
    sqlDate(r.garanziaA),
    sqlDate(r.durataDa),
    sqlDate(r.durataA),
    sqlDate(r.dataScadenza),
    sqlDate(r.dataCompetenza),
    sqlDate(r.dataMessaCassa),
    sqlDate(r.dataIncasso),
    sqlNum(r.importoIncassato),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlNum(r.premioLordo),
    sqlNum(r.provvigioni),
    sqlNum(r.provvigioni),
    sqlNum(r.premioNetto),
    sqlNum(r.tasse),
    sqlStr(r.frazionamento),
    sqlStr(r.frazionamento),
    r.rate,
    r.anniDurata,
    sqlNum(r.percentualeRiparto),
    sqlBool(r.tacitoRinnovo),
    sqlBool(r.emittenda),
    sqlBool(r.isAppendiceModifica),
    r.isAppendiceModifica && r.madreId ? sqlIdent(r.madreId) : "NULL",
    sqlStr(r.sostituiscePolizza),
    r.sostituisceRiga ?? "NULL",
    sqlStr(r.appendice),
    sqlStr(r.cigRif),
    sqlStr(r.descrizione),
    sqlStr(r.note),
    sqlStr(r.prodottoNome),
    sqlStr(r.specialist),
    sqlStr(r.aeNome),
    sqlStr(r.produttoreNome),
    sqlStr(r.tipoIncasso),
    sqlStr(r.contoIncasso),
    sqlStr(r.tipoPortafoglio),
    sqlStr(r.valuta),
    sqlNum(r.cambio),
    sqlDate(r.compContabile),
    sqlDate(r.compAssicurativa),
    sqlStr("CB"),
    r.fileId && /^\d+$/.test(r.fileId) ? r.fileId : "NULL",
  ].join(", ")})`;
}

function appendiceValues(opts: {
  id: string;
  madreId: string;
  titoloId: string;
  numero: string;
  r: CampobassoTitoloPianificato;
}): string {
  const tipo =
    opts.r.fileTipoDoc === "PR" ? "regolazione" : "modifica";
  return `(${[
    sqlIdent(opts.id),
    sqlIdent(opts.madreId),
    sqlStr(opts.numero),
    sqlDate(opts.r.garanziaDa),
    sqlDate(opts.r.garanziaDa),
    sqlStr(opts.r.descrizione || opts.r.appendice || `Appendice ${opts.r.fileTipoDoc}`),
    sqlStr(tipo),
    sqlStr(opts.r.note),
    sqlIdent(opts.titoloId),
    sqlNum(opts.r.premioNetto),
    sqlNum(opts.r.tasse),
    sqlNum(opts.r.premioLordo),
    sqlNum(opts.r.provvigioni),
    `'[]'::jsonb`,
  ].join(", ")})`;
}

function main() {
  const catalogs = JSON.parse(readFileSync("/tmp/cb_polizze_catalogs.json", "utf8")) as CampobassoCatalogs;
  const rows = XLSX.utils.sheet_to_json<CampobassoPolizzaRiga>(
    XLSX.readFile(EXCEL, { cellDates: true }).Sheets.Sheet1,
    { defval: null, raw: false },
  );
  const plan = planCampobassoPolizze(rows, catalogs);

  const withIds = plan.gruppi
    .filter((g) => g.esito === "da_creare" && g.madre)
    .map((g) => {
      const madreId = randomUUID();
      const madre = { ...g.madre!, newId: madreId };
      const quietanze = g.quietanze.map((q) => ({ ...q, newId: randomUUID(), madreId }));
      const appendici = g.appendici.map((a) => ({ ...a, newId: randomUUID(), madreId }));
      return { ...g, madre, quietanze, appendici };
    });

  const madri = withIds.map((g) => g.madre);
  const quietanze = withIds.flatMap((g) => g.quietanze);
  const appendici = withIds.flatMap((g) => g.appendici);
  const appendiciPolizza = appendici.map((a, i) => ({
    id: randomUUID(),
    madreId: a.madreId!,
    titoloId: a.newId,
    numero: String(i + 1),
    r: a,
  }));
  // numero_appendice per madre, non globale
  const seqByMadre = new Map<string, number>();
  for (const row of appendiciPolizza) {
    const n = (seqByMadre.get(row.madreId) || 0) + 1;
    seqByMadre.set(row.madreId, n);
    row.numero = String(n);
  }

  mkdirSync(OUT, { recursive: true });
  writeFileSync(
    `${OUT}/plan.json`,
    JSON.stringify(
      {
        file: EXCEL,
        rows: rows.length,
        stats: plan.stats,
        saltati: plan.saltati.map((s) => ({
          numero: s.numero,
          compagnia: s.compagniaCodice,
          motivo: s.motivo,
        })),
      },
      null,
      2,
    ),
  );

  const header = `INSERT INTO public.titoli (
  id, numero_titolo, riga, stato,
  cliente_id, cliente_anagrafica_id,
  compagnia_id, ramo_id, ufficio_id,
  garanzia_da, garanzia_a, durata_da, durata_a, data_scadenza, data_competenza,
  data_messa_cassa, data_incasso, importo_incassato,
  premio_netto, tasse, premio_lordo, provvigioni_firma, provvigioni_quietanza,
  premio_netto_quietanza, tasse_quietanza,
  frazionamento, periodicita, rate, anni_durata, percentuale_riparto,
  tacito_rinnovo, emittenda, is_appendice_modifica, appendice_modifica_polizza_madre_id,
  sostituisce_polizza, sostituisce_riga, appendice, cig_rif,
  descrizione_polizza, note, prodotto_nome,
  specialist, ae_nome, produttore_nome, tipo_incasso, conto_incasso, tipo_portafoglio,
  valuta, cambio, comp_contabile, comp_assicurativa, filiale, id_legacy
) VALUES`;

  const allTitoli = [...madri, ...quietanze, ...appendici];
  let n = 0;
  for (let i = 0; i < allTitoli.length; i += CHUNK) {
    const slice = allTitoli.slice(i, i + CHUNK);
    const sql = `ALTER TABLE public.titoli DISABLE TRIGGER trg_genera_quietanze_su_insert_madre;
${header}
${slice.map((r) => titoloValues(r)).join(",\n")};
ALTER TABLE public.titoli ENABLE TRIGGER trg_genera_quietanze_su_insert_madre;
`;
    writeFileSync(`${OUT}/ins-${String(n).padStart(4, "0")}.sql`, sql);
    n += 1;
  }

  let a = 0;
  for (let i = 0; i < appendiciPolizza.length; i += 20) {
    const slice = appendiciPolizza.slice(i, i + 20);
    const sql = `INSERT INTO public.appendici_polizza (
  id, titolo_id, numero_appendice, data_appendice, data_effetto, oggetto, tipo, note,
  titolo_modifica_id, premio_netto, tasse, premio_lordo, provvigioni, allegati
) VALUES
${slice.map(appendiceValues).join(",\n")};
`;
    writeFileSync(`${OUT}/app-${String(a).padStart(4, "0")}.sql`, sql);
    a += 1;
  }

  writeFileSync(
    `${OUT}/manifest.json`,
    JSON.stringify(
      {
        chunks: n,
        appendiceChunks: a,
        madri: madri.length,
        quietanze: quietanze.length,
        appendici: appendici.length,
        stats: plan.stats,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        out: OUT,
        chunks: n,
        appendiceChunks: a,
        madri: madri.length,
        quietanze: quietanze.length,
        appendici: appendici.length,
        stats: plan.stats,
      },
      null,
      2,
    ),
  );
}

main();
