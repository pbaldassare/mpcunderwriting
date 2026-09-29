/**
 * Date presunte di regolazione premio: anniversari di fine garanzia/durata.
 * Usa la stessa logica leap-year di quietanzePlan (Date.UTC + day overflow).
 */

function addMonthsISO(iso: string, months: number): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return "";
  const dt = new Date(Date.UTC(y, m - 1 + months, d));
  return dt.toISOString().slice(0, 10);
}

/** Aggiunge N anni a una data ISO yyyy-mm-dd. */
export function addYearsISO(iso: string, years: number): string {
  return addMonthsISO(iso, years * 12);
}

/**
 * Calcola le date presunte regolazione (fine garanzia di ogni anno).
 * base = durataDa || garanziaDa; per i=1..anni → base + i anni.
 */
export function computeRegolazioneDatePresunte(opts: {
  durataDa?: string | null;
  garanziaDa?: string | null;
  anniDurata: number;
}): string[] {
  const base = (opts.durataDa || opts.garanziaDa || "").trim();
  if (!base || !/^\d{4}-\d{2}-\d{2}$/.test(base)) return [];
  const anni = Math.max(1, Math.floor(Number(opts.anniDurata)) || 1);
  const out: string[] = [];
  for (let i = 1; i <= anni; i++) {
    const d = addYearsISO(base, i);
    if (d) out.push(d);
  }
  return out;
}

/**
 * Ridimensiona l'array date quando cambia `anni`.
 * - Indici già "touched" restano invariati.
 * - Nuove date in coda = calcolate.
 * - Excess rimossi.
 */
export function resizeRegolazioneDatePresunte(opts: {
  current: string[];
  touched: boolean[];
  durataDa?: string | null;
  garanziaDa?: string | null;
  anniDurata: number;
}): { dates: string[]; touched: boolean[] } {
  const computed = computeRegolazioneDatePresunte(opts);
  const n = computed.length;
  const dates: string[] = [];
  const touched: boolean[] = [];
  for (let i = 0; i < n; i++) {
    const wasTouched = !!opts.touched[i];
    const prev = opts.current[i];
    if (wasTouched && prev) {
      dates.push(prev);
      touched.push(true);
    } else {
      dates.push(computed[i] ?? "");
      touched.push(false);
    }
  }
  return { dates, touched };
}
