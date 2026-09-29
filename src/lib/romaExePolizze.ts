/**
 * Mapping polizze/sospesi gestionale EXE (Roma EXE) → titoli CBnet.
 *
 * Scelte chiuse con il broker:
 * - L'elenco è il portafoglio vivo: solo polizze madri, niente rate inventate.
 * - "Data primo quietanzamento" = prossima scadenza rata → `data_competenza`.
 * - I sospesi sono le uniche quietanze: titoli figli `sospeso`.
 * - Produttori non si importano (solo nota con il codice EXE).
 * - Niente storia inventata. Trigger auto-quietanza da disabilitare in import.
 */

import { lookupRomaExeClienteId } from "@/lib/romaExeClienti";
import { lookupRomaExeCompagniaId, type RomaExeCompagniaMapRow } from "@/lib/romaExeCompagnie";
import {
  exeRamoOriginale,
  resolveRomaExeRamo,
  type CatalogoRamoCBnet,
} from "@/lib/romaExeRami";

export const ROMA_EXE_UFFICIO_CODICE = "RM2";
export const ROMA_EXE_ESTRAZIONE = "2026-03-05";

export const FRAZIONAMENTO_CB: Record<string, string> = {
  annuale: "Annuale",
  semestrale: "Semestrale",
  trimestrale: "Trimestrale",
  quadrimestrale: "Quadrimestrale",
  mensile: "Mensile",
  "una tantum": "Rata unica",
  "rata unica": "Rata unica",
  unica: "Rata unica",
  poliennale: "Poliennale",
};

const CATALOGO_RAMO_ALIAS: Record<string, string> = {
  CREDITO: "CC",
  "GLOB.FABB": "LT",
  "GLOB.FABB.": "LT",
  "GLOBALE FABBRICATO": "LT",
  "GLOB FABB": "LT",
  "L. FAMIGLIA": "PE",
  "L FAMIGLIA": "PE",
  "RC FAMIGLIA": "PE",
};

export type RomaExeElencoRiga = {
  numero?: string | null;
  clienteCodice?: string | number | null;
  clienteNome?: string | null;
  effetto?: unknown;
  scadenza?: unknown;
  primoQuietanzamento?: unknown;
  premioLordo?: number | null;
  imponibileFuture?: number | null;
  tasseFuture?: number | null;
  provvigioniAttive?: number | null;
  frazionamento?: string | null;
  gruppoNome?: string | null;
  ramoCodice?: string | number | null;
  ramoDescrizione?: string | null;
  compagniaNome?: string | null;
  quota?: number | null;
  produttoreCodice?: string | number | null;
};

export type RomaExeSospesoRiga = {
  numero?: string | null;
  appendice?: string | null;
  compagniaNome?: string | null;
  rischio?: string | null;
  effetto?: unknown;
  scadenza?: unknown;
  importo?: number | null;
  importoResiduo?: number | null;
  provvigioniAttive?: number | null;
  clienteNome?: string | null;
  gruppoNome?: string | null;
};

export type ClienteNomeRef = {
  exe_codice?: string;
  cliente_id: string | null;
  ragione_sociale?: string | null;
};

export type RomaExePolizzaRisolta = {
  exeChiave: string;
  tipo: "polizza" | "quietanza";
  esito: "da_creare" | "saltata";
  motivo: string;
  exeNumero: string;
  numeroTitolo: string;
  riga: number;
  stato: "attivo" | "sospeso";
  clienteId: string | null;
  compagniaId: string | null;
  ramoId: string | null;
  garanziaDa: string | null;
  garanziaA: string | null;
  dataCompetenza: string | null;
  premioNetto: number;
  premioLordo: number;
  tasse: number;
  provvigioni: number;
  frazionamento: string | null;
  percentualeRiparto: number;
  coassicurazione: boolean;
  emittenda: boolean;
  sostituiscePolizza: string | null;
  sostituisceRiga: number | null;
  appendice: string | null;
  motivoSospensione: string | null;
  dataSospensione: string | null;
  note: string | null;
  descrizione: string | null;
  prodottoNome: string | null;
};

