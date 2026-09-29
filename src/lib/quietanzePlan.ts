// Helper PURO per calcolare le quietanze (rate) di una polizza.
// Usato dalla UI di Immissione Polizza per editare le rate prima del salvataggio,
// e dai test di regressione.

import { frazionamentoMesi, isPremioUnicoAnticipato, isRataUnica, type Frazionamento } from "./frazionamento";

export type QuietanzaPlanRow = {
  idx: number; // 1-based: 1 = rata alla firma, 2..N = rate successive
  garanzia_da: string; // ISO yyyy-mm-dd
  garanzia_a: string;
  data_competenza: string | null;
};

export type QuietanzaPlanInput = {
  frazionamento?: string | Frazionamento | null;
  anniDurata?: number | null;
  garanziaDa?: string | Date | null;
  garanziaA?: string | Date | null;
  durataDa?: string | Date | null;
  durataA?: string | Date | null;
  dataCompetenza?: string | Date | null;
  /** Se true: una sola quietanza sul periodo indicato, senza frazionamento. */
  polizzaTemporanea?: boolean | null;
  /** Se true: primo rateo a periodo libero, successive per frazionamento fino a durata_a. */
  polizzaRateo?: boolean | null;
};

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addMonths(d: Date, m: number): Date {
  const out = new Date(d.getTime());
  out.setMonth(out.getMonth() + m);
  return out;
}

function iso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function mesiRataFromFrazionamento(frazionamento: string): number {
  const f = frazionamento.toLowerCase();
  if (f === "poliennale") return 12;
  // Non è un frazionamento a slot: non usare in rateo / piani standard.
  if (isPremioUnicoAnticipato(f)) return 0;
  return frazionamentoMesi(f.charAt(0).toUpperCase() + f.slice(1), 1);
}

