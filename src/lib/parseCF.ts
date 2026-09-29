/**
 * Parsing del Codice Fiscale italiano.
 * Estrae sesso, data di nascita e codice catastale del comune.
 */

const MESI: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, H: 6,
  L: 7, M: 8, P: 9, R: 10, S: 11, T: 12,
};

export interface ParsedCF {
  sesso: "M" | "F";
  dataNascita: string; // YYYY-MM-DD
  codiceCatastale: string; // 4 char
}

export function parseCF(cf: string): ParsedCF | null {
  if (!cf || cf.length !== 16) return null;
  const upper = cf.toUpperCase();

  // Basic format validation: 6 letters, 2 digits, 1 letter, 2 digits, 1 letter, 3 digits, 1 letter
  if (!/^[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]$/.test(upper)) return null;

  const annoStr = upper.substring(6, 8);
  const meseLetter = upper.substring(8, 9);
  const giornoStr = upper.substring(9, 11);
  const codiceCatastale = upper.substring(11, 15);

  const mese = MESI[meseLetter];
  if (!mese) return null;

  let giorno = parseInt(giornoStr, 10);
  let sesso: "M" | "F" = "M";
  if (giorno > 40) {
    giorno -= 40;
    sesso = "F";
  }
  if (giorno < 1 || giorno > 31) return null;

  // Determine century: if anno > current 2-digit year + 5, assume 1900s
  const currentYear2 = new Date().getFullYear() % 100;
  const anno2 = parseInt(annoStr, 10);
  const anno4 = anno2 > currentYear2 + 5 ? 1900 + anno2 : 2000 + anno2;

  const dataNascita = `${anno4}-${String(mese).padStart(2, "0")}-${String(giorno).padStart(2, "0")}`;

  return { sesso, dataNascita, codiceCatastale };
}
