const eurFmt = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const eurFmt0 = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const numFmt = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** EUR con 2 decimali. Es: 1.234,56 € */
export const fmtEuro = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : eurFmt.format(v as number);

/** EUR arrotondato all'intero. Es: 1.235 € — usato in dashboard cliente. */
export const fmtEuro0 = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : eurFmt0.format(v as number);

/** Numero senza simbolo, 0 decimali */
export const fmtNum = (v: number | null | undefined): string =>
  v == null || isNaN(v as number) ? "—" : numFmt.format(v as number);

/** Percentuale con N decimali (default 1) */
export const fmtPct = (v: number | null | undefined, digits = 1): string =>
  v == null || isNaN(v as number) ? "—" : `${(v as number).toFixed(digits)}%`;