function addMonthsISO(iso: string, months: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/** Somma/sottrae giorni su data ISO yyyy-mm-dd (UTC calendar, no timezone drift). */
function addDaysISO(isoStr: string, days: number): string {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Fine contratto rateo: max(durata_da + anni, garanzia_a + 1 rata frazionamento). */
export function computeRateoDurataA({
  durataDa,
  garanziaA,
  frazionamento,
  anniDurata,
}: {
  durataDa: string;
  garanziaA?: string;
  frazionamento?: string;
  anniDurata: number;
}): string {
  if (!durataDa || anniDurata < 1) return "";
  const fromContratto = addMonthsISO(durataDa, anniDurata * 12);
  if (!garanziaA || !frazionamento) return fromContratto;
  const mesiRata = mesiRataFromFrazionamento(frazionamento);
  if (mesiRata <= 0) return fromContratto;
  const fromGaranzia = addMonthsISO(garanziaA, mesiRata);
  return fromGaranzia > fromContratto ? fromGaranzia : fromContratto;
}

function computeRateoPlan(
  garDa: Date,
  garA: Date,
  durA: Date,
  mesiRata: number,
): QuietanzaPlanRow[] {
  const rows: QuietanzaPlanRow[] = [{
    idx: 1,
    garanzia_da: iso(garDa),
    garanzia_a: iso(garA),
    data_competenza: iso(garDa),
  }];

  let da = garA;
  let idx = 2;
  while (da < durA) {
    let a = addMonths(da, mesiRata);
    if (a > durA) a = durA;
    rows.push({
      idx: idx++,
      garanzia_da: iso(da),
      garanzia_a: iso(a),
      data_competenza: iso(da),
    });
    if (a >= durA) break;
    da = a;
  }
  return rows;
}

/**
 * Calcola la lista completa delle quietanze. idx=1 e' la rata 1 (alla firma),
 * idx>=2 sono le rate successive.
 *
 * Poliennale: 1 quietanza annuale per ogni anno della durata (es. 3y -> 3 rate).
 * Premio unico anticipato: 2 quietanze con decorrenze distinte —
 *   Q1 = start → end-1 giorno; Q2 = end → end (giorno di fine).
 *   Edge: se il periodo è di 1 solo giorno, Q1 e Q2 restano sullo stesso giorno.
 * Altri frazionamenti: (12/mesi_rata) rate per ogni anno della durata.
 *
 * Ritorna [] se mancano dati indispensabili (garanzia_da/a o frazionamento).
 */
export function computeQuietanzePlan(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  const garDa = toDate(input.garanziaDa);
  const garA = toDate(input.garanziaA);
  if (!garDa || !garA) return [];

  if (input.polizzaTemporanea) {
    const competenza = toDate(input.dataCompetenza);
    return [{
      idx: 1,
      garanzia_da: iso(garDa),
      garanzia_a: iso(garA),
      data_competenza: competenza ? iso(competenza) : iso(garDa),
    }];
  }

  const f = String(input.frazionamento || "").toLowerCase();
  if (!f) return [];

  if (isRataUnica(f)) {
    const periodDa = toDate(input.durataDa) ?? garDa;
    const periodA = toDate(input.durataA) ?? garA;
    const competenza = toDate(input.dataCompetenza);
    return [{
      idx: 1,
      garanzia_da: iso(periodDa),
      garanzia_a: iso(periodA),
      data_competenza: competenza ? iso(competenza) : iso(periodDa),
    }];
  }

  if (input.polizzaRateo) {
    const durA = toDate(input.durataA);
    if (!durA) return [];
    const mesiRata = mesiRataFromFrazionamento(f);
    if (mesiRata <= 0 || mesiRata > 12) return [];
    return computeRateoPlan(garDa, garA, durA, mesiRata);
  }

  // Premio unico anticipato: Q1 copertura (start → end-1), Q2 tecnica (end → end).
  // Edge (periodo 1 giorno): day-before non valido → entrambe sullo stesso giorno.
  if (isPremioUnicoAnticipato(f)) {
    const periodDa = toDate(input.durataDa) ?? garDa;
    const periodA = toDate(input.durataA) ?? garA;
    const competenza = toDate(input.dataCompetenza);
    const daIso = iso(periodDa);
    const aIso = iso(periodA);
    const q1EndIso = daIso === aIso ? aIso : addDaysISO(aIso, -1);
    const comp = competenza ? iso(competenza) : daIso;
    return [
      { idx: 1, garanzia_da: daIso, garanzia_a: q1EndIso, data_competenza: comp },
      { idx: 2, garanzia_da: aIso, garanzia_a: aIso, data_competenza: comp },
    ];
  }

  const anni = Math.max(1, Number(input.anniDurata) || 1);

  let mesiRata: number;
  let nTot: number;
  if (f === "poliennale") {
    mesiRata = 12;
    nTot = anni;
  } else {
    mesiRata = mesiRataFromFrazionamento(f);
    if (mesiRata <= 0 || mesiRata > 12) return [];
    nTot = Math.floor(12 / mesiRata) * anni;
  }
  if (nTot < 1) return [];

  const competenza = toDate(input.dataCompetenza);
  const durA = toDate(input.durataA);
  const rows: QuietanzaPlanRow[] = [];
  for (let i = 1; i <= nTot; i++) {
    const da = addMonths(garDa, (i - 1) * mesiRata);
    // Non partire una rata a/dopo fine durata (es. 2029-06-30 → 2030).
    if (durA && da >= durA) break;
    let a = addMonths(da, mesiRata);
    if (durA && a > durA) a = durA;
    if (a <= da) break;
    rows.push({
      idx: i,
      garanzia_da: iso(da),
      garanzia_a: iso(a),
      data_competenza: competenza ? iso(addMonths(competenza, (i - 1) * mesiRata)) : null,
    });
  }
  return rows;
}

/**
 * Slot successivo alla messa a cassa di una rata.
 * La prossima garanzia parte da garanzia_a corrente; se cade a/dopo durata_a
 * della madre non si crea nulla (ultima rata legittima).
 */
export function nextQuietanzaAfterMessaCassa(input: {
  garanziaA?: string | Date | null;
  durataA?: string | Date | null;
  mesiRata: number;
}): QuietanzaPlanRow | null {
  const da = toDate(input.garanziaA);
  const durA = toDate(input.durataA);
  if (!da || input.mesiRata <= 0) return null;
  if (durA && da >= durA) return null;
  let a = addMonths(da, input.mesiRata);
  if (durA && a > durA) a = durA;
  if (a <= da) return null;
  return {
    idx: 0,
    garanzia_da: iso(da),
    garanzia_a: iso(a),
    data_competenza: iso(da),
  };
}

/** Solo le quietanze successive alla prima (idx >= 2). */
export function computeQuietanzeOnly(input: QuietanzaPlanInput): QuietanzaPlanRow[] {
  return computeQuietanzePlan(input).filter((r) => r.idx >= 2);
}
