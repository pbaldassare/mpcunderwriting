import { endOfMonth, format, subMonths } from "date-fns";

/**
 * Default "Data limite incasso" (E/C agenzie e produttori).
 *
 * Il mese di competenza non gira il 1° ma l'11:
 * - qualsiasi giorno di settembre → 30/09
 * - 1–10 del mese successivo → ancora fine mese precedente (es. 10/10 → 30/09)
 * - dall'11 fino al 10 del mese dopo → fine mese corrente (es. 11/10–10/11 → 31/10)
 */
export function defaultDataLimiteIncasso(now: Date = new Date()): Date {
  const day = now.getDate();
  const month = now.getMonth();

  // Settembre: tutto il mese solare resta sul 30/09 (anche l'1–10).
  if (month === 8) {
    return endOfMonth(now);
  }

  if (day <= 10) {
    return endOfMonth(subMonths(now, 1));
  }
  return endOfMonth(now);
}

export function defaultDataLimiteIncassoIso(now: Date = new Date()): string {
  return format(defaultDataLimiteIncasso(now), "yyyy-MM-dd");
}

export function isDefaultDataLimiteIncasso(d: Date | null | undefined, now: Date = new Date()): boolean {
  if (!d) return false;
  return format(d, "yyyy-MM-dd") === defaultDataLimiteIncassoIso(now);
}

/** Data inizio aperta per E/C produttori (solo limite superiore). */
export const EC_PRODUTTORI_PERIODO_DA = "1970-01-01";
