import type { GaranziaRow } from "@/components/polizze/PremiGaranziaCardShell";
import { parseDecimalItOr } from "@/lib/number";

export type MatriceProvvAccessori = {
  pctByRamoId: Map<string, number>;
  pctAccessoriByRamoId: Map<string, number>;
  pctDefault: number | null;
  pctAccessoriDefault: number | null;
  pctPrevalente: number;
  isUniform: boolean;
};

/** % netto risolta dalla sola matrice agenzia (baseline, ignora eventuali override). */
export function resolveRowPctNettoAgenzia(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (!matrice) return { pct: 0, matched: false };
  if (row.sottoramoId && matrice.pctByRamoId.has(row.sottoramoId)) {
    return { pct: matrice.pctByRamoId.get(row.sottoramoId)!, matched: true };
  }
  if (matrice.pctDefault != null) return { pct: matrice.pctDefault, matched: true };
  return { pct: matrice.pctPrevalente, matched: matrice.isUniform };
}

export function resolveRowPctNetto(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (row.provvNettoPctOverride && row.provvNettoPct != null && !Number.isNaN(row.provvNettoPct)) {
    return { pct: row.provvNettoPct, matched: true };
  }
  return resolveRowPctNettoAgenzia(row, matrice);
}

/** % accessori risolta dalla sola matrice agenzia (baseline, ignora eventuali override). */
export function resolveRowPctAccessoriAgenzia(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (!matrice) return { pct: 0, matched: false };
  if (row.sottoramoId && matrice.pctAccessoriByRamoId.has(row.sottoramoId)) {
    return { pct: matrice.pctAccessoriByRamoId.get(row.sottoramoId)!, matched: true };
  }
  // Default accessori del rapporto (es. 12%) prima del fallback sulla % netto (es. 8%)
  if (matrice.pctAccessoriDefault != null) {
    return { pct: matrice.pctAccessoriDefault, matched: true };
  }
  return resolveRowPctNettoAgenzia(row, matrice);
}

export function resolveRowPctAccessori(
  row: GaranziaRow,
  matrice: MatriceProvvAccessori | null,
): { pct: number; matched: boolean } {
  if (row.provvAccessoriPctOverride && row.provvAccessoriPct != null && !Number.isNaN(row.provvAccessoriPct)) {
    return { pct: row.provvAccessoriPct, matched: true };
  }
  return resolveRowPctAccessoriAgenzia(row, matrice);
}

/** Righe escluse dalla base provvigionale (CF/Oneri) o senza imponibile (diritti agenzia). */
export function isRigaEsclusaProvvigioni(r: GaranziaRow): boolean {
  return !!r.escludiProvvigioni || !!r.dirittiAgenzia;
}

/** Tasse auto-calcolate (campo `tasse` sulla riga). */
export function calcTasseAutoRiga(r: GaranziaRow): number {
  return parseDecimalItOr(r.tasse);
}

/** Rettifica manuale tasse (€): non influenza provvigioni, solo lordo/totali. */
export function calcTasseRettificaRiga(r: GaranziaRow): number {
  return parseDecimalItOr(r.tasseRettifica);
}

/** Tasse effettive = auto + rettifica (usate per lordo e totali). */
export function calcTasseEffettiveRiga(r: GaranziaRow | null | undefined): number {
  if (!r) return 0;
  return calcTasseAutoRiga(r) + calcTasseRettificaRiga(r);
}

/** Lordo riga: standard = netto+accessori+tasse_effettive+ssn; diritti agenzia = solo tasse. */
export function calcLordoGaranziaRow(r: GaranziaRow): number {
  const tasse = calcTasseEffettiveRiga(r);
  if (r.dirittiAgenzia) return tasse;
  const netto = parseDecimalItOr(r.netto);
  const accessori = parseDecimalItOr(r.accessori);
  const ssn = parseDecimalItOr(r.ssn);
  return calcLordoRiga(netto, accessori, tasse, ssn);
}

/** Provvigione € sul netto della riga (0 se riga esclusa). */
export function calcProvvNettoRiga(r: GaranziaRow, matrice: MatriceProvvAccessori | null): number {
  if (isRigaEsclusaProvvigioni(r)) return 0;
  const netto = parseDecimalItOr(r.netto);
  return (netto * resolveRowPctNetto(r, matrice).pct) / 100;
}

/** Provvigione € sugli accessori della riga (0 se riga esclusa). */
export function calcProvvAccessoriRiga(r: GaranziaRow, matrice: MatriceProvvAccessori | null): number {
  if (isRigaEsclusaProvvigioni(r)) return 0;
  const accessori = parseDecimalItOr(r.accessori);
  return (accessori * resolveRowPctAccessori(r, matrice).pct) / 100;
}

/** Provvigione € totale della riga (netto + accessori). */
export function calcProvvRiga(r: GaranziaRow, matrice: MatriceProvvAccessori | null): number {
  return calcProvvNettoRiga(r, matrice) + calcProvvAccessoriRiga(r, matrice);
}

