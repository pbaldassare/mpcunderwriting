/**
 * Logica coassicurazione: riparto premio/provvigioni tra più compagnie.
 */

export interface RipartoCoassicurazioneRow {
  /** Chiave locale React (non persistita) */
  localId: string;
  gruppoCompagniaId: string;
  compagniaId: string;
  rapportoId: string;
  quotaPercentuale: string;
}

export interface RipartoImportiTotals {
  netto: number;
  addizionali: number;
  tasse: number;
  lordo: number;
}

export interface RipartoProvvInfo {
  totale: number;
  provvNetto: number;
  provvAddizionali: number;
  percProvvNetto: number;
  percProvvAddizionali: number;
}

export interface RipartoImportiCalcolati {
  netto: number;
  addizionali: number;
  tasse: number;
  totale: number;
  provv_netto: number;
  provv_addizionali: number;
}

export interface LeaderPrefill {
  gruppoCompagniaId?: string;
  compagniaId?: string;
  rapportoId?: string;
}

export const QUOTA_MAX = 100;
export const QUOTA_TOLERANCE = 0.01;

let ripartoIdCounter = 0;

export function newRipartoLocalId(): string {
  ripartoIdCounter += 1;
  return `riparto-${Date.now()}-${ripartoIdCounter}`;
}

export function emptyRipartoRow(overrides?: Partial<RipartoCoassicurazioneRow>): RipartoCoassicurazioneRow {
  return {
    localId: newRipartoLocalId(),
    gruppoCompagniaId: "",
    compagniaId: "",
    rapportoId: "",
    quotaPercentuale: "",
    ...overrides,
  };
}

export function roundQuota(v: number): number {
  return Math.round(v * 100) / 100;
}