function normSpace(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function excelSerialToIso(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 10);
  }
  const s = normSpace(String(value));
  const it = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (it) return `${it[3]}-${it[2].padStart(2, "0")}-${it[1].padStart(2, "0")}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

export function normalizeNumeroPolizza(raw: string | null | undefined): string {
  return normSpace(raw);
}

export function isPlaceholderNumero(raw: string | null | undefined): boolean {
  const n = normalizeNumeroPolizza(raw).toUpperCase();
  if (!n) return true;
  if (["EMITT", "FIDO", "NON NS", "111", "1111"].includes(n)) return true;
  if (n.includes("NON NS")) return true;
  if (n.includes("LETTERA DI IMPEGNO")) return true;
  return false;
}

export function mapFrazionamentoExe(raw: string | null | undefined): string | null {
  const key = normSpace(raw).toLowerCase();
  if (!key) return null;
  return FRAZIONAMENTO_CB[key] ?? null;
}

export function quotaToPercentuale(quota: number | null | undefined): number {
  const q = Number(quota);
  if (!Number.isFinite(q) || q <= 0) return 100;
  if (q <= 1) return Math.round(q * 10000) / 100;
  if (q <= 100) return Math.round(q * 100) / 100;
  return Math.round((q / 10) * 100) / 100;
}

export function money(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function noteParts(parts: Array<string | null | undefined>): string | null {
  const rows = parts.map((p) => normSpace(p)).filter(Boolean);
  return rows.length ? rows.join("\n") : null;
}

function resolveRamoId(
  codice: string | number | null | undefined,
  descrizione: string | null | undefined,
  catalogo: CatalogoRamoCBnet[],
): { ramoId: string | null; prodottoNome: string | null } {
  const mapped = resolveRomaExeRamo(codice, descrizione, catalogo);
  if (mapped) return { ramoId: mapped.ramoId, prodottoNome: mapped.ramoDescrizione };
  const alias = CATALOGO_RAMO_ALIAS[normSpace(descrizione).toUpperCase()];
  if (alias) {
    const row = catalogo.find((r) => r.codice.toUpperCase() === alias);
    if (row) return { ramoId: row.id, prodottoNome: row.descrizione ?? alias };
  }
  const desc = normSpace(descrizione).toUpperCase();
  const byDesc = catalogo.find((r) => normSpace(r.descrizione).toUpperCase() === desc);
  return {
    ramoId: byDesc?.id ?? null,
    prodottoNome: byDesc?.descrizione ?? (descrizione ? normSpace(descrizione) : null),
  };
}

export function lookupClienteByNome(
  nome: string | null | undefined,
  clienti: ClienteNomeRef[],
): string | null {
  const want = normSpace(nome).toUpperCase();
  if (!want) return null;
  const exact = clienti.find((c) => c.cliente_id && normSpace(c.ragione_sociale).toUpperCase() === want);
  if (exact?.cliente_id) return exact.cliente_id;
  const loose = clienti.filter((c) => {
    const have = normSpace(c.ragione_sociale).toUpperCase();
    return Boolean(c.cliente_id && have && (have === want || have.startsWith(`${want} `) || want.startsWith(have)));
  });
  return loose.length === 1 ? loose[0].cliente_id : null;
}

export function buildNumeroTitolo(opts: {
  exeNumero: string;
  clienteCodice?: string | number | null;
  ramoCodice?: string | number | null;
  compagniaId?: string | null;
  scadenza?: string | null;
  seq: number;
  taken: Set<string>;
}): { numero: string; emittenda: boolean; remapped: boolean } {
  const raw = normalizeNumeroPolizza(opts.exeNumero);
  const placeholder = isPlaceholderNumero(raw);
  const base = placeholder
    ? `RM2-${String(opts.clienteCodice ?? "X")}-${String(opts.ramoCodice ?? "R")}-${opts.seq}`
    : raw;
  let numero = base;
  let i = 1;
  const collisionKey = (n: string) => `${n}|${opts.compagniaId ?? ""}|${opts.scadenza ?? ""}`;
  while (opts.taken.has(collisionKey(numero))) {
    i += 1;
    numero = `${base}-RM2${i}`;
  }
  opts.taken.add(collisionKey(numero));
  return { numero, emittenda: placeholder && /^emitt$/i.test(raw), remapped: numero !== raw };
}

export function resolveRomaExePolizza(
  riga: RomaExeElencoRiga,
  seq: number,
  catalogs: {
    rami: CatalogoRamoCBnet[];
    compagnieMap: RomaExeCompagniaMapRow[];
    clientiMap: Array<{ exe_codice: string; cliente_id: string | null }>;
    taken: Set<string>;
  },
): RomaExePolizzaRisolta {
  const exeNumero = normalizeNumeroPolizza(riga.numero);
  const exeChiave = `elenco:${seq}`;
  const compagniaNome = normSpace(riga.compagniaNome);
  const clienteId = lookupRomaExeClienteId(riga.clienteCodice, catalogs.clientiMap);
  const compagniaId = lookupRomaExeCompagniaId(null, compagniaNome, catalogs.compagnieMap);
  const ramo = resolveRamoId(riga.ramoCodice, riga.ramoDescrizione, catalogs.rami);
  const effetto = excelSerialToIso(riga.effetto);
  const scadenza = excelSerialToIso(riga.scadenza);
  const competenza = excelSerialToIso(riga.primoQuietanzamento);
  const lordo = money(riga.premioLordo);
  const quotaPct = quotaToPercentuale(riga.quota);
  const frazionamento = mapFrazionamentoExe(riga.frazionamento);
  const built = buildNumeroTitolo({
    exeNumero,
    clienteCodice: riga.clienteCodice,
    ramoCodice: riga.ramoCodice,
    compagniaId,
    scadenza,
    seq,
    taken: catalogs.taken,
  });

  const skipReasons: string[] = [];
  if (!exeNumero) skipReasons.push("Numero polizza vuoto");
  if (!clienteId) skipReasons.push("Cliente EXE non in mappa");
  if (!compagniaId) {
    skipReasons.push(compagniaNome ? `Compagnia non collegata (${compagniaNome})` : "Compagnia mancante");
  }
  if (!ramo.ramoId) {
    skipReasons.push(`Ramo non mappato (${exeRamoOriginale(riga.ramoCodice, riga.ramoDescrizione)})`);
  }
  if (!effetto || !scadenza) skipReasons.push("Date effetto/scadenza mancanti");

  const note = noteParts([
    built.remapped ? `Numero EXE originale: ${exeNumero}` : null,
    riga.gruppoNome ? `Gruppo cliente EXE: ${normSpace(String(riga.gruppoNome))}` : null,
    riga.produttoreCodice != null && String(riga.produttoreCodice).trim()
      ? `Produttore EXE (non importato): ${String(riga.produttoreCodice).trim()}`
      : null,
    riga.imponibileFuture != null || riga.tasseFuture != null
      ? `Imponibile/tasse future EXE: ${money(riga.imponibileFuture)} / ${money(riga.tasseFuture)}`
      : null,
  ]);

  const base: RomaExePolizzaRisolta = {
    exeChiave,
    tipo: "polizza",
    esito: "da_creare",
    motivo: built.remapped ? `Numero riassegnato da ${exeNumero}` : "Polizza EXE",
    exeNumero,
    numeroTitolo: built.numero,
    riga: 1,
    stato: "attivo",
    clienteId,
    compagniaId,
    ramoId: ramo.ramoId,
    garanziaDa: effetto,
    garanziaA: scadenza,
    dataCompetenza: competenza,
    premioNetto: lordo,
    premioLordo: lordo,
    tasse: 0,
    provvigioni: money(riga.provvigioniAttive),
    frazionamento,
    percentualeRiparto: quotaPct,
    coassicurazione: quotaPct < 99.99,
    emittenda: built.emittenda,
    sostituiscePolizza: null,
    sostituisceRiga: null,
    appendice: null,
    motivoSospensione: null,
    dataSospensione: null,
    note,
    descrizione: noteParts([ramo.prodottoNome, riga.clienteNome ? normSpace(riga.clienteNome) : null]),
    prodottoNome: ramo.prodottoNome,
  };

  if (skipReasons.length) {
    return { ...base, esito: "saltata", motivo: skipReasons.join("; ") };
  }
  return base;
}

export function matchMadrePerSospeso(
  sospeso: RomaExeSospesoRiga,
  madri: RomaExePolizzaRisolta[],
  compagniaId?: string | null,
): RomaExePolizzaRisolta | null {
  const num = normalizeNumeroPolizza(sospeso.numero).toUpperCase();
  if (!num) return null;
  const sameNum = madri.filter(
    (m) => m.esito === "da_creare" && normalizeNumeroPolizza(m.exeNumero).toUpperCase() === num,
  );
  if (sameNum.length === 0) return null;
  if (compagniaId) {
    const byComp = sameNum.filter((m) => m.compagniaId === compagniaId);
    if (byComp.length) return byComp[0];
  }
  return sameNum[0];
}

export function resolveRomaExeSospeso(
  riga: RomaExeSospesoRiga,
  seq: number,
  ctx: {
    madri: RomaExePolizzaRisolta[];
    rami: CatalogoRamoCBnet[];
    compagnieMap: RomaExeCompagniaMapRow[];
    clientiMap: ClienteNomeRef[];
    nextRiga: Map<string, number>;
  },
): RomaExePolizzaRisolta {
  const exeNumero = normalizeNumeroPolizza(riga.numero);
  const exeChiave = `sospeso:${seq}`;
  const compagniaNome = normSpace(riga.compagniaNome);
  const compagniaLookup = lookupRomaExeCompagniaId(null, compagniaNome, ctx.compagnieMap);
  const madre = matchMadrePerSospeso(riga, ctx.madri, compagniaLookup);
  const clienteId = madre?.clienteId ?? lookupClienteByNome(riga.clienteNome, ctx.clientiMap);
  const compagniaId = madre?.compagniaId ?? compagniaLookup;
  const ramo = madre?.ramoId
    ? { ramoId: madre.ramoId, prodottoNome: madre.prodottoNome }
    : resolveRamoId(null, riga.rischio, ctx.rami);
  const effetto = excelSerialToIso(riga.effetto);
  const scadenza = excelSerialToIso(riga.scadenza);
  const importo = money(riga.importoResiduo ?? riga.importo);
  const appendice = normSpace(riga.appendice) || null;

  const skipReasons: string[] = [];
  if (!exeNumero) skipReasons.push("Numero polizza vuoto");
  if (!clienteId) skipReasons.push(`Cliente non trovato (${normSpace(riga.clienteNome)})`);
  if (!compagniaId) {
    skipReasons.push(compagniaNome ? `Compagnia non collegata (${compagniaNome})` : "Compagnia mancante");
  }
  if (!effetto || !scadenza) skipReasons.push("Date rata mancanti");

  const numeroTitolo = madre?.numeroTitolo || exeNumero;
  const rigaFiglia = ctx.nextRiga.get(numeroTitolo) ?? 2;
  ctx.nextRiga.set(numeroTitolo, rigaFiglia + 1);

  const base: RomaExePolizzaRisolta = {
    exeChiave,
    tipo: "quietanza",
    esito: "da_creare",
    motivo: madre ? "Sospeso EXE" : "Sospeso orfano EXE",
    exeNumero,
    numeroTitolo,
    riga: rigaFiglia,
    stato: "sospeso",
    clienteId,
    compagniaId,
    ramoId: ramo.ramoId,
    garanziaDa: effetto,
    garanziaA: scadenza,
    dataCompetenza: effetto,
    premioNetto: importo,
    premioLordo: importo,
    tasse: 0,
    provvigioni: money(riga.provvigioniAttive),
    frazionamento: madre?.frazionamento ?? null,
    percentualeRiparto: madre?.percentualeRiparto ?? 100,
    coassicurazione: madre?.coassicurazione ?? false,
    emittenda: false,
    sostituiscePolizza: numeroTitolo,
    sostituisceRiga: 1,
    appendice,
    motivoSospensione: appendice,
    dataSospensione: ROMA_EXE_ESTRAZIONE,
    note: noteParts([
      madre ? null : "Quietanza orfana EXE: polizza non in elenco al 05.03.2026",
      riga.gruppoNome ? `Gruppo EXE: ${normSpace(riga.gruppoNome)}` : null,
      riga.clienteNome ? `Cliente EXE: ${normSpace(riga.clienteNome)}` : null,
    ]),
    descrizione: noteParts([ramo.prodottoNome, appendice]),
    prodottoNome: ramo.prodottoNome,
  };

  if (skipReasons.length) {
    return { ...base, esito: "saltata", motivo: skipReasons.join("; ") };
  }
  return base;
}
