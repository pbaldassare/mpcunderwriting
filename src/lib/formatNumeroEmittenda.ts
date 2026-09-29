/**
 * Formatta il progressivo emittenda: IA0001, IA0002, … IA9999, IA10000, …
 * Prefisso IA + almeno 4 cifre zero-padded; oltre 9999 non tronca.
 */
export function formatNumeroEmittenda(n: number): string {
  if (!Number.isFinite(n) || n < 1 || !Number.isInteger(n)) {
    throw new Error("Progressivo emittenda non valido");
  }
  const s = String(n);
  return `IA${s.length < 4 ? s.padStart(4, "0") : s}`;
}

/** True se il numero è un progressivo emittenda (IA seguito da sole cifre). */
export function isNumeroEmittenda(numero: string | null | undefined): boolean {
  return /^IA[0-9]+$/i.test((numero || "").trim());
}