export function parseQuotaPercentuale(raw: string): number {
  const n = parseFloat(String(raw).replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Normalizza input quota: solo cifre/virgola, max 2 decimali, tetto 100. */
export function sanitizeQuotaInput(raw: string, finalize = false): string {
  let s = raw.replace(",", ".").replace(/[^\d.]/g, "");
  const dotParts = s.split(".");
  if (dotParts.length > 2) {
    s = `${dotParts[0]}.${dotParts.slice(1).join("")}`;
  }
  const [intPart = "", decPart] = s.split(".");
  if (decPart !== undefined && decPart.length > 2) {
    s = `${intPart}.${decPart.slice(0, 2)}`;
  }
  if (s === "" || s === ".") return finalize ? "" : s;

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return "";

  if (n > QUOTA_MAX) return String(QUOTA_MAX);
  if (finalize) return String(roundQuota(Math.max(0, n)));
  return s;
}

export type QuotaRowIssue = "empty" | "invalid" | "zero" | "over_max";

export function validateQuotaRow(raw: string): {
  valid: boolean;
  value: number;
  issue?: QuotaRowIssue;
} {
  const trimmed = String(raw).trim();
  if (!trimmed) return { valid: false, value: 0, issue: "empty" };
  const n = parseFloat(trimmed.replace(",", "."));
  if (!Number.isFinite(n)) return { valid: false, value: 0, issue: "invalid" };
  if (n <= 0) return { valid: false, value: n, issue: "zero" };
  if (n > QUOTA_MAX) return { valid: false, value: n, issue: "over_max" };
  return { valid: true, value: roundQuota(n) };
}

export function sumQuotePercentuali(
  rows: Pick<RipartoCoassicurazioneRow, "quotaPercentuale">[] | null | undefined,
): number {
  if (!Array.isArray(rows)) return 0;
  return roundQuota(rows.reduce((s, r) => s + parseQuotaPercentuale(r?.quotaPercentuale), 0));
}

export type QuotaSumStatus = "ok" | "under" | "over";

export function getQuotaSumStatus(sum: number): QuotaSumStatus {
  const rounded = roundQuota(sum);
  const diffCents = Math.abs(Math.round(rounded * 100) - Math.round(QUOTA_MAX * 100));
  if (diffCents <= 1) return "ok";
  return rounded > QUOTA_MAX ? "over" : "under";
}

export function calcResiduoQuota(rows: RipartoCoassicurazioneRow[], excludeIdx: number): number {
  const sumOthers = rows.reduce((s, r, i) => {
    if (i === excludeIdx) return s;
    return s + parseQuotaPercentuale(r.quotaPercentuale);
  }, 0);
  return roundQuota(QUOTA_MAX - sumOthers);
}

export function applyResiduoToRow(
  rows: RipartoCoassicurazioneRow[],
  idx: number,
): RipartoCoassicurazioneRow[] {
  const residuo = calcResiduoQuota(rows, idx);
  if (residuo <= 0 || residuo > QUOTA_MAX) return rows;
  return rows.map((r, i) => (i === idx ? { ...r, quotaPercentuale: String(residuo) } : r));
}

/** Quote che sommano a 100% (ultima riga assorbe arrotondamenti). */
export function splitQuoteEvenly(count: number): string[] {
  if (count <= 0) return [];
  if (count === 1) return ["100"];
  const base = roundQuota(QUOTA_MAX / count);
  const quotas = Array.from({ length: count }, () => String(base));
  const sumExceptLast = quotas
    .slice(0, -1)
    .reduce((s, q) => s + parseQuotaPercentuale(q), 0);
  quotas[count - 1] = String(roundQuota(QUOTA_MAX - sumExceptLast));
  return quotas;
}

export function redistributeQuoteEvenly(rows: RipartoCoassicurazioneRow[]): RipartoCoassicurazioneRow[] {
  const quotas = splitQuoteEvenly(rows.length);
  return rows.map((r, i) => ({ ...r, quotaPercentuale: quotas[i] ?? "" }));
}

export function buildInitialCoassRows(leader?: LeaderPrefill): RipartoCoassicurazioneRow[] {
  const leaderRow = emptyRipartoRow({
    gruppoCompagniaId: leader?.gruppoCompagniaId || "",
    compagniaId: leader?.compagniaId || "",
    rapportoId: leader?.rapportoId || "",
    quotaPercentuale: "50",
  });
  const followerRow = emptyRipartoRow({ quotaPercentuale: "50" });
  return [leaderRow, followerRow];
}

export function isRipartoSumValidForPreview(rows: RipartoCoassicurazioneRow[] | null | undefined): boolean {
  return validateRipartoSum(rows).valid;
}

export function validateRipartoSum(rows: RipartoCoassicurazioneRow[] | null | undefined): {
  valid: boolean;
  sum: number;
  message?: string;
} {
  const list = Array.isArray(rows) ? rows : [];
  const rounded = sumQuotePercentuali(list);
  if (list.length === 0) {
    return { valid: false, sum: 0, message: "Aggiungi almeno una riga di coassicurazione" };
  }
  if (Math.abs(rounded - QUOTA_MAX) > QUOTA_TOLERANCE) {
    return {
      valid: false,
      sum: rounded,
      message: `La somma delle quote deve essere 100% (attuale: ${rounded.toFixed(2)}%)`,
    };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    if (!row?.gruppoCompagniaId) {
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: seleziona la Compagnia Assicurativa` };
    }
    if (!row?.compagniaId) {
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: seleziona l'Agenzia` };
    }
    const rowCheck = validateQuotaRow(row.quotaPercentuale);
    if (!rowCheck.valid) {
      if (rowCheck.issue === "over_max") {
        return { valid: false, sum: rounded, message: `Riga ${i + 1}: la quota non può superare 100%` };
      }
      return { valid: false, sum: rounded, message: `Riga ${i + 1}: quota % obbligatoria (maggiore di 0)` };
    }
  }
  return { valid: true, sum: rounded };
}

const round2 = (v: number) => Math.round(v * 100) / 100;

/** Ripartisce importi totali in base alle quote % (ultima riga assorbe arrotondamenti). */
export function calcRipartoImporti(
  totals: RipartoImportiTotals,
  rows: Pick<RipartoCoassicurazioneRow, "quotaPercentuale">[] | null | undefined,
  provv?: RipartoProvvInfo,
): RipartoImportiCalcolati[] {
  const list = Array.isArray(rows) ? rows : [];
  const n = list.length;
  if (n === 0) return [];

  const acc = { netto: 0, addizionali: 0, tasse: 0, totale: 0, provv_netto: 0, provv_addizionali: 0 };
  const out: RipartoImportiCalcolati[] = [];

  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const q = parseQuotaPercentuale(list[i]?.quotaPercentuale) / 100;

    const netto = isLast ? round2(totals.netto - acc.netto) : round2(totals.netto * q);
    const addizionali = isLast ? round2(totals.addizionali - acc.addizionali) : round2(totals.addizionali * q);
    const tasse = isLast ? round2(totals.tasse - acc.tasse) : round2(totals.tasse * q);
    const totale = isLast ? round2(totals.lordo - acc.totale) : round2(totals.lordo * q);
    const provv_netto = provv
      ? (isLast ? round2(provv.provvNetto - acc.provv_netto) : round2(provv.provvNetto * q))
      : 0;
    const provv_addizionali = provv
      ? (isLast ? round2(provv.provvAddizionali - acc.provv_addizionali) : round2(provv.provvAddizionali * q))
      : 0;

    acc.netto += netto;
    acc.addizionali += addizionali;
    acc.tasse += tasse;
    acc.totale += totale;
    acc.provv_netto += provv_netto;
    acc.provv_addizionali += provv_addizionali;

    out.push({ netto, addizionali, tasse, totale, provv_netto, provv_addizionali });
  }

  return out;
}