/** provv = Σ(netto × pct_netto/100) + Σ(accessori × pct_accessori/100) */
export function calcProvvigioniGaranzia(
  rows: GaranziaRow[] | null | undefined,
  matrice: MatriceProvvAccessori | null,
): number {
  return (Array.isArray(rows) ? rows : []).reduce((s, r) => {
    if (isRigaEsclusaProvvigioni(r)) return s;
    const netto = parseDecimalItOr(r.netto);
    const accessori = parseDecimalItOr(r.accessori);
    const pctNetto = resolveRowPctNetto(r, matrice).pct;
    const pctAcc = resolveRowPctAccessori(r, matrice).pct;
    return s + (netto * pctNetto) / 100 + (accessori * pctAcc) / 100;
  }, 0);
}

/** Media ponderata % netto e % accessori per display footer. */
export function provvPctBreakdown(
  rows: GaranziaRow[] | null | undefined,
  matrice: MatriceProvvAccessori | null,
): { pctNetto: number; pctAccessori: number } | null {
  let totNetto = 0;
  let totAcc = 0;
  let wNetto = 0;
  let wAcc = 0;
  const list = Array.isArray(rows) ? rows : [];
  for (const r of list) {
    if (isRigaEsclusaProvvigioni(r)) continue;
    const netto = parseDecimalItOr(r.netto);
    const accessori = parseDecimalItOr(r.accessori);
    const pn = resolveRowPctNetto(r, matrice).pct;
    const pa = resolveRowPctAccessori(r, matrice).pct;
    if (netto > 0) {
      totNetto += netto;
      wNetto += netto * pn;
    }
    if (accessori > 0) {
      totAcc += accessori;
      wAcc += accessori * pa;
    }
  }
  if (totNetto <= 0 && totAcc <= 0) return null;
  return {
    pctNetto: totNetto > 0 ? wNetto / totNetto : resolveRowPctNetto(list[0] || ({} as GaranziaRow), matrice).pct,
    pctAccessori: totAcc > 0 ? wAcc / totAcc : resolveRowPctAccessori(list[0] || ({} as GaranziaRow), matrice).pct,
  };
}

/** Imponibile = netto + accessori; tasse = imponibile × aliq/100 */
export function calcTasseRiga(netto: number, accessori: number, aliquotaTasse: number): number {
  if (aliquotaTasse <= 0) return 0;
  return +(((netto + accessori) * aliquotaTasse) / 100).toFixed(2);
}

export function calcLordoRiga(netto: number, accessori: number, tasse: number, ssn: number): number {
  return netto + accessori + tasse + ssn;
}

export type DecomposeLordoArgs = {
  lordo: number;
  accessori?: number;
  aliquotaTassePct?: number;
  /** Se true, SSN = netto × aliquotaSsnPct / 100 (segue il segno del netto). */
  ssnAuto?: boolean;
  aliquotaSsnPct?: number;
  /** SSN già impostato a mano (sottratto dal lordo prima dello split netto/tasse). */
  ssnManuale?: number;
};

export type DecomposeLordoResult = {
  netto: number;
  tasse: number;
  ssn: number;
  /** Residuo di arrotondamento: lordo − (netto + accessori + tasse + ssn). */
  tasseRettifica: number;
};

/**
 * Scompone un lordo (anche negativo, es. appendice a credito) in netto / tasse / SSN.
 * Non clamapa a zero: segno del lordo si propaga alle componenti proporzionali.
 */
export function decomposeLordoToPremi(args: DecomposeLordoArgs): DecomposeLordoResult {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const lordo = Number(args.lordo) || 0;
  const accessori = Number(args.accessori) || 0;
  const r1 = (Number(args.aliquotaTassePct) || 0) / 100;
  const ssnAuto = !!args.ssnAuto && (Number(args.aliquotaSsnPct) || 0) > 0;
  const r2 = ssnAuto ? (Number(args.aliquotaSsnPct) || 0) / 100 : 0;
  const ssnManuale = ssnAuto ? 0 : Number(args.ssnManuale) || 0;
  const lordoBase = lordo - ssnManuale;

  let nettoCalc: number;
  let tasseCalc: number;
  let ssnCalc: number;
  if (r1 + r2 > 0) {
    nettoCalc = (lordoBase - accessori * (1 + r1)) / (1 + r1 + r2);
    tasseCalc = (nettoCalc + accessori) * r1;
    ssnCalc = ssnAuto ? nettoCalc * r2 : ssnManuale;
  } else {
    nettoCalc = lordoBase - accessori;
    tasseCalc = 0;
    ssnCalc = ssnManuale;
  }

  const netto = round2(nettoCalc);
  const ssn = round2(ssnCalc);
  const tasse = r1 + r2 > 0 ? round2((netto + accessori) * r1) : round2(tasseCalc);
  const tasseRettifica = round2(lordo - netto - accessori - ssn - tasse);
  return { netto, tasse, ssn, tasseRettifica };
}

/** Importo persistito in premi_garanzia_polizza.firma/rata (netto o solo tasse per diritti agenzia). */
export function premioRigaDbImporto(r: GaranziaRow): number {
  if (r.dirittiAgenzia) return parseDecimalItOr(r.tasse);
  return parseDecimalItOr(r.netto);
}
