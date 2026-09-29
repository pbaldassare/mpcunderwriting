/** Orario di invio della comunicazione «messa a cassa serale» (fuso Italia). */
export const MESSA_CASSA_SERALE_TZ = "Europe/Rome";
export const MESSA_CASSA_SERALE_HOUR = 19;
export const MESSA_CASSA_SERALE_MINUTE = 30;

export type RomeDateParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export function romeDateParts(now: Date = new Date()): RomeDateParts {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: MESSA_CASSA_SERALE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** True se in Italia è già passata (o è) l'ora di invio serale del giorno corrente. */
export function isAtOrAfterMessaCassaSerale(now: Date = new Date()): boolean {
  const { hour, minute } = romeDateParts(now);
  return (
    hour > MESSA_CASSA_SERALE_HOUR ||
    (hour === MESSA_CASSA_SERALE_HOUR && minute >= MESSA_CASSA_SERALE_MINUTE)
  );
}

/**
 * Instant ISO della prossima (o odierna) 19:30 Europe/Rome.
 * Usa mezzogiorno UTC del giorno civile italiano per calcolare l'offset (CET/CEST).
 */
export function scheduledForMessaCassaSeraleOggi(now: Date = new Date()): string {
  const p = romeDateParts(now);
  const noonUtc = Date.UTC(p.year, p.month - 1, p.day, 12, 0, 0);
  const noonRome = romeDateParts(new Date(noonUtc));
  const offsetHours = noonRome.hour - 12;
  const utcMs = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    MESSA_CASSA_SERALE_HOUR - offsetHours,
    MESSA_CASSA_SERALE_MINUTE,
    0,
  );
  return new Date(utcMs).toISOString();
}

/** Pianifica (prima delle 19:30) oppure invia subito (da 19:30 in poi). */
export function shouldScheduleMessaCassaSerale(serale: boolean, now: Date = new Date()): boolean {
  return !!serale && !isAtOrAfterMessaCassaSerale(now);
}