export function buildDettaglioRipartoInsert(
  titoloId: string,
  rows: RipartoCoassicurazioneRow[],
  totals: RipartoImportiTotals,
  provv?: RipartoProvvInfo,
  tipoPagamento = "C",
) {
  const importi = calcRipartoImporti(totals, rows, provv);
  return rows.map((row, idx) => {
    const imp = importi[idx];
    return {
      titolo_id: titoloId,
      compagnia_id: row.compagniaId || null,
      gruppo_compagnia_id: row.gruppoCompagniaId || null,
      compagnia_rapporto_id: row.rapportoId || null,
      quota_percentuale: parseQuotaPercentuale(row.quotaPercentuale),
      perc_provv_netto: provv?.percProvvNetto ?? 0,
      perc_provv_addizionali: provv?.percProvvAddizionali ?? 0,
      netto: imp.netto,
      addizionali: imp.addizionali,
      tasse: imp.tasse,
      totale: imp.totale,
      provv_netto: imp.provv_netto,
      provv_addizionali: imp.provv_addizionali,
      tipo_pagamento: tipoPagamento,
    };
  });
}

/** Singola riga 100% (polizza non coassicurata). */
/** Converte righe DB dettaglio_riparto in righe editor coassicurazione. */
export function ripartoRowsFromDettaglio(
  rows: Array<{
    id?: string;
    gruppo_compagnia_id?: string | null;
    compagnia_id?: string | null;
    compagnia_rapporto_id?: string | null;
    quota_percentuale?: number | null;
  }>,
): RipartoCoassicurazioneRow[] {
  return rows.map((r) => ({
    localId: r.id || newRipartoLocalId(),
    gruppoCompagniaId: r.gruppo_compagnia_id || "",
    compagniaId: r.compagnia_id || "",
    rapportoId: r.compagnia_rapporto_id || "",
    quotaPercentuale: r.quota_percentuale != null ? String(r.quota_percentuale) : "",
  }));
}

export function buildDettaglioRipartoSingolo(
  titoloId: string,
  compagniaId: string,
  totals: RipartoImportiTotals,
  provv?: RipartoProvvInfo,
  extras?: { gruppoCompagniaId?: string | null; compagniaRapportoId?: string | null },
) {
  return buildDettaglioRipartoInsert(
    titoloId,
    [{
      localId: "single",
      gruppoCompagniaId: extras?.gruppoCompagniaId || "",
      compagniaId,
      rapportoId: extras?.compagniaRapportoId || "",
      quotaPercentuale: "100",
    }],
    totals,
    provv,
  );
}
